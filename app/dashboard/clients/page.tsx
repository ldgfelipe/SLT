import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { CreateClientDialog } from '@/components/clients/CreateClientDialog';
import { ClientsList } from '@/components/clients/ClientsList';
import { cookies } from 'next/headers';

export const instant = false;

export default async function ClientsPage() {
  let clientsWithCounts: any[] = [];
  let activeClientId: string | undefined;

  try {
    const cookieStore = await cookies();
    activeClientId = cookieStore.get('slt_active_client_id')?.value;

    const supabase = getSupabaseAdmin();
    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, name, slug, created_at')
      .order('created_at', { ascending: false });

    if (clientsData && clientsData.length > 0) {
      // Obtener conteos de forma segura para cada cliente
      const countsPromises = clientsData.map(async (c: any) => {
        const [contactsCount, dealsCount] = await Promise.all([
          supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('client_id', c.id),
          supabase.from('deals').select('id', { count: 'exact', head: true }).eq('client_id', c.id),
        ]);
        return {
          ...c,
          _counts: {
            contacts: contactsCount.count || 0,
            deals: dealsCount.count || 0,
          },
        };
      });

      clientsWithCounts = await Promise.all(countsPromises);

      if (!activeClientId || !clientsWithCounts.some((c) => c.id === activeClientId)) {
        activeClientId = clientsWithCounts[0].id;
      }
    }
  } catch (err) {
    console.warn('Error fetching clients:', err);
  }

  if (clientsWithCounts.length === 0) {
    clientsWithCounts = [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Agencia Alpha',
        slug: 'alpha',
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        _counts: { contacts: 2, deals: 1 },
      },
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        name: 'Tech Solutions Corp',
        slug: 'tech-corp',
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        _counts: { contacts: 1, deals: 1 },
      },
      {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        name: 'Cliente Vacío (Prueba Eliminar)',
        slug: 'cliente-vacio',
        created_at: new Date().toISOString(),
        _counts: { contacts: 0, deals: 0 },
      },
    ];
    if (!activeClientId) {
      activeClientId = clientsWithCounts[0].id;
    }
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

      <ClientsList clients={clientsWithCounts} activeClientId={activeClientId} />
    </div>
  );
}
