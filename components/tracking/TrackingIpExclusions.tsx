'use client';

import React, { useState, useTransition } from 'react';
import {
  AlertCircle,
  Ban,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  addTrackingExclusion,
  deleteTrackingExclusion,
} from '@/app/actions/tracking-exclusions';
import type { TrackingIpExclusion } from '@/types/database';

interface TrackingIpExclusionsProps {
  clientId: string;
  initialRules: TrackingIpExclusion[];
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function TrackingIpExclusions({
  clientId,
  initialRules,
}: TrackingIpExclusionsProps) {
  const [rules, setRules] = useState<TrackingIpExclusion[]>(initialRules);
  const [pattern, setPattern] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [adding, startAddTransition] = useTransition();
  const [deletingId, startDeleteTransition] = useTransition();

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const value = pattern.trim();
    if (!value) {
      setError('Ingresa una IP o un prefijo.');
      return;
    }

    startAddTransition(async () => {
      const result = await addTrackingExclusion({
        clientId,
        pattern: value,
        label,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setRules((current) => [result.rule, ...current]);
      setPattern('');
      setLabel('');
    });
  };

  const handleDelete = (rule: TrackingIpExclusion) => {
    if (!confirm(`¿Eliminar la regla "${rule.pattern}"?`)) return;

    startDeleteTransition(async () => {
      const result = await deleteTrackingExclusion(rule.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setRules((current) => current.filter((item) => item.id !== rule.id));
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Exclusiones de IP
            </h2>
            <p className="text-xs text-slate-500">
              Las visitas desde estas IPs no se registrarán en el pixel.
            </p>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-slate-400">
          {rules.length} regla(s)
        </span>
      </div>

      <form
        onSubmit={handleAdd}
        className="mt-4 flex flex-col gap-2 md:flex-row md:items-end"
      >
        <div className="flex-1">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            IP o prefijo
          </label>
          <input
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
            placeholder="Ej. 201.120.45.9  o  192.168.1.  o  2607:f8b0:"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Etiqueta (opcional)
          </label>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Ej. Mi laptop, oficinas"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>
        <button
          type="submit"
          disabled={adding}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Agregar
        </button>
      </form>

      {error && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </p>
      )}

      <div className="mt-4">
        {rules.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 px-4 py-8 text-center">
            <Ban className="mx-auto mb-2 h-7 w-7 text-slate-300" />
            <p className="text-xs text-slate-500">
              Aún no hay exclusiones. Agrega tu IP para excluir el tráfico de prueba.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                    {rule.pattern}
                  </span>
                  {rule.label && (
                    <span className="truncate text-xs text-slate-500">
                      {rule.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400">
                    {formatDate(rule.created_at)}
                  </span>
                  <button
                    onClick={() => handleDelete(rule)}
                    disabled={deletingId}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                    title="Eliminar regla"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
        Formatos admitidos: IP exacta <code>201.120.45.9</code>, prefijo IPv4{' '}
        <code>192.168.1.</code> (todos los dispositivos de ese rango), comodín{' '}
        <code>192.168.*</code> o prefijo IPv6 <code>2607:f8b0:</code>.
      </p>
    </section>
  );
}
