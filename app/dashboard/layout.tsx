import Link from 'next/link';
import { LayoutDashboard, Users, FileText, Activity, Building2 } from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { ClientSwitcher } from '@/components/layout/ClientSwitcher';
import { Client } from '@/types/database';

export const instant = false;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let clients: Client[] = [];
  let activeClientId: string | undefined;

  try {
    const cookieStore = await cookies();
    activeClientId = cookieStore.get('slt_active_client_id')?.value;

    const supabase = await createServerSupabaseClient();
    const { data: clientsData } = await supabase
      .from('clients')
      .select('*')
      .order('name');

    if (clientsData && clientsData.length > 0) {
      clients = clientsData;
      if (!activeClientId) {
        activeClientId = clients[0].id;
      }
    }
  } catch {
    // Si no hay conexión a Supabase aún, clientes mock para previsualizar el switcher
    clients = [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Agencia Alpha (Demo)',
        slug: 'alpha',
        created_at: new Date().toISOString(),
      },
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        name: 'Tech Solutions (Demo)',
        slug: 'tech-corp',
        created_at: new Date().toISOString(),
      },
    ];
    activeClientId = clients[0].id;
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
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

          {/* Switcher de Clientes */}
          <ClientSwitcher clients={clients} activeClientId={activeClientId} />
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
          >
            <LayoutDashboard className="w-4 h-4" />
            Pipelines (Kanban)
          </Link>

          <Link
            href="/dashboard/clients"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
          >
            <Building2 className="w-4 h-4" />
            Gestión de Clientes
          </Link>

          <Link
            href="/dashboard/contacts"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
          >
            <Users className="w-4 h-4" />
            Contactos
          </Link>

          <Link
            href="/dashboard/forms"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
          >
            <FileText className="w-4 h-4" />
            Formularios
          </Link>

          <Link
            href="/dashboard/tracking"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
          >
            <Activity className="w-4 h-4" />
            Pixel & Tracking
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 flex items-center justify-between">
          <span>SLT Multi-Tenant</span>
          <span className="text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 px-1.5 py-0.5 rounded font-mono">v1.1</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
