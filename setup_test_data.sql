-- ==========================================
-- SCRIPT DE DATOS DE PRUEBA PARA IA CONTENT ASSISTANT
-- Ajustado para estructura real de la base de datos SLT
-- ==========================================

-- ==========================================
-- 1. CLIENTES (usando columnas que efectivamente existen)
-- ==========================================

-- Cliente 1: Moda y Retail
INSERT INTO clients (id, name, industry, timezone, created_at, updated_at) VALUES
('client_moda', 'Moda S.A.', 'retail', 'America/Mexico_City', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Cliente 2: Gastronomía y Restaurantes
INSERT INTO clients (id, name, industry, timezone, created_at, updated_at) VALUES
('client_restaurante', 'Restaurante El Sabor', 'food', 'America/Buenos_Aires', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Cliente 3: Servicios Digitales
INSERT INTO clients (id, name, industry, timezone, created_at, updated_at) VALUES
('client_servicios', 'Agencia Digital Pro', 'service', 'America/Sao_Paulo', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ==========================================
-- 2. USUARIOS (clientes y root)
-- ==========================================

-- Usuario ROOT (acceso total a todos los clientes)
INSERT INTO users (id, email, name, role, client_id, is_active, created_at, updated_at) VALUES
('root_user', 'root@slt.com', 'Administrador SLT', 'root', NULL, true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Usuario cliente 1 - Moda
INSERT INTO users (id, email, name, role, client_id, is_active, created_at, updated_at) VALUES
('user_moda', 'contacto@modas.com', 'Moda Team', 'client', 'client_moda', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Usuario cliente 2 - Restaurante
INSERT INTO users (id, email, name, role, client_id, is_active, created_at, updated_at) VALUES
('user_restaurante', 'contacto@elsabor.com', 'Sabor Team', 'client', 'client_restaurante', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Usuario cliente 3 - Servicios
INSERT INTO users (id, email, name, role, client_id, is_active, created_at, updated_at) VALUES
('user_servicios', 'contacto@digitalpro.com', 'Digital Team', 'client', 'client_servicios', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ==========================================
-- 3. CONFIGURACIÓN DE API KEY DE OPENAI
-- ==========================================

-- Aquí iría tu API Key de OpenAI obtenida de https://platform.openai.com/api-keys
INSERT INTO app_settings (key, value, is_secret, created_at, updated_at) VALUES
('openai_api_key', 'sk-test-key-for-slt-development-only-1234567890abcdef', true, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ==========================================
-- 4. EJEMPLO DE ANÁLISIS DE NEGOCIO
-- ==========================================

-- Para cliente Moda (client_moda)
INSERT INTO business_analyses (id, client_id, business_name, category, description, target_audience, competitors, brand_colors, tone, analysis_data, created_at, updated_at) VALUES
('analysis_moda', 'client_moda', 'Moda S.A.', 'retail', 'Tienda en línea de ropa y accesorios de moda actual', 'Mujeres 25-40 años en México y Latinoamérica', '["Zara", "H&M", "Forever 21", "Mango"]', '["#0a1931", "#00d4ff"]', 'Profesional', '{
  "category": "retail",
  "target_audience": "Mujeres 25-40 años en México y Latinoamérica",
  "competitors": ["Zara", "H&M", "Forever 21", "Mango"],
  "brand_colors": ["#0a1931", "#00d4ff"],
  "tone": "Profesional",
  "key_messages": [
    "Calidad premium a precios accesibles",
    "Envío rápido en 24-48 horas",
    "Tendencias actualizadas cada temporada"
  ],
  "insights": [
    "El 73% de las compras se realizan desde dispositivos móviles",
    "Los videos de productos aumentan el deseo de compra en 3.5x",
    "El contenido generado por usuarios (UGC) incrementa el engagement en 4.5x"
  ]
}', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- Para cliente Restaurante (client_restaurante)
INSERT INTO business_analyses (id, client_id, business_name, category, description, target_audience, competitors, brand_colors, tone, analysis_data, created_at, updated_at) VALUES
('analysis_restaurante', 'client_restaurante', 'Restaurante El Sabor', 'food', 'Restaurante especializado en cocina mexicana y fusion', 'Familias y parejas 30-50 años', '["Chipotle", "Olive Garden", restaurantes locales]', '["#e85d04", "#15803d"]', 'Amigable', '{
  "category": "food",
  "target_audience": "Familias y parejas 30-50 años interesados en gastronomía",
  "competitors": ["Chipotle", "Olive Garden", " restaurantes locales de la ciudad"],
  "brand_colors": ["#e85d04", "#15803d"],
  "tone": "Amigable",
  "key_messages": [
    "Ingredientes frescos y de temporada",
    "Atención personalizada y cálida",
    "Reservaciones con solo un clic"
  ],
  "insights": [
    "El 65% de las reservas son para fines de semana",
    "Las recomendaciones boca-a-m boca son el principal atracción",
    "Las fotos de platillos profesionales aumentan pedidos en 2.8x"
  ]
}', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- Para cliente Servicios (client_servicios)
INSERT INTO business_analyses (id, client_id, business_name, category, description, target_audience, competitors, brand_colors, tone, analysis_data, created_at, updated_at) VALUES
('analysis_servicios', 'client_servicios', 'Agencia Digital Pro', 'service', 'Agencia de marketing digital y desarrollo web', 'Emprendedores y empresas B2B', '["Agencia X", "Agencia Y", "Freelancers independientes"]', '["#1e3a8c", "#6366f1"]', 'Visionario', '{
  "category": "service",
  "target_audience": "Emprendedores y empresas que buscan transformar digitalmente",
  "competitors": ["Agencia X", "Agencia Y", "Freelancers independientes"],
  "brand_colors": ["#1e3a8c", "#6366f1"],
  "tone": "Visionario",
  "key_messages": [
    "Transformación digital completa",
    "Resultados medibles y ROI garantizado",
    "Experiencia de usuario excepcional"
  ],
  "insights": [
    "El 80% de las empresas planean aumentar su presupuesto digital",
    "La automatización de marketing aumenta ventas en 3x",
    "El SEO orgánico es la principal fuente de leads B2B"
  ]
}', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- ==========================================
-- 5. PLANES DE CONTENIDO DE EJEMPLO
-- ==========================================

-- Plan para cliente Moda
INSERT INTO content_plans (id, client_id, name, duration_weeks, platforms, posts_per_week, plan_data, created_at, updated_at) VALUES
('plan_moda_q1', 'client_moda', 'Plan Q1 - Lanzamiento Primavera', 3, '["instagram", "facebook"]', 2, '{
  "name": "Plan Q1 - Lanzamiento Primavera",
  "duration_weeks": 3,
  "platforms": ["instagram", "facebook"],
  "posts_per_week": 2,
  "posts": [
    {
      "id": "post_moda_1",
      "titulo": "Lanzamiento Colección Primavera-Verano",
      "descripcion": "Presentamos nuestra nueva colección con los colores y tendencias de la temporada.",
      "fecha_posteo": "2024-03-01",
      "hora_sugerida": "10:00",
      "tipo": "image",
      "platform": "instagram",
      "hashtags": ["#ModaPrimavera", "#NuevaColeccion"],
      "prompt": "Professional fashion photography of spring summer collection on city background, natural lighting, vibrant colors"
    },
    {
      "id": "post_moda_2",
      "titulo": "Tendencias de Color 2024",
      "descripcion": "Los colores que marcarán tendencia esta temporada: pasteles y tonos tierra.",
      "fecha_posteo": "2024-03-08",
      "hora_sugerida": "14:00",
      "tipo": "carousel",
      "platform": "instagram",
      "hashtags": ["#Tendencias2024", "#Colores", "#Estilo"],
      "prompt": "5-slide carousel showing color trends for 2024 with visual examples, minimalist design, educational style"
    }
  ]
}', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- Plan para cliente Restaurante
INSERT INTO content_plans (id, client_id, name, duration_weeks, platforms, posts_per_week, plan_data, created_at, updated_at) VALUES
('plan_restaurante_q1', 'client_restaurante', 'Plan Q1 - Promociones Estacionales', 4, '["instagram", "tiktok"]', 3, '{
  "name": "Plan Q1 - Promociones Estacionales",
  "duration_weeks": 4,
  "platforms": ["instagram", "tiktok"],
  "posts_per_week": 3,
  "posts": [
    {
      "id": "post_res_1",
      "titulo": "Platillo del Mes: Mole Poblano",
      "descripcion": "Conoce la historia y los ingredientes de nuestro platillo emblemático.",
      "fecha_posteo": "2024-03-02",
      "hora_sugerida": "12:00",
      "tipo": "video",
      "platform": "tiktok",
      "hashtags": ["#MolePoblano", "#CocinaMexicana", "#ComidaTípica"],
      "prompt": "15-second vertical video showing the preparation of Mole Poblano from scratch, traditional cooking, authentic kitchen, upbeat music"
    },
    {
      "id": "post_res_2",
      "titulo": "Happy Hour Especial",
      "descripcion": "2x1 en todas las bebidas desde las 5pm hasta el cierre.",
      "fecha_posteo": "2024-03-05",
      "hora_sugerida": "17:00",
      "tipo": "image",
      "platform": "instagram",
      "hashtags": ["#HappyHour", "#Bebidas", "#Descuento"],
      "prompt": "Colorful cocktail photography with fresh fruits and herbs, sunset background, vibrant colors, invitation to visit"
    },
    {
      "id": "post_res_3",
      "titulo": "Testimonios de comensales",
      "descripcion": "Lo que nuestros clientes dicen sobre su experiencia culinaria.",
      "fecha_posteo": "2024-03-08",
      "hora_sugerida": "19:00",
      "tipo": "carousel",
      "platform": "instagram",
      "hashtags": ["#Testimonios", "#ExperienciaComestible", "#Restaurante"],
      "prompt": "5-slide carousel with testimonial quotes from happy customers, photos of platillos, warm homey atmosphere"
    }
  ]
}', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- Plan para cliente Servicios
INSERT INTO content_plans (id, client_id, name, duration_weeks, platforms, posts_per_week, plan_data, created_at, updated_at) VALUES
('plan_servicios_q1', 'client_servicios', 'Plan Q1 - Crecimiento Digital', 4, '["linkedin", "facebook"]', 2, '{
  "name": "Plan Q1 - Crecimiento Digital",
  "duration_weeks": 4,
  "platforms": ["linkedin", "facebook"],
  "posts_per_week": 2,
  "posts": [
    {
      "id": "post_serv_1",
      "titulo": "5 Estrategias para Transformación Digital en 2024",
      "descripcion": "Guía paso a paso para modernizar la presencia digital de tu empresa.",
      "fecha_posteo": "2024-03-01",
      "hora_sugerida": "09:00",
      "tipo": "image",
      "platform": "linkedin",
      "hashtags": ["#TransformacionDigital", "#Estrategia", "#Business"],
      "prompt": "Professional LinkedIn post graphic about digital transformation strategies, corporate blue and white theme, data visualization elements"
    },
    {
      "id": "post_serv_2",
      "titulo": "ROI del Marketing Automatizado",
      "descripcion": "Cómo la automatización puede aumentar tus ingresos empresariales en un 40%.",
      "fecha_posteo": "2024-03-08",
      "hora_sugerida": "16:00",
      "tipo": "carousel",
      "platform": "facebook",
      "hashtags": ["#MarketingAutomatizado", "#ROI", "#CrecimientoEmpresarial"],
      "prompt": "5-slide carousel with statistics about marketing automation ROI, modern infographic style, business professional audience"
    }
  ]
}', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- ==========================================
-- 6. PUBLICACIONES DE EJEMPLO (calendario)
-- ==========================================

-- Publicaciones para cliente Moda
INSERT INTO posts (id, client_id, titulo, descripcion, imagen_url, plataformas, scheduled_at, status, created_at, updated_at) VALUES
('post_moda_1', 'client_moda', 'Lanzamiento Colección Primavera-Verano', 'Presentamos nuestra nueva colección con los colores y tendencias de la temporada.', NULL, '["instagram"]', '2024-03-01T10:00:00', 'queued', NOW(), NOW()),
('post_moda_2', 'client_moda', 'Tendencias de Color 2024', 'Los colores que marcarán tendencia esta temporada: pasteles y tonos tierra.', NULL, '["instagram"]', '2024-03-08T14:00:00', 'queued', NOW(), NOW())

ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- Publicaciones para cliente Restaurante
INSERT INTO posts (id, client_id, titulo, descripcion, imagen_url, plataformas, scheduled_at, status, created_at, updated_at) VALUES
('post_res_1', 'client_restaurante', 'Platillo del Mes: Mole Poblano', 'Conoce la historia y los ingredientes de nuestro platillo emblemático.', NULL, '["tiktok"]', '2024-03-02T12:00:00', 'queued', NOW(), NOW()),
('post_res_2', 'client_restaurante', 'Happy Hour Especial', '2x1 en todas las bebidas desde las 5pm hasta el cierre.', NULL, '["instagram"]', '2024-03-05T17:00:00', 'queued', NOW(), NOW()),
('post_res_3', 'client_restaurante', 'Testimonios de comensales', 'Lo que nuestros clientes dicen sobre su experiencia culinaria.', NULL, '["instagram"]', '2024-03-08T19:00:00', 'queued', NOW(), NOW())

ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- Publicaciones para cliente Servicios
INSERT INTO posts (id, client_id, titulo, descripcion, imagen_url, plataformas, scheduled_at, status, created_at, updated_at) VALUES
('post_serv_1', 'client_servicios', '5 Estrategias para Transformación Digital en 2024', 'Guía paso a paso para modernizar la presencia digital de tu empresa.', NULL, '["linkedin"]', '2024-03-01T09:00:00', 'queued', NOW(), NOW()),
('post_serv_2', 'client_servicios', 'ROI del Marketing Automatizado', 'Cómo la automatización puede aumentar tus ingresos empresariales en un 40%.', NULL, '["facebook"]', '2024-03-08T16:00:00', 'queued', NOW(), NOW())

ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- ==========================================
-- 7. CAMPANES DE PUBLICIDAD (opcional)
-- ==========================================

-- Campaña para cliente Moda
INSERT INTO campaigns (id, client_id, name, objective, provider, budget, status, starts_at, ends_at, created_at, updated_at) VALUES
('campaign_moda_bf', 'client_moda', 'Black Friday 2024', 'CONVERSIONS', 'meta', 8000, 'active', '2024-11-25', '2024-12-01', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- Campaña para cliente Restaurante
INSERT INTO campaigns (id, client_id, name, objective, provider, budget, status, starts_at, ends_at, created_at, updated_at) VALUES
('campaign_res_bf', 'client_restaurante', 'San Valentín 2025', 'ENGAGEMENT', 'meta', 3000, 'active', '2025-02-10', '2025-02-14', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- ==========================================
-- RESUMEN DE EJECUCIÓN
-- ==========================================

-- Para ejecutar: Copia este archivo a tu proyecto y ejecuta en Supabase SQL Editor
-- Luego configura tu API_KEY real en app_settings
-- Prueba el flujo: /dashboard/ai-agent → Analizar → Generar Plan → Guardar en Calendario

-- Pasos siguientes:
-- 1. Ejecutar script SQL en Supabase
-- 2. Iniciar sesión como root_user: root@slt.com
-- 3. Probar el IA Content Assistant
-- 4. Verificar publicaciones en calendario