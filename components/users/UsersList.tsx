'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteUserAccount } from '@/app/actions/auth';
import { AppUser, Client } from '@/types/database';
import { ShieldCheck, User, Trash2, Mail } from 'lucide-react';

interface UsersListProps {
  users: AppUser[];
  clients: Client[];
  currentUserId: string;
}

export function UsersList({ users, clients, currentUserId }: UsersListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const getClientName = (clientId?: string | null) => {
    if (!clientId) return 'Global (Todos los clientes)';
    return clients.find((c) => c.id === clientId)?.name || 'Cliente asignado';
  };

  const handleDelete = (userId: string, userName: string) => {
    if (!confirm(`¿Eliminar al usuario "${userName}"?`)) return;
    startTransition(async () => {
      const res = await deleteUserAccount(userId);
      if (!res.success) {
        alert(res.error || 'No se pudo eliminar el usuario');
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th className="px-5 py-3.5">Usuario</th>
            <th className="px-5 py-3.5">Email</th>
            <th className="px-5 py-3.5">Rol</th>
            <th className="px-5 py-3.5">Ambiente / Cliente</th>
            <th className="px-5 py-3.5 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            return (
              <tr key={user.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    user.role === 'root'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                      : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400'
                  }`}>
                    {user.role === 'root' ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div>
                    <div>{user.name}</div>
                    {isSelf && <span className="text-[10px] text-indigo-600 font-semibold">(Tú)</span>}
                  </div>
                </td>
                <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {user.email}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    user.role === 'root'
                      ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                      : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                  }`}>
                    {user.role === 'root' ? 'SuperAdmin Root' : 'Admin Cliente'}
                  </span>
                </td>
                <td className="px-5 py-4 text-slate-600 dark:text-slate-400 text-xs">
                  {getClientName(user.client_id)}
                </td>
                <td className="px-5 py-4 text-right">
                  {!isSelf && (
                    <button
                      onClick={() => handleDelete(user.id, user.name)}
                      disabled={isPending}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
