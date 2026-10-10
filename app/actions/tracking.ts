'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createTrackingSite(clientId: string, domain: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();

    const { data, error } = await supabase
      .from('tracking_sites')
      .insert({
        client_id: clientId,
        domain: cleanDomain,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath('/dashboard/tracking');
    return { success: true, site: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al registrar dominio' };
  }
}

export async function deleteTrackingSite(siteId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('tracking_sites').delete().eq('id', siteId);
    if (error) return { success: false, error: error.message };

    revalidatePath('/dashboard/tracking');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar dominio' };
  }
}
