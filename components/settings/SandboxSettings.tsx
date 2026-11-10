'use client';

import { useState, useEffect } from 'react';
import { Loader2, Save, RefreshCw, AlertCircle, Check, ChevronDown } from 'lucide-react';
import { SOCIAL_PROVIDERS } from '@/lib/growth/sandbox-config';

interface SocialProviderConfig {
  sandbox: boolean;
  production: {
    client_id: string;
    client_secret: string;
  };
  sandbox_keys: {
    client_id: string;
    client_secret: string;
    target_user_id?: string;
  };
}

export function SandboxSettings({ clientId }: { clientId?: string }) {
  const [configs, setConfigs] = useState<Record<string, SocialProviderConfig>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Claves de producción por provider
  const PRODUCTION_KEYS: Record<string, [string, string]> = {
    facebook: ['META_APP_ID', 'META_APP_SECRET'],
    instagram: ['META_APP_ID', 'META_APP_SECRET'],
    tiktok: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
    linkedin: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
    x: ['X_CLIENT_ID', 'X_CLIENT_SECRET'],
    threads: ['THREADS_APP_ID', 'THREADS_APP_SECRET'],
    youtube: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  };

  const PRODUCTION_LABELS: Record<string, string> = {
    facebook: 'App ID',
    instagram: 'App ID',
    tiktok: 'Client Key',
    linkedin: 'Client ID',
    x: 'Client ID',
    threads: 'App ID',
    youtube: 'Client ID',
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const newConfigs: Record<string, SocialProviderConfig> = {};
      
      for (const provider of SOCIAL_PROVIDERS) {
        const [idKey, secretKey] = PRODUCTION_KEYS[provider] || ['', ''];
        const enabledRaw = await getSetting(`SANDBOX_${provider.toUpperCase()}_ENABLED`);
        const targetRaw = await getSetting(`SANDBOX_${provider.toUpperCase()}_TARGET`);
        
        newConfigs[provider] = {
          sandbox: enabledRaw === 'true',
          production: {
            client_id: '',
            client_secret: '',
          },
          sandbox_keys: {
            client_id: '',
            client_secret: '',
            target_user_id: targetRaw || undefined,
          },
        };
      }
      
      setConfigs(newConfigs);
      
      // Abrir todos por defecto
      const newExpanded: Record<string, boolean> = {};
      SOCIAL_PROVIDERS.forEach(p => newExpanded[p] = true);
      setExpanded(newExpanded);
      
    } catch (e) {
      setError('Error cargando configuración');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get setting
  const getSetting = async (key: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/settings/sandbox`);
      const data = await response.json();
      return data[key] || null;
    } catch {
      return null;
    }
  };

  const handleToggle = (provider: string, checked: boolean) => {
    setConfigs(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        sandbox: checked,
      },
    }));
  };

  const handleProductionChange = (provider: string, field: 'client_id' | 'client_secret', value: string) => {
    setConfigs(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        production: {
          ...prev[provider].production,
          [field]: value,
        },
      },
    }));
  };

  const handleSandboxChange = (provider: string, field: 'client_id' | 'client_secret' | 'target_user_id', value: string) => {
    setConfigs(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        sandbox_keys: {
          ...prev[provider].sandbox_keys,
          [field]: value,
        },
      },
    }));
  };

  const saveSettings = async () => {
    setSaving(true);
    setSuccess('');
    setError('');

    try {
      for (const provider of SOCIAL_PROVIDERS) {
        const config = configs[provider];
        if (!config) continue;
        
        // Guardar toggle de sandbox
        await fetch(`/api/settings/sandbox/${provider}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled: config.sandbox,
            target: config.sandbox_keys.target_user_id || '',
          }),
        });
      }

      setSuccess('Configuración guardada correctamente');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.message || 'Error inesperado');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-[#00d4ff]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Configuración por Red Social</h3>
        <p className="text-xs text-slate-400 mb-6">
          Ingresa las claves de producción y/o sandbox para cada red social. 
          Usa el toggle para alternar entre modo producción y sandbox.
        </p>
        
        <div className="rounded-2xl border border-white/10 bg-[#0c1f3d] p-6">
          <div className="space-y-4">
            {SOCIAL_PROVIDERS.map((provider) => {
              const config = configs[provider] || {
                sandbox: false,
                production: { client_id: '', client_secret: '' },
                sandbox_keys: { client_id: '', client_secret: '', target_user_id: '' },
              };
              const isOpen = expanded[provider];
              
              return (
                <div key={provider} className="border border-white/10 rounded-xl bg-[#0a1931]/30">
                  <button
                    onClick={() => setExpanded(prev => ({ ...prev, [provider]: !isOpen }))}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-white capitalize">{provider}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 mr-4">
                        {config.sandbox ? 'Sandbox' : 'Producción'}
                      </span>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={config.sandbox}
                          onChange={(e) => handleToggle(provider, e.target.checked)}
                          className="h-4 w-4 rounded border-white/20 bg-[#0a1931]"
                        />
                      </div>
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  
                  {isOpen && (
                    <div className="px-4 pb-3 space-y-3">
                      {/* Producción */}
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#00d4ff] mb-2">
                          Producción
                        </h4>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                              {PRODUCTION_LABELS[provider] || 'Client ID'}
                            </label>
                            <input
                              type="text"
                              value={config.production.client_id}
                              onChange={(e) => handleProductionChange(provider, 'client_id', e.target.value)}
                              placeholder="Client ID"
                              className="w-full rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#00d4ff] outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                              Client Secret
                            </label>
                            <input
                              type="text"
                              value={config.production.client_secret}
                              onChange={(e) => handleProductionChange(provider, 'client_secret', e.target.value)}
                              placeholder="Client Secret"
                              className="w-full rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#00d4ff] outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Sandbox */}
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">
                          Sandbox/Prueba
                        </h4>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                              Client ID
                            </label>
                            <input
                              type="text"
                              value={config.sandbox_keys.client_id}
                              onChange={(e) => handleSandboxChange(provider, 'client_id', e.target.value)}
                              placeholder="Client ID Sandbox"
                              className="w-full rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                              Client Secret
                            </label>
                            <input
                              type="text"
                              value={config.sandbox_keys.client_secret}
                              onChange={(e) => handleSandboxChange(provider, 'client_secret', e.target.value)}
                              placeholder="Client Secret Sandbox"
                              className="w-full rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 outline-none"
                            />
                          </div>
                        </div>
                        {provider === 'tiktok' && (
                          <div className="mt-2">
                            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                              User ID Prueba
                            </label>
                            <input
                              type="text"
                              value={config.sandbox_keys.target_user_id || ''}
                              onChange={(e) => handleSandboxChange(provider, 'target_user_id', e.target.value)}
                              placeholder="User ID de prueba"
                              className="w-full rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mensajes */}
      {success && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-200">
          <Check className="h-4 w-4" />
          {success}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-200">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Botones */}
      <div className="flex gap-3">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[#00d4ff] px-4 py-2.5 text-sm font-semibold text-[#06152b] hover:bg-cyan-300 transition disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar Configuración
        </button>

        <button
          onClick={loadSettings}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 transition"
        >
          <RefreshCw className="h-4 w-4" />
          Recargar
        </button>
      </div>
    </div>
  );
}