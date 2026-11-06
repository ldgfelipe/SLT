import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/auth';
import { CampaignsWorkspace } from '@/components/mail-center/CampaignsWorkspace';
import { getActiveClientContext } from '@/lib/app/active-client';
import {
  getCampaignStats,
  listMailCampaigns,
} from '@/app/actions/mail-campaigns';
import {
  listMailConnections,
  listMailLists,
} from '@/app/actions/mail-data';

export const instant = false;

export default async function MailCampaignsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  const { clientId, currentClient } = await getActiveClientContext(currentUser);

  if (!clientId) {
    return (
      <div className="h-full overflow-y-auto bg-[#0a1931] p-8 text-center text-sm text-slate-400">
        Crea un cliente primero.
      </div>
    );
  }

  const [statsRes, campaignsRes, listsRes, connectionsRes] = await Promise.all([
    getCampaignStats(clientId),
    listMailCampaigns(clientId),
    listMailLists(clientId),
    listMailConnections(clientId),
  ]);

  return (
    <div className="h-full overflow-y-auto bg-[#0a1931]">
      <CampaignsWorkspace
        clientId={clientId}
        currentClientName={currentClient?.name || null}
        initialStats={statsRes.success ? statsRes.stats : undefined}
        initialCampaigns={campaignsRes.success ? (campaignsRes.campaigns as any) : []}
        lists={listsRes.success ? listsRes.lists : []}
        connections={connectionsRes.success ? (connectionsRes.connections as any) : []}
      />
    </div>
  );
}
