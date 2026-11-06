'use server';

import dns from 'node:dns/promises';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/app/actions/auth';
import { canAccessClient } from '@/lib/growth/access';
import { revalidatePath } from 'next/cache';
import {
  decryptMailConfig,
  encryptMailConfig,
  maskMailConfig,
} from '@/lib/mail/config';
import {
  testConnection,
  type MailConnectionRecord,
} from '@/lib/mail/senders';
import { DEFAULT_MAIL_STATES, MAIL_COLOR_TO_BG } from '@/lib/mail/states';
import type { Contact } from '@/types/database';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ------------------------------------------------------------------ */
/* Estados de lista                                                     */
/* ------------------------------------------------------------------ */

export async function getMailStates(clientId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };
  if (!canAccessClient(user, clientId)) {
    return { success: false as const, error: 'Sin acceso a este cliente.' };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('mail_list_states')
      .select('id, client_id, estado, etiqueta, color, orden')
      .eq('client_id', clientId)
      .order('orden', { ascending: true });

    if (error) return { success: false as const, error: error.message };
    const states = (data && data.length > 0 ? data : DEFAULT_MAIL_STATES) as Array<{
      estado: string;
      etiqueta: string;
      color: string;
      orden: number;
    }>;
    return { success: true as const, states };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al cargar estados.' };
  }
}

/* ------------------------------------------------------------------ */
/* Listas                                                               */
/* ------------------------------------------------------------------ */

export async function listMailLists(clientId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };
  if (!canAccessClient(user, clientId)) {
    return { success: false as const, error: 'Sin acceso a este cliente.' };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('mail_lists')
      .select('id, client_id, name, description, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) return { success: false as const, error: error.message };

    const lists = data || [];

    const counts = await Promise.all(
      lists.map(async (list) => {
        const { count } = await supabase
          .from('mail_list_contacts')
          .select('contacto_id', { count: 'exact', head: true })
          .eq('lista_id', list.id);
        return { id: list.id, contact_count: count ?? 0 };
      })
    );

    const countByList = new Map(counts.map((c) => [c.id, c.contact_count]));
    return {
      success: true as const,
      lists: lists.map((list) => ({
        ...list,
        contact_count: countByList.get(list.id) ?? 0,
      })),
    };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al cargar listas.' };
  }
}

export async function createMailList(
  clientId: string,
  input: { name: string; description?: string }
) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };
  if (!canAccessClient(user, clientId)) {
    return { success: false as const, error: 'Sin acceso a este cliente.' };
  }

  const name = input.name.trim().slice(0, 160);
  if (!name) return { success: false as const, error: 'El nombre es obligatorio.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('mail_lists')
      .insert({
        client_id: clientId,
        name,
        description: input.description?.trim().slice(0, 500) || null,
      })
      .select('id, client_id, name, description, created_at')
      .single();

    if (error) return { success: false as const, error: error.message };
    revalidatePath('/dashboard/mail-center/listas');
    return { success: true as const, list: { ...data, contact_count: 0 } };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al crear la lista.' };
  }
}

export async function updateMailList(
  listId: string,
  input: { name?: string; description?: string }
) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data: list } = await supabase
      .from('mail_lists')
      .select('id, client_id')
      .eq('id', listId)
      .maybeSingle();

    if (!list) return { success: false as const, error: 'Lista no encontrada.' };
    if (!canAccessClient(user, list.client_id)) {
      return { success: false as const, error: 'Sin acceso.' };
    }

    const update: Record<string, unknown> = {};
    if (typeof input.name === 'string' && input.name.trim()) {
      update.name = input.name.trim().slice(0, 160);
    }
    if (typeof input.description === 'string') {
      update.description = input.description.trim().slice(0, 500) || null;
    }

    if (Object.keys(update).length === 0) {
      return { success: true as const };
    }

    const { error } = await supabase.from('mail_lists').update(update).eq('id', listId);
    if (error) return { success: false as const, error: error.message };
    revalidatePath('/dashboard/mail-center/listas');
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al actualizar.' };
  }
}

export async function deleteMailList(listId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data: list } = await supabase
      .from('mail_lists')
      .select('id, client_id')
      .eq('id', listId)
      .maybeSingle();

    if (!list) return { success: false as const, error: 'Lista no encontrada.' };
    if (!canAccessClient(user, list.client_id)) {
      return { success: false as const, error: 'Sin acceso.' };
    }

    const { error } = await supabase.from('mail_lists').delete().eq('id', listId);
    if (error) return { success: false as const, error: error.message };
    revalidatePath('/dashboard/mail-center/listas');
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al eliminar.' };
  }
}

