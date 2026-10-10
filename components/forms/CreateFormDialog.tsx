'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createForm } from '@/app/actions/forms';
import { Stage } from '@/types/database';
import { Plus, Loader2 } from 'lucide-react';

interface CreateFormDialogProps {
  clientId: string;
  stages: Stage[];
}

export function CreateFormDialog({ clientId, stages }: CreateFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [stageId, setStageId] = useState(stages[0]?.id || '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !stageId) return;

    const selectedStage = stages.find((s) => s.id === stageId);
    if (!selectedStage) return;

    setError(null);
    startTransition(async () => {
      const res = await createForm(clientId, {
        name,
        stage_id: stageId,
        pipeline_id: selectedStage.pipeline_id,
      });

      if (!res.success) {
        setError(res.error || 'Error al crear formulario');
      } else {
        setName('');
        setOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition shadow-sm"
      >
        <Plus className="w-4 h-4" />
        Nuevo Formulario
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
              Crear Formulario de Captura
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Cada formulario cuenta con un endpoint y snippet para incrustar en cualquier landing page o web externa.
            </p>

            {error && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre del Formulario *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Formulario de Contacto Web"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Etapa de Destino en el Pipeline *
                </label>
                <select
                  value={stageId}
                  onChange={(e) => setStageId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Crear Formulario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
