'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Activity,
  ShieldAlert,
  LogOut,
  UserCheck,
} from 'lucide-react';
import { ClientSwitcher } from '@/components/layout/ClientSwitcher';
import { logoutUser } from '@/app/actions/auth';
import { Client, AppUser } from '@/types/database';

interface DashboardSidebarProps {
  clients: Client[];
  activeClientId?: string;
  currentUser: AppUser | null;
}

export function DashboardSidebar({
  clients,
  activeClientId,
  currentUser,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  const isRoot = currentUser?.role === 'root';

  const navItems = [
    {
      label: 'Pipelines (Kanban)',
      href: '/dashboard',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      label: 'Gestión de Clientes',
      href: '/dashboard/clients',
      icon: Building2,
      hidden: !isRoot,
    },
    {
      label: 'Contactos',
      href: '/dashboard/contacts',
      icon: Users,
    },
    {
      label: 'Formularios',
      href: '/dashboard/forms',
      icon: FileText,
    },
    {
      label: 'Pixel & Tracking',
      href: '/dashboard/tracking',
      icon: Activity,
    },
    {
      label: 'Gestión de Usuarios',
      href: '/dashboard/users',
      icon: ShieldAlert,
      hidden: !isRoot,
    },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-screen">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <Link href="/dashboard" className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            S
          </div>
          <div>
            <span className="font-bold tracking-tight text-lg">SLT</span>
            <span className="text-[11px] text-slate-400 block -mt-1 font-medium">Simple Lead Tracker</span>
          </div>
        </Link>

        {/* Switcher de Clientes (Si es Root puede cambiar a cualquiera, si no, ve el suyo) */}
        {isRoot ? (
          <ClientSwitcher clients={clients} activeClientId={activeClientId} />
        ) : (
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
              Ambiente Asignado
            </span>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
              {clients.find((c) => c.id === activeClientId)?.name || 'Cliente Asignado'}
            </span>
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems
          .filter((item) => !item.hidden)
          .map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 mb-2">
          <div className="flex items-center gap-2 truncate">
            <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
              {currentUser?.name ? currentUser.name[0].toUpperCase() : 'U'}
            </div>
            <div className="truncate">
              <span className="text-xs font-medium text-slate-900 dark:text-slate-100 block truncate">
                {currentUser?.name || 'Administrador'}
              </span>
              <span className="text-[10px] text-slate-400 block -mt-0.5">
                {isRoot ? 'Root SuperAdmin' : 'Admin Cliente'}
              </span>
            </div>
          </div>

          <form action={logoutUser}>
            <button
              type="submit"
              title="Cerrar Sesión"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
