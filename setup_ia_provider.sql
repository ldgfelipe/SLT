-- ==========================================
-- CONFIGURACIÓN DE PROVEEDORES DE IA
-- Agrega campos para soportar múltiples proveedores (OpenAI, freellmapi, openroute, etc.)
-- ==========================================

-- Si la tabla app_settings ya existe, añadimos los nuevos campos:
-- Si no existen, se crearán con ALTER TABLE o los insertaremos con un valor por defecto

-- 1. Agregar campo 'provider' (proveedor de IA: openai, freellmapi, openroute, anthropic, etc.)
-- Usamos COALESCE para no romper si ya existe la tabla con datos
DO $$
BEGIN
    -- Intento añadir la columna provider
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'provider') THEN
        ALTER TABLE app_settings ADD COLUMN provider TEXT DEFAULT 'openai' NOT NULL;
        RAISE NOTICE 'Columna provider añadida a app_settings';
    ELSE
        RAISE NOTICE 'Columna provider ya existe en app_settings';
    END IF;
    
    -- Intento añadir la columna model (modelo específico del proveedor)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'model') THEN
        ALTER TABLE app_settings ADD COLUMN model TEXT DEFAULT 'gpt-4' NOT NULL;
        RAISE NOTICE 'Columna model añadida a app_settings';
    ELSE
        RAISE NOTICE 'Columna model ya existe en app_settings';
    END IF;
    
    -- Intento añadir la columna temperature (para completions)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'temperature') THEN
        ALTER TABLE app_settings ADD COLUMN temperature NUMERIC DEFAULT 0.7 NOT NULL;
        RAISE NOTICE 'Columna temperature añadida a app_settings';
    ELSE
        RAISE NOTICE 'Columna temperature ya existe en app_settings';
    END IF;
    
    -- Intento añadir la columna max_tokens
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'max_tokens') THEN
        ALTER TABLE app_settings ADD COLUMN max_tokens INTEGER DEFAULT 4000 NOT NULL;
        RAISE NOTICE 'Columna max_tokens añadida a app_settings';
    ELSE
        RAISE NOTICE 'Columna max_tokens ya existe en app_settings';
    END IF;
    
    -- Intento añadir la columna timeout (en segundos)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'timeout') THEN
        ALTER TABLE app_settings ADD COLUMN timeout INTEGER DEFAULT 30 NOT NULL;
        RAISE NOTICE 'Columna timeout añadida a app_settings';
    ELSE
        RAISE NOTICE 'Columna timeout ya existe en app_settings';
    END IF;
    
    RAISE NOTICE 'Migración de configuración de proveedores de IA completada';
END $$;

-- 2. Establecer configuración por defecto para todos los registros existentes
UPDATE app_settings SET 
    provider = 'freellmapi',  -- Proveedor gratuito por defecto
    model = 'auto',           -- Modelo automático
    temperature = 0.7,        -- Creatividad media
    max_tokens = 4000,        -- Límite de tokens
    timeout = 30              -- Tiempo máximo en segundos
WHERE provider IS NULL OR provider = 'openai';  -- Actualizamos las que eran openai o nulas

-- 3. Insertar configuración para freellmapi si no existe
INSERT INTO app_settings (key, value, is_secret, provider, model, temperature, max_tokens, timeout)
SELECT 
    'openai_api_key' as key,
    'sk-test-free-llm-api-key' as value,
    true as is_secret,
    'freellmapi' as provider,
    'auto' as model,
    0.7 as temperature,
    4000 as max_tokens,
    30 as timeout
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'openai_api_key');

-- 4. Insertar configuración para openroute si es necesario para rutas
INSERT INTO app_settings (key, value, is_secret, provider, model, temperature, max_tokens, timeout)
SELECT 
    'openroute_api_key' as key,
    'test-openroute-key' as value,
    true as is_secret,
    'openroute' as provider,
    'auto' as model,
    0.7 as temperature,
    4000 as max_tokens,
    30 as timeout
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'openroute_api_key');

-- 5. Verificar el estado final
SELECT key, provider, model, temperature, max_tokens, timeout 
FROM app_settings 
ORDER BY key;

-- 6. Mensaje final
SELECT '¡Configuración de proveedores de IA completada!' as mensaje;
EOF