'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/app/actions/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { canAccessClient } from '@/lib/growth/access';

interface DemoPost {
  titulo: string;
  descripcion: string;
  scheduled_at: string;
}

const DEMO_POSTS: DemoPost[] = [
  {
    titulo: 'Alta de producto en 15 segundos',
    descripcion:
      'Carga tus productos al inventario en segundos y empieza a vender más rápido.',
    scheduled_at: '2026-10-29T10:00:00-06:00',
  },
  {
    titulo: 'Excel vs Inventser',
    descripcion:
      'Deja las hojas de cálculo y centraliza inventario, ventas y clientes en un solo lugar.',
    scheduled_at: '2026-10-31T10:00:00-06:00',
  },
  {
    titulo: 'Prueba Gratis 14 días',
    descripcion:
      'Prueba Inventser gratis durante 14 días, sin tarjeta de crédito.',
    scheduled_at: '2026-11-02T10:00:00-06:00',
  },
  {
    titulo: 'Caso abarrotes',
    descripcion:
      'Cómo una tienda de abarrotes ordenó su inventario y aumentó sus ventas.',
    scheduled_at: '2026-11-04T10:00:00-06:00',
  },
  {
    titulo: '3 errores que te cuestan ventas',
    descripcion:
      'Los tres errores de inventario que más te cuestan ventas y cómo evitarlos.',
    scheduled_at: '2026-11-06T10:00:00-06:00',
  },
  {
    titulo: 'Sync multi-dispositivo',
    descripcion:
      'Sincroniza tu operación en computadora, tablet y celular en tiempo real.',
    scheduled_at: '2026-11-08T10:00:00-06:00',
  },
  {
    titulo: 'Caso de éxito',
    descripcion: 'Un caso real de crecimiento con Inventser.',
    scheduled_at: '2026-11-11T10:00:00-06:00',
  },
  {
    titulo: 'Todo bajo control',
    descripcion: 'Inventario, ventas y clientes en un solo lugar.',
    scheduled_at: '2026-11-12T10:00:00-06:00',
  },
];

/**
 * Inserta el calendario base (29/10/2026 - 12/11/2026, 10:00 CDMX)
 * sin duplicar títulos ya existentes.
 */
export async function seedDemoCalendar(clientId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'No autenticado.' };
  }

  if (!canAccessClient(user, clientId)) {
    return { success: false, error: 'Sin acceso a este cliente.' };
  }

  const supabase = getSupabaseAdmin();

  const { data: account } = await supabase
    .from('social_accounts')
    .select('id')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  let inserted = 0;

  for (const item of DEMO_POSTS) {
    const { data: existing } = await supabase
      .from('posts')
      .select('id')
      .eq('client_id', clientId)
      .eq('titulo', item.titulo)
      .maybeSingle();

    if (existing) continue;

    const { error } = await supabase.from('posts').insert({
      client_id: clientId,
      social_account_id: account?.id || null,
      titulo: item.titulo,
      descripcion: item.descripcion,
      imagen_url: 'inventser_transparent.png',
      plataformas: ['facebook', 'instagram'],
      scheduled_at: item.scheduled_at,
      status:
        new Date(item.scheduled_at).getTime() < Date.now()
          ? 'published'
          : 'queued',
    });

    if (error) {
      console.error('[growth/seed]', error);
      return { success: false, error: error.message };
    }

    inserted += 1;
  }

  revalidatePath('/dashboard/calendar');
  return { success: true, inserted };
}
