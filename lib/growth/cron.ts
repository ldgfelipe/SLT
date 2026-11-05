import crypto from 'crypto';

function timingSafeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

/** Valida el secreto que Vercel envía en `Authorization: Bearer <CRON_SECRET>`. */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[growth/cron] CRON_SECRET no configurado. Se rechazan las ejecuciones en producción.'
      );
      return false;
    }
    return true;
  }

  const authorization = request.headers.get('authorization') || '';
  const bearer = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
  const provided =
    bearer || request.headers.get('x-cron-secret') || '';

  if (!provided) return false;
  return timingSafeEqual(provided, secret);
}
