'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setActiveClient, deleteClientAccount } from '@/app/actions/clients';
import { Client } from '@/types/database';
import { Building2, Check, ArrowRight, Trash2, Loader2 } from 'lucide-react';

interface ClientWithCounts extends Client {
  _counts?: {
    contacts: number;
    deals: number;
  };
}

interface ClientsListProps {
  clients: ClientWithCounts[];
  activeClientId?: string;
}

export function ClientsList({ clients, activeClientId }: ClientsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSelect = (clientId: string) => {
    startTransition(async () => {
      await setActiveClient(clientId);
      router.push('/dashboard');
    });
  };

  const handleDelete = (clientId: string, clientName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar al cliente "${clientName}"? Esta acción solo se permite si no tiene datos asociados.`)) {
      return;
    }

    setDeletingId(clientId);
    setErrorMessage(null);

    startTransition(async () => {
      const res = await deleteClientAccount(clientId);
      setDeletingId(null);
      if (!res.success) {
        setErrorMessage(res.error || 'No se pudo eliminar el cliente.');
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex justify-between items-center">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="font-bold ml-2">✕</button>
        </div>
      )}

      {clients.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-8 text-center">
          <Building2 className="w-8 h-8 mx-auto text-slate-400 mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No hay clientes registrados todavía</p>
          <p className="text-xs text-slate-500 mt-1">Crea tu primer cliente con el botón “Nuevo Cliente”.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((client) => {
          const isActive = client.id === activeClientId;
          const hasData = (client._counts?.contacts || 0) > 0 || (client._counts?.deals || 0) > 0;
          const isDeletingThis = deletingId === client.id;

          return (
            <div
              key={client.id}
              className={`p-5 rounded-xl border bg-white dark:bg-slate-900 transition-all flex flex-col justify-between ${
                isActive
                  ? 'border-indigo-500 ring-2 ring-indigo-500/10 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <Check className="w-3 h-3" /> Activo
                      </span>
                    )}

                    <button
                      onClick={() => !hasData && handleDelete(client.id, client.name)}
                      disabled={isPending || isDeletingThis || hasData}
                      title={hasData ? 'No se puede eliminar: tiene datos asociados' : 'Eliminar cliente sin datos'}
                      className={`p-1.5 rounded-lg transition ${
                        hasData
                          ? 'opacity-30 cursor-not-allowed text-slate-400'
                          : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer'
                      }`}
                    >
                      {isDeletingThis ? (
                        <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                  {client.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Slug: {client.slug}
                </p>

                {client._counts && (
                  <div className="flex gap-2 mt-3 text-[11px] text-slate-500">
                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {client._counts.contacts} Contactos
                    </span>
                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {client._counts.deals} Deals
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {new Date(client.created_at).toLocaleDateString()}
                </span>

                <button
                  onClick={() => handleSelect(client.id)}
                  disabled={isPending || isActive}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                    isActive
                      ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-default'
                      : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-400'
                  }`}
                >
                  {isActive ? 'Seleccionado' : 'Entrar al ambiente'}
                  {!isActive && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
