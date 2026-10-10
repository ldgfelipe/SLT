import { createServerSupabaseClient } from '@/lib/supabase/server';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { Stage, Client } from '@/types/database';
import { cookies } from 'next/headers';

export const instant = false;

export default async function DashboardPage() {
  let stages: Stage[] = [];
  let connectionWarning = false;
  let currentClient: Client | null = null;

  try {
    const cookieStore = await cookies();
    let activeClientId = cookieStore.get('slt_active_client_id')?.value;

    const supabase = await createServerSupabaseClient();

    // Obtener los clientes disponibles
    const { data: clients } = await supabase.from('clients').select('*').order('name');

    if (clients && clients.length > 0) {
      if (!activeClientId || !clients.some((c) => c.id === activeClientId)) {
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
        const { data: stagesData, error } = await supabase
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

        if (error) {
          console.error('Supabase query error:', error);
          connectionWarning = true;
        } else if (stagesData) {
          stages = stagesData as unknown as Stage[];
        }
      }
    }
  } catch (err) {
    console.warn('Supabase not configured or query error:', err);
    connectionWarning = true;
  }

  // Fallback demo aislado según el cliente activo
  if (stages.length === 0) {
    const isTechCorp = currentClient?.slug === 'tech-corp';
    stages = isTechCorp
      ? [
          {
            id: 'tech-stage-1',
            pipeline_id: 'tech-p1',
            name: 'Demo Solicitada',
            order: 1,
            deals: [
              {
                id: 'deal-tech-1',
                client_id: 'tech',
                title: 'Global Logistics - 50 Seats',
                value: 12000,
                stage_id: 'tech-stage-1',
                contact_id: 'tc1',
                status: 'open',
                created_at: new Date().toISOString(),
                contact: {
                  id: 'tc1',
                  client_id: 'tech',
                  first_name: 'Roberto',
                  last_name: 'Silva',
                  email: 'roberto@globallogistics.com',
                  phone: '+1 800 555 0199',
                },
              },
            ],
          },
          {
            id: 'tech-stage-2',
            pipeline_id: 'tech-p1',
            name: 'Evaluación Técnica',
            order: 2,
            deals: [],
          },
          {
            id: 'tech-stage-3',
            pipeline_id: 'tech-p1',
            name: 'Negociación Legal',
            order: 3,
            deals: [],
          },
          {
            id: 'tech-stage-4',
            pipeline_id: 'tech-p1',
            name: 'Firmado',
            order: 4,
            deals: [],
          },
        ]
      : [
          {
            id: 'alpha-stage-1',
            pipeline_id: 'alpha-p1',
            name: 'Prospectos',
            order: 1,
            deals: [
              {
                id: 'deal-alpha-1',
                client_id: 'alpha',
                title: 'Campaña Redes Sociales Q2',
                value: 3500,
                stage_id: 'alpha-stage-1',
                contact_id: 'ac1',
                status: 'open',
                created_at: new Date().toISOString(),
                contact: {
                  id: 'ac1',
                  client_id: 'alpha',
                  first_name: 'Elena',
                  last_name: 'Torres',
                  email: 'elena@boutique.mx',
                  phone: '+52 55 9876 5432',
                },
              },
            ],
          },
          {
            id: 'alpha-stage-2',
            pipeline_id: 'alpha-p1',
            name: 'Reunión Agendada',
            order: 2,
            deals: [],
          },
          {
            id: 'alpha-stage-3',
            pipeline_id: 'alpha-p1',
            name: 'Presupuesto',
            order: 3,
            deals: [],
          },
          {
            id: 'alpha-stage-4',
            pipeline_id: 'alpha-p1',
            name: 'Cerrado',
            order: 4,
            deals: [],
          },
        ];
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

        {connectionWarning && (
          <div className="text-xs bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <span>⚠️ Modo Vista Previa: Configura tus variables de Supabase en <strong>Vercel Settings &gt; Environment Variables</strong></span>
          </div>
        )}
      </div>

      <KanbanBoard initialStages={stages} />
    </div>
  );
}
