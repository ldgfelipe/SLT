import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { PublisherCalendar } from '@/components/growth/PublisherCalendar';
import type { Client, Post, SocialAccount } from '@/types/database';

export const instant = false;

export default async function CalendarPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  let clients: Client[] = [];
  let activeClientId = '';
  let posts: Post[] = [];
  let accounts: SocialAccount[] = [];

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

    if (activeClientId) {
      const [{ data: postsData }, { data: accountsData }] = await Promise.all([
        supabase
          .from('posts')
          .select(
            '*, social_account:social_accounts(id,account_name,provider), campaign:campaigns(id,name)'
          )
          .eq('client_id', activeClientId)
          .order('scheduled_at', { ascending: true, nullsFirst: true })
          .limit(500),
        supabase
          .from('social_accounts')
          .select(
            'id, client_id, provider, account_name, page_id, ig_user_id, token_expires_at, status, metadata, created_at, updated_at'
          )
          .eq('client_id', activeClientId)
          .order('created_at', { ascending: false }),
      ]);

      posts = (postsData || []) as unknown as Post[];
      accounts = (accountsData || []) as SocialAccount[];
    }
  } catch (error) {
    console.warn('[calendar] load:', error);
  }

  if (!activeClientId) {
    return (
      <div className="h-full overflow-y-auto bg-[#0a1931] p-6 text-slate-100">
        <div className="rounded-2xl border border-white/10 bg-[#0c1f3d] px-6 py-12 text-center text-sm text-slate-400">
          Crea un cliente primero para usar el calendario publicador.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#0a1931] p-6 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <PublisherCalendar
          clientId={activeClientId}
          clients={clients}
          isRoot={currentUser.role === 'root'}
          initialPosts={posts}
          accounts={accounts}
        />
      </div>
    </div>
  );
}