/* ------------------------------------------------------------------ */
/* Contactos (vista de Mail Center)                                     */
/* ------------------------------------------------------------------ */

export interface MailContactRow {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mail_state: string;
  created_at: string;
  empresa: string;
  fuente: string;
  in_list: boolean;
}

export async function listContactsForMail(input: {
  clientId: string;
  listaId?: string | null;
  query?: string;
  estado?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };
  if (!canAccessClient(user, input.clientId)) {
    return { success: false as const, error: 'Sin acceso a este cliente.' };
  }

  try {
    const supabase = getSupabaseAdmin();
    const page = Math.max(1, input.page || 1);
    const pageSize = Math.min(100, Math.max(5, input.pageSize || 20));
    const fromIdx = (page - 1) * pageSize;
    const toIdx = fromIdx + pageSize - 1;

    let query = supabase
      .from('contacts')
      .select(
        'id, first_name, last_name, email, phone, mail_state, created_at, data',
        { count: 'exact' }
      )
      .eq('client_id', input.clientId)
      .order('created_at', { ascending: false })
      .range(fromIdx, toIdx);

    if (input.estado) query = query.eq('mail_state', input.estado);
    const q = (input.query || '').trim();
    if (q.length >= 2) {
      const clean = q.replace(/[%(),]/g, ' ');
      const pattern = `%${clean}%`;
      query = query.or(
        `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`
      );
    }

    const { data, count, error } = await query;
    if (error) return { success: false as const, error: error.message };

    let rows = (data || []).map((row: any) => ({
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      phone: row.phone,
      mail_state: row.mail_state || 'activo',
      created_at: row.created_at,
      empresa:
        row.data?.empresa ||
        row.data?.company ||
        row.data?.organization ||
        '',
      fuente: row.data?.fuente || row.data?.source || row.data?._attribution?.utm_campaign || '',
    })) as MailContactRow[];

    // Marcar los que están en la lista
    if (input.listaId) {
      const { data: members } = await supabase
        .from('mail_list_contacts')
        .select('contacto_id')
        .eq('lista_id', input.listaId)
        .in('contacto_id', rows.map((row) => row.id));

      const memberIds = new Set((members || []).map((row) => row.contacto_id));
      rows = rows.map((row) => ({ ...row, in_list: memberIds.has(row.id) }));
    } else {
      rows = rows.map((row) => ({ ...row, in_list: false }));
    }

    return {
      success: true as const,
      contacts: rows,
      total: count ?? rows.length,
      page,
      pageSize,
    };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al cargar contactos.' };
  }
}

export async function updateContactMailState(
  contactId: string,
  estado: string
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, client_id')
      .eq('id', contactId)
      .maybeSingle();

    if (!contact) return { success: false, error: 'Contacto no encontrado.' };
    if (!canAccessClient(user, contact.client_id)) {
      return { success: false, error: 'Sin acceso.' };
    }

    const { error } = await supabase
      .from('contacts')
      .update({ mail_state: estado })
      .eq('id', contactId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al actualizar.' };
  }
}

export async function bulkUpdateContactMailState(
  clientId: string,
  contactIds: string[],
  estado: string
): Promise<{ success: true; updated: number } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };
  if (!canAccessClient(user, clientId)) {
    return { success: false, error: 'Sin acceso a este cliente.' };
  }

  const ids = Array.from(new Set(contactIds)).slice(0, 1000);
  if (ids.length === 0) return { success: false, error: 'Selecciona al menos un contacto.' };

  try {
    const supabase = getSupabaseAdmin();
    const { error, count } = await supabase
      .from('contacts')
      .update({ mail_state: estado }, { count: 'exact' })
      .eq('client_id', clientId)
      .in('id', ids);

    if (error) return { success: false, error: error.message };
    revalidatePath('/dashboard/mail-center/listas');
    return { success: true, updated: count ?? ids.length };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al actualizar.' };
  }
}

/* ------------------------------------------------------------------ */
/* Membresía de listas                                                  */
/* ------------------------------------------------------------------ */

