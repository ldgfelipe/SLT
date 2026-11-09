-- Migración: Agregar campo social_account_ids para soporte de múltiples cuentas
-- Esta columna permite publicar en múltiples cuentas de red social desde una sola publicación

-- Agregar columna JSON para almacenar array de IDs de cuentas sociales
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS social_account_ids jsonb DEFAULT null;

-- Crear índice para consultas más rápidas
CREATE INDEX IF NOT EXISTS idx_posts_social_account_ids 
ON posts USING gin (social_account_ids);

-- Actualizar la columna de un solo ID para retrocompatibilidad
-- Si hay social_account_ids, también actualizar social_account_id con el primero
-- Esto mantiene compatibilidad con código existente
UPDATE posts 
SET social_account_id = (social_account_ids->0)::uuid
WHERE social_account_ids IS NOT NULL 
  AND (social_account_id IS NULL OR social_account_id = '')
  AND jsonb_array_length(social_account_ids) > 0;

-- Comentario en la columna
COMMENT ON COLUMN posts.social_account_ids IS 'Array de IDs de cuentas sociales para publicación múltiple (Facebook, Instagram, etc.)';

-- RLS policies (si existen, mantener compatibilidad)
-- Las políticas existentes deberían proteger esta columna