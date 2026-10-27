'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteForm } from '@/app/actions/forms';
import { Form, Stage } from '@/types/database';
import { Code, Copy, Check, Trash2, FileText } from 'lucide-react';

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
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tu-dominio.vercel.app';
    const code = `<form action="${origin}/api/forms/${formId}/submit" method="POST">\n  <input type="text" name="first_name" placeholder="Nombre" required />\n  <input type="text" name="last_name" placeholder="Apellido" />\n  <input type="email" name="email" placeholder="Email" required />\n  <input type="tel" name="phone" placeholder="Teléfono" />\n  <!-- Honey pot anti-bot (no debe llenarse) -->\n  <input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;opacity:0;height:0;width:0;" />\n  <button type="submit">Enviar</button>\n</form>`;
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