export async function addContactsToList(
  listaId: string,
  contactIds: string[]
) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };

  const ids = Array.from(new Set(contactIds)).slice(0, 2000);
  if (ids.length === 0) return { success: false as const, error: 'Selecciona contactos.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data: list } = await supabase
      .from('mail_lists')
      .select('id, client_id')
      .eq('id', listaId)
      .maybeSingle();

    if (!list) return { success: false as const, error: 'Lista no encontrada.' };
    if (!canAccessClient(user, list.client_id)) {
      return { success: false as const, error: 'Sin acceso.' };
    }

    // Validar que los contactos pertenecen al mismo cliente
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id')
      .eq('client_id', list.client_id)
      .in('id', ids);

    const validIds = (contacts || []).map((row) => row.id);
    if (validIds.length === 0) {
      return { success: false as const, error: 'Ningún contacto es de este cliente.' };
    }

    const { error } = await supabase.from('mail_list_contacts').upsert(
      validIds.map((contacto_id) => ({ lista_id: listaId, contacto_id })),
      { onConflict: 'lista_id,contacto_id', ignoreDuplicates: true }
    );

    if (error) return { success: false as const, error: error.message };
    revalidatePath('/dashboard/mail-center/listas');
    return { success: true as const, added: validIds.length };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al agregar.' };
  }
}

export async function removeContactsFromList(
  listaId: string,
  contactIds: string[]
) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };

  const ids = Array.from(new Set(contactIds)).slice(0, 2000);
  if (ids.length === 0) return { success: false as const, error: 'Selecciona contactos.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data: list } = await supabase
      .from('mail_lists')
      .select('id, client_id')
      .eq('id', listaId)
      .maybeSingle();

    if (!list) return { success: false as const, error: 'Lista no encontrada.' };
    if (!canAccessClient(user, list.client_id)) {
      return { success: false as const, error: 'Sin acceso.' };
    }

    const { error } = await supabase
      .from('mail_list_contacts')
      .delete()
      .eq('lista_id', listaId)
      .in('contacto_id', ids);

    if (error) return { success: false as const, error: error.message };
    revalidatePath('/dashboard/mail-center/listas');
    return { success: true as const, removed: ids.length };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al quitar.' };
  }
}

/* ------------------------------------------------------------------ */
/* Exportar CSV                                                         */
/* ------------------------------------------------------------------ */

