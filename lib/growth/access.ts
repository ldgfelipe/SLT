import { getCurrentUser } from '@/app/actions/auth';
import type { AppUser } from '@/types/database';

export function canAccessClient(user: AppUser, clientId: string): boolean {
  if (user.role === 'root') return true;
  return Boolean(user.client_id && user.client_id === clientId);
}

export async function requireUser(): Promise<AppUser | null> {
  return getCurrentUser();
}

export function isProvider(value: string): boolean {
  return [
    'facebook',
    'instagram',
    'tiktok',
    'linkedin',
    'x',
    'threads',
    'youtube',
  ].includes(value);
}
