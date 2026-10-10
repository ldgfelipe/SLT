import { createServerSupabaseClient } from '@/lib/supabase/server';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { Stage } from '@/types/database';

export const instant = false;


export default async function DashboardPage() {
  let stages: Stage[] = [];
  let connectionWarning = false;

  try {
    const supabase = await createServerSupabaseClient();

    const { data: stagesData, error } = await supabase
      .from('stages')
      .select(`
        id,
        pipeline_id,
        name,
        order,
        deals (
          id,
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
      .order('order', { ascending: true });

    if (error) {
      console.error('Supabase query error:', error);
      connectionWarning = true;
    } else if (stagesData) {
      stages = stagesData as unknown as Stage[];
    }
  } catch (err) {
    console.warn('Supabase not configured yet or connection failed:', err);
    connectionWarning = true;
  }

  // Si no hay datos de Supabase (por ejemplo antes de configurar las credenciales), mostrar columnas de demo
  if (stages.length === 0) {
    stages = [
      {
        id: 'stage-1',
        pipeline_id: 'default',
        name: 'Lead Entrante',
        order: 1,
        deals: [
          {
            id: 'deal-1',
            title: 'Lead: Acme Corp Requerimiento',
            value: 2500,
            stage_id: 'stage-1',
            contact_id: 'c1',
            status: 'open',
            created_at: new Date().toISOString(),
            contact: {
              id: 'c1',
              first_name: 'Carlos',
              last_name: 'Gómez',
              email: 'carlos@acme.com',
              phone: '+1 234 5678',
            },
          },
        ],
      },
      {
        id: 'stage-2',
        pipeline_id: 'default',
        name: 'Contacto Realizado',
        order: 2,
        deals: [
          {
            id: 'deal-2',
            title: 'Interesado en Plan Pro',
            value: 4800,
            stage_id: 'stage-2',
            contact_id: 'c2',
            status: 'open',
            created_at: new Date().toISOString(),
            contact: {
              id: 'c2',
              first_name: 'Mariana',
              last_name: 'Ríos',
              email: 'marianar@startup.io',
              phone: '+52 55 1234 5678',
            },
          },
        ],
      },
      {
        id: 'stage-3',
        pipeline_id: 'default',
        name: 'Propuesta Enviada',
        order: 3,
        deals: [],
      },
      {
        id: 'stage-4',
        pipeline_id: 'default',
        name: 'Cerrado Ganado',
        order: 4,
        deals: [],
      },
    ];
  }

  return (
    <div className="flex flex-col h-full p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipeline de Ventas</h1>
          <p className="text-sm text-slate-500">
            Gestiona tus leads y oportunidades en tiempo real arrastrando las tarjetas entre etapas.
          </p>
        </div>

        {connectionWarning && (
          <div className="text-xs bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <span>⚠️ Modo Vista Previa: Configura tus credenciales de Supabase en <code className="font-mono">.env.local</code></span>
          </div>
        )}
      </div>

      <KanbanBoard initialStages={stages} />
    </div>
  );
}
