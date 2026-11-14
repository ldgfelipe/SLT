import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { canAccessClient } from '@/lib/growth/access';
import type { SocialProvider } from '@/types/database';

// Tipos
interface BusinessAnalysisRequest {
  business_name: string;
  category?: string;
  description?: string;
  target_audience?: string;
  competitors?: string[];
  brand_colors?: string[];
  tone?: string;
}

interface ContentPlanRequest {
  name: string;
  duration_weeks: number;
  platforms: SocialProvider[];
  posts_per_week: number;
  business_name?: string;
  category?: string;
  description?: string;
  target_audience?: string;
  competitors?: string[];
  brand_colors?: string[];
  tone?: string;
}

interface GenerateImageRequest {
  prompt: string;
  platform?: SocialProvider;
  type?: 'image' | 'carousel' | 'video';
  plan_id?: string;
}

// Simulación de análisis con IA (en producción usarías OpenAI o Anthropic)
function analyzeBusiness(data: BusinessAnalysisRequest) {
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

// Generar plan de publicación
function generateContentPlan(data: ContentPlanRequest) {
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
      'Interactúa con tus seguidores en los primeros 2 horas',
      'Usa emojis para incrementar el engagement en Instagram'
    ]
  };
}

// Generar prompt para imagen
function generateImagePrompt(data: GenerateImageRequest, businessInfo?: any) {
  let prompt = data.prompt;
  
  if (businessInfo?.brand_colors) {
    prompt += ` using brand colors: ${businessInfo.brand_colors.join(', ')}`;
  }
  
  if (businessInfo?.tone) {
    prompt += ` in a ${businessInfo.tone} style`;
  }
  
  switch (data.type) {
    case 'carousel':
      prompt += ' create a 5-image carousel showing different aspects';
      break;
    case 'video':
      prompt += ' create a 15-second video concept';
      break;
    default:
      prompt += ' create a professional social media image';
  }
  
  if (data.platform) {
    const platformStyles: Record<SocialProvider, string> = {
      facebook: 'suitable for Facebook feed with clear branding',
      instagram: 'suitable for Instagram with bold colors and text overlay',
      tiktok: 'suitable for TikTok with dynamic layout',
      linkedin: 'suitable for LinkedIn professional audience',
      x: 'suitable for Twitter/X with clear readability',
      threads: 'suitable for Threads with modern aesthetic',
      youtube: 'suitable for YouTube thumbnail format'
    };
    prompt += ` ${platformStyles[data.platform] || ''}`;
  }
  
  return prompt;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const { action, ...payload } = await request.json();
  const supabase = getSupabaseAdmin();

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
        } = payload as BusinessAnalysisRequest;

        if (!business_name) {
          return NextResponse.json({ error: 'business_name es requerido.' }, { status: 400 });
        }

        const analysis = analyzeBusiness({
          business_name,
          category,
          description,
          target_audience,
          competitors,
          brand_colors,
          tone
        });

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
        } = payload as ContentPlanRequest;

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
        const { prompt, plan_id } = payload as GenerateImageRequest;
        
        if (!prompt) {
          return NextResponse.json({ error: 'prompt es requerido.' }, { status: 400 });
        }

        // En producción, aquí llamarías a OpenAI/DALL-E o Midjourney
        // Por ahora, devolvemos el prompt generado
        return NextResponse.json({ 
          prompt: generateImagePrompt(payload),
          plan_id 
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

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const action = request.nextUrl.searchParams.get('action');
  
  return POST(request);
}