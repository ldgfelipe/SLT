import { getSetting, setSettings, deleteSetting } from '@/lib/app/settings';

/**
 * Configuración de modo sandbox para redes sociales
 * 
 * Para habilitar sandbox en todas las redes:
 * - Variable de entorno: NEXT_PUBLIC_SANDBOX_MODE=true
 * - O en app_settings: SANDBOX_MODE = true
 */

export type SocialProviderSandboxConfig = {
  enabled: boolean;
  target?: string; // user_id específico para sandbox
  testAccountId?: string;
};

export const SOCIAL_PROVIDERS = ['facebook', 'instagram', 'tiktok', 'linkedin', 'x', 'threads', 'youtube'] as const;

export type SocialProvider = typeof SOCIAL_PROVIDERS[number];

// Configurable por provider
const DEFAULT_SANDBOX_CONFIG: Record<SocialProvider, SocialProviderSandboxConfig> = {
  facebook: { enabled: false, target: undefined },
  instagram: { enabled: false, target: undefined },
  tiktok: { enabled: false, target: undefined },
  linkedin: { enabled: false, target: undefined },
  x: { enabled: false, target: undefined },
  threads: { enabled: false, target: undefined },
  youtube: { enabled: false, target: undefined },
};

/**
 * Obtiene la configuración de sandbox para un provider específico
 */
export async function getSandboxConfig(provider: SocialProvider): Promise<SocialProviderSandboxConfig> {
  // 1. Verificar si el modo global sandbox está habilitado
  const globalSandbox = await getSetting('SANDBOX_MODE');
  const isGlobalSandbox = globalSandbox === 'true';

  // 2. Verificar configuración específica del provider
  const providerKey = `SANDBOX_${provider.toUpperCase()}`;
  const providerSandbox = await getSetting(providerKey);
  
  // 3. Verificar target específico (para usuarios de prueba)
  const targetKey = `SANDBOX_${provider.toUpperCase()}_TARGET`;
  const sandboxTarget = await getSetting(targetKey);

  // 4. Determinar si está habilitado
  let enabled = isGlobalSandbox;
  if (providerSandbox !== undefined && providerSandbox !== null) {
    enabled = providerSandbox === 'true';
  }

  return {
    enabled,
    target: sandboxTarget || undefined,
    testAccountId: sandboxTarget || undefined,
  };
}

/**
 * Obtiene todos los targets de sandbox para todos los providers
 */
export async function getAllSandboxTargets(): Promise<Record<string, string | undefined>> {
  const targets: Record<string, string | undefined> = {};
  
  for (const provider of SOCIAL_PROVIDERS) {
    const targetKey = `SANDBOX_${provider.toUpperCase()}_TARGET`;
    const value = await getSetting(targetKey);
    targets[provider] = value || undefined;
  }
  
  return targets;
}

/**
 * Habilita o deshabilita el modo sandbox globalmente
 */
export async function setGlobalSandbox(enabled: boolean): Promise<void> {
  await setSettings({ SANDBOX_MODE: enabled ? 'true' : 'false' });
}

/**
 * Configura el target de sandbox para un provider específico
 */
export async function setSandboxTarget(provider: SocialProvider, target: string): Promise<void> {
  const targetKey = `SANDBOX_${provider.toUpperCase()}_TARGET`;
  await setSettings({ [targetKey]: target });
}

/**
 * Habilita el modo sandbox
 */
export async function enableSandbox(): Promise<void> {
  await setGlobalSandbox(true);
}

/**
 * Deshabilita el modo sandbox
 */
export async function disableSandbox(): Promise<void> {
  await setGlobalSandbox(false);
}

/**
 * Resetea todas las configuraciones de sandbox
 */
export async function resetSandboxConfig(): Promise<void> {
  await deleteSetting('SANDBOX_MODE');
  
  for (const provider of SOCIAL_PROVIDERS) {
    await deleteSetting(`SANDBOX_${provider.toUpperCase()}`);
    await deleteSetting(`SANDBOX_${provider.toUpperCase()}_TARGET`);
  }
}