'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/app/actions/auth';
import { canAccessClient } from '@/lib/growth/access';

export async function createContact(clientId: string, formData: {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
}) {
  try {
    const supabase = getSupabaseAdmin();
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
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('contacts').delete().eq('id', contactId);
    if (error) return { success: false, error: error.message };

    revalidatePath('/dashboard/contacts');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al eliminar contacto' };
  }
}

/**
 * Copia contactos a otro cliente. Los duplicados por email se omiten.
 * Pensado para cargar audiencias al mailing de cada cliente.
 */
export async function copyContacts(
  contactIds: string[],
  targetClientId: string
): Promise<{
  success: boolean;
  error?: string;
  copied?: number;
  skipped?: number;
  total?: number;
}> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  const ids = Array.from(new Set(contactIds.filter(Boolean))).slice(0, 500);
  if (ids.length === 0) {
    return { success: false, error: 'Selecciona al menos un contacto.' };
  }

  try {
    const supabase = getSupabaseAdmin();

    if (!canAccessClient(user, targetClientId)) {
      return { success: false, error: 'Sin acceso al cliente destino.' };
    }

    // Verificar que el cliente destino existe
    const { data: targetClient } = await supabase
      .from('clients')
      .select('id')
      .eq('id', targetClientId)
      .maybeSingle();

    if (!targetClient) {
      return { success: false, error: 'El cliente destino no existe.' };
    }

    const { data: sources, error: sourcesError } = await supabase
      .from('contacts')
      .select('id, client_id, first_name, last_name, email, phone, data')
      .in('id', ids);

    if (sourcesError) return { success: false, error: sourcesError.message };

    const rows = sources || [];

    // Solo puede copiar desde clientes a los que tiene acceso
    const sourceClientIds = new Set(rows.map((row) => row.client_id));
    for (const sourceClientId of sourceClientIds) {
      if (!canAccessClient(user, sourceClientId)) {
        return {
          success: false,
          error: 'No tienes acceso a uno de los clientes de origen.',
        };
      }
    }

    // Emails ya presentes en el cliente destino (case-insensitive)
    const { data: existing } = await supabase
      .from('contacts')
      .select('email')
      .eq('client_id', targetClientId);

    const existingEmails = new Set(
      (existing || []).map((row) => String(row.email || '').toLowerCase())
    );

    let copied = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (const row of rows) {
      const email = String(row.email || '').toLowerCase();

      if (existingEmails.has(email)) {
        skipped += 1;
        continue;
      }

      const data = {
        ...(typeof row.data === 'object' && row.data ? row.data : {}),
        __copied_from: {
          client_id: row.client_id,
          contact_id: row.id,
          copied_at: new Date().toISOString(),
        },
      };

      const { error } = await supabase.from('contacts').insert({
        client_id: targetClientId,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        phone: row.phone,
        data,
      });

      if (error) {
        failures.push(`${row.email}: ${error.message}`);
        continue;
      }

      existingEmails.add(email);
      copied += 1;
    }

    revalidatePath('/dashboard/contacts');

    if (copied === 0 && failures.length > 0) {
      return { success: false, error: failures[0] };
    }

    return {
      success: true,
      copied,
      skipped,
      total: rows.length,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al copiar contactos.' };
  }
}
