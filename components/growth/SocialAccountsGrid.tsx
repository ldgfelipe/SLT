'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, KeyRound, Share2, Trash2 } from 'lucide-react';
import { ProviderIcon } from './ProviderIcon';
import { PROVIDERS } from '@/lib/growth/providers';
import type { SocialAccount } from '@/types/database';

interface SocialAccountsGridProps {
  accounts: SocialAccount[];
}

function formatDate(value?: string | null): string {
  if (!value) return 'Sin caducidad';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function SocialAccountsGrid({ accounts }: SocialAccountsGridProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleDelete = async (account: SocialAccount) => {
    if (
      !confirm(
        `¿Desconectar "${account.account_name}"? Las publicaciones programadas dejarán de usar esta cuenta.`
      )
    ) {
      return;
    }

    setDeleting(account.id);
    setError('');

    try {
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'No se pudo eliminar.');
      router.refresh();
    } catch (deleteError: any) {
      setError(deleteError?.message || 'No se pudo eliminar la cuenta.');
    } finally {
      setDeleting(null);
    }
  };

  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-white/10 bg-[#0c1f3d]/60 px-6 py-14 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00d4ff]/10 text-[#00d4ff]">
          <Share2 className="h-7 w-7" />
        </div>
        <h3 className="text-base font-semibold text-white">
          Aún no hay cuentas conectadas
        </h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
          Conecta Facebook, Instagram, TikTok, LinkedIn, X, Threads o YouTube
          para programar y publicar contenido automáticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account) => {
          const provider = PROVIDERS[account.provider];
          const expired = account.status !== 'active';

          return (
            <div
              key={account.id}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0c1f3d] to-[#0a1931] p-5 shadow-lg transition hover:border-[#00d4ff]/40"
            >
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-10 blur-2xl"
                style={{ background: provider?.color || '#00d4ff' }}
              />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5"
                    style={{ color: provider?.color }}
                  >
                    <ProviderIcon provider={account.provider} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {account.account_name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {provider?.label || account.provider}
                    </p>
                  </div>
                </div>

                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    expired
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  }`}
                >
                  {expired ? 'Revisar' : 'Activa'}
                </span>
              </div>

              <dl className="mt-4 space-y-1.5 text-[11px]">
                {account.page_id && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Page / User ID</dt>
                    <dd className="truncate font-mono text-slate-300">
                      {account.page_id}
                    </dd>
                  </div>
                )}
                {account.ig_user_id && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">IG User ID</dt>
                    <dd className="truncate font-mono text-slate-300">
                      {account.ig_user_id}
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1 text-slate-500">
                    <KeyRound className="h-3 w-3" /> Token
                  </dt>
                  <dd className="text-slate-300">
                    {formatDate(account.token_expires_at)}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00d4ff]" />
                  Token cifrado
                </span>
                <button
                  onClick={() => handleDelete(account)}
                  disabled={deleting === account.id}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-400 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  {deleting === account.id ? 'Quitando…' : 'Desconectar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
