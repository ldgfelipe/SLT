'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function createForm(clientId: string, data: {
  name: string;
  stage_id: string;
  pipeline_id: string;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const { data: form, error } = await supabase
      .from('forms')
      .insert({
        client_id: clientId,
        name: data.name,
        pipeline_id: data.pipeline_id,
        stage_id: data.stage_id,
        fields_config: [
          { name: 'first_name', label: 'Nombre', type: 'text', required: true },
          { name: 'last_name', label: 'Apellido', type: 'text', required: false },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'phone', label: 'Teléfono', type: 'tel', required: false },
        ],
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
