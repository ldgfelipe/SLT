import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { canAccessClient } from '@/lib/growth/access';
import type { SocialProvider } from '@/types/database';
import { getSetting } from '@/lib/app/settings';

// Configuraciones por proveedor de IA
const PROVIDERS_CONFIG = {
  openai: {
    name: 'OpenAI',
    apiHeader: 'Authorization',
    apiValue: 'Bearer ',
    models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4o'],
    defaultModel: 'gpt-4o',
  },
  freellmapi: {
    name: 'freellmapi',
    apiHeader: 'Authorization',
    apiValue: 'Bearer ',
    models: ['auto', 'freellm/fast', 'freellm/pro'],
    defaultModel: 'auto',
  },
  openroute: {
    name: 'openroute',
    apiHeader: 'Authorization',
    apiValue: 'Bearer ',
    models: ['auto', 'openroute/directions'],
    defaultModel: 'auto',
  },
};

// Obtener configuración actual del proveedor desde Supabase
async function getProviderConfig() {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', [
        'ia_provider',
        'ia_api_key',
        'ia_model',
        'ia_temperature',
        'ia_max_tokens',
        'ia_timeout',
      ])
      .single();
    
    if (data) {
      const settings: Record<string, string> = {};
      (data as any[]).forEach((row: any) => { settings[row.key] = row.value; });
      
      const provider = settings.ia_provider || 'freellmapi';
      const apiKey = settings.ia_api_key || '';
      const model = settings.ia_model || PROVIDERS_CONFIG[provider]?.defaultModel || 'auto';
      
      return {
        provider,
        apiKey,
        model,
        temperature: parseFloat(settings.ia_temperature || '0.7'),
        maxTokens: parseInt(settings.ia_max_tokens || '4000'),
        timeout: parseInt(settings.ia_timeout || '30'),
        config: PROVIDERS_CONFIG[provider] || PROVIDERS_CONFIG.freellmapi,
      };
    }
  } catch (e) {
    console.warn('Error reading IA provider config from Supabase:', e);
  }
  
  // Default: freellmapi gratuito
  return {
    provider: 'freellmapi',
    apiKey: '',
    model: 'auto',
    temperature: 0.7,
    maxTokens: 4000,
    timeout: 30,
    config: PROVIDERS_CONFIG.freellmapi,
  };
}

// Función auxiliar para análisis de negocio con proveedor configurable
async function analyzeBusiness(data: any, config: any) {
  const provider = config.provider || 'freellmapi';
  const apiKey = config.apiKey || '';
  const model = config.model || 'auto';
  const temperature = config.temperature || 0.7;
  
  // Si no hay API key o usa clave de prueba, usar análisis local/simulado
  if (!apiKey || apiKey.startsWith('sk-test') || apiKey === 'sk-test-key-for-slt-development-only-1234567890abcdef') {
    // Análisis local/simulado - no requiere API key
    return {
      category: data.category || 'General',
      target_audience: data.target_audience || 'General audience',
      competitors: data.competitors || [],
      brand_colors: data.brand_colors || ['#0a1931', '#00d4ff'],
      tone: data.tone || 'Profesional',
      key_messages: [
        `Calidad y profesionalismo en ${data.business_name}`,
        'Solución eficiente y confiable',
        'Enfoque centrado en el cliente'
      ],
      insights: [
        `Tu negocio ${data.business_name} se destaca por su enfoque en calidad`,
        'Considera destacar los beneficios únicos en cada publicación',
        'Usa testimonios reales para generar confianza'
      ]
    };
  }
  
  // Llamada real al proveedor de IA
  try {
    const response = await fetch('https://api.freellmapi.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model === 'auto' ? 'freellm/fast' : model,
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en marketing y análisis de negocios. Proporciona insights estratégicos y recomendaciones prácticas.'
          },
          {
            role: 'user',
            content: `Analiza el siguiente negocio y proporciona un análisis completo:\n\nNombre: ${data.business_name}\nCategoría: ${data.category || 'General'}\nDescripción: ${data.description || ''}\nAudiencia objetivo: ${data.target_audience || 'General audience'}\nCompetidores: ${data.competitors?.join(', ') || 'Ninguno'}\nColores de marca: ${data.brand_colors?.join(', ') || 'Ninguno'}\nTono de comunicación: ${data.tone || 'Profesional'}\n\nProporciona un JSON con: category, target_audience, competitors, brand_colors, tone, key_messages (array de 3), insights (array de 3).`
          }
        ],
        temperature: temperature,
        max_tokens: model === 'auto' ? 1000 : undefined,
      }),
    });
    
    // Si la llamada a freellmapi falla, intentar con openroute o caer de regreso local
    if (!response.ok) {
      console.warn('freellmapi call failed, trying fallback...');
      // Intentar con openroute para routing/navigation
      if (provider !== 'openroute') {
        try {
          const routeResponse = await fetch('https://api.openroute.com/v2/directions/driving-car', {
            method: 'POST',
            headers: {
              'Authorization': 'sk-test-openroute-key',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              coordinates: [[-99.133209, 19.432608], [-99.150647, 19.436167]],
              instructions: true,
              language: 'es-MX',
            }),
          });
          
          if (routeResponse.ok) {
            return { type: 'route', data: await routeResponse.json() };
          }
        } catch (e) {
          console.error('Route fallback also failed:', e);
        }
      }
      
      // Caer de regreso al análisis local
      return analyzeBusiness(data, { ...config, apiKey: '' });
    }
    
    if (!response.ok) {
      return analyzeBusiness(data, { ...config, apiKey: '' });
    }
    
    const result = await response.json();
    return result.choices?.[0]?.message?.content 
      ? JSON.parse(result.choices[0].message.content)
      : analyzeBusiness(data, { ...config, apiKey: '' });
    
  } catch (error) {
    console.error('Error in IA analysis:', error);
    // Caer de regreso al análisis local
    return analyzeBusiness(data, { ...config, apiKey: '' });
  }
}

