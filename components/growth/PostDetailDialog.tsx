'use client';

import React, { useRef, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Loader2,
  Pencil,
  Send,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { ProviderIcon } from './ProviderIcon';
import { StatusBadge } from './StatusBadge';
import { resolveMediaUrl } from '@/lib/growth/media';
import { PROVIDERS } from '@/lib/growth/providers';
import type { Post, SocialAccount, SocialProvider } from '@/types/database';

interface PostDetailDialogProps {
  open: boolean;
  post: Post | null;
  accounts: SocialAccount[];
  onClose: () => void;
  onEdit: (post: Post) => void;
  onChanged: () => void;
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

interface ProviderResult {
  provider: string;
  ok: boolean;
  error?: string | null;
}

export function PostDetailDialog({
  open,
  post,
  accounts,
  onClose,
  onEdit,
  onChanged,
}: PostDetailDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'publish' | 'upload' | 'delete' | null>(null);
  const [error, setError] = useState('');
  const [results, setResults] = useState<ProviderResult[] | null>(null);

  if (!open || !post) return null;

  const image = resolveMediaUrl(post.imagen_url);
  const platforms = (post.plataformas || []) as SocialProvider[];
  const account = accounts.find((item) => item.id === post.social_account_id);

  const publishNow = async () => {
    setBusy('publish');
    setError('');
    setResults(null);

    try {
      const response = await fetch(`/api/posts/${post.id}/publish`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo publicar.');
      }

      setResults(data?.result?.providers || []);
      onChanged();
    } catch (publishError: any) {
      setError(publishError?.message || 'No se pudo publicar.');
    } finally {
      setBusy(null);
    }
  };

  const uploadImage = async (file: File) => {
    setBusy('upload');
    setError('');

    try {
      const form = new FormData();
      form.set('image', file);
      const response = await fetch(`/api/posts/${post.id}/upload`, {
        method: 'POST',
        body: form,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo subir la imagen.');
      }
      onChanged();
    } catch (uploadError: any) {
      setError(uploadError?.message || 'No se pudo subir la imagen.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!confirm(`¿Eliminar "${post.titulo}"?`)) return;

    setBusy('delete');
    setError('');

    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo eliminar.');
      }
      onChanged();
      onClose();
    } catch (deleteError: any) {
      setError(deleteError?.message || 'No se pudo eliminar.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a1931] shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <StatusBadge status={post.status} />
              {platforms.map((provider) => (
                <span
                  key={provider}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300"
                >
                  <ProviderIcon provider={provider} className="h-3 w-3" />
                  {PROVIDERS[provider]?.label || provider}
                </span>
              ))}
            </div>
            <h2 className="truncate text-base font-bold text-white">
              {post.titulo}
            </h2>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
              <CalendarClock className="h-3 w-3" />
              {formatDateTime(post.scheduled_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={post.titulo}
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
              className="max-h-56 w-full rounded-xl border border-white/10 object-contain bg-[#0c1f3d]"
            />
          )}

          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
            {post.descripcion || 'Sin descripción.'}
          </p>

          <dl className="grid grid-cols-2 gap-2 text-[11px]">
            <Info label="Cuenta" value={account?.account_name || 'Automática'} />
            <Info
              label="Intentos"
              value={String(post.attempts || 0)}
            />
            <Info
              label="Publicado"
              value={
                post.published_at ? formatDateTime(post.published_at) : '—'
              }
            />
            <Info
              label="Campaña"
              value={post.campaign?.name || 'Sin campaña'}
            />
          </dl>

          {post.external_post_ids &&
            Object.keys(post.external_post_ids).length > 0 && (
              <div className="rounded-xl border border-white/10 bg-[#0c1f3d] p-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  IDs externos
                </p>
                <div className="space-y-1 text-[11px]">
                  {Object.entries(post.external_post_ids).map(
                    ([provider, externalId]) => (
                      <div
                        key={provider}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-slate-400">{provider}</span>
                        <span className="truncate font-mono text-slate-300">
                          {externalId}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

          {post.error_log && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200">
              <p className="mb-1 flex items-center gap-1 font-semibold">
                <Clock3 className="h-3 w-3" /> Último resultado
              </p>
              <p className="break-words">{post.error_log}</p>
            </div>
          )}

          {results && results.length > 0 && (
            <div className="space-y-1 rounded-xl border border-white/10 bg-[#0c1f3d] p-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Resultado de publicación
              </p>
              {results.map((result) => (
                <div
                  key={result.provider}
                  className="flex items-center gap-2 text-[11px]"
                >
                  {result.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-rose-400" />
                  )}
                  <span className="text-slate-300">{result.provider}</span>
                  {result.error && (
                    <span className="truncate text-rose-300">
                      {result.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-5 py-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onEdit(post)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-white/25 hover:text-white"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadImage(file);
                event.target.value = '';
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-[#00d4ff]/40 hover:text-white disabled:opacity-50"
            >
              {busy === 'upload' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Subir a Storage
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={remove}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
            >
              {busy === 'delete' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Eliminar
            </button>

            <button
              onClick={publishNow}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#00d4ff] px-3 py-1.5 text-[11px] font-semibold text-[#06152b] transition hover:bg-cyan-300 disabled:opacity-60"
            >
              {busy === 'publish' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Publicar ahora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0c1f3d] px-2.5 py-1.5">
      <dt className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-slate-300">{value}</dd>
    </div>
  );
}
