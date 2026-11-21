import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/auth';
import { canAccessClient } from '@/lib/growth/access';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const { prompt, openai_api_key, platform, image_type } = await request.json();

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt es requerido.' }, { status: 400 });
  }

  if (!openai_api_key) {
    return NextResponse.json({ error: 'API key de OpenAI requerida.' }, { status: 400 });
  }

  try {
    const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openai_api_key}`,
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

    if (!imageResponse.ok) {
      const error = await imageResponse.json();
      return NextResponse.json({ error: error?.message || 'Error generando imagen.' }, { status: 500 });
    }

    const imageData = await imageResponse.json();
    
    return NextResponse.json({
      success: true,
      image_url: imageData?.data?.[0]?.url || null,
      prompt: prompt
    });

  } catch (error: any) {
    console.error('[images/generate] error:', error);
    return NextResponse.json({ error: error.message || 'Error interno.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('client_id');
  
  if (clientId && !canAccessClient(user, clientId)) {
    return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 });
  }

  // Este endpoint es POST-only, pero se mantiene para compatibilidad
  return NextResponse.json({ error: 'Usa POST para generar imágenes.' }, { status: 405 });
}