// Generar plan de publicación (siempre local, no requiere API key)
function generateContentPlan(data: any) {
  const dates: string[] = [];
  const posts = [];

  const startDate = new Date();

  for (let week = 0; week < data.duration_weeks; week++) {
    for (let day = 0; day < 7; day++) {
      for (let postNum = 0; postNum < Math.ceil(data.posts_per_week / 7); postNum++) {
        if (postNum === 0) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + week * 7 + day);
          
          posts.push({
            date: date.toISOString().split('T')[0],
            platforms: data.platforms,
            titulo: `Publicación ${posts.length + 1} - ${data.business_name || 'Negocio'}`,
            descripcion: `Contenido relevante para nuestra audiencia en ${data.platforms.join(', ')}`,
            hashtag: `#${(data.business_name || 'negocio').replace(/\s+/g, '')}`,
            hora_sugerida: '10:00',
            tipo: day % 5 === 0 ? 'imagen' : 'texto'
          });
        }
      }
    }
  }

  return {
    plan: {
      name: data.name,
      duration_weeks: data.duration_weeks,
      total_posts: posts.length,
      posts_per_week: data.posts_per_week,
      platforms: data.platforms,
      posts
    },
    suggestions: [
      'Mantén consistencia en los horarios de publicación',
      'Interactúa con tus seguidores en las primeras 2 horas',
      'Usa emojis para incrementar el engagement en Instagram'
    ]
  };
}

// Generar prompt de imagen (siempre local)
function generateImagePrompt(data: any, config: any) {
  const provider = config.provider || 'freellmapi';
  const model = config.model || 'auto';
  
  // Prompt genérico que puede usarse con cualquier proveedor
  return `Prompt creativo para: ${data.prompt} • Proveedor: ${provider} • Modelo: ${model}`;
}

