'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/app/actions/auth';
import { canAccessClient } from '@/lib/growth/access';
import { revalidatePath } from 'next/cache';

export async function updateDealStage(dealId: string, targetStageId: string) {
  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('deals')
      .update({ stage_id: targetStageId })
      .eq('id', dealId);

    if (error) {
      console.error('Error updating deal:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error('Failed to update deal stage:', err);
    return { success: false, error: err.message || 'Error updating deal stage' };
  }
}

/**
 * Elimina una oportunidad del Kanban. Las notas ligadas al deal se
 * eliminan en cascada; el contacto NO se borra.
 */
export async function deleteDeal(dealId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();

    const { data: deal } = await supabase
      .from('deals')
      .select('id, client_id, title')
      .eq('id', dealId)
      .maybeSingle();

    if (!deal) return { success: false, error: 'Oportunidad no encontrada.' };

    if (!canAccessClient(user, deal.client_id)) {
      return { success: false, error: 'Sin acceso a este cliente.' };
    }

    const { error } = await supabase.from('deals').delete().eq('id', dealId);

    if (error) {
      console.error('Error deleting deal:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar la oportunidad' };
  }
}
