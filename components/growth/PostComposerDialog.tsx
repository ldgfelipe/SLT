'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Loader2, Upload, X } from 'lucide-react';
import { ProviderIcon } from './ProviderIcon';
import { resolveMediaUrl } from '@/lib/growth/media';
import { PROVIDERS, SOCIAL_PROVIDERS } from '@/lib/growth/providers';
import type { Post, SocialAccount, SocialProvider } from '@/types/database';

interface PostComposerDialogProps {
  open: boolean;
  clientId: string;
  accounts: SocialAccount[];
  post?: Post | null;
  onClose: () => void;
  onSaved: () => void;
}

const TZ = 'America/Mexico_City';

function toMexicoInput(iso?: string | null): string {
  if (!iso) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return `${fmt.format(new Date())}T10:00`;
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || '';

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get(
    'minute'
  )}`;
}

function fromMexicoInput(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}:00-06:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function PostComposerDialog({
  open,
  clientId,
  accounts,
  post,
  onClose,
  onSaved,
}: PostComposerDialogProps) {
  const isEdit = Boolean(post);
  const fileRef = useRef<HTMLInputElement>(null);

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [platforms, setPlatforms] = useState<SocialProvider[]>([]);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [autoQueue, setAutoQueue] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;

    setTitulo(post?.titulo || '');
    setDescripcion(post?.descripcion || '');
    setScheduledAt(toMexicoInput(post?.scheduled_at));
    setPlatforms(
      (post?.plataformas as SocialProvider[] | undefined)?.length
        ? (post!.plataformas as SocialProvider[])
        : ['facebook', 'instagram']
    );
    setAccountIds(post?.social_account_id ? [post.social_account_id] : []);
    setAutoQueue(post ? post.status !== 'draft' : true);
    setImageFile(null);
    setPreview(resolveMediaUrl(post?.imagen_url));
    setError('');
  }, [open, post?.id]);

  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const availableAccounts = useMemo(() => {
    if (platforms.length === 0) return accounts;
    const filtered = accounts.filter((account) =>
      platforms.includes(account.provider)
    );
    return filtered.length > 0 ? filtered : accounts;
  }, [accounts, platforms]);

  if (!open) return null;

  const togglePlatform = (provider: SocialProvider) => {
    setPlatforms((current) =>
      current.includes(provider)
        ? current.filter((item) => item !== provider)
        : [...current, provider]
    );
  };

  const toggleAccount = (id: string) => {
    setAccountIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!titulo.trim()) {
      setError('El título es obligatorio.');
      return;
    }

    if (platforms.length === 0) {
      setError('Selecciona al menos una red social.');
      return;
    }

    const scheduledIso = fromMexicoInput(scheduledAt);
    if (!scheduledIso) {
      setError('Selecciona una fecha y hora válidas.');
      return;
    }

    setSaving(true);

    try {
      if (isEdit && post) {
        if (imageFile) {
          const uploadForm = new FormData();
          uploadForm.set('image', imageFile);
          const uploadResponse = await fetch(
            `/api/posts/${post.id}/upload`,
            { method: 'POST', body: uploadForm }
          );
          const uploadData = await uploadResponse.json();
          if (!uploadResponse.ok) {
            throw new Error(
              uploadData?.error || 'No se pudo subir la imagen.'
            );
          }
        }

        const status =
          post.status === 'published' || post.status === 'publishing'
            ? post.status
            : autoQueue
              ? 'queued'
              : 'draft';

        const response = await fetch(`/api/posts/${post.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titulo,
            descripcion,
            plataformas: platforms,
            scheduled_at: scheduledIso,
            social_account_ids: accountIds.length > 0 ? accountIds : null,
            status,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'No se pudo actualizar.');
        }
      } else {
        const form = new FormData();
        form.set('client_id', clientId);
        form.set('titulo', titulo);
        form.set('descripcion', descripcion);
        form.set('plataformas', JSON.stringify(platforms));
        form.set('scheduled_at', scheduledIso);
        form.set('status', autoQueue ? 'queued' : 'draft');
        if (accountIds.length > 0) form.set('social_account_ids', JSON.stringify(accountIds));
        if (imageFile) form.set('image', imageFile);

        const response = await fetch('/api/posts', {
          method: 'POST',
          body: form,
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'No se pudo crear la publicación.');
        }
      }

      onSaved();
      onClose();
    } catch (submitError: any) {
      setError(submitError?.message || 'No se pudo guardar la publicación.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a1931] shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-white">
              {isEdit ? 'Editar publicación' : 'Nueva publicación'}
            </h2>
            <p className="text-xs text-slate-400">
              Zona horaria: America/Mexico_City (UTC-6).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Título
            </label>
            <input
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              placeholder="Ej. Alta de producto en 15 segundos"
              className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-[#00d4ff]"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Descripción / copy
            </label>
            <textarea
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
              rows={4}
              placeholder="Texto que se publicará en las redes…"
              className="w-full resize-y rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-[#00d4ff]"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Redes
            </label>
            <div className="flex flex-wrap gap-2">
              {SOCIAL_PROVIDERS.map((provider) => {
                const active = platforms.includes(provider);
                return (
                  <button
                    type="button"
                    key={provider}
                    onClick={() => togglePlatform(provider)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                      active
                        ? 'border-[#00d4ff]/50 bg-[#00d4ff]/10 text-white'
                        : 'border-white/10 bg-[#0c1f3d] text-slate-400 hover:border-white/25'
                    }`}
                  >
                    <ProviderIcon provider={provider} className="h-3.5 w-3.5" />
                    {PROVIDERS[provider].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Fecha y hora
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Cuentas para publicar
              </label>
              <div className="mt-2 max-h-48 overflow-y-auto space-y-2">
                {SOCIAL_PROVIDERS.map((provider) => {
                  const providerAccounts = accounts.filter(
                    (account) => account.provider === provider
                  );
                  if (providerAccounts.length === 0) return null;
                  return (
                    <div
                      key={provider}
                      className="rounded-lg border border-white/10 bg-[#0c1f3d] p-3"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <ProviderIcon
                          provider={provider}
                          className="h-4 w-4"
                        />
                        <span className="text-xs font-semibold text-white">
                          {PROVIDERS[provider].label}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {providerAccounts.map((account) => (
                          <label
                            key={account.id}
                            className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={accountIds.includes(account.id)}
                              onChange={() => toggleAccount(account.id)}
                              className="h-4 w-4 rounded border-white/20 bg-[#0a1931]"
                            />
                            <span className="truncate">
                              {account.account_name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={autoQueue}
              onChange={(event) => setAutoQueue(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-[#0c1f3d]"
            />
            Encolar para publicación automática a la hora programada
          </label>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Imagen
            </label>
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#0c1f3d]">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt="Vista previa"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImagePlus className="h-6 w-6 text-slate-600" />
                )}
              </div>

              <div className="space-y-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) =>
                    setImageFile(event.target.files?.[0] || null)
                  }
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0c1f3d] px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-[#00d4ff]/40 hover:text-white"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {imageFile ? 'Cambiar imagen' : 'Subir a Storage'}
                </button>
                <p className="text-[10px] text-slate-500">
                  JPG, PNG, WebP o GIF · máx. 8 MB.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#00d4ff] px-4 py-2 text-xs font-semibold text-[#06152b] transition hover:bg-cyan-300 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Crear publicación'}
          </button>
        </div>
      </form>
    </div>
  );
}
