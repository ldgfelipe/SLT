import Link from 'next/link';
import { LayoutDashboard, Users, FileText, Activity } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-lg">
              S
            </div>
            <div>
              <span className="font-bold tracking-tight text-lg">SLT</span>
              <span className="text-xs text-slate-400 block -mt-1">Simple Lead Tracker</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
          >
            <LayoutDashboard className="w-4 h-4" />
            Pipelines (Kanban)
          </Link>
          <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-not-allowed">
            <Users className="w-4 h-4" />
            Contactos
          </div>
          <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-not-allowed">
            <FileText className="w-4 h-4" />
            Formularios
          </div>
          <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-not-allowed">
            <Activity className="w-4 h-4" />
            Pixel & Tracking
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400">
          SLT MVP v1.0
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
