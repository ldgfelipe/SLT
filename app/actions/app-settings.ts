'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/app/actions/auth';
import { SECRET_KEY_KEYS } from '@/lib/app/keys';
import {
  deleteSetting,
  setSettings,
  invalidateSettingsCache,
} from '@/lib/app/settings';

const ALLOWED = new Set(SECRET_KEY_KEYS);

export interface SettingsActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

/** Guarda las claves enviadas (vacío = conservar el valor actual). */
export async function saveAppSettings(
  _prev: SettingsActionResult | undefined,
  formData: FormData
): Promise<SettingsActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };
  if (user.role !== 'root') {
    return {
      success: false,
      error: 'Solo el usuario root puede configurar las claves del Growth Hub.',
    };
  }

  const values: Record<string, string> = {};
  for (const key of ALLOWED) {
    const raw = formData.get(key);
    if (typeof raw === 'string' && raw.trim()) {
      values[key] = raw.trim();
    }
  }

  if (Object.keys(values).length === 0) {
    return { success: true, message: 'No hubo cambios.' };
  }

  try {
    await setSettings(values);
    invalidateSettingsCache();
    revalidatePath('/dashboard/settings');
    return {
      success: true,
      message: `${Object.keys(values).length} clave(s) guardadas y cifradas en la base de datos.`,
    };
  } catch (error: any) {
    console.error('[app-settings] save:', error);
    return {
      success: false,
      error: error?.message || 'No se pudieron guardar las claves.',
    };
  }
}

/** Elimina UNA clave de la base de datos. Las claves en Vercel no se tocan. */
export async function clearAppSetting(
  _prev: SettingsActionResult | undefined,
  formData: FormData
): Promise<SettingsActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'No autenticado.' };
  if (user.role !== 'root') {
    return { success: false, error: 'Solo el usuario root puede borrar claves.' };
  }

  const key = String(formData.get('key') || '');
  if (!ALLOWED.has(key)) {
    return { success: false, error: 'Clave no válida.' };
  }

  try {
    await deleteSetting(key);
    invalidateSettingsCache();
    revalidatePath('/dashboard/settings');
    return { success: true, message: `${key} eliminada de la base de datos.` };
  } catch (error: any) {
    console.error('[app-settings] clear:', error);
    return {
      success: false,
      error: error?.message || 'No se pudo eliminar la clave.',
    };
  }
}
