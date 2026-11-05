import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowUpRight,
  CircleAlert,
  DollarSign,
  MousePointerClick,
  Target,
  TrendingUp,
} from 'lucide-react';
import { getCurrentUser } from '@/app/actions/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { CampaignsSyncButton } from '@/components/growth/CampaignsSyncButton';
import {
  CampaignsTable,
  type CampaignTableRow,
} from '@/components/growth/CampaignsTable';
import type { Campaign, Client } from '@/types/database';

export const instant = false;

function money(value: number): string {
  return `$${Number(value || 0).toLocaleString('es-MX', {
    maximumFractionDigits: 0,
  })}`;
}

function number(value: number): string {
  return Number(value || 0).toLocaleString('es-MX');
}

export default async function CampaignsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  let clients: Client[] = [];
  let activeClientId = '';
  let campaigns: CampaignTableRow[] = [];
  let hasMetaAccount = false;
  let totalVisits = 0;

  try {
    const cookieStore = await cookies();
    activeClientId = cookieStore.get('slt_active_client_id')?.value || '';

    const supabase = getSupabaseAdmin();

    let clientQuery = supabase.from('clients').select('*').order('name');
    if (currentUser.role === 'client_admin' && currentUser.client_id) {
      clientQuery = clientQuery.eq('id', currentUser.client_id);
    }

    const { data: clientsData } = await clientQuery;
    clients = (clientsData || []) as Client[];

    if (clients.length > 0) {
      if (currentUser.role === 'client_admin' && currentUser.client_id) {
        activeClientId = currentUser.client_id;
      } else if (
        !activeClientId ||
        !clients.some((client) => client.id === activeClientId)
      ) {
        activeClientId = clients[0].id;
      }
    }

    if (activeClientId) {
      const currentClient =
        clients.find((client) => client.id === activeClientId) || clients[0];

      const [{ data: campaignsData }, { data: metaAccount }, { data: sites }] =
        await Promise.all([
          supabase
            .from('campaigns')
            .select('*')
            .eq('client_id', activeClientId)
            .order('spend', { ascending: false })
            .limit(300),
          supabase
            .from('social_accounts')
            .select('id')
            .eq('client_id', activeClientId)
            .eq('provider', 'facebook')
            .eq('status', 'active')
            .limit(1)
            .maybeSingle(),
          supabase
            .from('tracking_sites')
            .select('id')
            .eq('client_id', activeClientId),
        ]);

      hasMetaAccount = Boolean(metaAccount);

      const siteIds = (sites || []).map((site) => site.id);
      const byCampaignId = new Map<string, number>();
      const byName = new Map<string, number>();

      if (siteIds.length > 0) {
        const { data: events } = await supabase
          .from('tracking_events')
          .select('campaign_id, utm_campaign')
          .in('tracking_site_id', siteIds)
          .order('created_at', { ascending: false })
          .limit(20000);

        for (const event of events || []) {
          if (event.campaign_id) {
            byCampaignId.set(
              event.campaign_id,
              (byCampaignId.get(event.campaign_id) || 0) + 1
            );
          }
          if (event.utm_campaign) {
            const key = event.utm_campaign.toLowerCase();
            byName.set(key, (byName.get(key) || 0) + 1);
          }
        }
      }

      const rows = ((campaignsData || []) as Campaign[]).map((campaign) => {
        const liveVisits =
          byCampaignId.get(campaign.id) ||
          byName.get(campaign.name.toLowerCase()) ||
          Number(campaign.visits || 0);

        return {
          ...campaign,
          visits: liveVisits,
          clientName: currentClient?.name || 'Cliente',
        };
      });

      campaigns = rows;
      totalVisits = rows.reduce((total, row) => total + row.visits, 0);
    }
  } catch (error) {
    console.warn('[campaigns] load:', error);
  }

  const totalSpend = campaigns.reduce(
    (total, campaign) => total + Number(campaign.spend || 0),
    0
  );
  const totalLeads = campaigns.reduce(
    (total, campaign) => total + Number(campaign.leads || 0),
    0
  );
  const totalRevenue = campaigns.reduce(
    (total, campaign) => total + Number(campaign.revenue || 0),
    0
  );
  const averageRoas =
    totalSpend > 0 && totalRevenue > 0 ? totalRevenue / totalSpend : 0;

  return (
    <div className="h-full overflow-y-auto bg-[#0a1931] p-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Campañas Ads
              </h1>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                Meta Ads
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Gasto, leads y ROAS de Meta cruzados con las visitas atribuidas por
              UTM en el sitio del cliente.
            </p>
          </div>

          {activeClientId && (
            <CampaignsSyncButton clientId={activeClientId} />
          )}
        </div>

        {!hasMetaAccount && activeClientId && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <span className="flex items-start gap-2">
              <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
              No hay una cuenta de Facebook conectada para este cliente.
              Conéctala para sincronizar campañas.
            </span>
            <Link
              href="/dashboard/social-accounts"
              className="inline-flex items-center gap-1 rounded-lg border border-amber-400/40 px-2.5 py-1 text-[11px] font-semibold text-amber-100 transition hover:bg-amber-400/10"
            >
              Ir a Cuentas Sociales <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            icon={<DollarSign className="h-4 w-4" />}
            label="Gasto total"
            value={money(totalSpend)}
          />
          <Kpi
            icon={<Target className="h-4 w-4" />}
            label="Leads"
            value={number(totalLeads)}
          />
          <Kpi
            icon={<TrendingUp className="h-4 w-4" />}
            label="ROAS promedio"
            value={averageRoas > 0 ? `${averageRoas.toFixed(2)}x` : '—'}
          />
          <Kpi
            icon={<MousePointerClick className="h-4 w-4" />}
            label="Visitas atribuidas"
            value={number(totalVisits)}
          />
        </div>

        <CampaignsTable campaigns={campaigns} />

        <div className="grid gap-3 sm:grid-cols-3">
          <Info
            title="Atribución automática"
            text="Un trigger vincula cada visita con campaign_id cuando utm_campaign coincide con el nombre o el ID externo de la campaña."
          />
          <Info
            title="UTM recomendado"
            text="Usa el mismo nombre de campaña en utm_campaign y en Meta Ads para que el cruce sea exacto."
          />
          <Info
            title="Sincronización horaria"
            text="El cron consulta Meta Marketing API cada hora. También puedes sincronizar manualmente."
          />
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-[#0c1f3d] to-[#0a1931] px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <span className="text-[#00d4ff]">{icon}</span>
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function Info({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0c1f3d]/60 p-4">
      <p className="text-xs font-semibold text-white">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{text}</p>
    </div>
  );
}
