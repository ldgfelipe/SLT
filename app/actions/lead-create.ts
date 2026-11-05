'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/app/actions/auth';
import { canAccessClient } from '@/lib/growth/access';
import { revalidatePath } from 'next/cache';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ContactSearchRow {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

export async function searchContactsForLead(
  clientId: string,
  query: string
): Promise<
  { success: true; contacts: ContactSearchRow[] } | { success: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  if (!clientId) return { success: false, error: 'Falta el cliente.' };
  if (!canAccessClient(user, clientId)) {
    return { success: false, error: 'Sin acceso a este cliente.' };
  }

  const clean = query.replace(/[%(),]/g, ' ').trim();
  if (clean.length < 2) return { success: true, contacts: [] };

  try {
    const supabase = getSupabaseAdmin();
    const pattern = `%${clean}%`;

    const { data, error } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone')
      .eq('client_id', clientId)
      .or(
        `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`
      )
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) return { success: false, error: error.message };
    return { success: true, contacts: (data || []) as ContactSearchRow[] };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al buscar contactos.' };
  }
}

export interface CreateLeadInput {
  /** Cliente activo (necesario solo al crear un contacto nuevo). */
  clientId?: string | null;
  /** ID de un contacto existente */
  contactId?: string | null;
  /** Datos para crear un contacto nuevo */
  newContact?: {
    first_name: string;
    last_name?: string;
    email: string;
    phone?: string;
  } | null;
  /** Título de la oportunidad (opcional) */
  title?: string;
  /** Valor esperado en moneda local */
  value?: number;
  /** Etapa del Kanban (opcional; por defecto la primera del pipeline) */
  stageId?: string | null;
}

export async function createLeadFromKanban(
  input: CreateLeadInput
): Promise<{ success: true; contactId: string; dealId: string } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  const supabase = getSupabaseAdmin();

  try {
    let contactId: string | null = null;
    let clientId: string | null = null;
    let displayName = '';

    /* ---------------------------------------------------------- */
    /* 1. Resolver el contacto (existente o nuevo)                 */
    /* ---------------------------------------------------------- */
    if (input.contactId) {
      const { data: contact, error } = await supabase
        .from('contacts')
        .select('id, client_id, first_name, last_name, email')
        .eq('id', input.contactId)
        .maybeSingle();

      if (error || !contact) {
        return { success: false, error: 'Contacto no encontrado.' };
      }
      if (!canAccessClient(user, contact.client_id)) {
        return { success: false, error: 'Sin acceso a este cliente.' };
      }

      contactId = contact.id;
      clientId = contact.client_id;
      displayName = `${contact.first_name} ${contact.last_name || ''}`.trim();
    } else if (input.newContact) {
      const firstName = input.newContact.first_name.trim();
      const email = input.newContact.email.trim().toLowerCase();
      const lastName = input.newContact.last_name?.trim() || null;
      const phone = input.newContact.phone?.trim() || null;

      if (!firstName) {
        return { success: false, error: 'El nombre es obligatorio.' };
      }
      if (!EMAIL_REGEX.test(email)) {
        return { success: false, error: 'Ingresa un correo válido.' };
      }
      if (!input.clientId) {
        return { success: false, error: 'Falta el cliente activo.' };
      }
      if (!canAccessClient(user, input.clientId)) {
        return { success: false, error: 'Sin acceso a este cliente.' };
      }

      const { data: created, error } = await supabase
        .from('contacts')
        .insert({
          client_id: input.clientId,
          first_name: firstName.slice(0, 120),
          last_name: lastName?.slice(0, 120) || null,
          email,
          phone: phone?.slice(0, 40) || null,
          data: {
            source: 'kanban_manual',
            captured_at: new Date().toISOString(),
            captured_by: user.id,
          },
        })
        .select('id')
        .single();

      if (error || !created) {
        return {
          success: false,
          error: error?.message || 'No se pudo crear el contacto.',
        };
      }

      contactId = created.id;
      clientId = input.clientId;
      displayName = `${firstName} ${lastName || ''}`.trim();
    } else {
      return { success: false, error: 'Selecciona un contacto o crea uno nuevo.' };
    }

    /* ---------------------------------------------------------- */
    /* 2. Resolver pipeline y etapa                                */
    /* ---------------------------------------------------------- */
    const { data: pipeline } = await supabase
      .from('pipelines')
      .select('id')
      .eq('client_id', clientId!)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!pipeline) {
      return {
        success: false,
        error: 'El cliente no tiene un pipeline configurado.',
      };
    }

    let stageId: string | null = null;

    if (input.stageId) {
      const { data: stage } = await supabase
        .from('stages')
        .select('id')
        .eq('id', input.stageId)
        .eq('pipeline_id', pipeline.id)
        .maybeSingle();

      if (stage) stageId = stage.id;
    }

    if (!stageId) {
      const { data: firstStage } = await supabase
        .from('stages')
        .select('id')
        .eq('pipeline_id', pipeline.id)
        .order('order', { ascending: true })
        .limit(1)
        .maybeSingle();

      stageId = firstStage?.id || null;
    }

    if (!stageId) {
      return {
        success: false,
        error: 'El pipeline no tiene etapas. Crea al menos una.',
      };
    }

    /* ---------------------------------------------------------- */
    /* 3. Crear la oportunidad                                     */
    /* ---------------------------------------------------------- */
    const title =
      input.title?.trim().slice(0, 200) ||
      `${displayName || 'Lead'}`.trim() ||
      'Lead';

    const value = Number.isFinite(Number(input.value))
      ? Math.max(0, Number(input.value))
      : 0;

    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        client_id: clientId!,
        title,
        value,
        stage_id: stageId,
        contact_id: contactId,
        status: 'open',
      })
      .select('id')
      .single();

    if (dealError || !deal) {
      return {
        success: false,
        error: dealError?.message || 'No se pudo crear la oportunidad.',
      };
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/contacts');

    return { success: true, contactId: contactId!, dealId: deal.id };
  } catch (err: any) {
    console.error('[lead-create] error:', err);
    return { success: false, error: err?.message || 'Error al crear el lead.' };
  }
}