export async function exportMailContactsCsv(
  input: { clientId: string; listaId?: string | null }
): Promise<{ success: true; csv: string; filename: string; count: number } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };
  if (!canAccessClient(user, input.clientId)) {
    return { success: false, error: 'Sin acceso a este cliente.' };
  }

  try {
    const supabase = getSupabaseAdmin();

    let contactIds: string[] | null = null;
    if (input.listaId) {
      const { data: members } = await supabase
        .from('mail_list_contacts')
        .select('contacto_id')
        .eq('lista_id', input.listaId)
        .limit(20_000);
      contactIds = (members || []).map((row) => row.contacto_id);
      if (contactIds.length === 0) {
        return { success: true, csv: '\uFEFFemail,nombre,empresa,telefono,estado\r\n', filename: 'contactos.csv', count: 0 };
      }
    }

    let query = supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, mail_state, data, created_at')
      .eq('client_id', input.clientId)
      .order('created_at', { ascending: false })
      .limit(50_000);

    if (contactIds) query = query.in('id', contactIds);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    const escape = (value: unknown) => {
      const text = value == null ? '' : String(value);
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    const header = ['email', 'nombre', 'apellido', 'empresa', 'giro', 'cargo', 'telefono', 'sitio_web', 'region', 'fuente', 'estado'];
    const lines = [header.join(',')];
    for (const row of data || []) {
      const d = (row as any).data || {};
      lines.push(
        [
          row.email,
          row.first_name,
          row.last_name || '',
          d.empresa || d.company || '',
          d.giro || d.industry || '',
          d.cargo || d.position || '',
          row.phone || '',
          d.sitio_web || d.website || '',
          d.region || d.estado || '',
          d.fuente || d.source || '',
          row.mail_state || 'activo',
        ]
          .map(escape)
          .join(',')
      );
    }

    return {
      success: true,
      csv: '\uFEFF' + lines.join('\r\n'),
      filename: `contactos-${new Date().toISOString().slice(0, 10)}.csv`,
      count: (data || []).length,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error al exportar.' };
  }
}

/* ------------------------------------------------------------------ */
/* Importar CSV (detección automática de columnas)                      */
/* ------------------------------------------------------------------ */

const HEADER_ALIASES: Record<string, string> = {
  email: 'email',
  correo: 'email',
  mail: 'email',
  e_mail: 'email',
  correo_electronico: 'email',
  nombre: 'first_name',
  nombres: 'first_name',
  first_name: 'first_name',
  first: 'first_name',
  given_name: 'first_name',
  apellidos: 'last_name',
  apellido: 'last_name',
  last_name: 'last_name',
  last: 'last_name',
  surname: 'last_name',
  nombre_completo: 'full_name',
  full_name: 'full_name',
  name: 'full_name',
  empresa: 'empresa',
  company: 'empresa',
  organization: 'empresa',
  razon_social: 'empresa',
  giro: 'giro',
  industry: 'giro',
  sector: 'giro',
  actividad: 'giro',
  camara: 'camara',
  chamber: 'camara',
  empleados: 'empleados',
  num_empleados: 'empleados',
  employees: 'empleados',
  size: 'empleados',
  cargo: 'cargo',
  puesto: 'cargo',
  position: 'cargo',
  role: 'cargo',
  telefono: 'phone',
  celular: 'phone',
  phone: 'phone',
  tel: 'phone',
  whatsapp: 'phone',
  region: 'region',
  estado: 'region',
  state: 'region',
  municipio: 'region',
  ciudad: 'region',
  city: 'region',
  sitio_web: 'sitio_web',
  website: 'sitio_web',
  web: 'sitio_web',
  url: 'sitio_web',
  fuente: 'fuente',
  source: 'fuente',
  origen: 'fuente',
};

function normalizeHeader(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  const src = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < src.length; i++) {
    const char = src[i];

    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      current.push(field);
      field = '';
      continue;
    }

    if (char === '\n' || char === '\r') {
      if (char === '\r' && src[i + 1] === '\n') i++;
      current.push(field);
      field = '';
      if (current.some((cell) => cell.trim() !== '')) rows.push(current);
      current = [];
      continue;
    }

    field += char;
  }

  current.push(field);
  if (current.some((cell) => cell.trim() !== '')) rows.push(current);

  return rows;
}

