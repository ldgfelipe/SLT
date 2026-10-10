'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteTrackingSite } from '@/app/actions/tracking';
import { TrackingSite } from '@/types/database';
import { Globe, Copy, Check, Trash2, Code2 } from 'lucide-react';

interface TrackingSitesListProps {
  sites: TrackingSite[];
}

export function TrackingSitesList({ sites }: TrackingSitesListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyScriptTag = (siteId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tu-dominio.vercel.app';
    const tag = `<!-- SLT Pixel Tracker -->\n<script\n  src="${origin}/slt-tracker.js"\n  data-site-id="${siteId}"\n  data-host="${origin}"\n  async>\n</script>`;
    navigator.clipboard.writeText(tag);
    setCopiedId(siteId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDelete = (id: string, domain: string) => {
    if (!confirm(`¿Eliminar el sitio "${domain}" y su tracking asociado?`)) return;
    startTransition(async () => {
      await deleteTrackingSite(id);
      router.refresh();
    });
  };

  if (sites.length === 0) {
    return (
      <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
        <Globe className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h3 className="font-semibold text-slate-700 dark:text-slate-300">No hay sitios registrados</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
          Registra el dominio donde deseas instalar el script de rastreo (Pixel) para capturar visitas y conversiones.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sites.map((site) => (
        <div
          key={site.id}
          className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-600" />
              <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                {site.domain}
              </h3>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Site ID: {site.id}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => copyScriptTag(site.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-400 transition"
            >
              {copiedId === site.id ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>¡Pixel Copiado!</span>
                </>
              ) : (
                <>
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Copiar Script del Pixel</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleDelete(site.id, site.domain)}
              disabled={isPending}
              className="p-2 text-slate-400 hover:text-rose-600 rounded-lg transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
