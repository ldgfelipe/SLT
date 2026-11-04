'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createForm } from '@/app/actions/forms';
import { Stage } from '@/types/database';
import {
  DEFAULT_FORM_FIELDS,
  FormConfig,
  FormField,
  FormFieldType,
  SubmitBehavior,
} from '@/types/forms';
import { buildFormHtml } from '@/components/forms/EmbedFormHelper';
import { Plus, Trash2, Copy, Check, X, Loader2, MessageSquare, ExternalLink, Code2, CopyPlus } from 'lucide-react';

interface CreateFormDialogProps {
  clientId: string;
  stages: Stage[];
}

interface CreatedForm {
  id: string;
  name: string;
  snippet: string;
}

const FIELD_TYPES: Array<{ value: FormFieldType; label: string }> = [
  { value: 'text', label: 'Texto' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Teléfono' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Fecha' },
  { value: 'textarea', label: 'Texto largo' },
  { value: 'select', label: 'Lista de opciones' },
  { value: 'checkbox', label: 'Casilla / aceptación' },
];

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  return Promise.resolve();
}

export function CreateFormDialog({ clientId, stages }: CreateFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [stageId, setStageId] = useState(stages[0]?.id || '');
  const [fields, setFields] = useState<FormField[]>(() => DEFAULT_FORM_FIELDS.map((f) => ({ ...f })));
  const [submitMode, setSubmitMode] = useState<SubmitBehavior>('none');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [message, setMessage] = useState('¡Gracias! Hemos recibido tus datos.');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedForm | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedStage = stages.find((s) => s.id === stageId);

  const validFields = useMemo(
    () => fields.filter((field) => field.key.trim() !== '' && field.label.trim() !== ''),
    [fields]
  );

  const openDialog = () => {
    setOpen(true);
    setCreated(null);
    setCopied(false);
    setError(null);
  };

  const closeDialog = () => {
    if (isPending) return;
    setOpen(false);
    setCreated(null);
    setCopied(false);
  };

  function addField(): void {
    const index = fields.length + 1;
    setFields((current) => [
      ...current,
      { key: `campo_${index}`, label: 'Nuevo campo', type: 'text', placeholder: '', required: false },
    ]);
  }

  function duplicateField(index: number): void {
    setFields((current) => {
      const source = current[index];
      const copy: FormField = {
        ...source,
        key: `${source.key}_copia`,
        label: `${source.label} (copia)`,
        options: source.options?.map((option) => ({ ...option })),
      };
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
  }

  function removeField(index: number): void {
    setFields((current) => current.filter((_, i) => i !== index));
  }

  function updateField(index: number, patch: Partial<FormField>): void {
    setFields((current) =>
      current.map((field, i) => {
        if (i !== index) return field;
        const next: FormField = { ...field, ...patch };
        if (patch.type === 'select' && !next.options?.length) {
          next.options = [
            { value: 'opcion_1', label: 'Opción 1' },
            { value: 'opcion_2', label: 'Opción 2' },
          ];
        }
        return next;
      })
    );
  }

  function updateLabel(index: number, label: string): void {
    setFields((current) =>
      current.map((field, i) => {
        if (i !== index) return field;
        const shouldAutoKey = /^campo_\d+$/.test(field.key) || field.key.trim() === '';
        return {
          ...field,
          label,
          key: shouldAutoKey ? slugify(label) || field.key : field.key,
        };
      })
    );
  }

  function updateOption(index: number, optionIndex: number, patch: Partial<{ value: string; label: string }>): void {
    setFields((current) =>
      current.map((field, i) => {
        if (i !== index || !field.options) return field;
        const options = field.options.map((option, oi) =>
          oi === optionIndex ? { ...option, ...patch } : option
        );
        return { ...field, options };
      })
    );
  }

  function addOption(index: number): void {
    setFields((current) =>
      current.map((field, i) => {
        if (i !== index) return field;
        const options = field.options || [];
        return {
          ...field,
          options: [...options, { value: `opcion_${options.length + 1}`, label: `Opción ${options.length + 1}` }],
        };
      })
    );
  }

  function removeOption(index: number, optionIndex: number): void {
    setFields((current) =>
      current.map((field, i) =>
        i === index
          ? { ...field, options: (field.options || []).filter((_, oi) => oi !== optionIndex) }
          : field
      )
    );
  }

  async function handleCopy() {
    if (!created) return;
    await copyToClipboard(created.snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  const resetForAnother = () => {
    setName('');
    setFields(DEFAULT_FORM_FIELDS.map((f) => ({ ...f })));
    setSubmitMode('none');
    setRedirectUrl('');
    setMessage('¡Gracias! Hemos recibido tus datos.');
    setCreated(null);
    setCopied(false);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedStage) return;

    if (validFields.length === 0) {
      setError('Agrega al menos un campo con llave y etiqueta.');
      return;
    }

    const keys = validFields.map((field) => field.key.trim());
    if (new Set(keys).size !== keys.length) {
      setError('Hay llaves (nombre interno) repetidas. Cada campo debe tener una llave única.');
      return;
    }

    if (submitMode === 'redirect' && !redirectUrl.trim()) {
      setError('Indica la URL de destino para la redirección.');
      return;
    }

    const config: FormConfig = {
      fields: validFields,
      submit_mode: submitMode,
      redirect_url: submitMode === 'redirect' ? redirectUrl.trim() : undefined,
      message: submitMode === 'message' ? (message.trim() || '¡Gracias! Hemos recibido tus datos.') : undefined,
    };

    setError(null);
    startTransition(async () => {
      const result = await createForm(clientId, {
        name: name.trim(),
        fields_config: config,
        stage_id: selectedStage.id,
        pipeline_id: selectedStage.pipeline_id,
      });

      if (!result.success || !result.form) {
        setError(result.error || 'Error al crear el formulario');
        return;
      }

      const form = result.form as { id: string; name: string };
      setCreated({
        id: form.id,
        name: form.name,
        snippet: buildFormHtml({ formId: form.id, fields: config.fields }),
      });

      router.refresh();
    });
  };

  if (!open) {
    return (
      <button
        onClick={openDialog}
        className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition shadow-sm"
      >
        <Plus className="w-4 h-4" /> Nuevo Formulario
      </button>
    );
  }

  return (
    <>
      <button
        onClick={openDialog}
        className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition shadow-sm"
      >
        <Plus className="w-4 h-4" /> Nuevo Formulario
      </button>

      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl max-h-[94vh] overflow-y-auto shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {created ? 'Formulario creado' : 'Crear formulario'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {created
                  ? 'Copia el código y pégalo donde quieras mostrarlo.'
                  : 'Diseña los campos, define qué pasa al enviar y obtén el código embebible.'}
              </p>
            </div>
            <button
              onClick={closeDialog}
              disabled={isPending}
              aria-label="Cerrar"
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {created ? (
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold text-sm">
                  <Check className="w-5 h-5" /> “{created.name}” está listo.
                </div>
                <code className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 font-mono truncate">
                  ID: {created.id}
                </code>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5" /> Código embebible
                  </p>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? '¡Copiado!' : 'Copiar código'}
                  </button>
                </div>
                <pre className="max-h-72 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3 text-[11px] leading-relaxed font-mono whitespace-pre text-slate-700 dark:text-slate-300">
                  {created.snippet}
                </pre>
                <p className="text-[11px] text-slate-400 mt-2">
                  Pega el bloque completo (estilos + HTML + script) en tu web. El formulario ya incluye protección anti-bot y es responsive.
                </p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                <button
                  onClick={resetForAnother}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Crear otro
                </button>
                <button
                  onClick={closeDialog}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition"
                >
                  Listo
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6">
              {error && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start justify-between gap-3">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError(null)} className="font-bold">✕</button>
                </div>
              )}

              {/* Datos generales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Nombre del formulario
                  </label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Captura de leads B2B"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Etapa del pipeline al recibir el lead
                  </label>
                  <select
                    required
                    value={stageId}
                    onChange={(e) => setStageId(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Comportamiento de envío */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  ¿Qué pasa al enviar el formulario?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <BehaviorCard
                    active={submitMode === 'none'}
                    onClick={() => setSubmitMode('none')}
                    icon={<Check className="w-4 h-4" />}
                    title="Mostrar confirmación"
                    description="Mensaje de éxito en el mismo formulario."
                  />
                  <BehaviorCard
                    active={submitMode === 'message'}
                    onClick={() => setSubmitMode('message')}
                    icon={<MessageSquare className="w-4 h-4" />}
                    title="Mensaje personalizado"
                    description="Reemplaza el formulario por tu mensaje."
                  />
                  <BehaviorCard
                    active={submitMode === 'redirect'}
                    onClick={() => setSubmitMode('redirect')}
                    icon={<ExternalLink className="w-4 h-4" />}
                    title="Redirigir a una URL"
                    description="Lleva al usuario a otra página."
                  />
                </div>

                {submitMode === 'message' && (
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    placeholder="Ej. ¡Gracias! Un asesor te contactará muy pronto."
                    className="mt-3 w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-y"
                  />
                )}
                {submitMode === 'redirect' && (
                  <input
                    type="url"
                    required
                    value={redirectUrl}
                    onChange={(e) => setRedirectUrl(e.target.value)}
                    placeholder="https://tudominio.com/gracias"
                    className="mt-3 w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                )}
              </div>

              {/* Editor + vista previa */}
              <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Campos ({fields.length})
                    </p>
                    <button
                      type="button"
                      onClick={addField}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-400 transition rounded-lg"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar campo
                    </button>
                  </div>

                  <div className="space-y-3 lg:max-h-[440px] lg:overflow-y-auto lg:pr-1">
                    {fields.map((field, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-3 space-y-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            {index + 1}
                          </span>
                          <select
                            value={field.type}
                            onChange={(e) => updateField(index, { type: e.target.value as FormFieldType })}
                            className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          >
                            {FIELD_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                          <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={!!field.required}
                              onChange={(e) => updateField(index, { required: e.target.checked })}
                              className="h-3.5 w-3.5 accent-indigo-600"
                            />
                            Obligatorio
                          </label>
                          <button
                            type="button"
                            onClick={() => duplicateField(index)}
                            title="Duplicar campo"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md transition"
                          >
                            <CopyPlus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeField(index)}
                            title="Eliminar campo"
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">Etiqueta visible</label>
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) => updateLabel(index, e.target.value)}
                              className="w-full px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                              placeholder="Ej. Nombre completo"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">Llave (se guarda en el contacto)</label>
                            <input
                              type="text"
                              value={field.key}
                              onChange={(e) => updateField(index, { key: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                              placeholder="first_name"
                            />
                          </div>
                        </div>

                        {field.type !== 'checkbox' && (
                          <div>
                            <label className="block text-[11px] font-medium text-slate-500 mb-1">Texto de ayuda / placeholder</label>
                            <input
                              type="text"
                              value={field.placeholder || ''}
                              onChange={(e) => updateField(index, { placeholder: e.target.value })}
                              className="w-full px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                              placeholder="Ej. Escribe tu nombre"
                            />
                          </div>
                        )}

                        {field.type === 'select' && (
                          <div className="pl-3 border-l-2 border-indigo-200 dark:border-indigo-900 space-y-2">
                            <p className="text-[11px] font-semibold text-slate-500">Opciones</p>
                            {(field.options || []).map((option, optionIndex) => (
                              <div key={optionIndex} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={option.label}
                                  onChange={(e) =>
                                    updateOption(index, optionIndex, {
                                      label: e.target.value,
                                      value: slugify(e.target.value) || option.value,
                                    })
                                  }
                                  className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                  placeholder="Etiqueta"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeOption(index, optionIndex)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => addOption(index)}
                              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                              + Agregar opción
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vista previa */}
                <div className="lg:sticky lg:top-24 self-start">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Vista previa</p>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4">
                    <PreviewForm fields={fields} message={submitMode === 'message' ? message : null} />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    El formulario real se adapta a móvil, tablet y escritorio.
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <p className="text-[11px] text-slate-400">
                  Los campos extra se guardan automáticamente en el contacto.
                </p>
                <button
                  type="submit"
                  disabled={isPending || !name.trim() || !selectedStage}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Creando…
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Crear formulario
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

function BehaviorCard({
  active,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-3 rounded-xl border transition ${
        active
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
      }`}
    >
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${active ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
        {icon} {title}
      </span>
      <span className="block text-[11px] text-slate-500 mt-1 leading-snug">{description}</span>
    </button>
  );
}

function PreviewForm({ fields, message }: { fields: FormField[]; message: string | null }) {
  const inputClass =
    'w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500';
  const labelClass = 'block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1';

  return (
    <div className="pointer-events-none select-none">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((field, index) => {
          const full = field.type === 'textarea' || field.type === 'checkbox' ? 'sm:col-span-2' : '';
          const mark = field.required ? <span className="text-rose-500 ml-0.5">*</span> : null;

          if (field.type === 'checkbox') {
            return (
              <label key={index} className={`${full} flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300`}>
                <input type="checkbox" className="h-3.5 w-3.5 accent-indigo-600" />
                <span>{field.label || 'Casilla'} {mark}</span>
              </label>
            );
          }

          return (
            <div key={index} className={full}>
              <span className={labelClass}>{field.label || 'Campo'} {mark}</span>
              {field.type === 'textarea' ? (
                <textarea rows={2} placeholder={field.placeholder} className={`${inputClass} resize-none`} />
              ) : field.type === 'select' ? (
                <select className={inputClass}>
                  <option value="">Selecciona una opción</option>
                  {(field.options || []).map((option, optionIndex) => (
                    <option key={optionIndex} value={option.value}>{option.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  className={inputClass}
                />
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="mt-3 w-full py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white"
      >
        Enviar
      </button>

      {message && (
        <p className="mt-2 px-3 py-2 rounded-lg text-[11px] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300">
          {message}
        </p>
      )}
    </div>
  );
}
