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
    { label: 'Pipelines', href: '/dashboard', icon: LayoutDashboard, exact: true },
    { label: 'Clientes', href: '/dashboard/clients', icon: Building2, hidden: !isRoot },
    { label: 'Contactos', href: '/dashboard/contacts', icon: Users },
    { label: 'Formularios', href: '/dashboard/forms', icon: FileText },
    { label: 'Tracking', href: '/dashboard/tracking', icon: Activity },
    { label: 'Social', href: '/dashboard/social-accounts', icon: Share2 },
    { label: 'Calendario', href: '/dashboard/calendar', icon: CalendarDays },
    { label: 'IA Contenido', href: '/dashboard/ai-agent', icon: Brain },
    { label: 'Ads', href: '/dashboard/campaigns', icon: Megaphone },
    { label: 'Mail', href: '/dashboard/mail-center/campanas', icon: Mail },
    { label: 'Listas', href: '/dashboard/mail-center/listas', icon: ListChecks },
    { label: 'Importar', href: '/dashboard/mail-center/importar', icon: Upload },
    { label: 'Validar', href: '/dashboard/mail-center/validacion', icon: BadgeCheck },
    { label: 'Integraciones', href: '/dashboard/mail-center/integraciones', icon: Plug },
    { label: 'Usuarios', href: '/dashboard/users', icon: ShieldAlert, hidden: !isRoot },
    { label: 'Ajustes', href: '/dashboard/settings', icon: Settings, hidden: !isRoot },
  ];

  const visibleItems = navItems.filter((item) => !item.hidden);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href);

  // Cerrar menú móvil al navegar
  React.useEffect(() => {
    if (mobileOpen) setMobileOpen(false);
  }, [pathname, mobileOpen]);

  return (
    <>
      {/* Overlay móvil */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-[99] lg:hidden transition-all duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Botón móvil - siempre visible */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-[101] lg:hidden p-2 rounded-xl text-slate-200 hover:text-cyan-400 hover:bg-slate-800/50 transition bg-slate-900/70"
        aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar móvil - off-canvas con animación */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-[99] bg-black/60 backdrop-blur-md lg:hidden transition-all duration-300" />
          <aside className="fixed top-0 left-0 z-[100] h-screen w-64 bg-slate-900/95 border-r border-slate-800/50 shadow-2xl transform -translate-x-full transition-transform duration-300 ease-out lg:hidden"
            style={{ transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)' }}>
            <MobileSidebarContent
              clients={clients}
              activeClientId={activeClientId}
              currentUser={currentUser}
              isRoot={isRoot}
              pathname={pathname}
              isActive={isActive}
              visibleItems={visibleItems}
            />
          </aside>
        </>
      )}

      {/* Sidebar desktop - permanente */}
      <aside className="hidden lg:flex bg-slate-900/95 border-r border-slate-800/50 h-screen transition-all duration-300 w-64">
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
          mobile={false}
        />
      </aside>

      {/* Spacer para desktop cuando la sidebar se colapsa - opcional */}
      {collapsed && (
        <div className="hidden lg:block w-16 bg-slate-900/95 border-r border-slate-800/50" />
      )}
    </>
  );
}

interface MobileSidebarContentProps {
  clients: Client[];
  activeClientId?: string;
  currentUser: AppUser | null;
  isRoot: boolean;
  pathname: string;
  isActive: (href: string) => boolean;
  visibleItems: Array<{ label: string; href: string; icon: any; exact?: boolean; hidden?: boolean }>;
}

