'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ListPlus,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Mail,
  Users,
  Tag,
  X,
} from 'lucide-react';
import {
  addContactsToList,
  bulkUpdateContactMailState,
  createMailList,
  deleteMailList,
  exportMailContactsCsv,
  listContactsForMail,
  listMailLists,
  removeContactsFromList,
  updateContactMailState,
  updateMailList,
  getMailStates,
  type MailContactRow,
} from '@/app/actions/mail-data';
import { LeadDetailDrawer } from '@/components/lead/LeadDetailDrawer';
import { MAIL_COLOR_TO_BG } from '@/lib/mail/states';
import { Contact, Client } from '@/types/database';

interface ListsWorkspaceProps {
  clientId: string;
  currentClient: Client | null;
}

interface ListRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  contact_count?: number;
}

interface StateOption {
  estado: string;
  etiqueta: string;
  color: string;
  orden: number;
}

export function ListsWorkspace({ clientId, currentClient }: ListsWorkspaceProps) {
  const router = useRouter();
  const [lists, setLists] = useState<ListRow[]>([]);
  const [states, setStates] = useState<StateOption[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<MailContactRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkEstado, setBulkEstado] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [newListName, setNewListName] = useState('');
  const [showNewList, setShowNewList] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [drawerContactId, setDrawerContactId] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const searchRef = useRef<number | null>(null);

  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const stateByEstado = useMemo(
    () => new Map(states.map((s) => [s.estado, s])),
    [states]
  );

  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    const result = await listMailLists(clientId);
    if (result.success) setLists(result.lists as any);
    else setError(result.error);
    setLoadingLists(false);
  }, [clientId]);

  const loadStates = useCallback(async () => {
    const result = await getMailStates(clientId);
    if (result.success) setStates(result.states as StateOption[]);
  }, [clientId]);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    const result = await listContactsForMail({
      clientId,
      listaId: activeListId,
      query,
      estado: estadoFilter || null,
      page,
      pageSize,
    });
    if (result.success) {
      setContacts(result.contacts);
      setTotal(result.total);
      setSelected(new Set());
    } else {
      setError(result.error);
    }
    setLoadingContacts(false);
  }, [clientId, activeListId, query, estadoFilter, page]);

  useEffect(() => {
    loadLists();
    loadStates();
  }, [loadLists, loadStates]);

  useEffect(() => {
    setPage(1);
  }, [activeListId, query, estadoFilter]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const showOk = (text: string) => {
    setMessage(text);
    setError('');
  };

  const run = (task: () => Promise<void>) => {
    startTransition(task);
  };

  const createList = () => {
    const name = newListName.trim();
    if (!name) return;
    run(async () => {
      const result = await createMailList(clientId, { name });
      if (result.success) {
        setNewListName('');
        setShowNewList(false);
        await loadLists();
        showOk('Lista creada.');
      } else {
        setError(result.error);
      }
    });
  };

  const renameList = (id: string) => {
    const name = renameValue.trim();
    if (!name) return;
    run(async () => {
      const result = await updateMailList(id, { name });
      if (result.success) {
        setRenamingId(null);
        await loadLists();
        showOk('Lista actualizada.');
      } else {
        setError(result.error);
      }
    });
  };

  const removeList = (id: string) => {
    if (!confirm('¿Eliminar esta lista? Los contactos siguen en CRM pero se quitan de la lista.')) return;
    run(async () => {
      const result = await deleteMailList(id);
      if (result.success) {
        if (activeListId === id) setActiveListId(null);
        await loadLists();
        showOk('Lista eliminada.');
      } else {
        setError(result.error);
      }
    });
  };

  const allSelected = contacts.length > 0 && selected.size === contacts.length;

  const toggleAll = () => {
    setSelected((current) =>
      current.size === contacts.length
        ? new Set()
        : new Set(contacts.map((c) => c.id))
    );
  };

  const toggleOne = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyBulkEstado = () => {
    if (!bulkEstado || selected.size === 0) return;
    run(async () => {
      const result = await bulkUpdateContactMailState(
        clientId,
        Array.from(selected),
        bulkEstado
      );
      if (result.success) {
        showOk(`${result.updated.toLocaleString('es-MX')} contacto(s) actualizados.`);
        await loadContacts();
      } else {
        setError(result.error);
      }
    });
  };

  const addToList = (targetListId: string) => {
    if (!targetListId || selected.size === 0) return;
    run(async () => {
      const result = await addContactsToList(targetListId, Array.from(selected));
      if (result.success) {
        showOk(`Agregados a la lista.`);
        await loadLists();
        await loadContacts();
      } else {
        setError(result.error);
      }
    });
  };

  const removeFromList = () => {
    if (!activeListId || selected.size === 0) return;
    run(async () => {
      const result = await removeContactsFromList(activeListId, Array.from(selected));
      if (result.success) {
        showOk('Se quitaron de la lista.');
        await loadLists();
        await loadContacts();
      } else {
        setError(result.error);
      }
    });
  };

  const exportCsv = () => {
    run(async () => {
      const result = await exportMailContactsCsv({
        clientId,
        listaId: activeListId,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      showOk(`Exportados ${result.count.toLocaleString('es-MX')} contactos.`);
    });
  };

  const badgeFor = (estado: string) => {
    const state = stateByEstado.get(estado);
    const color = state?.color || 'gray';
    return {
      label: state?.etiqueta || estado,
      className: MAIL_COLOR_TO_BG[color] || MAIL_COLOR_TO_BG.gray,
    };
  };

  const activeList = lists.find((l) => l.id === activeListId) || null;

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Listas y Contactos</h1>
            {currentClient && (
              <span className="rounded-full border border-[#00d4ff]/30 bg-[#00d4ff]/10 px-2.5 py-1 text-[11px] font-semibold text-[#00d4ff]">
                {currentClient.name}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Organiza tus audiencias, estados de suscripción y exportaciones antes de enviar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-[#00d4ff]/40 hover:text-white"
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
          <button
            onClick={() => router.push('/dashboard/mail-center/importar')}
            className="inline-flex items-center gap-1 rounded-lg bg-[#00d4ff] px-3 py-2 text-xs font-semibold text-[#06152b] transition hover:bg-cyan-300"
          >
            <Upload className="h-4 w-4" /> Importar CSV
          </button>
        </div>
      </div>

      {(message || error) && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-xs ${
            error
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        {/* Listas */}
        <aside className="rounded-2xl border border-white/10 bg-[#0c1f3d] p-4 h-fit lg:sticky lg:top-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Listas
            </h2>
            <button
              onClick={() => setShowNewList((v) => !v)}
              className="rounded-lg p-1.5 text-[#00d4ff] transition hover:bg-[#00d4ff]/10"
              title="Nueva lista"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {showNewList && (
            <div className="mt-3 flex items-center gap-2">
              <input
                autoFocus
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createList()}
                placeholder="Nombre de la lista…"
                className="w-full rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-xs text-white outline-none focus:border-[#00d4ff]"
              />
              <button
                onClick={createList}
                className="rounded-lg bg-[#00d4ff] p-2 text-[#06152b]"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="mt-3 space-y-1.5 max-h-[60vh] overflow-y-auto">
            <button
              onClick={() => setActiveListId(null)}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs transition ${
                !activeListId
                  ? 'border-[#00d4ff]/40 bg-[#00d4ff]/10 text-white'
                  : 'border-white/5 bg-white/[0.02] text-slate-400 hover:border-white/10 hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-2 font-semibold">
                <Users className="h-4 w-4" /> Todos los contactos
              </span>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-500">
                {total}
              </span>
            </button>

            {loadingLists ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
              </div>
            ) : lists.length === 0 ? (
              <p className="px-2 py-6 text-center text-[11px] text-slate-500">
                Aún no hay listas.{' '}
                <button onClick={() => setShowNewList(true)} className="text-[#00d4ff] underline">
                  Crear una
                </button>
              </p>
            ) : (
              lists.map((list) => (
                <div
                  key={list.id}
                  className={`group rounded-xl border px-3 py-2 transition ${
                    activeListId === list.id
                      ? 'border-[#00d4ff]/40 bg-[#00d4ff]/10'
                      : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                  }`}
                >
                  {renamingId === list.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') renameList(list.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        className="w-full rounded bg-[#0a1931] px-2 py-1 text-xs text-white outline-none border border-[#00d4ff]/40"
                      />
                      <button onClick={() => renameList(list.id)} className="text-[#00d4ff]">
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => setActiveListId(list.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate text-xs font-semibold text-slate-200">
                          {list.name}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {list.contact_count?.toLocaleString('es-MX')} contacto(s)
                        </span>
                      </button>
                      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                          onClick={() => {
                            setRenamingId(list.id);
                            setRenameValue(list.name);
                          }}
                          className="rounded p-1 text-slate-500 hover:text-white"
                          title="Renombrar"
                        >
                          <ListPlus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removeList(list.id)}
                          className="rounded p-1 text-slate-500 hover:text-rose-400"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Contactos */}
        <section className="lg:col-span-3 rounded-2xl border border-white/10 bg-[#0c1f3d] overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar…"
                  className="w-40 bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
                />
              </div>
              <select
                value={estadoFilter}
                onChange={(e) => setEstadoFilter(e.target.value)}
                className="rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-xs text-slate-300 outline-none"
              >
                <option value="">Todos los estados</option>
                {states.map((s) => (
                  <option key={s.estado} value={s.estado}>
                    {s.etiqueta}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-500">
                {total.toLocaleString('es-MX')} resultado(s)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <>
                  <select
                    value={bulkEstado}
                    onChange={(e) => setBulkEstado(e.target.value)}
                    className="rounded-lg border border-white/10 bg-[#0a1931] px-2 py-2 text-[11px] text-slate-300 outline-none"
                  >
                    <option value="">Cambiar estado…</option>
                    {states.map((s) => (
                      <option key={s.estado} value={s.estado}>
                        {s.etiqueta}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={applyBulkEstado}
                    disabled={!bulkEstado || busy}
                    className="rounded-lg bg-violet-600 px-2.5 py-2 text-[11px] font-semibold text-white transition hover:bg-violet-700 disabled:opacity-40"
                  >
                    Aplicar ({selected.size})
                  </button>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) addToList(e.target.value);
                      e.target.value = '';
                    }}
                    className="rounded-lg border border-white/10 bg-[#0a1931] px-2 py-2 text-[11px] text-slate-300 outline-none"
                  >
                    <option value="">Agregar a lista…</option>
                    {lists.filter((l) => l.id !== activeListId).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  {activeListId && (
                    <button
                      onClick={removeFromList}
                      disabled={busy}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500/20"
                    >
                      Quitar de lista
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-white/[0.02] text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded accent-[#00d4ff]"
                    />
                  </th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Correo</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loadingContacts ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-600" />
                    </td>
                  </tr>
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                      <Mail className="mx-auto mb-2 h-8 w-8 text-slate-700" />
                      No hay contactos{activeListId ? ' en esta lista' : ''}.
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => {
                    const badge = badgeFor(contact.mail_state);
                    const checked = selected.has(contact.id);
                    return (
                      <tr
                        key={contact.id}
                        className={`transition ${
                          checked ? 'bg-[#00d4ff]/5' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOne(contact.id)}
                            className="h-4 w-4 rounded accent-[#00d4ff]"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setDrawerContactId(contact.id)}
                            className="text-left font-medium text-slate-200 hover:text-[#00d4ff] transition"
                          >
                            {contact.first_name} {contact.last_name || ''}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{contact.email}</td>
                        <td className="px-4 py-3 text-slate-400 max-w-[140px] truncate">
                          {contact.empresa || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={contact.mail_state}
                            onChange={async (e) => {
                              const result = await updateContactMailState(contact.id, e.target.value);
                              if (!result.success) setError(result.error);
                              else loadContacts();
                            }}
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold outline-none ${badge.className}`}
                          >
                            {states.map((s) => (
                              <option key={s.estado} value={s.estado}>
                                {s.etiqueta}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(contact.created_at as string).toLocaleDateString('es-MX')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-2.5 text-[11px] text-slate-500">
            <span>
              Página {page} de {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-white/10 p-1.5 transition hover:border-white/25 hover:text-white disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-white/10 p-1.5 transition hover:border-white/25 hover:text-white disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </div>

      <LeadDetailDrawer
        open={!!drawerContactId}
        contactId={drawerContactId || undefined}
        onClose={() => setDrawerContactId(null)}
      />
    </div>
  );
}
