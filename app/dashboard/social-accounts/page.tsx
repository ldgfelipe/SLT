import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AlertCircle, Sparkles } from 'lucide-react';
import { getCurrentUser } from '@/app/actions/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { SocialAccountsGrid } from '@/components/growth/SocialAccountsGrid';
import { ConnectAccountDialog } from '@/components/growth/ConnectAccountDialog';
import { configuredProviders } from '@/lib/growth/providers';
import type {
  Client,
  PendingOAuthSession,
  SocialAccount,
  SocialProvider,
} from '@/types/database';

export const instant = false;

interface PageProps {
  searchParams: Promise<{
    oauth_session?: string;
    oauth_error?: string;
  }>;
}

export default async function SocialAccountsPage({ searchParams }: PageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  const params = await searchParams;
  let clients: Client[] = [];
  let activeClientId = '';
  let accounts: SocialAccount[] = [];
  let pendingSession: PendingOAuthSession | null = null;

  try {
    const cookieStore = await cookies();
    activeClientId = cookieStore.get('slt_active_client_id')?.value || '';

    const supabase = getSupabaseAdmin();

    let clientQuery = supabase.from('clients').select('*').order('name');
    if (currentUser.role === 'client_admin' && currentUser.client_id) {
      clientQuery = clientQuery.eq('id', currentUser.client_id);
    }

    const { data: clientsData } = await clientQuery;
    clients = (clientsData || []) as Client[];

    if (clients.length > 0) {
      if (currentUser.role === 'client_admin' && currentUser.client_id) {
        activeClientId = currentUser.client_id;
      } else if (
        !activeClientId ||
        !clients.some((client) => client.id === activeClientId)
      ) {
        activeClientId = clients[0].id;
      }
    }

    if (params.oauth_session) {
      const { data: session } = await supabase
        .from('social_oauth_sessions')
        .select('id, client_id, provider, accounts, expires_at')
        .eq('id', params.oauth_session)
        .maybeSingle();

      if (session) {
        const canAccess =
          currentUser.role === 'root' ||
          currentUser.client_id === session.client_id;

        if (canAccess) {
          const rawAccounts = Array.isArray(session.accounts)
            ? session.accounts
            : [];

          pendingSession = {
            id: session.id,
            provider: session.provider as SocialProvider,
            expires_at: session.expires_at,
            accounts: rawAccounts.map((account: any) => ({
              account_name: String(account.account_name || 'Cuenta'),
              page_id: account.page_id || null,
              ig_user_id: account.ig_user_id || null,
              token_expires_at: account.token_expires_at || null,
              metadata: account.metadata || {},
            })),
          };
        }
      }
    }

    if (activeClientId) {
      const { data: accountsData } = await supabase
        .from('social_accounts')
        .select(
          'id, client_id, provider, account_name, page_id, ig_user_id, token_expires_at, status, metadata, created_at, updated_at'
        )
        .eq('client_id', activeClientId)
        .order('created_at', { ascending: false });

      accounts = (accountsData || []) as SocialAccount[];
    }
  } catch (error) {
    console.warn('[social-accounts] load:', error);
  }

  const currentClient = clients.find((client) => client.id === activeClientId);
  const configured = await configuredProviders();

  return (
    <div className="h-full overflow-y-auto bg-[#0a1931] p-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Cuentas Sociales
              </h1>
              {currentClient && (
                <span className="rounded-full border border-[#00d4ff]/30 bg-[#00d4ff]/10 px-2.5 py-1 text-[11px] font-semibold text-[#00d4ff]">
                  {currentClient.name}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Conecta las cuentas donde Inventser publicará el contenido del
              calendario. Los tokens se cifran en el servidor.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {configured.length === 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300">
                <AlertCircle className="h-3.5 w-3.5" />
                Configura credenciales OAuth
              </span>
            )}
            {activeClientId && (
              <ConnectAccountDialog
                clients={clients}
                activeClientId={activeClientId}
                configured={configured}
                isRoot={currentUser.role === 'root'}
                pendingSession={pendingSession}
              />
            )}
          </div>
        </div>

        {params.oauth_error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{params.oauth_error}</span>
          </div>
        )}

        {pendingSession && (
          <div className="flex items-start gap-2 rounded-xl border border-[#00d4ff]/30 bg-[#00d4ff]/10 px-4 py-3 text-sm text-cyan-100">
            <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#00d4ff]" />
            <span>
              Autorización completada. Elige en el modal qué cuenta guardar.
            </span>
          </div>
        )}

        {clients.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#0c1f3d] px-6 py-12 text-center text-sm text-slate-400">
            Crea un cliente primero para conectar cuentas sociales.
          </div>
        ) : (
          <SocialAccountsGrid accounts={accounts} />
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <InfoCard
            title="Tokens cifrados"
            text="AES-256-GCM con TOKEN_ENCRYPTION_KEY. Nunca se envían al frontend."
          />
          <InfoCard
            title="Aislamiento por cliente"
            text="Cada cuenta pertenece a un cliente y no se mezcla con otros."
          />
          <InfoCard
            title="Renovación diaria"
            text="Un cron renueva los tokens que caducan en los próximos 7 días."
          />
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0c1f3d]/60 p-4">
      <p className="text-xs font-semibold text-white">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{text}</p>
    </div>
  );
}
