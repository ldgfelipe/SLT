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
    const value = await getSetting(name);
    return NextResponse.json({ value });
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

  const { name, value } = await request.json();

  if (!name) {
    return NextResponse.json({ error: 'Parameter "name" is required.' }, { status: 400 });
  }

  try {
    if (value === null || value === '') {
      // Elimina la configuración
      const { deleteSetting } = await import('@/lib/app/settings');
      await deleteSetting(name);
    } else {
      await setSettings({ [name]: value });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`[settings/set] error for ${name}:`, error);
    return NextResponse.json({ error: error.message || 'Error setting value.' }, { status: 500 });
  }
}