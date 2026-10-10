'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createContact(clientId: string, formData: {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
}) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        client_id: clientId,
        first_name: formData.first_name,
        last_name: formData.last_name || null,
        email: formData.email,
        phone: formData.phone || null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath('/dashboard/contacts');
    return { success: true, contact: data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear contacto' };
  }
}

export async function deleteContact(contactId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('contacts').delete().eq('id', contactId);
    if (error) return { success: false, error: error.message };

    revalidatePath('/dashboard/contacts');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar contacto' };
  }
}
