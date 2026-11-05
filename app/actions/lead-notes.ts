'use server';

import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/app/actions/auth';
import { revalidatePath } from 'next/cache';
import { canAccessClient } from '@/lib/growth/access';
import type { LeadNote, LeadNoteKind } from '@/types/database';

const NOTE_KINDS: LeadNoteKind[] = [
  'note',
  'action',
  'call',
  'email',
  'whatsapp',
  'meeting',
];

interface NoteTarget {
  dealId?: string;
  contactId?: string;
}

async function resolveTarget(
  supabase: any,
  target: NoteTarget
): Promise<
  | { ok: true; clientId: string; dealId: string | null; contactId: string | null }
  | { ok: false; error: string }
> {
  let clientId: string | null = null;
  let resolvedDealId = target.dealId || null;
  let resolvedContactId = target.contactId || null;

  if (target.dealId) {
    const { data } = await supabase
      .from('deals')
      .select('id, client_id, contact_id')
      .eq('id', target.dealId)
      .maybeSingle();

    if (!data) return { ok: false, error: 'Oportunidad no encontrada.' };
    clientId = data.client_id as string;
    resolvedDealId = data.id as string;
    if (!resolvedContactId) resolvedContactId = data.contact_id || null;
  }

  if (target.contactId) {
    const { data } = await supabase
      .from('contacts')
      .select('id, client_id')
      .eq('id', target.contactId)
      .maybeSingle();

    if (!data) return { ok: false, error: 'Contacto no encontrado.' };

    if (clientId && clientId !== data.client_id) {
      return {
        ok: false,
        error: 'La oportunidad y el contacto pertenecen a clientes distintos.',
      };
    }

    clientId = data.client_id as string;
    resolvedContactId = data.id as string;
  }

  if (!clientId) return { ok: false, error: 'Falta el deal o el contacto.' };

  return {
    ok: true,
    clientId,
    dealId: resolvedDealId,
    contactId: resolvedContactId,
  };
}

export async function listLeadNotes(
  input: NoteTarget
): Promise<{ success: true; notes: LeadNote[] } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();
    const target = await resolveTarget(supabase, input);
    if (!target.ok) return { success: false, error: target.error };

    if (!canAccessClient(user, target.clientId)) {
      return { success: false, error: 'Sin acceso a este cliente.' };
    }

    const orFilter: string[] = [];
    if (target.contactId) orFilter.push(`contact_id.eq.${target.contactId}`);
    if (target.dealId) orFilter.push(`deal_id.eq.${target.dealId}`);

    const { data, error } = await supabase
      .from('lead_notes')
      .select(
        'id, client_id, deal_id, contact_id, author_id, kind, body, due_at, done, completed_at, created_at, updated_at, author:users(id, name, email)'
      )
      .or(orFilter.join(','))
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.warn('[lead-notes] list:', error.message);
      return { success: false, error: error.message };
    }

    const notes = (data || []).map((row: any) => ({
      ...row,
      author: Array.isArray(row.author) ? row.author[0] ?? null : row.author ?? null,
    })) as LeadNote[];

    return { success: true, notes };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Error al cargar notas.' };
  }
}

export async function addLeadNote(input: {
  dealId?: string;
  contactId?: string;
  kind: LeadNoteKind;
  body: string;
  dueAt?: string | null;
}): Promise<{ success: true; note: LeadNote } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  const body = input.body.trim().slice(0, 2000);
  if (!body) return { success: false, error: 'La nota no puede estar vacía.' };

  const kind = NOTE_KINDS.includes(input.kind) ? input.kind : 'note';

  try {
    const supabase = getSupabaseAdmin();
    const target = await resolveTarget(supabase, input);
    if (!target.ok) return { success: false, error: target.error };

    if (!canAccessClient(user, target.clientId)) {
      return { success: false, error: 'Sin acceso a este cliente.' };
    }

    let dueAt: string | null = null;
    if (input.dueAt) {
      const parsed = new Date(input.dueAt);
      if (!Number.isNaN(parsed.getTime())) dueAt = parsed.toISOString();
    }

    const { data, error } = await supabase
      .from('lead_notes')
      .insert({
        client_id: target.clientId,
        deal_id: target.dealId,
        contact_id: target.contactId,
        author_id: user.id,
        kind,
        body,
        due_at: dueAt,
      })
      .select(
        'id, client_id, deal_id, contact_id, author_id, kind, body, due_at, done, completed_at, created_at, updated_at, author:users(id, name, email)'
      )
      .single();

    if (error) {
      console.warn('[lead-notes] insert:', error.message);
      return { success: false, error: error.message };
    }

    const row = data as any;
    const note: LeadNote = {
      ...row,
      author: Array.isArray(row.author) ? row.author[0] ?? null : row.author ?? null,
    };

    revalidatePath('/dashboard');

    return { success: true, note };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Error al guardar la nota.' };
  }
}

export async function toggleLeadNote(
  noteId: string,
  done: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();

    const { data: note } = await supabase
      .from('lead_notes')
      .select('id, client_id')
      .eq('id', noteId)
      .maybeSingle();

    if (!note) return { success: false, error: 'Nota no encontrada.' };

    if (!canAccessClient(user, note.client_id)) {
      return { success: false, error: 'Sin acceso a este cliente.' };
    }

    const { error } = await supabase
      .from('lead_notes')
      .update({
        done,
        completed_at: done ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Error al actualizar.' };
  }
}

export async function deleteLeadNote(
  noteId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();

    const { data: note } = await supabase
      .from('lead_notes')
      .select('id, client_id')
      .eq('id', noteId)
      .maybeSingle();

    if (!note) return { success: false, error: 'Nota no encontrada.' };

    if (!canAccessClient(user, note.client_id)) {
      return { success: false, error: 'Sin acceso a este cliente.' };
    }

    const { error } = await supabase.from('lead_notes').delete().eq('id', noteId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Error al eliminar.' };
  }
}
