'use client';

import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  Loader2,
  Plus,
  Search,
  UserRound,
  UserRoundPlus,
  X,
  AlertCircle,
  Kanban,
} from 'lucide-react';
import {
  createLeadFromKanban,
  searchContactsForLead,
  type ContactSearchRow,
} from '@/app/actions/lead-create';
import { Stage } from '@/types/database';

interface AddLeadDialogProps {
  clientId?: string;
  stages: Stage[];
}

type Mode = 'existing' | 'new';

export function AddLeadDialog({ clientId, stages }: AddLeadDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('existing');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContactSearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ContactSearchRow | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [title, setTitle] = useState('');
  const [value, setValue] = useState('0');
  const [stageId, setStageId] = useState(stages[0]?.id || '');

  const [error, setError] = useState('');
  const [saving, startTransition] = useTransition();
  const searchRef = useRef<number | null>(null);
  const titleTouched = useRef(false);

  const reset = () => {
    setMode('existing');
    setQuery('');
    setResults([]);
    setSelected(null);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setTitle('');
    setValue('0');
    setStageId(stages[0]?.id || '');
    setError('');
    titleTouched.current = false;
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const openDialog = () => {
    reset();
    setOpen(true);
  };

  // Título automático a partir del nombre/email
  useEffect(() => {
    if (titleTouched.current) return;
    if (mode === 'existing') {
      if (selected) {
        setTitle(
          `${selected.first_name} ${selected.last_name || ''}`.trim()
        );
      }
    } else {
      const auto = `${firstName} ${lastName}`.trim();
      setTitle(auto);
    }
  }, [mode, selected, firstName, lastName]);

  // Búsqueda con debounce
  useEffect(() => {
    if (!open || mode !== 'existing' || selected) return;
    if (searchRef.current) window.clearTimeout(searchRef.current);

    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    searchRef.current = window.setTimeout(async () => {
      if (!clientId) return;
      setSearching(true);
      const response = await searchContactsForLead(clientId, q);
      setSearching(false);
      if (response.success) setResults(response.contacts);
      else setError(response.error || 'Error al buscar.');
    }, 300);

    return () => {
      if (searchRef.current) window.clearTimeout(searchRef.current);
    };
  }, [query, open, mode, selected, clientId]);

  const canSubmit = useMemo(() => {
    if (mode === 'existing') return Boolean(selected);
    return Boolean(firstName.trim() && email.trim());
  }, [mode, selected, firstName, email]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!canSubmit) {
      setError(mode === 'existing' ? 'Selecciona un contacto.' : 'Completa nombre y correo.');
      return;
    }

    startTransition(async () => {
      const result = await createLeadFromKanban({
        clientId,
        contactId: selected?.id,
        newContact:
          mode === 'new'
            ? {
                first_name: firstName,
                last_name: lastName,
                email,
                phone,
              }
            : undefined,
        title: title.trim() || undefined,
        value: Number(value) || 0,
        stageId: stageId || undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.refresh();
      close();
    });
  };

  return (
    <>
      <button
        onClick={openDialog}
        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
      >
        <Plus className="h-4 w-4" />
        Agregar lead
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit}
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                  <Kanban className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Nuevo lead
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Se crea en Contactos y en el pipeline.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Modo */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('existing');
                    setError('');
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    mode === 'existing'
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-800 dark:text-slate-400'
                  }`}
                >
                  <UserRound className="h-4 w-4" />
                  Contacto existente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('new');
                    setError('');
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    mode === 'new'
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-800 dark:text-slate-400'
                  }`}
                >
                  <UserRoundPlus className="h-4 w-4" />
                  Crear contacto
                </button>
              </div>

              {mode === 'existing' ? (
                <div className="space-y-2">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Buscar contacto
                  </label>
                  {selected ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/40">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                          {selected.first_name[0]?.toUpperCase() || 'C'}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                            {selected.first_name} {selected.last_name || ''}
                          </p>
                          <p className="truncate text-[10px] text-emerald-700 dark:text-emerald-400">
                            {selected.email || 'Sin correo'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelected(null)}
                        className="text-[10px] font-semibold text-emerald-800 hover:underline dark:text-emerald-300"
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:border-indigo-400 dark:border-slate-800 dark:bg-slate-950/50">
                        <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
                        <input
                          autoFocus
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Nombre, correo o teléfono…"
                          className="w-full bg-transparent text-sm outline-none dark:text-slate-100"
                        />
                        {searching && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                      </div>
                      {results.length > 0 && (
                        <ul className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                          {results.map((contact) => (
                            <li key={contact.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelected(contact);
                                  setResults([]);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                              >
                                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                                  {contact.first_name[0]?.toUpperCase() || 'C'}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                                    {contact.first_name} {contact.last_name || ''}
                                  </span>
                                  <span className="block truncate text-[10px] text-slate-500">
                                    {contact.email || 'Sin correo'}
                                  </span>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {query.trim().length >= 2 && !searching && results.length === 0 && (
                        <p className="text-[10px] text-slate-400">
                          Sin coincidencias. Prueba con la pestaña “Crear contacto”.
                        </p>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Nombre *
                    </label>
                    <input
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Apellido
                    </label>
                    <input
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Correo *
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Teléfono
                    </label>
                    <input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                </div>
              )}

              {/* Oportunidad */}
              <div className="grid gap-2 sm:grid-cols-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Título de la oportunidad
                  </label>
                  <input
                    value={title}
                    onChange={(event) => {
                      titleTouched.current = true;
                      setTitle(event.target.value);
                    }}
                    placeholder="Se genera a partir del nombre"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Valor esperado
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Etapa inicial
                  </label>
                  <select
                    value={stageId}
                    onChange={(event) => setStageId(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
              <p className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                El lead entra a Contactos y al Kanban.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !canSubmit}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Crear lead
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
