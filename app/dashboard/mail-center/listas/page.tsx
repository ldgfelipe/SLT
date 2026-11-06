import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/auth';
import { ListsWorkspace } from '@/components/mail-center/ListsWorkspace';
import { getActiveClientContext } from '@/lib/app/active-client';

export const instant = false;

export default async function MailListsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  const { clientId, currentClient } = await getActiveClientContext(currentUser);

  return (
    <div className="h-full overflow-y-auto bg-[#0a1931]">
      {clientId ? (
        <ListsWorkspace clientId={clientId} currentClient={currentClient} />
      ) : (
        <div className="p-8 text-center text-sm text-slate-400">
          Crea un cliente primero para administrar listas.
        </div>
      )}
    </div>
  );
}
