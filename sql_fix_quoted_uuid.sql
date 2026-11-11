-- SOLUCIÓN FINAL: Manejar UUIDs con comillas dobles extra
-- El problema es que (jsonb->0) devuelve el string con comillas dobles: ""uuid"" en lugar de "uuid"

-- PASO 1: Verificar el formato actual de los datos
SELECT 
  id,
  titulo,
  social_account_ids,
  (social_account_ids->0)::text as raw_value,
  -- Intentar quitar comillas dobles extra
  TRIM(BOTH '"' FROM ((social_account_ids->0)::text)) as cleaned_value
FROM posts
WHERE social_account_ids IS NOT NULL
LIMIT 5;

-- PASO 2: Actualizar con limpieza de comillas
-- Usamos TRIM para remover comillas dobles que rodean el UUID
UPDATE posts 
SET social_account_id = TRIM(BOTH '"' FROM ((social_account_ids->0)::text))::uuid
WHERE social_account_ids IS NOT NULL 
  AND social_account_id IS NULL
  AND jsonb_array_length(social_account_ids) > 0
  AND LENGTH(TRIM(BOTH '"' FROM ((social_account_ids->0)::text))) = 36; -- UUID tiene 36 caracteres

-- PASO 3: Verificar que los valores sean UUIDs válidos
UPDATE posts 
SET social_account_id = NULL
WHERE social_account_ids IS NOT NULL 
  AND social_account_id IS NULL
  AND NOT (LENGTH(TRIM(BOTH '"' FROM ((social_account_ids->0)::text))) = 36);

-- PASO 4: Verificar resultados
SELECT 
  id,
  titulo,
  social_account_id,
  social_account_ids,
  CASE 
    WHEN social_account_id IS NOT NULL THEN 'ÉXITO'
    ELSE 'ERROR - valor inválido'
  END as resultado
FROM posts
WHERE social_account_ids IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- PASO 5: Count final
SELECT 
  COUNT(*) as total_posts,
  COUNT(CASE WHEN social_account_ids IS NOT NULL THEN 1 END) as con_ids,
  COUNT(CASE WHEN social_account_id IS NOT NULL THEN 1 END) as con_social_account_id
FROM posts;