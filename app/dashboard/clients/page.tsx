import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { CreateClientDialog } from '@/components/clients/CreateClientDialog';
import { ClientsList } from '@/components/clients/ClientsList';
import { getCurrentUser } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export const instant = false;

export default async function ClientsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');
  if (currentUser.role !== 'root') redirect('/dashboard');

  let clientsWithCounts: any[] = [];
  let activeClientId: string | undefined;
  let fetchError: string | null = null;

  try {
    const cookieStore = await cookies();
    activeClientId = cookieStore.get('slt_active_client_id')?.value;

    const supabase = getSupabaseAdmin();
    const { data: clientsData, error } = await supabase
      .from('clients')
      .select('id, name, slug, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      fetchError = error.message;
      console.error('[ClientsPage] fetch error:', error);
    } else if (clientsData && clientsData.length > 0) {
      // Obtener conteos de forma segura para cada cliente (no romper si faltan tablas)
      const countsPromises = clientsData.map(async (c: any) => {
        let contacts = 0;
        let deals = 0;
        try {
          const { count } = await supabase
            .from('contacts')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', c.id);
          contacts = count || 0;
        } catch (e) {
          console.warn('[ClientsPage] contacts count error for', c.id, e);
        }
        try {
          const { count } = await supabase
            .from('deals')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', c.id);
          deals = count || 0;
        } catch (e) {
          console.warn('[ClientsPage] deals count error for', c.id, e);
        }
        return {
          ...c,
          _counts: {
            contacts,
            deals,
          },
        };
      });

      clientsWithCounts = await Promise.all(countsPromises);

      if (!activeClientId || !clientsWithCounts.some((c) => c.id === activeClientId)) {
        activeClientId = clientsWithCounts[0].id;
      }
    }
  } catch (err: any) {
    fetchError = err.message || 'Error desconocido';
    console.warn('[ClientsPage] Error fetching clients:', err);
  }

  return (
    <div className="flex flex-col h-full p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Clientes</h1>
          <p className="text-sm text-slate-500">
            Crea, administra y elimina clientes que no tengan datos asociados para mantener limpio el entorno.
          </p>
        </div>

        <CreateClientDialog />
      </div>

      {fetchError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 p-4">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">Error al cargar clientes</p>
          <p className="text-xs text-rose-600 dark:text-rose-500 mt-1 font-mono">{fetchError}</p>
          <p className="text-xs text-rose-500 dark:text-rose-600 mt-2">
            Verifica que la tabla <code>clients</code> exista en Supabase y que las variables de entorno estén configuradas en Vercel.
          </p>
        </div>
      )}

      <ClientsList clients={clientsWithCounts} activeClientId={activeClientId} />
    </div>
  );
}

