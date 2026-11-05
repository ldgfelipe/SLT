import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentUser } from '@/app/actions/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { canAccessClient } from '@/lib/growth/access';
import { storageBucket } from '@/lib/growth/providers';

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = getSupabaseAdmin();

  const { data: post, error } = await supabase
    .from('posts')
    .select('id, client_id')
    .eq('id', id)
    .maybeSingle();

  if (error || !post) {
    return NextResponse.json(
      { error: 'Publicación no encontrada.' },
      { status: 404 }
    );
  }

  if (!canAccessClient(user, post.client_id)) {
    return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'No se pudo leer el archivo.' },
      { status: 400 }
    );
  }

  const file = form.get('image');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: 'Selecciona una imagen.' },
      { status: 400 }
    );
  }

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
  const path = `${post.client_id}/${Date.now()}-${crypto
    .randomUUID()
    .slice(0, 8)}.${extension}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(storageBucket())
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json(
      { error: `No se pudo subir la imagen: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { data: publicUrl } = supabase.storage
    .from(storageBucket())
    .getPublicUrl(path);

  const { data: updated, error: updateError } = await supabase
    .from('posts')
    .update({
      imagen_url: publicUrl.publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ post: updated });
}
