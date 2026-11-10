import { getSetting } from '@/lib/app/settings';
import { setSettings, deleteSetting } from '@/lib/app/settings';

export type SocialProvider = 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'x' | 'threads' | 'youtube';

export interface ProviderSandboxConfig {
  enabled: boolean;
  target?: string | null;
}

export const SOCIAL_PROVIDERS = ['facebook', 'instagram', 'tiktok', 'linkedin', 'x', 'threads', 'youtube'] as const;

/**
 * Obtiene la configuración de sandbox para un provider específico
 */
export async function getSandboxConfig(provider: SocialProvider): Promise<ProviderSandboxConfig> {
  // Leer configuración específica del provider desde app_settings
  const enabledRaw = await getSetting(`SANDBOX_${provider.toUpperCase()}_ENABLED`);
  const targetRaw = await getSetting(`SANDBOX_${provider.toUpperCase()}_TARGET`);

  const enabled = enabledRaw === 'true';
  const target = targetRaw || null;

  return {
    enabled,
    target: enabled ? target : null,
  };
}

/**
 * Obtiene el estado de sandbox para todos los providers
 */
export async function getAllSandboxConfigs(): Promise<Record<string, ProviderSandboxConfig>> {
  const configs: Record<string, ProviderSandboxConfig> = {};
  
  for (const provider of SOCIAL_PROVIDERS) {
    configs[provider] = await getSandboxConfig(provider);
  }
  
  return configs;
}

/**
 * Establece la configuración de sandbox para un provider específico
 */
export async function setProviderSandboxConfig(
  provider: SocialProvider,
  config: { enabled: boolean; target?: string | null }
): Promise<void> {
  const settings: Record<string, string> = {};
  
  settings[`SANDBOX_${provider.toUpperCase()}_ENABLED`] = config.enabled ? 'true' : 'false';
  
  if (config.target) {
    settings[`SANDBOX_${provider.toUpperCase()}_TARGET`] = config.target;
  } else {
    // Eliminar target si no hay uno
    await deleteSetting(`SANDBOX_${provider.toUpperCase()}_TARGET`);
  }

  await setSettings(settings);
}

/**
 * Reinicia todas las configuraciones de sandbox
 */
export async function resetAllSandboxConfigs(): Promise<void> {
  const keys: string[] = [];
  
  for (const provider of SOCIAL_PROVIDERS) {
    keys.push(`SANDBOX_${provider.toUpperCase()}_ENABLED`, `SANDBOX_${provider.toUpperCase()}_TARGET`);
  }
  
  for (const key of keys) {
    await deleteSetting(key);
  }
}

/**
 * Verifica si un provider debe usar sandbox para una URL de autorización
 */
export async function shouldUseSandbox(provider: SocialProvider, target?: string): Promise<boolean> {
  // Si se proporciona un target explícitamente, usar sandbox
  if (target) return true;
  
  // Leer configuración del provider
  const config = await getSandboxConfig(provider);
  return config.enabled && !!config.target;
}