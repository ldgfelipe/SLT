'use client';

import React from 'react';
import { Activity, Users, MousePointerClick, Globe } from 'lucide-react';
import { TrackingSite } from '@/types/database';

export interface TrackingEventRow {
  id: string;
  tracking_site_id: string;
  visitor_id: string;
  contact_id: string | null;
  event_type: 'pageview' | 'conversion';
  url: string;
  created_at: string;
  tracking_sites?: { domain: string } | null;
}

interface TrackingEventsListProps {
  events: TrackingEventRow[];
  sites: TrackingSite[];
}

export function TrackingEventsList({ events, sites }: TrackingEventsListProps) {
  const siteMap = new Map(sites.map((s) => [s.id, s.domain]));

  if (events.length === 0) {
    return (
      <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
        <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h3 className="font-semibold text-slate-700 dark:text-slate-300">Sin tráfico registrado todavía</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
          Instala el pixel en tu sitio y las visitas de usuarios reales aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-4 py-3 text-left">Fecha</th>
            <th className="px-4 py-3 text-left">Sitio</th>
            <th className="px-4 py-3 text-left">Tipo</th>
            <th className="px-4 py-3 text-left">URL</th>
            <th className="px-4 py-3 text-left">Visitante</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {events.map((ev) => (
            <tr key={ev.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                {new Date(ev.created_at).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-xs font-medium text-slate-700 dark:text-slate-300">
                {siteMap.get(ev.tracking_site_id) || ev.tracking_sites?.domain || '—'}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    ev.event_type === 'conversion'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  }`}
                >
                  {ev.event_type === 'conversion' ? (
                    <MousePointerClick className="w-3 h-3" />
                  ) : (
                    <Activity className="w-3 h-3" />
                  )}
                  {ev.event_type === 'conversion' ? 'Conversión' : 'Visita'}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate" title={ev.url}>
                {ev.url}
              </td>
              <td className="px-4 py-3 text-xs font-mono text-slate-400">
                {ev.visitor_id.slice(0, 8)}…
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}