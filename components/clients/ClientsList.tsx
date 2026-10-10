'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setActiveClient } from '@/app/actions/clients';
import { Client } from '@/types/database';
import { Building2, Check, ArrowRight } from 'lucide-react';

interface ClientsListProps {
  clients: Client[];
  activeClientId?: string;
}

export function ClientsList({ clients, activeClientId }: ClientsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSelect = (clientId: string) => {
    startTransition(async () => {
      await setActiveClient(clientId);
      router.push('/dashboard');
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {clients.map((client) => {
        const isActive = client.id === activeClientId;
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
                {isActive && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <Check className="w-3 h-3" /> Activo
                  </span>
                )}
              </div>

              <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                {client.name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Slug: {client.slug}
              </p>
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
  );
}