export async function importContactsCsv(
  clientId: string,
  input: {
    csv: string;
    listaId?: string | null;
    nuevaLista?: string | null;
    delimiter?: string | null;
  }
) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };
  if (!canAccessClient(user, clientId)) {
    return { success: false as const, error: 'Sin acceso a este cliente.' };
  }

  const raw = (input.csv || '').trim();
  if (!raw) return { success: false as const, error: 'El archivo está vacío.' };
  if (raw.length > 2_000_000) {
    return { success: false as const, error: 'El archivo supera 2 MB. Divide el CSV en partes.' };
  }

  try {
    const rows = parseCsv(raw);
    if (rows.length < 2) {
      return { success: false as const, error: 'El CSV debe tener encabezados y al menos una fila.' };
    }

    const headers = rows[0].map(normalizeHeader);
    const columnMap = new Map<number, string>();

    headers.forEach((header, index) => {
      const alias = HEADER_ALIASES[header];
      if (alias) columnMap.set(index, alias);
    });

    if (![...columnMap.values()].includes('email')) {
      return {
        success: false as const,
        error: 'No se detectó la columna de email. Revisa los encabezados (email, correo, mail…).',
      };
    }

    const emailIdx = [...columnMap.entries()].find(([, v]) => v === 'email')?.[0];
    const supabase = getSupabaseAdmin();

    // Destino: lista existente o nueva lista
    let targetListaId = input.listaId || null;
    let targetListName: string | null = null;

    if (!targetListaId && input.nuevaLista && input.nuevaLista.trim()) {
      const { data: newList, error: listError } = await supabase
        .from('mail_lists')
        .insert({
          client_id: clientId,
          name: input.nuevaLista.trim().slice(0, 160),
          description: 'Importada desde CSV',
        })
        .select('id, name')
        .single();
      if (listError) return { success: false as const, error: listError.message };
      targetListaId = newList.id;
      targetListName = newList.name;
    }

    // Emails ya existentes en este cliente (para omitir duplicados)
    const { data: existing } = await supabase
      .from('contacts')
      .select('email')
      .eq('client_id', clientId);
    const existingEmails = new Set(
      (existing || []).map((row) => String(row.email || '').toLowerCase())
    );

    let inserted = 0;
    let duplicates = 0;
    let invalid = 0;
    const newEmails: string[] = [];
    const inserts: any[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const email = String(emailIdx !== undefined ? row[emailIdx] : '').trim().toLowerCase();

      if (!EMAIL_REGEX.test(email)) {
        invalid += 1;
        continue;
      }
      if (existingEmails.has(email)) {
        duplicates += 1;
        continue;
      }
      existingEmails.add(email);

      const record: Record<string, string> = {};
      const dataExtras: Record<string, string> = {};

      headers.forEach((header, index) => {
        const value = (row[index] ?? '').trim();
        if (!value) return;
        const alias = columnMap.get(index);

        if (alias === 'full_name') {
          const parts = value.split(/\s+/);
          record.first_name = parts[0]?.slice(0, 120) || '';
          record.last_name = parts.slice(1).join(' ').slice(0, 120) || '';
          return;
        }

        if (alias) {
          record[alias] = value;
        } else {
          dataExtras[header.slice(0, 60)] = value.slice(0, 300);
        }
      });

      if (!record.first_name) record.first_name = 'Contacto';

      inserts.push({
        client_id: clientId,
        first_name: record.first_name || 'Contacto',
        last_name: record.last_name || null,
        email,
        phone: record.phone || null,
        mail_state: 'activo',
        data: {
          ...dataExtras,
          empresa: record.empresa || undefined,
          giro: record.giro || undefined,
          camara: record.camara || undefined,
          empleados: record.empleados || undefined,
          cargo: record.cargo || undefined,
          region: record.region || undefined,
          sitio_web: record.sitio_web || undefined,
          fuente: record.fuente || 'csv',
          _attribution: {
            source: 'csv',
            captured_at: new Date().toISOString(),
          },
        },
      });
      newEmails.push(email);

      if (inserts.length >= 500) {
        const { error } = await supabase.from('contacts').insert(inserts);
        if (!error) inserted += inserts.length;
        inserts.length = 0;
      }
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from('contacts').insert(inserts);
      if (!error) inserted += inserts.length;
    }

    // Membresía de lista
    if (targetListaId && newEmails.length > 0) {
      const { data: newContacts } = await supabase
        .from('contacts')
        .select('id, email')
        .eq('client_id', clientId)
        .in('email', newEmails.slice(0, 1000));

      if (newContacts && newContacts.length > 0) {
        await supabase.from('mail_list_contacts').upsert(
          newContacts.map((row) => ({
            lista_id: targetListaId,
            contacto_id: row.id,
          })),
          { onConflict: 'lista_id,contacto_id', ignoreDuplicates: true }
        );
      }
    }

    revalidatePath('/dashboard/mail-center/listas');
    revalidatePath('/dashboard/contacts');

    return {
      success: true as const,
      inserted,
      duplicates,
      invalid,
      nuevos: inserted + duplicates + invalid,
      listaId: targetListaId,
      listaNombre: targetListName,
    };
  } catch (err: any) {
    console.error('[mail-import] error:', err);
    return { success: false as const, error: err?.message || 'Error al importar.' };
  }
}

/* ------------------------------------------------------------------ */
/* Validación de correos (formato + MX)                                 */
/* ------------------------------------------------------------------ */

const mxCache = new Map<string, boolean>();

async function hasMxRecord(domain: string): Promise<boolean> {
  if (mxCache.has(domain)) return mxCache.get(domain)!;

  let ok = false;
  try {
    const mx = await Promise.race([
      dns.resolveMx(domain),
      new Promise<any[]>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000)
      ),
    ]);
    ok = Array.isArray(mx) && mx.length > 0;
  } catch {
    // Sin MX: probar A record
    try {
      const a = await Promise.race([
        dns.resolve4(domain),
        new Promise<string[]>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 4000)
        ),
      ]);
      ok = Array.isArray(a) && a.length > 0;
    } catch {
      ok = false;
    }
  }

  mxCache.set(domain, ok);
  return ok;
}

