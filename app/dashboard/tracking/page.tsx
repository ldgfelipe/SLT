import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { CreateTrackingSiteDialog } from '@/components/tracking/CreateTrackingSiteDialog';
import { TrackingSitesList } from '@/components/tracking/TrackingSitesList';
import { getCurrentUser } from '@/app/actions/auth';
import { TrackingSite, Client } from '@/types/database';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const instant = false;

export default async function TrackingPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  let sites: TrackingSite[] = [];
  let currentClient: Client | null = null;
  let activeClientId: string | undefined;

  try {
    const cookieStore = await cookies();
    activeClientId = cookieStore.get('slt_active_client_id')?.value;

    const supabase = getSupabaseAdmin();
    
    let clientQuery = supabase.from('clients').select('*').order('name');
    if (currentUser.role === 'client_admin' && currentUser.client_id) {
      clientQuery = clientQuery.eq('id', currentUser.client_id);
    }
    const { data: clients } = await clientQuery;

    if (clients && clients.length > 0) {
      if (currentUser.role === 'client_admin' && currentUser.client_id) {
        activeClientId = currentUser.client_id;
      } else if (!activeClientId || !clients.some((c) => c.id === activeClientId)) {
        activeClientId = clients[0].id;
      }
      currentClient = clients.find((c) => c.id === activeClientId) || clients[0];
    }

    if (activeClientId) {
      const { data: sitesData } = await supabase
        .from('tracking_sites')
        .select('*')
        .eq('client_id', activeClientId)
        .order('created_at', { ascending: false });

      if (sitesData) sites = sitesData;
    }
  } catch (err) {
    console.warn('Error fetching tracking sites:', err);
  }

  return (
    <div className="flex flex-col h-full p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Pixel &amp; Tracking</h1>
            {currentClient && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 font-medium">
                Cliente: {currentClient.name}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            Genera tags JavaScript del Pixel para incrustar en sitios de clientes y registrar visitas de leads.
          </p>
        </div>

        {activeClientId && <CreateTrackingSiteDialog clientId={activeClientId} />}
      </div>

      <TrackingSitesList sites={sites} />
    </div>
  );
}
