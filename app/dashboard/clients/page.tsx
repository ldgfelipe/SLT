import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CreateClientDialog } from '@/components/clients/CreateClientDialog';
import { ClientsList } from '@/components/clients/ClientsList';
import { Client } from '@/types/database';
import { cookies } from 'next/headers';

export const instant = false;

export default async function ClientsPage() {
  let clients: Client[] = [];
  let activeClientId: string | undefined;

  try {
    const cookieStore = await cookies();
    activeClientId = cookieStore.get('slt_active_client_id')?.value;

    const supabase = await createServerSupabaseClient();
    const { data: clientsData, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && clientsData && clientsData.length > 0) {
      clients = clientsData;
      if (!activeClientId) {
        activeClientId = clients[0].id;
      }
    }
  } catch (err) {
    console.warn('Error fetching clients:', err);
  }

  // Clientes Demo si no hay base de datos configurada aún
  if (clients.length === 0) {
    clients = [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Agencia Alpha',
        slug: 'alpha',
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        name: 'Tech Solutions Corp',
        slug: 'tech-corp',
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
    ];
    if (!activeClientId) {
      activeClientId = clients[0].id;
    }
  }

  return (
    <div className="flex flex-col h-full p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Clientes</h1>
          <p className="text-sm text-slate-500">
            Crea clientes y conmuta entre ellos para aislar sus pipelines, contactos y métricas.
          </p>
        </div>

        <CreateClientDialog />
      </div>

      <ClientsList clients={clients} activeClientId={activeClientId} />
    </div>
  );
}
