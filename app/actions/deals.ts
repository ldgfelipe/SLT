'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateDealStage(dealId: string, targetStageId: string) {
  try {
    const supabase = await createServerSupabaseClient();

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
