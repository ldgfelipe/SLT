import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { canAccessClient } from '@/lib/growth/access';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const { plan_id, openai_api_key, generate_storage } = await request.json();

  const supabase = getSupabaseAdmin();

  // Obtener el plan de contenido
  const { data: plan, error: planError } = await supabase
    .from('content_plans')
    .select('*, client_id, business_name, analysis_data')
    .eq('id', plan_id)
    .single();

  if (planError || !plan) {
    return NextResponse.json({ error: 'Plan no encontrado.' }, { status: 404 });
  }

  // Verificar acceso
  if (!canAccessClient(user, plan.client_id)) {
    return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 });
  }

  const posts = plan.plan_data?.posts || [];
  const businessInfo = plan.analysis_data || {};

  if (!openai_api_key) {
    return NextResponse.json({ error: 'API key de OpenAI requerida.' }, { status: 400 });
  }

  const generatedImages: any[] = [];
  const results: any[] = [];

  // Generar imágenes para cada post
  for (const post of posts) {
    const prompt = buildImagePrompt(post, businessInfo);

    try {
      const imageResponse = await generateImage(prompt, openai_api_key);
      const imageData = await imageResponse.json();

      const imageRecord = {
        client_id: plan.client_id,
        plan_id: plan_id,
        post_titulo: post.titulo,
        prompt: prompt,
        image_url: imageData?.data?.[0]?.url || null,
        type: post.tipo || 'image',
        status: imageData?.data?.[0]?.url ? 'completed' : 'failed',
        error: imageData?.error || null,
        created_at: new Date().toISOString(),
      };

      const { data: savedImage } = await supabase
        .from('generated_images')
        .insert(imageRecord)
        .select()
        .single();

      results.push(savedImage);
    } catch (error: any) {
      results.push({ error: error.message, post: post.titulo });
    }
  }

  return NextResponse.json({
    success: true,
    generated: results.length,
    images: results,
  });
}

function buildImagePrompt(post: any, businessInfo: any): string {
  let prompt = post.descripcion || post.titulo || 'Content creation';

  // Añadir colores de marca
  if (businessInfo?.brand_colors?.length) {
    prompt += ` using brand colors: ${businessInfo.brand_colors.join(', ')}`;
  }

  // Añadir tono
  if (businessInfo?.tone) {
    prompt += ` in a ${businessInfo.tone} style`;
  }

  // Ajustar según tipo
  const tipo = post.tipo || 'image';
  if (tipo === 'carousel') {
    prompt += ' create a 5-image carousel showing different aspects';
  } else if (tipo === 'video') {
    prompt += ' create a 15-second video concept';
  } else {
    prompt += ' create a professional social media image';
  }

  return prompt;
}

async function generateImage(prompt: string, apiKey: string) {
  return await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    }),
  });
}