'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export async function setActiveClient(clientId: string) {
  const cookieStore = await cookies();
  cookieStore.set('slt_active_client_id', clientId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 año
    sameSite: 'lax',
  });
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/clients');
  return { success: true };
}

export async function createClientAccount(name: string, slug?: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const cleanSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-')).trim();

    // 1. Crear el cliente
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        name,
        slug: cleanSlug,
      })
      .select()
      .single();

    if (clientError) {
      return { success: false, error: clientError.message };
    }

    // 2. Crear Pipeline por defecto para este cliente
    const { data: pipeline, error: pipelineError } = await supabase
      .from('pipelines')
      .insert({
        client_id: newClient.id,
        name: 'Pipeline General',
      })
      .select()
      .single();

    if (!pipelineError && pipeline) {
      // 3. Crear etapas por defecto
      await supabase.from('stages').insert([
        { pipeline_id: pipeline.id, name: 'Lead Entrante', order: 1 },
        { pipeline_id: pipeline.id, name: 'Contacto', order: 2 },
        { pipeline_id: pipeline.id, name: 'Propuesta', order: 3 },
        { pipeline_id: pipeline.id, name: 'Cerrado Ganado', order: 4 },
      ]);
    }

    // Activar el cliente recién creado
    await setActiveClient(newClient.id);

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/clients');
    return { success: true, client: newClient };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al crear cliente' };
  }
}
