'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setActiveClient } from '@/app/actions/clients';
import { Client } from '@/types/database';
import { Building2, Check, ChevronsUpDown, Plus } from 'lucide-react';
import Link from 'next/link';

interface ClientSwitcherProps {
  clients: Client[];
  activeClientId?: string;
}

export function ClientSwitcher({ clients, activeClientId }: ClientSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = React.useState(false);

  const activeClient = clients.find((c) => c.id === activeClientId) || clients[0];

  const handleSelect = (clientId: string) => {
    setIsOpen(false);
    startTransition(async () => {
      await setActiveClient(clientId);
      router.refresh();
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left"
      >
        <div className="flex items-center gap-2.5 truncate">
          <div className="h-7 w-7 rounded-md bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="truncate">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
              Ambiente Activo
            </span>
            <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate block">
              {activeClient?.name || 'Seleccionar Cliente'}
            </span>
          </div>
        </div>
        <ChevronsUpDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-50 py-1 overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
              Cambiar de Cliente
            </div>

            <div className="max-h-56 overflow-y-auto py-1">
              {clients.map((client) => {
                const isSelected = client.id === activeClient?.id;
                return (
                  <button
                    key={client.id}
                    onClick={() => handleSelect(client.id)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
                  >
                    <span className={`truncate ${isSelected ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      {client.name}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 p-1">
              <Link
                href="/dashboard/clients"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded transition font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Gestionar Clientes
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
