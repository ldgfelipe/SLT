import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { normalizeFormConfig } from '@/types/forms';
import { HostedForm } from '@/components/forms/HostedForm';

// El formulario se lee de la base de datos en cada request para reflejar
// inmediatamente los cambios hechos desde el dashboard.
export const instant = false;

interface HostedFormPageProps {
  params: Promise<{ id: string }>;
}

const getForm = cache(async (id: string) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('forms')
      .select('id, name, fields_config')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.warn('[hosted form] error:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[hosted form] error:', err);
    return null;
  }
});

export async function generateMetadata({ params }: HostedFormPageProps): Promise<Metadata> {
  const { id } = await params;
  const form = await getForm(id);

  return {
    title: form?.name ? `${form.name} · Formulario` : 'Formulario',
    description: 'Formulario de contacto',
    robots: { index: false, follow: false },
  };
}

export default async function HostedFormPage({ params }: HostedFormPageProps) {
  const { id } = await params;
  const form = await getForm(id);

  if (!form) notFound();

  const config = normalizeFormConfig(form.fields_config);

  return (
    <main className="w-full bg-slate-50 dark:bg-slate-950">
      <HostedForm formId={form.id} config={config} />
    </main>
  );
}
