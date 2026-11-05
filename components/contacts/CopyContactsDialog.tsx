'use client';

import React, { useState, useTransition } from 'react';
import { Check, Loader2, X, Copy } from 'lucide-react';
import { copyContacts } from '@/app/actions/contacts';
import { Client } from '@/types/database';

interface CopyContactsDialogProps {
  open: boolean;
  clients: Client[];
  currentClientId?: string;
  selectedIds: string[];
  onClose: () => void;
  onCopied: (result: { copied: number; skipped: number; total: number }) => void;
}

export function CopyContactsDialog({
  open,
  clients,
  currentClientId,
  selectedIds,
  onClose,
  onCopied,
}: CopyContactsDialogProps) {
  const [targetId, setTargetId] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    copied: number;
    skipped: number;
    total: number;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const targets = clients.filter((client) => client.id !== currentClientId);

  const handleCopy = () => {
    setError('');
    if (!targetId) {
      setError('Selecciona un cliente destino.');
      return;
    }

    startTransition(async () => {
      const response = await copyContacts(selectedIds, targetId);

      if (!response.success) {
        setError(response.error || 'No se pudieron copiar los contactos.');
        return;
      }

      setResult({
        copied: response.copied || 0,
        skipped: response.skipped || 0,
        total: response.total || selectedIds.length,
      });
      onCopied({
        copied: response.copied || 0,
        skipped: response.skipped || 0,
        total: response.total || selectedIds.length,
      });
    });
  };

  const close = () => {
    setTargetId('');
    setError('');
    setResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Copiar contactos
            </h2>
            <p className="text-xs text-slate-500">
              {selectedIds.length} seleccionado(s). Se omitirán duplicados por email.
            </p>
          </div>
          <button
            onClick={close}
            aria-label="Cerrar"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {result ? (
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {result.copied} contacto(s) copiados
              </p>
              <p className="text-xs text-slate-500">
                {result.skipped > 0
                  ? `${result.skipped} omitido(s) por ya existir en el cliente destino.`
                  : 'Sin duplicados.'}
              </p>
              <button
                onClick={close}
                className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Listo
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Cliente destino
                </label>
                <select
                  value={targetId}
                  onChange={(event) => setTargetId(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">Selecciona…</option>
                  {targets.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                {targets.length === 0 && (
                  <p className="mt-1 text-[10px] text-slate-400">
                    No hay otro cliente al que copiar.
                  </p>
                )}
              </div>

              <button
                onClick={handleCopy}
                disabled={pending || !targetId || selectedIds.length === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                Copiar {selectedIds.length} contacto(s)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
