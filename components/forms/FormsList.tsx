'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteForm } from '@/app/actions/forms';
import { Form, Stage } from '@/types/database';
import { normalizeFormConfig } from '@/types/forms';
import {
  buildEmbedSnippet,
  buildFormUrl,
  resolveServerUrl,
} from '@/components/forms/EmbedFormHelper';
import { FormEditorDialog } from '@/components/forms/FormEditorDialog';
import {
  Code,
  Copy,
  Check,
  Trash2,
  FileText,
  MessageSquare,
  ExternalLink,
  Pencil,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';

interface FormsListProps {
  forms: Form[];
  stages: Stage[];
  clientId: string;
}

export function FormsList({ forms, stages, clientId }: FormsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [host, setHost] = useState<string | null>(null);

  useEffect(() => {
    setHost(resolveServerUrl());
  }, []);

  const getStageName = (stageId: string) => {
    return stages.find((s) => s.id === stageId)?.name || 'Etapa asignada';
  };

  const copyEmbedCode = (formId: string) => {
    navigator.clipboard.writeText(buildEmbedSnippet(formId, resolveServerUrl()));
    setCopiedId(formId);
    setTimeout(() => setCopiedId(null), 2200);
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
          Crea un formulario, edítalo cuando quieras y pega un embed de una sola línea en tu web.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {forms.map((form) => {
          const config = normalizeFormConfig(form.fields_config);
          const snippet = host ? buildEmbedSnippet(form.id, host) : '';
          const formUrl = host ? buildFormUrl(form.id, host) : '';

          return (
            <div
              key={form.id}
              className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    Destino: {getStageName(form.stage_id)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingForm(form)}
                      title="Editar formulario"
                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-md transition"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => handleDelete(form.id, form.name)}
                      disabled={isPending}
                      title="Eliminar formulario"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                  {form.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">
                  ID: {form.id}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                    {config.fields.length} campos
                  </span>
                  {config.redirect_url ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-medium">
                      <ExternalLink className="w-3 h-3" /> Redirige
                    </span>
                  ) : config.message ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium">
                      <MessageSquare className="w-3 h-3" /> Mensaje
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium">
                      <Check className="w-3 h-3" /> Confirmación
                    </span>
                  )}
                  {config.captcha && config.captcha.provider !== 'none' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 font-medium">
                      <ShieldCheck className="w-3 h-3" />
                      {config.captcha.provider === 'recaptcha' ? 'reCAPTCHA' : 'Turnstile'}
                    </span>
                  )}
                </div>

                <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <Code className="w-3.5 h-3.5 text-indigo-600" />
                    Embed de una línea
                  </div>
                  <code className="block font-mono text-[10.5px] leading-relaxed text-slate-600 dark:text-slate-400 break-all line-clamp-2">
                    {snippet || 'Generando embed…'}
                  </code>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">
                  {new Date(form.created_at).toLocaleDateString()}
                </span>

                <div className="flex items-center gap-2">
                  {formUrl && (
                    <a
                      href={formUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" /> Abrir
                    </a>
                  )}
                  <button
                    onClick={() => copyEmbedCode(form.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-400 transition"
                  >
                    {copiedId === form.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar embed</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <FormEditorDialog
        clientId={clientId}
        stages={stages}
        open={!!editingForm}
        form={editingForm}
        onClose={() => setEditingForm(null)}
      />
    </>
  );
}
