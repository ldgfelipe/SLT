import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { CreateUserDialog } from '@/components/users/CreateUserDialog';
import { UsersList } from '@/components/users/UsersList';
import { getCurrentUser } from '@/app/actions/auth';
import { AppUser, Client } from '@/types/database';
import { redirect } from 'next/navigation';

export const instant = false;

export default async function UsersPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  // Solo Root puede ver la gestión de usuarios
  if (currentUser.role !== 'root') {
    redirect('/dashboard');
  }

  let users: AppUser[] = [];
  let clients: Client[] = [];

  try {
    const supabase = getSupabaseAdmin();

    const [usersRes, clientsRes] = await Promise.all([
      supabase.from('users').select('id, name, email, role, client_id, created_at').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
    ]);

    if (usersRes.data) users = usersRes.data as AppUser[];
    if (clientsRes.data) clients = clientsRes.data as Client[];
  } catch (err) {
    console.error('Error fetching users or clients:', err);
  }

  return (
    <div className="flex flex-col h-full p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Usuarios</h1>
          <p className="text-sm text-slate-500">
            Administra los accesos al sistema. Los usuarios asignados a un cliente solo verán su ambiente respectivo.
          </p>
        </div>

        <CreateUserDialog clients={clients} />
      </div>

      <UsersList users={users} clients={clients} currentUserId={currentUser.id} />
    </div>
  );
}
