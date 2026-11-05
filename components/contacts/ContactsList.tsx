'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteContact } from '@/app/actions/contacts';
import { LeadDetailDrawer } from '@/components/lead/LeadDetailDrawer';
import { getExternalContactData } from '@/lib/attribution';
import { Contact, Client } from '@/types/database';
import { CopyContactsDialog } from './CopyContactsDialog';
import { Eye, Mail, Phone, Trash2, User, Copy, CheckSquare2, Square } from 'lucide-react';

interface ContactsListProps {
  contacts: Contact[];
  clients: Client[];
  activeClientId?: string;
}

export function ContactsList({ contacts, clients, activeClientId }: ContactsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyOpen, setCopyOpen] = useState(false);

  const allSelected = contacts.length > 0 && selectedIds.size === contacts.length;

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) =>
      prev.size === contacts.length ? new Set() : new Set(contacts.map((c) => c.id))
    );
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`¿Eliminar al contacto "${name}"?`)) return;
    startTransition(async () => {
      await deleteContact(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      router.refresh();
    });
  };

  if (contacts.length === 0) {
    return (
      <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
        <User className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h3 className="font-semibold text-slate-700 dark:text-slate-300">No hay contactos aún</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
          Crea tu primer contacto o captura leads automáticamente a través de los formularios embebidos.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {/* Toolbar de selección / copia */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleAll}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
            >
              {allSelected ? (
                <CheckSquare2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {allSelected ? 'Quitar selección' : 'Seleccionar todos'}
            </button>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {selectedIds.size} seleccionado(s)
            </span>
          </div>

          <button
            onClick={() => setCopyOpen(true)}
            disabled={selectedIds.size === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/70"
          >
            <Copy className="h-4 w-4" />
            Copiar a otro cliente
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Seleccionar todos"
                    className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                  />
                </th>
                <th className="px-5 py-3.5">Nombre</th>
                <th className="px-5 py-3.5">Email</th>
                <th className="px-5 py-3.5">Teléfono</th>
                <th className="px-5 py-3.5">Datos extra</th>
                <th className="px-5 py-3.5">Fecha</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {contacts.map((contact) => {
                const extras = getExternalContactData(contact);
                const checked = selectedIds.has(contact.id);

                return (
                  <tr
                    key={contact.id}
                    className={`transition ${
                      checked
                        ? 'bg-indigo-50/60 dark:bg-indigo-950/20'
                        : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(contact.id)}
                        aria-label={`Seleccionar ${contact.first_name}`}
                        className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                      />
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">
                      <button
                        onClick={() => setSelectedContactId(contact.id)}
                        className="flex items-center gap-2.5 text-left group"
                        title="Ver journey del lead"
                      >
                        <span className="h-8 w-8 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                          {contact.first_name[0]}
                        </span>
                        <span className="group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                          {contact.first_name} {contact.last_name || ''}
                        </span>
                      </button>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {contact.email}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                      {contact.phone ? (
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {contact.phone}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Sin teléfono</span>
                      )}
                    </td>
                    <td className="px-5 py-4 min-w-[220px]">
                      {extras.length > 0 ? (
                        <div className="text-[11px] text-slate-500 space-y-0.5">
                          {extras.map(([key, value]) => (
                            <div key={key} className="flex items-center gap-1.5 font-mono">
                              <span className="text-indigo-600 dark:text-indigo-400">
                                {key}:
                              </span>
                              <span className="max-w-[180px] truncate">{value}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-xs">
                      {contact.created_at
                        ? new Date(contact.created_at).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedContactId(contact.id)}
                          title="Ver journey"
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            handleDelete(
                              contact.id,
                              `${contact.first_name} ${contact.last_name || ''}`
                            )
                          }
                          disabled={isPending}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CopyContactsDialog
        open={copyOpen}
        clients={clients}
        currentClientId={activeClientId}
        selectedIds={Array.from(selectedIds)}
        onClose={() => setCopyOpen(false)}
        onCopied={() => {
          setSelectedIds(new Set());
          router.refresh();
        }}
      />

      <LeadDetailDrawer
        open={!!selectedContactId}
        contactId={selectedContactId || undefined}
        onClose={() => setSelectedContactId(null)}
      />
    </>
  );
}
