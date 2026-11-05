import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { decryptToken } from './crypto';
import { graphVersion } from './providers';

export interface MetaSyncResult {
  clientId: string;
  synced: number;
  error?: string;
}

interface MetaCampaign {
  id: string;
  name?: string;
  objective?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string | number;
  lifetime_budget?: string | number;
  start_time?: string;
  stop_time?: string;
}

interface MetaInsight {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: Array<{ action_type?: string; value?: string }>;
  action_values?: Array<{ action_type?: string; value?: string }>;
}

async function graphGet(url: string, token: string): Promise<any> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      data?.error?.message || `Meta respondió ${response.status}`
    );
  }

  return data;
}

async function fetchAllPages(
  url: string,
  token: string,
  maxPages = 5
): Promise<any[]> {
  const rows: any[] = [];
  let next: string | null = url;
  let page = 0;

  while (next && page < maxPages) {
    const data = await graphGet(next, token);
    if (Array.isArray(data?.data)) rows.push(...data.data);
    next = data?.paging?.next || null;
    page += 1;
  }

  return rows;
}

const LEAD_ACTIONS = new Set([
  'lead',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
  'offsite_conversion.fb_pixel_complete_registration',
]);

const PURCHASE_ACTIONS = new Set([
  'purchase',
  'omni_purchase',
  'offsite_conversion.fb_pixel_purchase',
  'onsite_web_purchase',
]);

function sumActions(
  actions: Array<{ action_type?: string; value?: string }> | undefined,
  types: Set<string>
): number {
  if (!Array.isArray(actions)) return 0;
  return actions.reduce((total, action) => {
    if (!action?.action_type || !types.has(action.action_type)) return total;
    return total + Number(action.value || 0);
  }, 0);
}

async function countVisits(
  clientId: string,
  campaigns: Array<{ id: string; name: string; external_campaign_id: string | null }>
): Promise<Record<string, number>> {
  const supabase = getSupabaseAdmin();
  const counts: Record<string, number> = {};
  if (campaigns.length === 0) return counts;

  const { data: sites } = await supabase
    .from('tracking_sites')
    .select('id')
    .eq('client_id', clientId);

  const siteIds = (sites || []).map((site) => site.id);
  if (siteIds.length === 0) return counts;

  const { data: events } = await supabase
    .from('tracking_events')
    .select('campaign_id, utm_campaign')
    .in('tracking_site_id', siteIds)
    .order('created_at', { ascending: false })
    .limit(20000);

  const byId = new Map<string, number>();
  const byName = new Map<string, number>();

  for (const event of events || []) {
    if (event.campaign_id) {
      byId.set(event.campaign_id, (byId.get(event.campaign_id) || 0) + 1);
    }
    if (event.utm_campaign) {
      const key = event.utm_campaign.toLowerCase();
      byName.set(key, (byName.get(key) || 0) + 1);
    }
  }

  for (const campaign of campaigns) {
    counts[campaign.id] =
      byId.get(campaign.id) ||
      byName.get(campaign.name.toLowerCase()) ||
      (campaign.external_campaign_id
        ? byName.get(campaign.external_campaign_id.toLowerCase()) || 0
        : 0);
  }

  return counts;
}

