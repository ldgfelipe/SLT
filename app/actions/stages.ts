'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCurrentUser } from './auth';
import { canAccessClient } from '@/lib/growth/access';

export async function deleteStage(stageId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'No autenticado.' };
  }

  const supabase = getSupabaseAdmin();

  // Verificar que la etapa existe y obtener el client_id
  const { data: stage, error: fetchError } = await supabase
    .from('stages')
    .select('id, client_id')
    .eq('id', stageId)
    .single();

  if (fetchError || !stage) {
    return { success: false, error: 'Etapa no encontrada.' };
  }

  // Verificar acceso
  if (!canAccessClient(user, stage.client_id)) {
    return { success: false, error: 'Sin acceso.' };
  }

  // Mover las oportunidades a la primera etapa disponible
  const { data: firstStage } = await supabase
    .from('stages')
    .select('id')
    .eq('client_id', stage.client_id)
    .order('position')
    .limit(1)
    .single();

  // Actualizar las oportunidades
  await supabase
    .from('deals')
    .update({ stage_id: firstStage?.id || null })
    .eq('stage_id', stageId);

  // Eliminar la etapa
  const { error: deleteError } = await supabase
    .from('stages')
    .delete()
    .eq('id', stageId);

  if (deleteError) {
    return { success: false, error: 'Error al eliminar la etapa.' };
  }

  return { success: true };
}

export async function updateStageName(stageId: string, name: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'No autenticado.' };
  }

  const supabase = getSupabaseAdmin();

  // Verificar que la etapa existe y obtener el client_id
  const { data: stage, error: fetchError } = await supabase
    .from('stages')
    .select('id, client_id')
    .eq('id', stageId)
    .single();

  if (fetchError || !stage) {
    return { success: false, error: 'Etapa no encontrada.' };
  }

  // Verificar acceso
  if (!canAccessClient(user, stage.client_id)) {
    return { success: false, error: 'Sin acceso.' };
  }

  // Actualizar el nombre
  const { error: updateError } = await supabase
    .from('stages')
    .update({ name })
    .eq('id', stageId);

  if (updateError) {
    return { success: false, error: 'Error al actualizar el nombre.' };
  }

  return { success: true };
}