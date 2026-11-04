'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import type { FormConfig } from '@/types/forms';

interface FormPayload {
  name: string;
  fields_config: FormConfig;
  stage_id: string;
  pipeline_id: string;
}

export async function createForm(clientId: string, data: FormPayload) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: form, error } = await supabase
      .from('forms')
      .insert({
        client_id: clientId,
        name: data.name,
        pipeline_id: data.pipeline_id,
        stage_id: data.stage_id,
        fields_config: data.fields_config,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath('/dashboard/forms');
    return { success: true, form };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear formulario' };
  }
}

export async function updateForm(formId: string, data: FormPayload) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: form, error } = await supabase
      .from('forms')
      .update({
        name: data.name,
        pipeline_id: data.pipeline_id,
        stage_id: data.stage_id,
        fields_config: data.fields_config,
      })
      .eq('id', formId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath('/dashboard/forms');
    revalidatePath(`/f/${formId}`);
    return { success: true, form };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al actualizar formulario' };
  }
}

export async function deleteForm(formId: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('forms').delete().eq('id', formId);
    if (error) return { success: false, error: error.message };

    revalidatePath('/dashboard/forms');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar formulario' };
  }
}
