import React from 'react';
import type { PostStatus } from '@/types/database';

const STYLES: Record<PostStatus, string> = {
  draft: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  queued: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  publishing: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  published: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  failed: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

const LABELS: Record<PostStatus, string> = {
  draft: 'Borrador',
  queued: 'Programado',
  publishing: 'Publicando',
  published: 'Publicado',
  failed: 'Fallido',
};

export function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        STYLES[status] || STYLES.draft
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[status] || status}
    </span>
  );
}