export async function validateEmails(
  clientId: string,
  input: {
    rawText: string;
    listaId?: string | null;
    removeInvalid?: boolean;
  }
) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };
  if (!canAccessClient(user, clientId)) {
    return { success: false as const, error: 'Sin acceso a este cliente.' };
  }

  const candidates = Array.from(
    new Set(
      (input.rawText || '')
        .split(/[\s,;]+/)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 1000)
    )
  );

  if (candidates.length === 0) {
    return { success: false as const, error: 'No se detectaron correos.' };
  }

  const valid: string[] = [];
  const invalid: Array<{ email: string; reason: string }> = [];

  for (const email of candidates) {
    if (!EMAIL_REGEX.test(email)) {
      invalid.push({ email, reason: 'Formato inválido' });
      continue;
    }

    const domain = email.split('@')[1];
    const hasMx = await hasMxRecord(domain);
    if (!hasMx) {
      invalid.push({ email, reason: 'Dominio sin MX / no existe' });
    } else {
      valid.push(email);
    }
  }

  let removed = 0;

  if (input.removeInvalid && input.listaId && invalid.length > 0) {
    try {
      const supabase = getSupabaseAdmin();
      const emails = invalid.map((item) => item.email);

      // Contactos de la lista con correos inválidos
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id')
        .eq('client_id', clientId)
        .in('email', emails);

      const ids = (contacts || []).map((row) => row.id);

      if (ids.length > 0) {
        const { error } = await supabase
          .from('mail_list_contacts')
          .delete()
          .eq('lista_id', input.listaId)
          .in('contacto_id', ids);

        if (!error) removed = ids.length;
      }
    } catch (err) {
      console.warn('[mail-validate] remove:', err);
    }
  }

  return {
    success: true as const,
    total: candidates.length,
    validCount: valid.length,
    valid,
    invalid,
    removed,
  };
}

/* ------------------------------------------------------------------ */
/* Conexiones de envío                                                  */
/* ------------------------------------------------------------------ */

export async function listMailConnections(clientId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };
  if (!canAccessClient(user, clientId)) {
    return { success: false as const, error: 'Sin acceso a este cliente.' };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('mail_connections')
      .select('id, client_id, nombre, proveedor, activo, created_at, updated_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) return { success: false as const, error: error.message };

    return {
      success: true as const,
      connections: (data || []).map((row: any) => ({
        ...row,
      })) as MailConnectionRecord[],
    };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al cargar conexiones.' };
  }
}

export async function getConnectionDetail(connectionId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('mail_connections')
      .select('id, client_id, nombre, proveedor, activo, config')
      .eq('id', connectionId)
      .maybeSingle();

    if (error || !data) return { success: false as const, error: 'Conexión no encontrada.' };
    if (!canAccessClient(user, data.client_id)) {
      return { success: false as const, error: 'Sin acceso.' };
    }

    const config = decryptMailConfig(data.config);
    return {
      success: true as const,
      connection: {
        id: data.id,
        nombre: data.nombre,
        proveedor: data.proveedor,
        activo: data.activo,
        config,
        maskedConfig: maskMailConfig(config),
      },
    };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al cargar.' };
  }
}

export async function saveMailConnection(
  clientId: string,
  input: {
    connectionId?: string | null;
    nombre: string;
    proveedor: string;
    activo?: boolean;
    config: Record<string, string>;
  }
) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };
  if (!canAccessClient(user, clientId)) {
    return { success: false as const, error: 'Sin acceso a este cliente.' };
  }

  const nombre = input.nombre.trim().slice(0, 120);
  if (!nombre) return { success: false as const, error: 'El nombre es obligatorio.' };
  if (!input.proveedor) return { success: false as const, error: 'Selecciona un proveedor.' };

  try {
    const supabase = getSupabaseAdmin();

    if (input.connectionId) {
      const { data: existing } = await supabase
        .from('mail_connections')
        .select('id, client_id, config')
        .eq('id', input.connectionId)
        .maybeSingle();

      if (!existing) return { success: false as const, error: 'Conexión no encontrada.' };
      if (!canAccessClient(user, existing.client_id)) {
        return { success: false as const, error: 'Sin acceso.' };
      }

      // Conservar campos sensibles que no se reenvían (vacío = conservar)
      const old = decryptMailConfig(existing.config);
      const merged = { ...old };
      for (const [key, value] of Object.entries(input.config)) {
        const trimmed = value?.trim();
        if (trimmed) merged[key] = trimmed;
      }

      const { error } = await supabase
        .from('mail_connections')
        .update({
          nombre,
          proveedor: input.proveedor,
          activo: input.activo ?? true,
          config: encryptMailConfig(merged),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.connectionId);

      if (error) return { success: false as const, error: error.message };
    } else {
      const { error } = await supabase.from('mail_connections').insert({
        client_id: clientId,
        nombre,
        proveedor: input.proveedor,
        activo: input.activo ?? true,
        config: encryptMailConfig(input.config),
      });

      if (error) return { success: false as const, error: error.message };
    }

    revalidatePath('/dashboard/mail-center/integraciones');
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al guardar.' };
  }
}

