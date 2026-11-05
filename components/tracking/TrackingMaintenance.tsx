'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Download,
  Loader2,
  Save,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import {
  clearTrackingEvents,
  exportTrackingCsv,
  purgeTrackingEvents,
  updateTrackingLimit,
  type TrackingStats,
} from '@/app/actions/tracking-maintenance';

interface SiteOption {
  id: string;
  domain: string;
}

interface TrackingMaintenanceProps {
  clientId: string;
  siteOptions: SiteOption[];
  initialStats: TrackingStats;
}

const ALERT_TEXT: Record<TrackingStats['alert'], string> = {
  ok: 'La base está por debajo del límite.',
  warning: 'La base está por encima del 80% del límite.',
  exceeded: 'La base alcanzó el límite. Se purgarán los eventos más antiguos automáticamente.',
};

const ALERT_STYLE: Record<TrackingStats['alert'], string> = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  exceeded: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
};

const BAR_STYLE: Record<TrackingStats['alert'], string> = {
  ok: 'bg-emerald-500',
  warning: 'bg-amber-400',
  exceeded: 'bg-rose-500',
};

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TrackingMaintenance({
  clientId,
  siteOptions,
  initialStats,
}: TrackingMaintenanceProps) {
  const router = useRouter();
  const [stats, setStats] = useState(initialStats);
  const [maxEvents, setMaxEvents] = useState(String(initialStats.maxEvents));
  const [siteId, setSiteId] = useState<string>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exportLimit, setExportLimit] = useState('10000');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, startSaveTransition] = useTransition();
  const [purging, startPurgeTransition] = useTransition();
  const [clearing, startClearTransition] = useTransition();
  const [exporting, startExportTransition] = useTransition();

  const percent = Math.min(100, Math.round(stats.percent * 100));

  const showMessage = (text: string) => {
    setMessage(text);
    setError('');
  };

  const saveLimit = () => {
    setError('');
    setMessage('');
    startSaveTransition(async () => {
      const result = await updateTrackingLimit(clientId, Number(maxEvents));
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMaxEvents(String(result.maxEvents));
      setStats((current) => ({
        ...current,
        maxEvents: result.maxEvents,
        percent: result.maxEvents > 0 ? current.total / result.maxEvents : 0,
        alert:
          current.total / result.maxEvents >= 1
            ? 'exceeded'
            : current.total / result.maxEvents >= 0.8
              ? 'warning'
              : 'ok',
      }));
      showMessage(`Límite actualizado a ${result.maxEvents.toLocaleString('es-MX')} registros.`);
    });
  };

  const purge = () => {
    if (
      !confirm(
        'Se conservarán los registros más recientes y se eliminarán los más antiguos hasta respetar el límite. ¿Continuar?'
      )
    ) {
      return;
    }

    startPurgeTransition(async () => {
      const result = await purgeTrackingEvents(clientId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      showMessage(
        result.purged > 0
          ? `Se eliminaron ${result.purged.toLocaleString('es-MX')} registros antiguos.`
          : 'No hay nada que purgar.'
      );
      router.refresh();
    });
  };

  const clearAll = () => {
    const confirmation = prompt(
      'Esto borrará TODO el tráfico registrado para este cliente en SLT (no se puede deshacer).\nEscribe BORRAR para confirmar:'
    );

    if (confirmation !== 'BORRAR') {
      if (confirmation !== null) setError('Confirmación inválida. Debes escribir BORRAR.');
      return;
    }

    setError('');
    setMessage('');
    startClearTransition(async () => {
      const result = await clearTrackingEvents(clientId, confirmation);
      if (!result.success) {
        setError(result.error);
        return;
      }
      showMessage(`Se eliminaron ${result.deleted.toLocaleString('es-MX')} registros.`);
      setStats((current) => ({ ...current, total: 0, percent: 0, alert: 'ok' }));
      router.refresh();
    });
  };

  const exportCsv = () => {
    setError('');
    setMessage('');
    startExportTransition(async () => {
      const result = await exportTrackingCsv(clientId, {
        siteId: siteId || null,
        from: from ? new Date(`${from}T00:00:00-06:00`).toISOString() : null,
        to: to ? new Date(`${to}T23:59:59-06:00`).toISOString() : null,
        limit: Number(exportLimit),
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
      URL.revokeObjectURL(url);

      showMessage(
        `Exportados ${result.count.toLocaleString('es-MX')} registros.`
      );
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Mantenimiento de la base
            </h2>
            <p className="text-xs text-slate-500">
              Exportar, purgar y limitar los registros de tracking.
            </p>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-slate-400">
          {stats.total.toLocaleString('es-MX')} / {stats.maxEvents.toLocaleString('es-MX')} registros
        </span>
      </div>

      {/* Barra de ocupación */}
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${BAR_STYLE[stats.alert]}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div
        className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${ALERT_STYLE[stats.alert]}`}
      >
        {stats.alert === 'ok' ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
        ) : (
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
        )}
        <span className="leading-snug">{ALERT_TEXT[stats.alert]}</span>
      </div>

      <p className="mt-1.5 text-[10px] text-slate-400">
        Rango de registros: {formatDateTime(stats.oldest)} → {formatDateTime(stats.newest)}
      </p>

      {error && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
      {message && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          {message}
        </p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Límite */}
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Límite de registros
          </h3>
          <p className="mt-1 text-[11px] text-slate-400">
            Al superarlo, se purgan automáticamente los eventos más antiguos.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={100}
              max={5_000_000}
              step={1000}
              value={maxEvents}
              onChange={(event) => setMaxEvents(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              onClick={saveLimit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={purge}
              disabled={purging}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-60 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/40"
            >
              {purging ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Purgar antiguos
            </button>
            <button
              onClick={clearAll}
              disabled={clearing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              {clearing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Borrar todo
            </button>
          </div>
        </div>

        {/* Exportar */}
        <div className="rounded-xl border border-slate-200 p-4 lg:col-span-2 dark:border-slate-800">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Exportar CSV
          </h3>
          <p className="mt-1 text-[11px] text-slate-400">
            Descarga los eventos en un archivo CSV (Excel compatible, con BOM UTF-8).
          </p>

          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Sitio
              </label>
              <select
                value={siteId}
                onChange={(event) => setSiteId(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">Todos los sitios</option>
                {siteOptions.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.domain}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Desde
              </label>
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Hasta
              </label>
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Máx. registros
              <input
                type="number"
                min={1}
                max={50000}
                step={1000}
                value={exportLimit}
                onChange={(event) => setExportLimit(event.target.value)}
                className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] normal-case tracking-normal outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
            <button
              onClick={exportCsv}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Exportar CSV
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
