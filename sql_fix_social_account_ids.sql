-- Solución correcta para migrar social_account_ids a social_account_id
-- El problema es que el cast directo (jsonb->0)::uuid falla
-- La solución es usar ::text::uuid o verificar el contenido primero

-- Verificar columnas actuales primero
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'posts' 
  AND column_name IN ('social_account_id', 'social_account_ids');

-- 1. Agregar columna social_account_ids si no existe (debe ser JSONB)
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS social_account_ids jsonb DEFAULT null;

-- 2. Crear índice GIN para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_posts_social_account_ids 
ON posts USING gin (social_account_ids);

-- 3. ACTUALIZACIÓN CORREGIDA - Usar ::text::uuid
-- Primero verificamos que el valor sea válido antes del cast
UPDATE posts 
SET social_account_id = ((social_account_ids->0)::text)::uuid
WHERE social_account_ids IS NOT NULL 
  AND (social_account_id IS NULL OR social_account_id = '')
  AND jsonb_typeof(social_account_ids->0) IN ('string', 'number')
  AND jsonb_array_length(social_account_ids) > 0;

-- 4. También intentar con el valor numérico si es necesario
-- (Esto es para casos donde el JSON pudiera contener números en lugar de strings)

-- Verificar los resultados
SELECT 
  id,
  social_account_id,
  social_account_ids,
  CASE 
    WHEN social_account_id IS NOT NULL AND social_account_ids IS NOT NULL 
    THEN 'OK - datos sincronizados'
    WHEN social_account_id IS NULL AND social_account_ids IS NOT NULL 
    THEN 'PENDIENTE - data en array pero sin ID principal'
    ELSE 'SIN DATOS'
  END as status_check
FROM posts
LIMIT 10;