'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/app/actions/auth';
import { revalidatePath } from 'next/cache';
import { canAccessClient } from '@/lib/growth/access';
import {
  isValidExclusionPattern,
  normalizePattern,
} from '@/lib/tracking/ip-exclusions';
import type { TrackingIpExclusion } from '@/types/database';

export async function listTrackingExclusions(
  clientId: string
): Promise<
  { success: true; rules: TrackingIpExclusion[] } | { success: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  try {
    if (!canAccessClient(user, clientId)) {
      return { success: false, error: 'Sin acceso a este cliente.' };
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('tracking_ip_exclusions')
      .select('id, client_id, pattern, label, created_at, created_by')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, rules: (data || []) as TrackingIpExclusion[] };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Error al cargar reglas.' };
  }
}

export async function addTrackingExclusion(input: {
  clientId: string;
  pattern: string;
  label?: string;
}): Promise<
  { success: true; rule: TrackingIpExclusion } | { success: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  try {
    if (!canAccessClient(user, input.clientId)) {
      return { success: false, error: 'Sin acceso a este cliente.' };
    }

    const pattern = normalizePattern(input.pattern);
    if (!pattern || !isValidExclusionPattern(pattern)) {
      return {
        success: false,
        error:
          'Patrón inválido. Usa una IP exacta (201.120.45.9), un prefijo terminado en punto (192.168.1.) o un comodín (192.168.*).',
      };
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('tracking_ip_exclusions')
      .insert({
        client_id: input.clientId,
        pattern,
        label: input.label?.trim().slice(0, 120) || null,
        created_by: user.id,
      })
      .select('id, client_id, pattern, label, created_at, created_by')
      .single();

    if (error) {
      if (String(error.message).toLowerCase().includes('duplicate')) {
        return {
          success: false,
          error: 'Esta IP ya está en la lista de exclusión.',
        };
      }
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/tracking');
    return { success: true, rule: data as TrackingIpExclusion };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Error al guardar la regla.' };
  }
}

export async function deleteTrackingExclusion(
  ruleId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();

    const { data: rule } = await supabase
      .from('tracking_ip_exclusions')
      .select('id, client_id')
      .eq('id', ruleId)
      .maybeSingle();

    if (!rule) return { success: false, error: 'Regla no encontrada.' };

    if (!canAccessClient(user, rule.client_id)) {
      return { success: false, error: 'Sin acceso a este cliente.' };
    }

    const { error } = await supabase
      .from('tracking_ip_exclusions')
      .delete()
      .eq('id', ruleId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/dashboard/tracking');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Error al eliminar la regla.' };
  }
}
