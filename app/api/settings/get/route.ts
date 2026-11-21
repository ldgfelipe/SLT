import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/auth';
import { getSetting, setSettings, invalidateSettingsCache } from '@/lib/app/settings';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  if (!name) {
    return NextResponse.json({ error: 'Parameter "name" is required.' }, { status: 400 });
  }

  try {
    // Obtener valor específico
    const value = await getSetting(name);
    
    // También retornar la configuración completa del proveedor
    const provider = await getSetting('ia_provider') || 'freellmapi';
    const model = await getSetting('ia_model') || 'auto';
    const temperature = parseFloat(await getSetting('ia_temperature') || '0.7');
    const maxTokens = parseInt(await getSetting('ia_max_tokens') || '4000');
    const timeout = parseInt(await getSetting('ia_timeout') || '30');
    
    return NextResponse.json({
      value,
      // Configuración completa del proveedor
      provider,
      model,
      temperature,
      maxTokens,
      timeout
    });
  } catch (error: any) {
    console.error(`[settings/get] error for ${name}:`, error);
    return NextResponse.json({ error: error.message || 'Error getting setting.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  // Solo root puede cambiar configuraciones sensibles
  if (user.role !== 'root') {
    return NextResponse.json({ error: 'Solo administrador root puede cambiar configuraciones.' }, { status: 403 });
  }

  const { name, value, provider, model, temperature, maxTokens, timeout } = await request.json();

  if (!name) {
    return NextResponse.json({ error: 'Parameter "name" is required.' }, { status: 400 });
  }

  try {
    if (value === null || value === '') {
      // Elimina la configuración
      const { deleteSetting } = await import('@/lib/app/settings');
      await deleteSetting(name);
      await invalidateSettingsCache();
    } else {
      // Guardar el valor y la configuración del proveedor
      await setSettings({ [name]: value });
      // Actualizar configuración del proveedor si se proporciona
      if (provider) await setSettings({ ia_provider: provider });
      if (model !== undefined) await setSettings({ ia_model: String(model) });
      if (temperature !== undefined) await setSettings({ ia_temperature: String(temperature) });
      if (maxTokens !== undefined) await setSettings({ ia_max_tokens: String(maxTokens) });
      if (timeout !== undefined) await setSettings({ ia_timeout: String(timeout) });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`[settings/set] error for ${name}:`, error);
    return NextResponse.json({ error: error.message || 'Error setting value.' }, { status: 500 });
  }
}