export async function deleteMailConnection(connectionId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('mail_connections')
      .select('id, client_id')
      .eq('id', connectionId)
      .maybeSingle();

    if (!data) return { success: false as const, error: 'Conexión no encontrada.' };
    if (!canAccessClient(user, data.client_id)) {
      return { success: false as const, error: 'Sin acceso.' };
    }

    const { error } = await supabase.from('mail_connections').delete().eq('id', connectionId);
    if (error) return { success: false as const, error: error.message };
    revalidatePath('/dashboard/mail-center/integraciones');
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al eliminar.' };
  }
}

export async function toggleMailConnection(connectionId: string, activo: boolean) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('mail_connections')
      .select('id, client_id')
      .eq('id', connectionId)
      .maybeSingle();

    if (!data) return { success: false as const, error: 'Conexión no encontrada.' };
    if (!canAccessClient(user, data.client_id)) {
      return { success: false as const, error: 'Sin acceso.' };
    }

    const { error } = await supabase
      .from('mail_connections')
      .update({ activo, updated_at: new Date().toISOString() })
      .eq('id', connectionId);

    if (error) return { success: false as const, error: error.message };
    revalidatePath('/dashboard/mail-center/integraciones');
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al actualizar.' };
  }
}

export async function testMailConnectionAction(connectionId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('mail_connections')
      .select('id, client_id, nombre, proveedor, config, activo')
      .eq('id', connectionId)
      .maybeSingle();

    if (!data) return { success: false as const, error: 'Conexión no encontrada.' };
    if (!canAccessClient(user, data.client_id)) {
      return { success: false as const, error: 'Sin acceso.' };
    }

    const result = await testConnection(data as MailConnectionRecord);
    return { success: true as const, result };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al probar.' };
  }
}

/* ------------------------------------------------------------------ */
/* SES Config + límite del ambiente                                     */
/* ------------------------------------------------------------------ */

export async function getSesConfigAction(connectionId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data: connection } = await supabase
      .from('mail_connections')
      .select('id, client_id')
      .eq('id', connectionId)
      .maybeSingle();

    if (!connection) return { success: false as const, error: 'Conexión no encontrada.' };
    if (!canAccessClient(user, connection.client_id)) {
      return { success: false as const, error: 'Sin acceso.' };
    }

    const { data } = await supabase
      .from('ses_config')
      .select('*')
      .eq('conexion_id', connectionId)
      .maybeSingle();

    return {
      success: true as const,
      config: data || {
        conexion_id: connectionId,
        limite_diario: 50000,
        max_por_minuto: null,
        max_por_segundo: 14,
        usar_tracking: true,
        dominio_tracking: null,
        correo_bajas: null,
        updated_at: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al cargar SES.' };
  }
}

export async function saveSesConfigAction(
  connectionId: string,
  input: {
    limite_diario: number;
    max_por_minuto: number | null;
    max_por_segundo: number;
    usar_tracking: boolean;
    dominio_tracking: string | null;
    correo_bajas: string | null;
  }
) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };

  try {
    const supabase = getSupabaseAdmin();
    const { data: connection } = await supabase
      .from('mail_connections')
      .select('id, client_id')
      .eq('id', connectionId)
      .maybeSingle();

    if (!connection) return { success: false as const, error: 'Conexión no encontrada.' };
    if (!canAccessClient(user, connection.client_id)) {
      return { success: false as const, error: 'Sin acceso.' };
    }

    const daily = Math.max(1, Math.min(50000, Math.round(Number(input.limite_diario) || 50000)));
    const rate = Math.max(1, Math.min(14, Math.round(Number(input.max_por_segundo) || 14)));
    const perMinute =
      input.max_por_minuto != null
        ? Math.max(1, Math.min(Math.floor(rate * 60 * 0.95), Math.round(Number(input.max_por_minuto))))
        : null;

    const { error } = await supabase.from('ses_config').upsert(
      {
        conexion_id: connectionId,
        limite_diario: daily,
        max_por_minuto: perMinute,
        max_por_segundo: rate,
        usar_tracking: Boolean(input.usar_tracking),
        dominio_tracking: input.dominio_tracking?.trim() || null,
        correo_bajas: input.correo_bajas?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'conexion_id' }
    );

    if (error) return { success: false as const, error: error.message };
    revalidatePath('/dashboard/mail-center/integraciones');
    return { success: true as const, applied: { limite_diario: daily, max_por_segundo: rate, max_por_minuto: perMinute } };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al guardar SES.' };
  }
}

