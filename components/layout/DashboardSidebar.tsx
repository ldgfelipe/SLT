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
  Share2,
  CalendarDays,
  Megaphone,
  Settings,
  Mail,
  ListChecks,
  Upload,
  BadgeCheck,
  Plug,
  Brain,
  Menu,
  X,
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
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);

  const isRoot = currentUser?.role === 'root';

  const navItems = [
    {
      label: 'Pipelines',
      href: '/dashboard',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      label: 'Clientes',
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
      label: 'Tracking',
      href: '/dashboard/tracking',
      icon: Activity,
    },
    {
      label: 'Social',
      href: '/dashboard/social-accounts',
      icon: Share2,
    },
    {
      label: 'Calendario',
      href: '/dashboard/calendar',
      icon: CalendarDays,
    },
    {
      label: 'IA Contenido',
      href: '/dashboard/ai-agent',
      icon: Brain,
    },
    {
      label: 'Ads',
      href: '/dashboard/campaigns',
      icon: Megaphone,
    },
    {
      label: 'Mail',
      href: '/dashboard/mail-center/campanas',
      icon: Mail,
    },
    {
      label: 'Listas',
      href: '/dashboard/mail-center/listas',
      icon: ListChecks,
    },
    {
      label: 'Importar',
      href: '/dashboard/mail-center/importar',
      icon: Upload,
    },
    {
      label: 'Validar',
      href: '/dashboard/mail-center/validacion',
      icon: BadgeCheck,
    },
    {
      label: 'Integraciones',
      href: '/dashboard/mail-center/integraciones',
      icon: Plug,
    },
    {
      label: 'Usuarios',
      href: '/dashboard/users',
      icon: ShieldAlert,
      hidden: !isRoot,
    },
    {
      label: 'Ajustes',
      href: '/dashboard/settings',
      icon: Settings,
      hidden: !isRoot,
    },
  ];

  const visibleItems = navItems.filter((item) => !item.hidden);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href);

  // Cerrar menú móvil al navegar
  React.useEffect(() => {
    if (mobileOpen) setMobileOpen(false);
  }, [pathname, mobileOpen]);

  return (
    <>
      {/* Botón móvil */}
      <div className="lg:hidden fixed top-4 left-4 z-[100] p-2">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-xl p-2 text-slate-200 hover:text-cyan-400 hover:bg-slate-800/50 transition bg-slate-900/70"
          aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Overlay para móvil */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-md z-[99] transition"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col h-screen bg-slate-900/95 border-r border-slate-800/50">
        <SidebarContent
          clients={clients}
          activeClientId={activeClientId}
          currentUser={currentUser}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          isRoot={isRoot}
          pathname={pathname}
          isActive={isActive}
          visibleItems={visibleItems}
        />
      </aside>

      {/* Sidebar móvil */}
      {mobileOpen && (
        <aside className="lg:hidden fixed inset-y-0 left-0 z-[100] w-64 bg-slate-900/95 border-r border-slate-800/50 shadow-2xl">
          <SidebarContent
            clients={clients}
            activeClientId={activeClientId}
            currentUser={currentUser}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            isRoot={isRoot}
            pathname={pathname}
            isActive={isActive}
            visibleItems={visibleItems}
            mobile
          />
        </aside>
      )}
    </>
  );
}

interface SidebarContentProps {
  clients: Client[];
  activeClientId?: string;
  currentUser: AppUser | null;
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
  isRoot: boolean;
  pathname: string;
  isActive: (href: string) => boolean;
  visibleItems: Array<{ label: string; href: string; icon: any; exact?: boolean; hidden?: boolean }>;
  mobile?: boolean;
}

function SidebarContent({
  clients,
  activeClientId,
  currentUser,
  collapsed,
  setCollapsed,
  isRoot,
  pathname,
  isActive,
  visibleItems,
  mobile = false,
}: SidebarContentProps) {
  return (
    <>
      {/* Header */}
      <div className={`p-3 border-b border-slate-800/50 ${collapsed ? 'items-center justify-center' : ''}`}>
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-cyan-500 text-white flex items-center justify-center font-bold text-sm shadow-md">
            S
          </div>
          {!collapsed && (
            <div>
              <span className="font-bold text-base text-white">SLT</span>
              <span className="text-xs text-slate-400 block -mt-0.5">Lead Tracker</span>
            </div>
          )}
        </Link>

        {!mobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto rounded-xl p-1.5 text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 transition"
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-1.5 text-sm rounded-lg transition-all duration-200 ${
                isActive(item.href)
                  ? 'bg-cyan-500/15 text-cyan-300 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive(item.href) ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-2 border-t border-slate-800/50">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40 mb-2">
          <div className="h-7 w-7 rounded-full bg-cyan-500 text-white flex items-center justify-center font-bold text-xs">
            {currentUser?.name ? currentUser.name[0].toUpperCase() : 'U'}
          </div>
          {!collapsed && (
            <div className="truncate">
              <span className="text-xs font-medium text-slate-100 block">{currentUser?.name || 'Admin'}</span>
              <span className="text-[10px] text-slate-500 block -mt-0.5">
                {isRoot ? 'SuperAdmin' : 'Cliente'}
              </span>
            </div>
          )}
          <form action={logoutUser} className="ml-auto">
            <button
              type="submit"
              title="Cerrar Sesión"
              className="p-1 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 justify-center">
          <a
            href="/app/docs/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-cyan-400 transition"
          >
            Privacidad
          </a>
          <a
            href="/app/docs/data-deletion"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-cyan-400 transition"
          >
            Borrar datos
          </a>
        </div>
      </div>
    </>
  );
}