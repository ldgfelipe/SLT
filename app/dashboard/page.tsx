import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { getCurrentUser } from '@/app/actions/auth';
import { Stage, Client } from '@/types/database';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const instant = false;

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  let stages: Stage[] = [];
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
      // 1. Obtener el pipeline principal del cliente seleccionado
      const { data: pipeline } = await supabase
        .from('pipelines')
        .select('id')
        .eq('client_id', activeClientId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (pipeline) {
        // 2. Obtener etapas y deals específicos de este cliente y pipeline
        const { data: stagesData } = await supabase
          .from('stages')
          .select(`
            id,
            pipeline_id,
            name,
            order,
            deals (
              id,
              client_id,
              title,
              value,
              stage_id,
              status,
              created_at,
              contact:contacts (
                id,
                first_name,
                last_name,
                email,
                phone
              )
            )
          `)
          .eq('pipeline_id', pipeline.id)
          .order('order', { ascending: true });

        if (stagesData) {
          stages = stagesData as unknown as Stage[];
        }
      }
    }
  } catch (err) {
    console.warn('Supabase query error:', err);
  }

  return (
    <div className="flex flex-col h-full p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Pipeline de Ventas</h1>
            {currentClient && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 font-medium">
                Cliente: {currentClient.name}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            Ambiente exclusivo para las oportunidades y leads de este cliente.
          </p>
        </div>
      </div>

      <KanbanBoard initialStages={stages} />
    </div>
  );
}