export async function getMailSettingsAction(clientId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };
  if (!canAccessClient(user, clientId)) {
    return { success: false as const, error: 'Sin acceso.' };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('mail_settings')
      .select('client_id, limite_diario, updated_at')
      .eq('client_id', clientId)
      .maybeSingle();

    return {
      success: true as const,
      settings: data || { client_id: clientId, limite_diario: 300, updated_at: new Date().toISOString() },
    };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al cargar límite.' };
  }
}

export async function saveMailSettingsAction(clientId: string, limiteDiario: number) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };
  if (!canAccessClient(user, clientId)) {
    return { success: false as const, error: 'Sin acceso a este cliente.' };
  }

  try {
    const value = Math.max(1, Math.min(100000, Math.round(Number(limiteDiario) || 300)));
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from('mail_settings').upsert(
      {
        client_id: clientId,
        limite_diario: value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id' }
    );

    if (error) return { success: false as const, error: error.message };
    revalidatePath('/dashboard/mail-center/integraciones');
    return { success: true as const, limite_diario: value };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al guardar.' };
  }
}

/* ------------------------------------------------------------------ */
/* Bajas (supresión)                                                    */
/* ------------------------------------------------------------------ */

export async function listBajas(clientId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };
  if (!canAccessClient(user, clientId)) {
    return { success: false as const, error: 'Sin acceso a este cliente.' };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('ses_bajas')
      .select('id, email, motivo, origen, campana_id, detalle, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, bajas: data || [] };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al cargar bajas.' };
  }
}

export async function addBajas(
  clientId: string,
  input: { rawText: string; motivo?: string; campanaId?: string | null }
) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };
  if (!canAccessClient(user, clientId)) {
    return { success: false as const, error: 'Sin acceso a este cliente.' };
  }

  const emails = Array.from(
    new Set(
      (input.rawText || '')
        .split(/[\s,;]+/)
        .map((value) => value.trim().toLowerCase())
        .filter((value) => EMAIL_REGEX.test(value))
        .slice(0, 1000)
    )
  );

  if (emails.length === 0) {
    return { success: false as const, error: 'No se detectaron correos válidos.' };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('ses_bajas').upsert(
      emails.map((email) => ({
        client_id: clientId,
        email,
        motivo: input.motivo?.trim().slice(0, 120) || 'baja voluntaria',
        origen: 'app',
        campana_id: input.campanaId || null,
      })),
      { onConflict: 'client_id,email', ignoreDuplicates: true }
    );

    if (error) return { success: false as const, error: error.message };

    // Marcar contactos como no suscritos
    await supabase
      .from('contacts')
      .update({ mail_state: 'no_suscrito' })
      .eq('client_id', clientId)
      .in('email', emails);

    revalidatePath('/dashboard/mail-center/integraciones');
    return { success: true as const, added: emails.length };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al guardar bajas.' };
  }
}

export async function removeBaja(clientId: string, bajaId: string, action: 'reactivate' | 'delete') {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: 'No autenticado.' };
  if (!canAccessClient(user, clientId)) {
    return { success: false as const, error: 'Sin acceso a este cliente.' };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: baja } = await supabase
      .from('ses_bajas')
      .select('id, email')
      .eq('id', bajaId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (!baja) return { success: false as const, error: 'Baja no encontrada.' };

    if (action === 'reactivate') {
      const { error } = await supabase
        .from('contacts')
        .update({ mail_state: 'activo' })
        .eq('client_id', clientId)
        .eq('email', baja.email);
      if (error) console.warn('[baja] reactivate contact:', error.message);
    }

    const { error } = await supabase.from('ses_bajas').delete().eq('id', bajaId);
    if (error) return { success: false as const, error: error.message };

    revalidatePath('/dashboard/mail-center/integraciones');
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'Error al procesar.' };
  }
}
