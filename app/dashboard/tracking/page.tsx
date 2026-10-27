import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { CreateTrackingSiteDialog } from '@/components/tracking/CreateTrackingSiteDialog';
import { TrackingSitesList } from '@/components/tracking/TrackingSitesList';
import { TrackingEventsList, TrackingEventRow } from '@/components/tracking/TrackingEventsList';
import { getCurrentUser } from '@/app/actions/auth';
import { TrackingSite, Client } from '@/types/database';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const instant = false;

export default async function TrackingPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  let sites: TrackingSite[] = [];
  let events: TrackingEventRow[] = [];
  let currentClient: Client | null = null;
  let activeClientId: string | undefined;
  let totalVisits = 0;
  let uniqueVisitors = 0;
  let totalConversions = 0;

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

      // Tráfico capturado (solo usuarios reales filtrados por honey pot en el API)
      if (sites.length > 0) {
        const siteIds = sites.map((s) => s.id);
        const { data: eventsData } = await supabase
          .from('tracking_events')
          .select('id, tracking_site_id, visitor_id, contact_id, event_type, url, created_at, tracking_sites(domain)')
          .in('tracking_site_id', siteIds)
          .order('created_at', { ascending: false })
          .limit(200);

        if (eventsData) {
          events = eventsData as unknown as TrackingEventRow[];
          totalVisits = events.filter((e) => e.event_type === 'pageview').length;
          totalConversions = events.filter((e) => e.event_type === 'conversion').length;
          uniqueVisitors = new Set(events.map((e) => e.visitor_id)).size;
        }
      }
    }
  } catch (err) {
    console.warn('Error fetching tracking data:', err);
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

      {/* Métricas de tráfico (usuarios reales) */}
      {sites.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Visitas</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalVisits}</p>
          </div>
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Visitantes únicos</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{uniqueVisitors}</p>
          </div>
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Conversiones</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalConversions}</p>
          </div>
        </div>
      )}

      {/* Eventos capturados */}
      {sites.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight">Tráfico capturado (usuarios reales)</h2>
          <TrackingEventsList events={events} sites={sites} />
        </div>
      )}
    </div>
  );
}
