import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/app/actions/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { canAccessClient } from '@/lib/growth/access';
import {
  getAppUrl,
  getProviderCredentials,
  isSocialProvider,
  PROVIDERS,
} from '@/lib/growth/providers';
import { verifyOAuthState } from '@/lib/growth/state';
import { discoverAccounts, exchangeCodeForToken } from '@/lib/growth/oauth';
import { encryptToken } from '@/lib/growth/crypto';

function redirectWithError(request: NextRequest, message: string) {
  const target = new URL('/dashboard/social-accounts', getAppUrl(request));
  target.searchParams.set('oauth_error', message.slice(0, 300));
  return NextResponse.redirect(target);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider } = await context.params;

  if (!isSocialProvider(provider)) {
    return redirectWithError(request, 'Proveedor social inválido.');
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(
      new URL('/login', getAppUrl(request))
    );
  }

  const url = new URL(request.url);
  const oauthError =
    url.searchParams.get('error_description') || url.searchParams.get('error');

  if (oauthError) {
    return redirectWithError(request, oauthError);
  }

  const state = verifyOAuthState(url.searchParams.get('state'));
  if (!state || state.provider !== provider) {
    return redirectWithError(
      request,
      'El estado OAuth es inválido o expiró. Intenta conectar la cuenta de nuevo.'
    );
  }

  if (!canAccessClient(user, state.clientId)) {
    return redirectWithError(request, 'No tienes acceso a este cliente.');
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return redirectWithError(request, 'La red social no devolvió el código.');
  }

  const credentials = await getProviderCredentials(provider);
  if (!credentials) {
    return redirectWithError(
      request,
      `Faltan las credenciales de ${PROVIDERS[provider].label}.`
    );
  }

  const redirectUri = `${getAppUrl(request)}/api/auth/${provider}/callback`;
  const cookieStore = await cookies();

  let codeVerifier: string | undefined;

  if (provider === 'x') {
    const raw = cookieStore.get('slt_oauth_pkce')?.value;
    cookieStore.delete('slt_oauth_pkce');

    if (!raw) {
      return redirectWithError(request, 'Falta el verificador PKCE de X.');
    }

    try {
      const parsed = JSON.parse(raw) as { nonce?: string; verifier?: string };
      if (!parsed.verifier || parsed.nonce !== state.nonce) {
        return redirectWithError(request, 'El verificador PKCE no coincide.');
      }
      codeVerifier = parsed.verifier;
    } catch {
      return redirectWithError(request, 'El verificador PKCE es inválido.');
    }
  }

  try {
    const token = await exchangeCodeForToken({
      provider,
      credentials,
      code,
      redirectUri,
      codeVerifier,
    });

    const discovered = await discoverAccounts({ provider, token });

    if (discovered.length === 0) {
      return redirectWithError(
        request,
        `No encontramos cuentas publicables en ${PROVIDERS[provider].label}. Revisa los permisos otorgados.`
      );
    }

    // Nunca guardamos el token en claro: se cifra antes de tocar la base.
    const encryptedAccounts = discovered.map((account) => {
      const { access_token, refresh_token, ...rest } = account;
      return {
        ...rest,
        access_token_encrypted: encryptToken(access_token),
        refresh_token_encrypted: refresh_token
          ? encryptToken(refresh_token)
          : null,
      };
    });

    const supabase = getSupabaseAdmin();
    const { data: session, error } = await supabase
      .from('social_oauth_sessions')
      .insert({
        client_id: state.clientId,
        user_id: user.id,
        provider,
        accounts: encryptedAccounts,
      })
      .select('id')
      .single();

    if (error || !session) {
      console.error('[oauth callback] session insert:', error);
      return redirectWithError(
        request,
        'No se pudo guardar la sesión OAuth en la base de datos.'
      );
    }

    const target = new URL('/dashboard/social-accounts', getAppUrl(request));
    target.searchParams.set('oauth_session', session.id);
    return NextResponse.redirect(target);
  } catch (error: any) {
    console.error(`[oauth callback:${provider}]`, error);
    return redirectWithError(
      request,
      error?.message || 'No se pudo completar la conexión con la red social.'
    );
  }
}
