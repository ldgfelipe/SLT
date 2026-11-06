import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/auth';
import { ConnectionsWorkspace } from '@/components/mail-center/ConnectionsWorkspace';
import { getActiveClientContext } from '@/lib/app/active-client';

export const instant = false;

export default async function MailIntegracionesPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  const { clientId } = await getActiveClientContext(currentUser);

  return (
    <div className="h-full overflow-y-auto bg-[#0a1931]">
      {clientId ? (
        <ConnectionsWorkspace clientId={clientId} />
      ) : (
        <div className="p-8 text-center text-sm text-slate-400">
          Crea un cliente primero para configurar integraciones.
        </div>
      )}
    </div>
  );
}
