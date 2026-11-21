-- ==========================================
-- SCRIPT DE DATOS DE PRUEBA V2 (solo columnas básicas)
-- ==========================================

-- ==========================================
-- 1. CLIENTES (solo id y name)
-- ==========================================

-- Cliente 1: Moda y Retail
INSERT INTO clients (id, name) VALUES
('client_moda', 'Moda S.A.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Cliente 2: Restaurantes y Food
INSERT INTO clients (id, name) VALUES
('client_restaurante', 'Restaurante El Sabor')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Cliente 3: Servicios Digitales
INSERT INTO clients (id, name) VALUES
('client_servicios', 'Agencia Digital Pro')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ==========================================
-- 2. USUARIOS
-- ==========================================

-- Usuario ROOT (acceso total)
INSERT INTO users (id, email, name, role, client_id, is_active) VALUES
('root_user', 'root@slt.com', 'Admin Root', 'root', NULL, true)

ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Usuarios por cliente
INSERT INTO users (id, email, name, role, client_id, is_active) VALUES
('user_moda', 'contacto@modas.com', 'Moda Team', 'client', 'client_moda', true)

ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO users (id, email, name, role, client_id, is_active) VALUES
('user_res', 'contacto@elsabor.com', 'Sabor Team', 'client', 'client_restaurante', true)

ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO users (id, email, name, role, client_id, is_active) VALUES
('user_serv', 'contacto@digitalpro.com', 'Digital Team', 'client', 'client_servicios', true)

ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ==========================================
-- 3. API KEY DE OPENAI
-- ==========================================

INSERT INTO app_settings (key, value, is_secret) VALUES
('openai_api_key', 'sk-test-key-slt-development', true)

ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ==========================================
-- 4. EJEMPLO DE NEGOCIO (solo campos esenciales)
-- ==========================================

-- Para cliente Moda
INSERT INTO business_analyses (id, client_id, business_name, category, description, target_audience, brand_colors, tone, analysis_data) VALUES
('analysis_moda', 'client_moda', 'Moda S.A.', 'retail', 'Tienda de ropa y accesorios', 'Mujeres 25-40 años', '["#0a1931", "#00d4ff"]', 'Profesional', '{"category":"retail","target_audience":"Mujeres 25-40 años"}')

ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- Para cliente Restaurante
INSERT INTO business_analyses (id, client_id, business_name, category, description, target_audience, brand_colors, tone, analysis_data) VALUES
('analysis_res', 'client_restaurante', 'Restaurante El Sabor', 'food', 'Restaurante mexicano', 'Familias 30-50 años', '["#e85d04", "#15803d"]', 'Amigable', '{"category":"food","target_audience":"Familias 30-50 años"}')

ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- Para cliente Servicios
INSERT INTO business_analyses (id, client_id, business_name, category, description, target_audience, brand_colors, tone, analysis_data) VALUES
('analysis_serv', 'client_servicios', 'Agencia Digital Pro', 'service', 'Marketing digital', 'Emprendedores B2B', '["#1e3a8c", "#6366f1"]', 'Visionario', '{"category":"service","target_audience":"Emprendedores B2B"}')

ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- ==========================================
-- 5. PLANES DE CONTENIDO
-- ==========================================

INSERT INTO content_plans (id, client_id, name, duration_weeks, platforms, posts_per_week, plan_data) VALUES
('plan_moda', 'client_moda', 'Plan Q1 Moda', 3, '["instagram","facebook"]', 2, '{"posts":[{"id":"p1","titulo":"Test","descripcion":"Descripción de prueba"}]}')

ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

INSERT INTO content_plans (id, client_id, name, duration_weeks, platforms, posts_per_week, plan_data) VALUES
('plan_res', 'client_restaurante', 'Plan Q1 Restaurante', 4, '["instagram","tiktok"]', 3, '{"posts":[{"id":"p1","titulo":"Test","descripcion":"Descripción de prueba"}]}')

ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

INSERT INTO content_plans (id, client_id, name, duration_weeks, platforms, posts_per_week, plan_data) VALUES
('plan_serv', 'client_servicios', 'Plan Q1 Servicios', 4, '["linkedin","facebook"]', 2, '{"posts":[{"id":"p1","titulo":"Test","descripcion":"Descripción de prueba"}]}')

ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- ==========================================
-- 6. PUBLICACIONES (calendario)
-- ==========================================

INSERT INTO posts (id, client_id, titulo, descripcion, imagen_url, plataformas, scheduled_at, status) VALUES
('post_moda_1', 'client_moda', 'Post de prueba Moda', 'Descripción del post de prueba', NULL, '["instagram"]', '2024-03-01T10:00:00', 'queued')

ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

INSERT INTO posts (id, client_id, titulo, descripcion, imagen_url, plataformas, scheduled_at, status) VALUES
('post_res_1', 'client_restaurante', 'Post de prueba Restaurante', 'Descripción del post de prueba', NULL, '["tiktok"]', '2024-03-01T12:00:00', 'queued')

ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

INSERT INTO posts (id, client_id, titulo, descripcion, imagen_url, plataformas, scheduled_at, status) VALUES
('post_serv_1', 'client_servicios', 'Post de prueba Servicios', 'Descripción del post de prueba', NULL, '["linkedin"]', '2024-03-01T09:00:00', 'queued')

ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- ==========================================
-- INSTRUCCIONES DE EJECUCIÓN
-- ==========================================

-- 1. Ejecutar este script en Supabase SQL Editor
-- 2. Ir a /dashboard/ai-agent con usuario root@slt.com
-- 3. Probar el flujo: Analizar → Generar Plan → Guardar en Calendario

-- NOTAS:
-- - La API Key de OpenAI es una clave de prueba (funcional para desarrollo)
-- - Las publicaciones tienen estado 'queued' (programadas)
-- - Las recomendaciones de medio aparecerán en la vista de publicaciones