export async function syncMetaCampaigns(
  clientId: string
): Promise<MetaSyncResult> {
  const supabase = getSupabaseAdmin();

  const { data: account, error: accountError } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('client_id', clientId)
    .eq('provider', 'facebook')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (accountError) {
    return { clientId, synced: 0, error: accountError.message };
  }

  if (!account) {
    return {
      clientId,
      synced: 0,
      error:
        'No hay una cuenta de Facebook conectada. Conéctala en Cuentas Sociales.',
    };
  }

  const token = decryptToken(account.access_token_encrypted);
  if (!token) {
    return {
      clientId,
      synced: 0,
      error: 'No se pudo descifrar el token de Meta.',
    };
  }

  const rawAdAccountId =
    (account.metadata?.ad_account_id as string | undefined) ||
    process.env.META_AD_ACCOUNT_ID ||
    '';

  if (!rawAdAccountId) {
    return {
      clientId,
      synced: 0,
      error: 'Falta META_AD_ACCOUNT_ID en el entorno.',
    };
  }

  const adAccountId = rawAdAccountId.replace(/^act_/, '').trim();
  const version = graphVersion();

  try {
    const campaignFields = [
      'id',
      'name',
      'objective',
      'status',
      'effective_status',
      'daily_budget',
      'lifetime_budget',
      'start_time',
      'stop_time',
    ].join(',');

    const campaignUrl = new URL(
      `https://graph.facebook.com/${version}/act_${adAccountId}/campaigns`
    );
    campaignUrl.searchParams.set('fields', campaignFields);
    campaignUrl.searchParams.set('limit', '200');

    const rawCampaigns = (await fetchAllPages(
      campaignUrl.toString(),
      token
    )) as MetaCampaign[];

    const insightUrl = new URL(
      `https://graph.facebook.com/${version}/act_${adAccountId}/insights`
    );
    insightUrl.searchParams.set('level', 'campaign');
    insightUrl.searchParams.set(
      'fields',
      'campaign_id,campaign_name,spend,impressions,clicks,actions,action_values'
    );
    insightUrl.searchParams.set('date_preset', 'maximum');
    insightUrl.searchParams.set('limit', '200');

    let rawInsights: MetaInsight[] = [];
    try {
      rawInsights = (await fetchAllPages(
        insightUrl.toString(),
        token
      )) as MetaInsight[];
    } catch (insightError) {
      console.warn('[meta-sync] insights:', insightError);
    }

    const insightByCampaign = new Map<string, MetaInsight>();
    for (const insight of rawInsights) {
      if (insight.campaign_id) {
        insightByCampaign.set(insight.campaign_id, insight);
      }
    }

    const normalized = rawCampaigns.map((campaign) => {
      const insight = insightByCampaign.get(campaign.id) || {};
      const budgetMinor = Number(
        campaign.daily_budget || campaign.lifetime_budget || 0
      );

      return {
        client_id: clientId,
        name: campaign.name || `Campaña ${campaign.id}`,
        objective: campaign.objective || null,
        provider: 'meta',
        external_campaign_id: campaign.id,
        budget: Number.isFinite(budgetMinor) ? budgetMinor / 100 : 0,
        spend: Number(insight.spend || 0),
        impressions: Number(insight.impressions || 0),
        clicks: Number(insight.clicks || 0),
        leads: Math.round(sumActions(insight.actions, LEAD_ACTIONS)),
        conversions: Math.round(sumActions(insight.actions, PURCHASE_ACTIONS)),
        revenue: sumActions(insight.action_values, PURCHASE_ACTIONS),
        status:
          campaign.effective_status || campaign.status || 'unknown',
        starts_at: campaign.start_time || null,
        ends_at: campaign.stop_time || null,
        last_synced_at: new Date().toISOString(),
      };
    });

    let synced = 0;

    for (const campaign of normalized) {
      const { data: existing } = await supabase
        .from('campaigns')
        .select('id')
        .eq('client_id', clientId)
        .eq('provider', 'meta')
        .eq('external_campaign_id', campaign.external_campaign_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('campaigns')
          .update(campaign)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('campaigns').insert(campaign);
        if (error) throw error;
      }

      synced += 1;
    }

    // Visitas atribuidas: por campaign_id (trigger) o por UTM = nombre.
    const { data: storedCampaigns } = await supabase
      .from('campaigns')
      .select('id, name, external_campaign_id')
      .eq('client_id', clientId)
      .eq('provider', 'meta');

    const visits = await countVisits(clientId, storedCampaigns || []);

    for (const campaign of storedCampaigns || []) {
      await supabase
        .from('campaigns')
        .update({ visits: visits[campaign.id] || 0 })
        .eq('id', campaign.id);
    }

    return { clientId, synced };
  } catch (error: any) {
    console.error('[meta-sync]', error);
    return {
      clientId,
      synced: 0,
      error: error?.message || 'Error sincronizando Meta Ads.',
    };
  }
}
