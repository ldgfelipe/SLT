import type { PostStatus, SocialProvider } from '@/types/database';
import { isSocialProvider } from './providers';

export const POST_STATUSES: PostStatus[] = [
  'draft',
  'queued',
  'publishing',
  'published',
  'failed',
];

/** Acepta array, JSON string o lista separada por comas. */
export function normalizePlatforms(raw: unknown): SocialProvider[] {
  let values: unknown[] = [];

  if (Array.isArray(raw)) {
    values = raw;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        values = Array.isArray(parsed) ? parsed : [];
      } catch {
        values = [];
      }
    } else {
      values = trimmed.split(',');
    }
  }

  const unique = new Set<SocialProvider>();
  for (const value of values) {
    const provider = String(value).trim().toLowerCase();
    if (isSocialProvider(provider)) unique.add(provider);
  }

  return Array.from(unique);
}
