import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { getCurrentUser } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { Client } from '@/types/database';

export const instant = false;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await getCurrentUser();

  // Si no hay sesión iniciada, redirigir al login
  if (!currentUser) {
    redirect('/login');
  }

  let clients: Client[] = [];
  let activeClientId: string | undefined;

  try {
    const cookieStore = await cookies();
    activeClientId = cookieStore.get('slt_active_client_id')?.value;

    const supabase = getSupabaseAdmin();

    // Si es Root, obtiene todos los clientes; si es client_admin, solo su cliente asignado
    let query = supabase.from('clients').select('*').order('name');
    if (currentUser.role === 'client_admin' && currentUser.client_id) {
      query = query.eq('id', currentUser.client_id);
    }

    const { data: clientsData } = await query;

    if (clientsData && clientsData.length > 0) {
      clients = clientsData;

      // Si es client_admin, su ambiente SIEMPRE es su client_id
      if (currentUser.role === 'client_admin' && currentUser.client_id) {
        activeClientId = currentUser.client_id;
      } else if (!activeClientId || !clients.some((c) => c.id === activeClientId)) {
        activeClientId = clients[0].id;
      }
    }
  } catch (err) {
    console.error('Error fetching clients in layout:', err);
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <DashboardSidebar
        clients={clients}
        activeClientId={activeClientId}
        currentUser={currentUser}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
