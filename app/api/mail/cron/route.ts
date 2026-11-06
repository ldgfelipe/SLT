import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isAuthorizedCron } from '@/lib/growth/cron';
import { sendCampaignBatch, startCampaignNow } from '@/lib/mail/batch';

export const maxDuration = 60;

async function run(): Promise<NextResponse> {
  const supabase = getSupabaseAdmin();

  // 1) Arrancar campañas programadas vencidas
  const { data: due } = await supabase
    .from('mail_campaigns')
    .select('id')
    .eq('estado', 'programada')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(20);

  const started: string[] = [];
  for (const row of due || []) {
    const { data: campaign } = await supabase
      .from('mail_campaigns')
      .select('*')
      .eq('id', row.id)
      .maybeSingle();

    if (!campaign) continue;
    const result = await startCampaignNow(supabase, campaign);
    if (!result.error) started.push(campaign.id);
    await sendCampaignBatch(campaign.id, { batchSize: 200, start: true });
  }

  // 2) Continuar campañas en curso
  const { data: running } = await supabase
    .from('mail_campaigns')
    .select('id')
    .eq('estado', 'enviando')
    .order('started_at', { ascending: true })
    .limit(20);

  const continued: Array<{ id: string; sent: number; remaining: number }> = [];
  for (const row of running || []) {
    const result = await sendCampaignBatch(row.id, { batchSize: 200 });
    continued.push({ id: row.id, sent: result.sent, remaining: result.remaining });
  }

  return NextResponse.json({
    ok: true,
    started: started.length,
    continued,
  });
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedCron(request))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  return run();
}

export async function POST(request: NextRequest) {
  return GET(request);
}
