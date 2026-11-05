import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/app/actions/auth';
import { canAccessClient } from '@/lib/growth/access';
import {
  isSocialProvider,
  PROVIDERS,
  getProviderCredentials,
  getAppUrl,
} from '@/lib/growth/providers';
import {
  createPkcePair,
  signOAuthState,
  verifyOAuthState,
} from '@/lib/growth/state';
import { buildAuthorizeUrl } from '@/lib/growth/oauth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider } = await context.params;

  if (!isSocialProvider(provider)) {
    return NextResponse.json(
      { error: 'Proveedor social inválido.' },
      { status: 400 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const url = new URL(request.url);
  let clientId = url.searchParams.get('client_id') || '';

  if (!clientId) {
    const cookieStore = await cookies();
    clientId = cookieStore.get('slt_active_client_id')?.value || '';
  }

  if (!clientId) {
    return NextResponse.json(
      { error: 'Falta el cliente. Selecciona un cliente activo.' },
      { status: 400 }
    );
  }

  if (!canAccessClient(user, clientId)) {
    return NextResponse.json(
      { error: 'No tienes acceso a este cliente.' },
      { status: 403 }
    );
  }

  const credentials = getProviderCredentials(provider);
  if (!credentials) {
    return NextResponse.json(
      {
        error: `Faltan las credenciales OAuth de ${PROVIDERS[provider].label}. Configúralas en Vercel.`,
      },
      { status: 400 }
    );
  }

  const redirectUri = `${getAppUrl(request)}/api/auth/${provider}/callback`;
  const state = signOAuthState({ clientId, userId: user.id, provider });
  const statePayload = verifyOAuthState(state);

  let codeChallenge: string | undefined;

  // X/Twitter exige PKCE: guardamos el verifier en cookie httpOnly.
  if (provider === 'x' && statePayload) {
    const pkce = createPkcePair();
    codeChallenge = pkce.challenge;

    const cookieStore = await cookies();
    cookieStore.set(
      'slt_oauth_pkce',
      JSON.stringify({ nonce: statePayload.nonce, verifier: pkce.verifier }),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 10,
      }
    );
  }

  const authorizeUrl = buildAuthorizeUrl({
    provider,
    credentials,
    redirectUri,
    state,
    scopes: PROVIDERS[provider].scopes,
    pkceChallenge: codeChallenge,
  });

  return NextResponse.redirect(authorizeUrl);
}
