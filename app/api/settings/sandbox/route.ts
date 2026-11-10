import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/auth';
import { setSettings, deleteSetting } from '@/lib/app/settings';
import { getSetting } from '@/lib/app/settings';
import { type SocialProvider } from '@/lib/growth/sandbox-config';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  // Solo root puede cambiar estas configuraciones
  if (user.role !== 'root') {
    return NextResponse.json({ error: 'Solo administrador root puede acceder.' }, { status: 403 });
  }

  const PROVIDERS: SocialProvider[] = ['facebook', 'instagram', 'tiktok', 'linkedin', 'x', 'threads', 'youtube'];

  try {
    // Cargar configuración global
    const globalSandbox = await getSetting('SANDBOX_MODE');
    
    // Cargar targets específicos
    const targets: Record<string, string | null> = {};
    for (const provider of PROVIDERS) {
      const targetKey = `SANDBOX_${provider.toUpperCase()}_TARGET`;
      targets[provider] = await getSetting(targetKey);
    }

    return NextResponse.json({
      globalSandbox: globalSandbox === 'true',
      targets: Object.fromEntries(
        Object.entries(targets).map(([k, v]) => [k, v || ''])
      ),
    });

  } catch (error: any) {
    console.error('[settings/sandbox] error:', error);
    return NextResponse.json({ error: error.message || 'Error cargando configuración.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  // Solo root puede cambiar estas configuraciones
  if (user.role !== 'root') {
    return NextResponse.json({ error: 'Solo administrador root puede acceder.' }, { status: 403 });
  }

  const { globalSandbox, targets } = await request.json();
  const PROVIDERS: SocialProvider[] = ['facebook', 'instagram', 'tiktok', 'linkedin', 'x', 'threads', 'youtube'];

  try {
    const settings: Record<string, string> = {};

    // Configuración global
    if (typeof globalSandbox === 'boolean') {
      settings.SANDBOX_MODE = globalSandbox ? 'true' : 'false';
    }

    // Targets específicos
    if (targets && typeof targets === 'object') {
      for (const provider of PROVIDERS) {
        if (targets[provider]) {
          const targetKey = `SANDBOX_${provider.toUpperCase()}_TARGET`;
          settings[targetKey] = targets[provider];
        }
      }
    }

    await setSettings(settings);

    return NextResponse.json({ success: true, message: 'Configuración guardada correctamente.' });

  } catch (error: any) {
    console.error('[settings/sandbox] error:', error);
    return NextResponse.json({ error: error.message || 'Error guardando configuración.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  // Solo root puede cambiar estas configuraciones
  if (user.role !== 'root') {
    return NextResponse.json({ error: 'Solo administrador root puede acceder.' }, { status: 403 });
  }

  const PROVIDERS: SocialProvider[] = ['facebook', 'instagram', 'tiktok', 'linkedin', 'x', 'threads', 'youtube'];

  try {
    // Eliminar configuración global
    await deleteSetting('SANDBOX_MODE');

    // Eliminar targets específicos
    for (const provider of PROVIDERS) {
      await deleteSetting(`SANDBOX_${provider.toUpperCase()}_TARGET`);
    }

    return NextResponse.json({ success: true, message: 'Configuración reiniciada.' });

  } catch (error: any) {
    console.error('[settings/sandbox] error:', error);
    return NextResponse.json({ error: error.message || 'Error reiniciando configuración.' }, { status: 500 });
  }
}