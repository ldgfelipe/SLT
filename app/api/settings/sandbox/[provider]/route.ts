import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/auth';
import { setSettings, deleteSetting, getSetting } from '@/lib/app/settings';
import { type SocialProvider, SOCIAL_PROVIDERS } from '@/lib/growth/sandbox-config';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  if (user.role !== 'root') {
    return NextResponse.json({ error: 'Solo administrador root puede acceder.' }, { status: 403 });
  }

  const { provider } = await context.params;
  const validProvider = SOCIAL_PROVIDERS.find(p => p === provider);
  
  if (!validProvider) {
    return NextResponse.json({ error: 'Proveedor no válido.' }, { status: 400 });
  }

  try {
    const enabledRaw = await getSetting(`SANDBOX_${provider.toUpperCase()}_ENABLED`);
    const targetRaw = await getSetting(`SANDBOX_${provider.toUpperCase()}_TARGET`);

    return NextResponse.json({
      enabled: enabledRaw === 'true',
      target: targetRaw || null,
    });

  } catch (error: any) {
    console.error(`[settings/sandbox/${provider}] error:`, error);
    return NextResponse.json({ error: error.message || 'Error cargando configuración.' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  if (user.role !== 'root') {
    return NextResponse.json({ error: 'Solo administrador root puede acceder.' }, { status: 403 });
  }

  const { provider } = await context.params;
  const validProvider = SOCIAL_PROVIDERS.find(p => p === provider);
  
  if (!validProvider) {
    return NextResponse.json({ error: 'Proveedor no válido.' }, { status: 400 });
  }

  const { enabled, target } = await request.json();

  try {
    const settings: Record<string, string> = {};
    
    settings[`SANDBOX_${provider.toUpperCase()}_ENABLED`] = enabled ? 'true' : 'false';
    
    if (target && enabled) {
      settings[`SANDBOX_${provider.toUpperCase()}_TARGET`] = target;
    } else {
      // Eliminar target si no está habilitado
      await deleteSetting(`SANDBOX_${provider.toUpperCase()}_TARGET`);
    }

    await setSettings(settings);

    return NextResponse.json({ 
      success: true, 
      message: `Configuración para ${provider} guardada correctamente.` 
    });

  } catch (error: any) {
    console.error(`[settings/sandbox/${provider}] error:`, error);
    return NextResponse.json({ error: error.message || 'Error guardando configuración.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  if (user.role !== 'root') {
    return NextResponse.json({ error: 'Solo administrador root puede acceder.' }, { status: 403 });
  }

  const { provider } = await context.params;
  const validProvider = SOCIAL_PROVIDERS.find(p => p === provider);
  
  if (!validProvider) {
    return NextResponse.json({ error: 'Proveedor no válido.' }, { status: 400 });
  }

  try {
    await deleteSetting(`SANDBOX_${provider.toUpperCase()}_ENABLED`);
    await deleteSetting(`SANDBOX_${provider.toUpperCase()}_TARGET`);

    return NextResponse.json({ 
      success: true, 
      message: `Configuración para ${provider} reiniciada.` 
    });

  } catch (error: any) {
    console.error(`[settings/sandbox/${provider}] error:`, error);
    return NextResponse.json({ error: error.message || 'Error reiniciando configuración.' }, { status: 500 });
  }
}