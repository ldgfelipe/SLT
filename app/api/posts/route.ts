import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getCurrentUser } from '@/app/actions/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { canAccessClient } from '@/lib/growth/access';
import { storageBucket } from '@/lib/growth/providers';
import {
  normalizePlatforms,
  POST_STATUSES,
} from '@/lib/growth/platforms';
import type { PostStatus } from '@/types/database';

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const POST_SELECT =
  '*, social_account:social_accounts(id,account_name,provider), campaign:campaigns(id,name)';

async function resolveClientId(request: NextRequest, explicit?: unknown) {
  if (typeof explicit === 'string' && explicit) return explicit;
  const fromQuery = request.nextUrl.searchParams.get('client_id');
  if (fromQuery) return fromQuery;
  const cookieStore = await cookies();
  return cookieStore.get('slt_active_client_id')?.value || '';
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const clientId = await resolveClientId(request);
  if (!clientId) {
    return NextResponse.json({ error: 'Falta el cliente.' }, { status: 400 });
  }

  if (!canAccessClient(user, clientId)) {
    return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 });
  }

  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');
  const status = request.nextUrl.searchParams.get('status');

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('client_id', clientId)
    .order('scheduled_at', { ascending: true, nullsFirst: true });

  if (from) query = query.gte('scheduled_at', from);
  if (to) query = query.lte('scheduled_at', to);
  if (status && POST_STATUSES.includes(status as PostStatus)) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ posts: data || [] });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type') || '';
  let payload: Record<string, any> = {};
  let file: File | null = null;

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();

      for (const key of [
        'client_id',
        'titulo',
        'descripcion',
        'social_account_id',
        'campaign_id',
        'scheduled_at',
        'status',
        'imagen_url',
      ]) {
        const value = form.get(key);
        if (typeof value === 'string') payload[key] = value;
      }

      // Nuevo: leer social_account_ids como JSON
      const accountIdsRaw = form.get('social_account_ids');
      if (typeof accountIdsRaw === 'string' && accountIdsRaw) {
        try {
          payload.social_account_ids = JSON.parse(accountIdsRaw);
        } catch {
          // Si no es JSON válido, ignora
        }
      }

      payload.plataformas = normalizePlatforms(form.get('plataformas'));

      const uploaded = form.get('image');
      if (uploaded instanceof File && uploaded.size > 0) {
        file = uploaded;
      }
    } else {
      payload = await request.json();
    }
  } catch {
    return NextResponse.json(
      { error: 'No se pudo leer el formulario.' },
      { status: 400 }
    );
  }

  const clientId = await resolveClientId(request, payload.client_id);
  if (!clientId) {
    return NextResponse.json({ error: 'Falta el cliente.' }, { status: 400 });
  }

  if (!canAccessClient(user, clientId)) {
    return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 });
  }

  const titulo = String(payload.titulo || '').trim();
  if (!titulo) {
    return NextResponse.json(
      { error: 'El título es obligatorio.' },
      { status: 400 }
    );
  }

  let scheduledAt: string | null = null;
  if (payload.scheduled_at) {
    const parsed = new Date(String(payload.scheduled_at));
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: 'La fecha programada no es válida.' },
        { status: 400 }
      );
    }
    scheduledAt = parsed.toISOString();
  }

  const statusInput = typeof payload.status === 'string' ? payload.status : '';
  const status: PostStatus = POST_STATUSES.includes(statusInput as PostStatus)
    ? (statusInput as PostStatus)
    : scheduledAt
      ? 'queued'
      : 'draft';

  const supabase = getSupabaseAdmin();

  // Validamos que las relaciones pertenezcan al cliente.
  if (payload.social_account_id) {
    const { data: account } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('id', payload.social_account_id)
      .eq('client_id', clientId)
      .maybeSingle();

    if (!account) {
      return NextResponse.json(
        { error: 'La cuenta social no pertenece al cliente.' },
        { status: 400 }
      );
    }
  }

  if (payload.campaign_id) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', payload.campaign_id)
      .eq('client_id', clientId)
      .maybeSingle();

    if (!campaign) {
      return NextResponse.json(
        { error: 'La campaña no pertenece al cliente.' },
        { status: 400 }
      );
    }
  }

  let imagenUrl =
    typeof payload.imagen_url === 'string' && payload.imagen_url.trim()
      ? payload.imagen_url.trim()
      : null;

  // Subida de imagen a Supabase Storage (bucket público inventser-images).
  if (file) {
    if (!IMAGE_TYPES[file.type]) {
      return NextResponse.json(
        { error: 'Formato no permitido. Usa JPG, PNG, WebP o GIF.' },
        { status: 400 }
      );
    }

    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'La imagen supera los 8 MB.' },
        { status: 400 }
      );
    }

    const extension = IMAGE_TYPES[file.type];
    const path = `${clientId}/${Date.now()}-${crypto
      .randomUUID()
      .slice(0, 8)}.${extension}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(storageBucket())
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `No se pudo subir la imagen: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: publicUrl } = supabase.storage
      .from(storageBucket())
      .getPublicUrl(path);

    imagenUrl = publicUrl.publicUrl;
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({
      client_id: clientId,
      social_account_id: payload.social_account_id || null,
      social_account_ids: payload.social_account_ids || null,
      campaign_id: payload.campaign_id || null,
      titulo: titulo.slice(0, 200),
      descripcion:
        typeof payload.descripcion === 'string'
          ? payload.descripcion.slice(0, 5000)
          : null,
      imagen_url: imagenUrl,
      plataformas: normalizePlatforms(payload.plataformas),
      scheduled_at: scheduledAt,
      status,
    })
    .select(POST_SELECT)
    .single();

  if (error) {
    console.error('[api/posts] insert:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post: data }, { status: 201 });
}
