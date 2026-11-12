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
      label: 'Cuentas Sociales',
      href: '/dashboard/social-accounts',
      icon: Share2,
    },
    {
      label: 'Calendario Publicador',
      href: '/dashboard/calendar',
      icon: CalendarDays,
    },
    {
      label: 'Agente IA Contenido',
      href: '/dashboard/ai-agent',
      icon: Brain,
    },
    {
      label: 'Campañas Ads',
      href: '/dashboard/campaigns',
      icon: Megaphone,
    },
    {
      label: 'Campañas Mail',
      href: '/dashboard/mail-center/campanas',
      icon: Mail,
    },
    {
      label: 'Listas y Contactos',
      href: '/dashboard/mail-center/listas',
      icon: ListChecks,
    },
    {
      label: 'Importar CSV',
      href: '/dashboard/mail-center/importar',
      icon: Upload,
    },
    {
      label: 'Validar Correos',
      href: '/dashboard/mail-center/validacion',
      icon: BadgeCheck,
    },
    {
      label: 'Integraciones Mail',
      href: '/dashboard/mail-center/integraciones',
      icon: Plug,
    },
    {
      label: 'Gestión de Usuarios',
      href: '/dashboard/users',
      icon: ShieldAlert,
      hidden: !isRoot,
    },
    {
      label: 'Configuración',
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
      {/* Botón móvil para abrir cerrar */}
      <div className="lg:hidden fixed top-4 left-4 z-[100] p-2">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white transition bg-slate-900/50"
          aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Overlay para móvil */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-[99] transition"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar desktop - siempre visible */}
      <aside className="hidden lg:flex w-64 border-r border-slate-200 dark:border-slate-800 bg-[#0a1931]/30 flex-col h-screen">
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

      {/* Sidebar móvil - desplegable */}
      {mobileOpen && (
        <aside className="lg:hidden fixed left-0 top-0 h-screen w-64 border-r border-slate-200 dark:border-slate-800 bg-[#0a1931]/30 flex flex-col z-[100] shadow-xl">
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
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <Link href="/dashboard" className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-cyan-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            S
          </div>
          {!collapsed && (
            <div>
              <span className="font-bold tracking-tight text-lg text-white">SLT</span>
              <span className="text-[11px] text-slate-400 block -mt-1 font-medium">
                Simple Lead Tracker
              </span>
            </div>
          )}
        </Link>

        {/* Toggle collapse solo en desktop */}
        {!mobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="self-end rounded-lg p-2 text-slate-400 hover:text-cyan-400 hover:bg-white/10 transition"
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition ${
                isActive(item.href)
                  ? 'bg-cyan-500/10 text-cyan-400 font-semibold shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive(item.href) ? 'text-cyan-400' : 'text-slate-400'}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/30 mb-2">
          {collapsed ? (
            <div className="h-7 w-7 rounded-full bg-cyan-500 text-white flex items-center justify-center font-bold text-xs">
              {currentUser?.name ? currentUser.name[0].toUpperCase() : 'U'}
            </div>
          ) : (
            <>
              <div className="h-7 w-7 rounded-full bg-cyan-500 text-white flex items-center justify-center font-bold text-xs">
                {currentUser?.name ? currentUser.name[0].toUpperCase() : 'U'}
              </div>
              <div className="truncate">
                <span className="text-xs font-medium text-slate-100 block truncate">
                  {currentUser?.name || 'Administrador'}
                </span>
                <span className="text-[10px] text-slate-400 block -mt-0.5">
                  {isRoot ? 'Root SuperAdmin' : 'Admin Cliente'}
                </span>
              </div>
            </>
          )}
          <form action={logoutUser} className="ml-auto">
            <button
              type="submit"
              title="Cerrar Sesión"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <a
            href="https://tudominio.com/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-cyan-400 transition"
          >
            Política de privacidad
          </a>
          <a
            href="https://tudominio.com/data-deletion"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-cyan-400 transition"
          >
            Eliminar mis datos
          </a>
        </div>
      </div>
    </>
  );
}