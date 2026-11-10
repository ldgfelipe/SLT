'use client';

import { useState, useEffect } from 'react';
import { Loader2, Save, RefreshCw, AlertCircle } from 'lucide-react';

interface SandboxSettingsProps {
  clientId?: string;
}

// Switch personalizado
function Switch({ checked, onCheckedChange, className }: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <button
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
        checked ? 'bg-[#00d4ff] border-[#00d4ff]' : 'border-slate-600 bg-slate-600'
      } ${className}`}
    >
      <div
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export function SandboxSettings({ clientId }: SandboxSettingsProps) {
  const [globalSandbox, setGlobalSandbox] = useState(false);
  const [sandboxTargets, setSandboxTargets] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const PROVIDERS = ['facebook', 'instagram', 'tiktok', 'linkedin', 'x', 'threads', 'youtube'];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/sandbox', { method: 'GET' });
      const data = await response.json();
      if (response.ok) {
        setGlobalSandbox(data.globalSandbox || false);
        setSandboxTargets(data.targets || {});
      }
    } catch (e) {
      setError('Error cargando configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleGlobalToggle = async (checked: boolean) => {
    setGlobalSandbox(checked);
  };

  const handleTargetChange = (provider: string, value: string) => {
    setSandboxTargets(prev => ({
      ...prev,
      [provider]: value
    }));
  };

  const saveSettings = async () => {
    setSaving(true);
    setSuccess('');
    setError('');

    try {
      const response = await fetch('/api/settings/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          globalSandbox,
          targets: sandboxTargets,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Error guardando configuration');
      }

      setSuccess('Configuración de sandbox guardada correctamente');
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
      await fetch('/api/settings/sandbox', {
        method: 'DELETE',
      });
      setGlobalSandbox(false);
      const resetTargets: Record<string, string> = {};
      PROVIDERS.forEach(p => resetTargets[p] = '');
      setSandboxTargets(resetTargets);
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
        <h3 className="text-lg font-semibold text-white mb-4">Configuración de Sandbox</h3>
        
        <div className="rounded-2xl border border-white/10 bg-[#0c1f3d] p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-sm font-semibold text-white mb-1">Modo Sandbox Global</h4>
              <p className="text-xs text-slate-400">
                Habilita sandbox para todas las redes sociales automáticamente
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">{globalSandbox ? 'Activado' : 'Desactivado'}</span>
              <Switch
                checked={globalSandbox}
                onCheckedChange={handleGlobalToggle}
                className="data-[state='checked']:bg-[#00d4ff]"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Targets de usuario de prueba (opcional)
            </h4>
            
            {PROVIDERS.map((provider) => (
              <div key={provider} className="flex items-center gap-4">
                <div className="w-20">
                  <span className="text-xs text-slate-400 capitalize">{provider}</span>
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={sandboxTargets[provider] || ''}
                    onChange={(e) => handleTargetChange(provider, e.target.value)}
                    placeholder={`User ID de prueba para ${provider}`}
                    className="w-full rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#00d4ff] outline-none"
                  />
                </div>
              </div>
            ))}
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