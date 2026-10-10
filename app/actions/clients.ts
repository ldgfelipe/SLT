'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export async function setActiveClient(clientId: string) {
  const cookieStore = await cookies();
  cookieStore.set('slt_active_client_id', clientId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/clients');
  revalidatePath('/dashboard/contacts');
  revalidatePath('/dashboard/forms');
  revalidatePath('/dashboard/tracking');
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

export async function deleteClientAccount(clientId: string) {
  try {
    const supabase = getSupabaseAdmin();

    // 1. Verificar si el cliente tiene datos reales (contactos, deals o sitios de tracking)
    const [contactsRes, dealsRes, sitesRes] = await Promise.all([
      supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
      supabase.from('deals').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
      supabase.from('tracking_sites').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
    ]);

    const totalContacts = contactsRes.count || 0;
    const totalDeals = dealsRes.count || 0;
    const totalSites = sitesRes.count || 0;

    if (totalContacts > 0 || totalDeals > 0 || totalSites > 0) {
      return {
        success: false,
        error: `No se puede eliminar el cliente porque tiene datos asociados (${totalContacts} contactos, ${totalDeals} oportunidades, ${totalSites} sitios de tracking).`,
      };
    }

    // 2. Si está libre de datos reales, eliminar pipelines primero para evitar cualquier bloqueo de constraint
    await supabase.from('pipelines').delete().eq('client_id', clientId);

    // 3. Eliminar el registro del cliente
    const { error: deleteError } = await supabase.from('clients').delete().eq('id', clientId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    // Si el cliente eliminado era el que estaba activo en la cookie, limpiarlo
    const cookieStore = await cookies();
    const activeClientId = cookieStore.get('slt_active_client_id')?.value;
    if (activeClientId === clientId) {
      cookieStore.delete('slt_active_client_id');
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/clients');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar cliente' };
  }
}
