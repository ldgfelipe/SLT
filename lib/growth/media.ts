/**
 * Resolución de imágenes de publicaciones.
 *
 * Se usa tanto en servidor (publish) como en componentes cliente (previews),
 * por eso solo referencia variables `NEXT_PUBLIC_*` (inlinadas en el bundle).
 */
function bucketName(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ||
    process.env.SUPABASE_STORAGE_BUCKET ||
    'inventser-images'
  );
}

/** Convierte una ruta del bucket (o un nombre suelto) en URL pública. */
export function resolveMediaUrl(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // URL absoluta, data URL o asset local de /public.
  if (/^(https?:|data:|\/)/i.test(trimmed)) return trimmed;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return trimmed;

  const bucket = bucketName();
  const path = trimmed.replace(/^\/+/, '');
  const prefixed = path.startsWith(`${bucket}/`) ? path : `${bucket}/${path}`;

  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${prefixed}`;
}
