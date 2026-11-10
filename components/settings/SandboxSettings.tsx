'use client';

import { useState, useEffect } from 'react';
import { Loader2, Save, RefreshCw, AlertCircle } from 'lucide-react';
import { SOCIAL_PROVIDERS, type SocialProvider } from '@/lib/growth/sandbox-config';

interface SandboxSettingsProps {
  clientId?: string;
}

// Switch personalizado
function Toggle({ checked, onCheckedChange, disabled }: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onCheckedChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        checked 
          ? 'bg-[#00d4ff] border-[#00d4ff]' 
          : 'border-slate-600 bg-slate-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'} disabled:cursor-not-allowed`}
    >
      <div
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// Colores por provider
const PROVIDER_COLORS: Record<string, string> = {
  facebook: '#1877f2',
  instagram: '#e1306c',
  tiktok: '#00f2ea',
  linkedin: '#0a66c2',
  x: '#e7e9ea',
  threads: '#a1a1aa',
  youtube: '#ff0033',
};

const PROVIDER_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  x: 'X/Twitter',
  threads: 'Threads',
  youtube: 'YouTube',
};

export function SandboxSettings({ clientId }: SandboxSettingsProps) {
  const [configs, setConfigs] = useState<Record<string, { enabled: boolean; target: string }>>({});
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
      // Cargar configuración de cada provider
      const newConfigs: Record<string, { enabled: boolean; target: string }> = {};
      
      for (const provider of SOCIAL_PROVIDERS) {
        const response = await fetch(`/api/settings/sandbox/${provider}`);
        const data = await response.json();
        if (response.ok) {
          newConfigs[provider] = {
            enabled: data.enabled || false,
            target: data.target || '',
          };
        } else {
          newConfigs[provider] = { enabled: false, target: '' };
        }
      }
      
      setConfigs(newConfigs);
    } catch (e) {
      setError('Error cargando configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (provider: SocialProvider, checked: boolean) => {
    setConfigs(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        enabled: checked,
      },
    }));
  };

  const handleTargetChange = (provider: SocialProvider, value: string) => {
    setConfigs(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        target: value,
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
            enabled: config?.enabled || false,
            target: config?.target || '',
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

  const resetSettings = async () => {
    setLoading(true);
    try {
      for (const provider of SOCIAL_PROVIDERS) {
        await fetch(`/api/settings/sandbox/${provider}`, {
          method: 'DELETE',
        });
      }
      
      const emptyConfigs: Record<string, { enabled: boolean; target: string }> = {};
      SOCIAL_PROVIDERS.forEach(p => emptyConfigs[p] = { enabled: false, target: '' });
      setConfigs(emptyConfigs);
      
      setSuccess('Configuración reiniciada');
    } catch (e) {
      setError('Error reiniciando configuración');
    } finally {
      setLoading(false);
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
        <h3 className="text-lg font-semibold text-white mb-2">Configuración de Sandbox por Red</h3>
        <p className="text-xs text-slate-400 mb-4">
          Activa sandbox para una red social específica usando usuarios de prueba
        </p>
        
        <div className="rounded-2xl border border-white/10 bg-[#0c1f3d] p-6">
          <div className="grid gap-4">
            {SOCIAL_PROVIDERS.map((provider) => {
              const color = PROVIDER_COLORS[provider] || '#888';
              const label = PROVIDER_LABELS[provider] || provider;
              const config = configs[provider] || { enabled: false, target: '' };
              
              return (
                <div 
                  key={provider} 
                  className="border border-white/10 rounded-xl p-4 bg-[#0a1931]/30"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs"
                        style={{ backgroundColor: color }}
                      >
                        {provider.toUpperCase().charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">{label}</h4>
                        <p className="text-xs text-slate-400">
                          {config.enabled ? 'Sandbox activo' : 'Producción'}
                        </p>
                      </div>
                    </div>
                    <Toggle
                      checked={config.enabled}
                      onCheckedChange={(checked) => handleToggle(provider, checked)}
                    />
                  </div>
                  
                  {config.enabled && (
                    <div className="ml-13">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 block">
                        User ID de prueba
                      </label>
                      <input
                        type="text"
                        value={config.target}
                        onChange={(e) => handleTargetChange(provider, e.target.value)}
                        placeholder={`User ID de prueba para ${provider}`}
                        className="w-full rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#00d4ff] outline-none"
                      />
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
          <Save className="h-4 w-4" />
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

        <button
          onClick={resetSettings}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-500/20 bg-transparent px-4 py-2.5 text-sm font-medium text-amber-300 hover:bg-amber-500/10 transition"
        >
          Reiniciar
        </button>
      </div>
    </div>
  );
}