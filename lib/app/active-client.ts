import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { AppUser, Client } from '@/types/database';

/**
 * Resuelve el cliente activo para páginas del dashboard (mismo patrón que
 * tracking/contacts, con fallback seguro).
 */
export async function getActiveClientContext(
  currentUser: AppUser
): Promise<{ clientId?: string; clients: Client[]; currentClient: Client | null }> {
  let clients: Client[] = [];
  let activeClientId: string | undefined;

  try {
    const cookieStore = await cookies();
    activeClientId = cookieStore.get('slt_active_client_id')?.value;

    const supabase = getSupabaseAdmin();
    let query = supabase.from('clients').select('*').order('name');
    if (currentUser.role === 'client_admin' && currentUser.client_id) {
      query = query.eq('id', currentUser.client_id);
    }

    const { data } = await query;
    clients = (data || []) as Client[];

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
  } catch (error) {
    console.warn('[active-client] error:', error);
  }

  const currentClient =
    clients.find((client) => client.id === activeClientId) || null;

  return { clientId: activeClientId, clients, currentClient };
}
