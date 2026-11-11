import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { getCurrentUser } from '@/app/actions/auth';
import { SECRET_KEY_KEYS } from '@/lib/app/keys';
import { getSettingStatuses } from '@/lib/app/settings';
import { AppSettingsForm } from '@/components/settings/AppSettingsForm';

export const instant = true;

export default async function SettingsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');
  if (currentUser.role !== 'root') redirect('/dashboard');

  const statuses = await getSettingStatuses(SECRET_KEY_KEYS);
  const missing = statuses.filter((status) => status.source === 'missing').length;

  return (
    <div className="h-full overflow-y-auto bg-[#0a1931] p-6 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Configuración
              </h1>
              <span className="rounded-full border border-[#00d4ff]/30 bg-[#00d4ff]/10 px-2.5 py-1 text-[11px] font-semibold text-[#00d4ff]">
                Growth Hub
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Claves del Growth Hub. Las que no existan en Vercel se guardan cifradas en la tabla interna <code>app_settings</code> y las lee el servidor automáticamente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Acceso solo root
          </div>
        </div>

        {missing > 0 && (
          <p className="text-xs text-slate-500">
            {missing} clave(s) pendientes. Las de Vercel ganan sobre las de la BD.
          </p>
        )}

        <AppSettingsForm statuses={statuses} />

        <div className="grid gap-3 sm:grid-cols-3">
          <Info
            title="Cifrado"
            text="AES-256-GCM con clave derivada de SUPABASE_SERVICE_ROLE_KEY. Las claves nunca llegan al navegador."
          />
          <Info
            title="Prioridad"
            text="Variable de entorno de Vercel → app_settings (BD). Las de Vercel no se pueden editar desde aquí."
          />
          <Info
            title="Seguridad"
            text="La tabla app_settings no tiene policies RLS: anon/authenticated no pueden leerla. Solo service_role."
          />
        </div>
      </div>
    </div>
  );
}

function Info({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0c1f3d]/60 p-4">
      <p className="text-xs font-semibold text-white">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{text}</p>
    </div>
  );
}