import { NextRequest, NextResponse } from 'next/server';
import { trackOpen } from '@/lib/mail/track-handlers';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const campaignId = params.get('c');
  const email = params.get('e');
  const signature = params.get('s');

  if (!campaignId || !email || !signature) {
    return new NextResponse(PIXEL_FALLBACK, {
      status: 200,
      headers: pixelHeaders(),
    });
  }

  const result = await trackOpen(campaignId, email, signature);

  if (!result.ok) {
    return new NextResponse(PIXEL_FALLBACK, {
      status: 200,
      headers: pixelHeaders(),
    });
  }

  return new NextResponse(new Uint8Array(result.pixel), {
    status: 200,
    headers: pixelHeaders(),
  });
}

const PIXEL_FALLBACK = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

function pixelHeaders() {
  return {
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
  };
}
