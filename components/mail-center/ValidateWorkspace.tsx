'use client';

import React, { useEffect, useState, useTransition } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  Loader2,
  Trash2,
  ListChecks,
} from 'lucide-react';
import { validateEmails, listMailLists } from '@/app/actions/mail-data';

interface ValidateWorkspaceProps {
  clientId: string;
}

export function ValidateWorkspace({ clientId }: ValidateWorkspaceProps) {
  const [lists, setLists] = useState<Array<{ id: string; name: string; contact_count?: number }>>([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [rawText, setRawText] = useState('');
  const [valid, setValid] = useState<string[]>([]);
  const [invalid, setInvalid] = useState<Array<{ email: string; reason: string }>>([]);
  const [removed, setRemoved] = useState<number | null>(null);
  const [removeInvalid, setRemoveInvalid] = useState(true);
  const [error, setError] = useState('');
  const [validating, startTransition] = useTransition();

  useEffect(() => {
    listMailLists(clientId).then((res) => {
      if (res.success) setLists(res.lists as any);
    });
  }, [clientId]);

  const runValidation = () => {
    setError('');
    setValid([]);
    setInvalid([]);
    setRemoved(null);

    startTransition(async () => {
      const result = await validateEmails(clientId, {
        rawText,
        listaId: selectedListId || null,
        removeInvalid: selectedListId ? removeInvalid : false,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setValid(result.valid);
      setInvalid(result.invalid);
      setRemoved(result.removed ?? 0);
    });
  };

  const total = valid.length + invalid.length;

  return (
    <div className="p-6 max-w-5xl mx-auto text-slate-100 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-6 w-6 text-[#00d4ff]" />
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Validar Correos
          </h1>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Verificación de formato + existencia de registro MX (hasta 1,000 correos por validación).
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-[#0c1f3d] p-5">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Pega los correos (uno por línea, coma o punto y coma)
          </label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={14}
            placeholder={'juan@empresa.com\ncontacto@negocio.mx'}
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a1931] px-3 py-2 font-mono text-[11px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-[#00d4ff]"
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500">
              {rawText.split(/[\s,;]+/).filter((s) => s.trim()).length.toLocaleString('es-MX')} correos detectados
            </span>
            <button
              onClick={runValidation}
              disabled={validating || !rawText.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#00d4ff] px-4 py-2.5 text-xs font-semibold text-[#06152b] transition hover:bg-cyan-300 disabled:opacity-40"
            >
              {validating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BadgeCheck className="h-4 w-4" />
              )}
              Validar correos
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#0c1f3d] p-5">
            <h2 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <ListChecks className="h-3.5 w-3.5" />
              Lista de la que borrar inválidos
            </h2>
            <select
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
              className="mt-2 w-full rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#00d4ff]"
            >
              <option value="">— No borrar de ninguna lista —</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name} ({list.contact_count?.toLocaleString('es-MX') ?? 0})
                </option>
              ))}
            </select>
            {selectedListId && (
              <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                <input
                  type="checkbox"
                  checked={removeInvalid}
                  onChange={(e) => setRemoveInvalid(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#00d4ff]"
                />
                Eliminar también esos correos de la lista
              </label>
            )}
          </div>

          {total > 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#0c1f3d] p-5">
              <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Resultados
              </h2>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <p className="text-xl font-bold text-white">{total}</p>
                  <p className="text-[9px] text-slate-500">Analizados</p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <p className="text-xl font-bold text-emerald-400">{valid.length}</p>
                  <p className="text-[9px] text-emerald-600">Válidos</p>
                </div>
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                  <p className="text-xl font-bold text-rose-400">{invalid.length}</p>
                  <p className="text-[9px] text-rose-600">Inválidos</p>
                </div>
              </div>

              {removed !== null && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-300">
                  <Trash2 className="h-3 w-3" />
                  {removed} contacto(s) eliminados de la lista.
                </p>
              )}

              {invalid.length > 0 && (
                <div className="mt-3 max-h-40 overflow-y-auto rounded-xl border border-rose-500/20 bg-rose-500/5 p-2">
                  {invalid.slice(0, 50).map((item) => (
                    <div
                      key={item.email}
                      className="flex items-center justify-between gap-2 border-b border-rose-500/10 py-1 text-[10px] last:border-0"
                    >
                      <span className="truncate text-rose-200">{item.email}</span>
                      <span className="flex-shrink-0 text-rose-400">{item.reason}</span>
                    </div>
                  ))}
                  {invalid.length > 50 && (
                    <p className="pt-1 text-[9px] text-rose-400">
                      + {invalid.length - 50} más…
                    </p>
                  )}
                </div>
              )}

              {valid.length > 0 && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Puedes usar estos correos en tus campañas sin rebotes por formato o MX.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
