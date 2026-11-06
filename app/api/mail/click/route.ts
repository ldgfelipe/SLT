import { NextRequest, NextResponse } from 'next/server';
import { trackClick } from '@/lib/mail/track-handlers';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const campaignId = params.get('c');
  const url = params.get('u');
  const signature = params.get('s');

  if (!campaignId || !url || !signature) {
    return NextResponse.redirect('https://slt-xi.vercel.app', 302);
  }

  const result = await trackClick(campaignId, url, signature);

  if (!result.ok) {
    return NextResponse.redirect('https://slt-xi.vercel.app', 302);
  }

  return NextResponse.redirect(result.redirect, 302);
}
