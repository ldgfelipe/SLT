'use client';

import { useState, useEffect } from 'react';
import { Loader2, Save, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { SOCIAL_PROVIDERS, type SocialProvider } from '@/lib/growth/sandbox-config';

interface ProviderConfig {
  sandbox: boolean;
  testKey?: string;
  testSecret?: string;
}

export function SandboxSettings({ clientId }: { clientId?: string }) {
  const [configs, setConfigs] = useState<Record<string, ProviderConfig>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const newConfigs: Record<string, ProviderConfig> = {};
      
      for (const provider of SOCIAL_PROVIDERS) {
        const enabledRaw = await getSetting(`SANDBOX_${provider.toUpperCase()}_ENABLED`);
        newConfigs[provider] = {
          sandbox: enabledRaw === 'true',
          testKey: '',
          testSecret: '',
        };
      }
      
      setConfigs(newConfigs);
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

  const handleToggle = (provider: SocialProvider, checked: boolean) => {
    setConfigs(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        sandbox: checked,
      },
    }));
  };

  const handleTestKeyChange = (provider: SocialProvider, value: string) => {
    setConfigs(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        testKey: value,
      },
    }));
  };

  const handleTestSecretChange = (provider: SocialProvider, value: string) => {
    setConfigs(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        testSecret: value,
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
        await fetch(`/api/settings/sandbox/${provider}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled: config?.sandbox || false,
            target: config?.testKey || '',
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
        <h3 className="text-lg font-semibold text-white mb-4">Modo Sandbox</h3>
        <p className="text-xs text-slate-400 mb-6">
          Activa sandbox para usar cuentas de prueba en lugar de producción
        </p>
        
        <div className="rounded-2xl border border-white/10 bg-[#0c1f3d] p-6">
          <div className="grid gap-4">
            {SOCIAL_PROVIDERS.map((provider) => {
              const config = configs[provider] || { sandbox: false, testKey: '', testSecret: '' };
              const color = provider === 'tiktok' ? '#00f2ea' : 
                           provider === 'instagram' ? '#e1306c' : 
                           provider === 'facebook' ? '#1877f2' : '#888';
              
              return (
                <div key={provider} className="border border-white/10 rounded-xl p-4 bg-[#0a1931]/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                        style={{ backgroundColor: color }}
                      >
                        {provider.toUpperCase().charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-white capitalize">{provider}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">
                        {config.sandbox ? 'Sandbox' : 'Producción'}
                      </span>
                      <label className="relative inline-flex h-5 w-9 items-center">
                        <input
                          type="checkbox"
                          checked={config.sandbox}
                          onChange={(e) => handleToggle(provider, e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`inline-block h-5 w-5 rounded-full transition-transform ${
                          config.sandbox ? 'translate-x-5 bg-[#00d4ff]' : 'translate-x-1 bg-slate-600'
                        }`}></div>
                      </label>
                    </div>
                  </div>
                  
                  {config.sandbox && (
                    <div className="ml-13 grid gap-3">
                      <div>
                        <label className="text-xs font-semibold uppercase text-slate-400 mb-1 block">
                          User ID de prueba
                        </label>
                        <input
                          type="text"
                          value={config.testKey}
                          onChange={(e) => handleTestKeyChange(provider, e.target.value)}
                          placeholder={`User ID de prueba para ${provider}`}
                          className="w-full rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#00d4ff] outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mensaje de éxito */}
      {success && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-200">
          <Check className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* Mensaje de error */}
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