// Endpoint principal
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const { action, ...payload } = await request.json();
  const supabase = getSupabaseAdmin();

  // Obtener configuración del proveedor de IA
  const config = await getProviderConfig();

  // Obtener client_id del usuario
  const { data: userData } = await supabase
    .from('users')
    .select('client_id, role')
    .eq('id', user.id)
    .single();

  // Si el usuario no tiene client_id, intentar usar el primer cliente disponible
  let clientId: string | null = userData?.client_id || null;

  if (!clientId && user.role === 'root') {
    // Root puede usar cualquier cliente, usar el primero disponible
    const { data: clients } = await supabase
      .from('clients')
      .select('id')
      .order('created_at')
      .limit(1);
    
    if (clients && clients.length > 0) {
      clientId = clients[0].id;
    }
  }

  // Para acciones que no requieren guardado, permitir sin client_id
  const actionsWithoutClientId = ['generate_image_prompt'];
  const requiresClientId = !actionsWithoutClientId.includes(action);

  if (!clientId && requiresClientId) {
    return NextResponse.json({ 
      error: 'Usuario no tiene client_id. Asigna un cliente al usuario o contacta al administrador.' 
    }, { status: 400 });
  }

  try {
    switch (action) {
      case 'analyze_business': {
        const { 
          business_name, 
          category, 
          description, 
          target_audience, 
          competitors,
          brand_colors,
          tone 
        } = payload as {
          business_name: string;
          category?: string;
          description?: string;
          target_audience?: string;
          competitors?: string[];
          brand_colors?: string[];
          tone?: string;
        };

        if (!business_name) {
          return NextResponse.json({ error: 'business_name es requerido.' }, { status: 400 });
        }

        const analysis = await analyzeBusiness({
          business_name,
          category,
          description,
          target_audience,
          competitors,
          brand_colors,
          tone
        }, config);

        const { data: saved } = await supabase
          .from('business_analyses')
          .insert({
            client_id: clientId,
            business_name,
            category,
            description,
            target_audience,
            competitors,
            brand_colors,
            tone,
            analysis_data: analysis
          })
          .select()
          .single();

        return NextResponse.json({ analysis: saved }, { status: 201 });
      }

      case 'generate_content_plan': {
        const { 
          name, 
          duration_weeks, 
          platforms, 
          posts_per_week,
          business_name
        } = payload as {
          name: string;
          duration_weeks: number;
          platforms: SocialProvider[];
          posts_per_week: number;
          business_name?: string;
        };

        if (!name || !platforms || !duration_weeks) {
          return NextResponse.json({ 
            error: 'name, duration_weeks y platforms son requeridos.' 
          }, { status: 400 });
        }

        const planData = generateContentPlan(payload);

        const { data: saved } = await supabase
          .from('content_plans')
          .insert({
            client_id: clientId,
            name,
            duration_weeks,
            platforms,
            posts_per_week,
            plan_data: planData
          })
          .select()
          .single();

        return NextResponse.json({ plan: saved }, { status: 201 });
      }

      case 'generate_image_prompt': {
        const { prompt, plan_id } = payload as {
          prompt: string;
          plan_id?: string;
        };
        
        if (!prompt) {
          return NextResponse.json({ error: 'prompt es requerido.' }, { status: 400 });
        }

        // Usar el modelo y proveedor configurados
        const promptPrompt = generateImagePrompt({ prompt }, config);

        return NextResponse.json({ 
          prompt: promptPrompt,
          model: config.model,
          provider: config.provider
        }, { status: 200 });
      }

      case 'get_analyses': {
        const { data } = await supabase
          .from('business_analyses')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false });

        return NextResponse.json({ analyses: data }, { status: 200 });
      }

      case 'get_plans': {
        const { data } = await supabase
          .from('content_plans')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false });

        return NextResponse.json({ plans: data }, { status: 200 });
      }

      case 'get_generated_images': {
        const { data } = await supabase
          .from('generated_images')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false });

        return NextResponse.json({ images: data }, { status: 200 });
      }

      case 'save_to_calendar': {
        const { plan, posts } = payload as { plan: any; posts: any[] };
        
        if (!plan || !posts?.length) {
          return NextResponse.json({ error: 'plan y posts son requeridos.' }, { status: 400 });
        }

        const savedPosts: any[] = [];

        for (const post of posts) {
          const postDate = post.fecha_posteo || new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const postTime = post.hora_sugerida || '10:00';

          const { data: savedPost } = await supabase
            .from('posts')
            .insert({
              client_id: clientId,
              titulo: post.titulo,
              descripcion: post.descripcion,
              imagen_url: post.imagen_url || null,
              plataformas: plan.platforms || ['instagram'],
              scheduled_at: `${postDate}T${postTime}:00`,
              status: 'queued',
              external_post_ids: {},
              attempts: 0
            })
            .select()
            .single();

          if (savedPost) savedPosts.push(savedPost);
        }

        return NextResponse.json({ saved: savedPosts.length, posts: savedPosts }, { status: 201 });
      }

      default:
        return NextResponse.json({ 
          error: 'Acción no válida. Usa: analyze_business, generate_content_plan, generate_image_prompt, get_analyses, get_plans, get_generated_images' 
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[ai-agent] error:', error);
    return NextResponse.json({ error: error.message || 'Error interno.' }, { status: 500 });
  }
}

// Endpoint GET para compatibilidad
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const action = request.nextUrl.searchParams.get('action');
  
  // Si hay acción específica, pasarla como payload POST
  if (action) {
    const body = JSON.stringify({ action });
    const fakeRequest: NextRequest = {
      nextUrl: new URL('http://localhost'),
      headers: { 'content-type': 'application/json' },
      text: () => Promise.resolve(body),
    } as any;
    return POST(fakeRequest);
  }

  return NextResponse.json({ error: 'Usa POST con acción parámetro' }, { status: 400 });
}