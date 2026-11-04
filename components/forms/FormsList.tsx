'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteForm } from '@/app/actions/forms';
import { Form, Stage } from '@/types/database';
import { normalizeFormConfig } from '@/types/forms';
import { buildFormHtml, resolveServerUrl } from '@/components/forms/EmbedFormHelper';
import { Code, Copy, Check, Trash2, FileText, MessageSquare, ExternalLink } from 'lucide-react';

interface FormsListProps {
  forms: Form[];
  stages: Stage[];
}

export function FormsList({ forms, stages }: FormsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getStageName = (stageId: string) => {
    return stages.find((s) => s.id === stageId)?.name || 'Etapa asignada';
  };

  const copyEmbedCode = (formId: string) => {
    const form = forms.find((f) => f.id === formId);
    const config = normalizeFormConfig(form?.fields_config);
    const code = buildFormHtml({
      formId,
      fields: config.fields,
      serverUrl: resolveServerUrl(),
    });
    navigator.clipboard.writeText(code);
    setCopiedId(formId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`¿Eliminar el formulario "${name}"?`)) return;
    startTransition(async () => {
      await deleteForm(id);
      router.refresh();
    });
  };

  if (forms.length === 0) {
    return (
      <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
        <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h3 className="font-semibold text-slate-700 dark:text-slate-300">No hay formularios creados</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
          Crea un formulario para generar un endpoint de captura de leads y su código HTML incrustable.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {forms.map((form) => (
        <div
          key={form.id}
          className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                Destino: {getStageName(form.stage_id)}
              </span>
              <button
                onClick={() => handleDelete(form.id, form.name)}
                disabled={isPending}
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100">
              {form.name}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              ID: {form.id}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                {normalizeFormConfig(form.fields_config).fields.length} campos
              </span>
              {(() => {
                const config = normalizeFormConfig(form.fields_config);
                if (config.redirect_url) {
                  return (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-medium">
                      <ExternalLink className="w-3 h-3" /> Redirige
                    </span>
                  );
                }
                if (config.message) {
                  return (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium">
                      <MessageSquare className="w-3 h-3" /> Mensaje
                    </span>
                  );
                }
                return (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium">
                    <Check className="w-3 h-3" /> Confirmación
                  </span>
                );
              })()}
            </div>

            <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 text-xs space-y-1">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-indigo-600" />
                Endpoint POST (CORS Universal)
              </div>
              <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate">
                /api/forms/{form.id}/submit
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {new Date(form.created_at).toLocaleDateString()}
            </span>

            <button
              onClick={() => copyEmbedCode(form.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-400 transition"
            >
              {copiedId === form.id ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>¡Código Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar HTML Embebible</span>
                </>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