function MobileSidebarContent({
  clients,
  activeClientId,
  currentUser,
  isRoot,
  pathname,
  isActive,
  visibleItems,
}: MobileSidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-2.5 border-b border-slate-800/50 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-cyan-500 text-white flex items-center justify-center font-bold text-sm shadow-md">
            S
          </div>
          <span className="font-bold text-base text-white">SLT</span>
        </Link>
      </div>

      {/* Client Switcher - solo en desktop */}
      {isRoot && clients.length > 0 && (
        <div className="px-2.5 py-2 border-b border-slate-800/50">
          <ClientSwitcher clients={clients} activeClientId={activeClientId} />
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-2.5 py-1.5 text-sm rounded-lg transition-all duration-200 ${
                isActive(item.href)
                  ? 'bg-cyan-500/15 text-cyan-300 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive(item.href) ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span className="truncate flex-1 text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-2.5 border-t border-slate-800/50">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/40 mb-2">
          <div className="h-6 w-6 rounded-full bg-cyan-500 text-white flex items-center justify-center font-bold text-[11px] flex-shrink-0">
            {currentUser?.name ? currentUser.name[0].toUpperCase() : 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-slate-100 block truncate">
              {currentUser?.name || 'Admin'}
            </span>
            <span className="text-[11px] text-slate-300 block">
              {isRoot ? 'SuperAdmin' : 'Cliente'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1 text-[11px] text-slate-500">
          <a href="/app/docs/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition truncate">
            Política de privacidad
          </a>
          <a href="/app/docs/data-deletion" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition">
            Eliminar mis datos
          </a>
        </div>
      </div>
    </div>
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`p-1.5 border-b border-slate-800/50 flex items-center gap-1.5 ${collapsed ? 'justify-center px-1.5' : 'justify-between px-2.5'}`}>
        <Link href="/dashboard" className="flex items-center gap-1.5">
          <div className="h-7 w-7 rounded-lg bg-cyan-500 text-white flex items-center justify-center font-bold text-sm shadow-md">
            S
          </div>
          {!collapsed && (
            <span className="font-bold text-base text-white">SLT</span>
          )}
        </Link>

        {/* Client Switcher - solo en desktop no móvil */}
        {!mobile && isRoot && (
          <ClientSwitcher clients={clients} activeClientId={activeClientId} />
        )}

        {/* Botón colapsar */}
        {!mobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-lg p-1 text-slate-300 hover:text-cyan-400 hover:bg-slate-800/40 transition"
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-1 space-y-0.25 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-2 py-0.75 text-xs rounded-lg transition-all duration-200 ${
                isActive(item.href)
                  ? 'bg-cyan-500/15 text-cyan-300 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Icon className={`w-3 h-3 shrink-0 ${isActive(item.href) ? 'text-cyan-400' : 'text-slate-400'}`} />
              {!collapsed && <span className="truncate flex-1 text-xs">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="p-1.5 border-t border-slate-800/50">
        <div className="flex flex-col gap-0.5 mb-1.5">
          <div className={`flex items-center gap-1.5 p-1.5 rounded-lg bg-slate-800/40 ${
            collapsed ? 'justify-center' : 'justify-between'
          }`}>
            <div className="h-5 w-5 rounded-full bg-cyan-500 text-white flex items-center justify-center font-bold text-[9px] flex-shrink-0">
              {currentUser?.name ? currentUser.name[0].toUpperCase() : 'U'}
            </div>
            {!collapsed && (
              <span className="text-[9px] font-medium text-slate-100 truncate flex-1">
                {currentUser?.name || 'Admin'}
              </span>
            )}
          </div>
          
          <div className={`flex items-center gap-1.5 ${
            collapsed ? 'justify-center' : 'justify-between'
          }`}>
            {!collapsed && (
              <span className="text-[9px] text-slate-300">
                {isRoot ? 'SuperAdmin' : 'Cliente'}
              </span>
            )}
            <form action={logoutUser}>
              <button
                type="submit"
                title="Cerrar Sesión"
                className="rounded-lg p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition text-[10px]"
              >
                Cerrar
              </button>
            </form>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 text-[9px] text-slate-500">
          <a href="/app/docs/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition truncate">
            Política de privacidad
          </a>
          <a href="/app/docs/data-deletion" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition">
            Eliminar mis datos
          </a>
        </div>
      </div>
    </div>
  );
}