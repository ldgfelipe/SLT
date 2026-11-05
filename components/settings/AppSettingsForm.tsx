'use client';

import React, {
  useActionState,
  useState,
  useTransition,
} from 'react';
import {
  Check,
  KeyRound,
  Loader2,
  Lock,
  Save,
  Trash2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  SECRET_KEY_GROUPS,
  SECRET_KEYS,
} from '@/lib/app/keys';
import {
  saveAppSettings,
  clearAppSetting,
  type SettingsActionResult,
} from '@/app/actions/app-settings';
import type { SettingStatus, SettingSource } from '@/lib/app/settings';

interface AppSettingsFormProps {
  statuses: SettingStatus[];
}

const SOURCE_LABEL: Record<SettingSource, string> = {
  vercel: 'En Vercel',
  db: 'En BD',
  missing: 'Sin configurar',
};

const SOURCE_STYLE: Record<SettingSource, string> = {
  vercel: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
  db: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  missing: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
};

export function AppSettingsForm({ statuses }: AppSettingsFormProps) {
  const statusByKey = new Map(statuses.map((s) => [s.key, s]));
  const [saveState, saveAction, saving] = useActionState(
    saveAppSettings,
    undefined as SettingsActionResult | undefined
  );
  const [clearState, setClearState] = useState<SettingsActionResult | null>(null);
  const [clearPending, startClearTransition] = useTransition();
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const toggleReveal = (key: string) => {
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleClear = (key: string) => {
    if (!confirm(`¿Eliminar ${key} de la base de datos?`)) return;

    startClearTransition(async () => {
      const formData = new FormData();
      formData.set('key', key);
      const result = await clearAppSetting(undefined, formData);
      setClearState(result);
    });
  };

  const feedback = saveState || clearState;

  return (
    <form action={saveAction} className="space-y-6">
      {feedback?.error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {feedback.error}
        </div>
      )}

      {feedback?.message && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {feedback.message}
        </div>
      )}

      {SECRET_KEY_GROUPS.map((group) => {
        const items = SECRET_KEYS.filter((item) => item.group === group.id);
        if (items.length === 0) return null;

        return (
          <section
            key={group.id}
            className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1f3d]/60"
          >
            <header className="border-b border-white/10 px-5 py-3">
              <h2 className="text-sm font-semibold text-white">
                {group.label}
              </h2>
            </header>

            <div className="divide-y divide-white/5">
              {items.map((item) => {
                const status = statusByKey.get(item.key);
                const source: SettingSource = status?.source || 'missing';
                const locked = source === 'vercel';
                const inDb = source === 'db';
                const inputType = revealed.has(item.key) ? 'text' : 'password';

                return (
                  <div
                    key={item.key}
                    className="px-5 py-4 transition hover:bg-white/[0.02]"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <label
                            htmlFor={item.key}
                            className="text-xs font-semibold text-white"
                          >
                            {item.label}
                          </label>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SOURCE_STYLE[source]}`}
                          >
                            {SOURCE_LABEL[source]}
                          </span>
                          {status?.updated_at && (
                            <span className="text-[10px] text-slate-500">
                              Actualizada{' '}
                              {new Date(status.updated_at).toLocaleString(
                                'es-MX',
                                {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }
                              )}
                            </span>
                          )}
                        </div>

                        {item.hint && (
                          <p className="mt-1 text-[11px] text-slate-400">
                            {item.hint}
                          </p>
                        )}

                        {locked && (
                          <p className="mt-1 flex items-center gap-1 text-[10px] text-indigo-300">
                            <Lock className="h-3 w-3" />
                            Definida en Vercel (tiene prioridad). No se puede editar ni
                            borrar desde aquí.
                          </p>
                        )}
                      </div>

                      <div className="flex w-full flex-col gap-2 sm:w-96">
                        <div className="flex items-center gap-2">
                          <input
                            id={item.key}
                            name={item.key}
                            type={inputType}
                            disabled={locked}
                            autoComplete="new-password"
                            placeholder={
                              locked ? '•••••••• (Vercel)' : 'Vacío = conservar'
                            }
                            className="w-full rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 font-mono text-xs text-white placeholder:text-slate-600 outline-none focus:border-[#00d4ff] disabled:cursor-not-allowed disabled:opacity-50"
                          />
                          {!locked && (
                            <button
                              type="button"
                              onClick={() => toggleReveal(item.key)}
                              className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:border-white/25 hover:text-white"
                              aria-label="Mostrar u ocultar"
                            >
                              {revealed.has(item.key) ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </div>

                        {inDb && (
                          <button
                            type="button"
                            disabled={clearPending}
                            onClick={() => handleClear(item.key)}
                            className="inline-flex items-center justify-end gap-1 text-[10px] text-slate-500 transition hover:text-rose-300"
                          >
                            <Trash2 className="h-3 w-3" /> Borrar de BD
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#00d4ff]/20 bg-[#0a1931]/95 px-5 py-4 shadow-2xl shadow-cyan-500/10 backdrop-blur">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <KeyRound className="h-4 w-4 text-[#00d4ff]" />
          Los campos vacíos no se modifican. Las claves guardadas se cifran en BD.
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[#00d4ff] px-5 py-2.5 text-sm font-semibold text-[#06152b] shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar cambios
        </button>
      </div>
    </form>
  );
}
