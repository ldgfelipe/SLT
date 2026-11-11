'use client';

import { useState, useEffect } from 'react';
import { Loader2, Save, RefreshCw, AlertCircle, Check, ChevronDown, Plug, Power } from 'lucide-react';
import { SOCIAL_PROVIDERS } from '@/lib/growth/sandbox-config';

interface ProviderConfig {
  provider: string;
  status: 'not_configured' | 'configured' | 'connected' | 'error';
  connected_account?: {
    id: string;
    account_name: string;
  };
}

export function SandboxSettings({ clientId }: { clientId?: string }) {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadProvidersInfo();
  }, []);

  const loadProvidersInfo = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/social-accounts/status');
      const data = await response.json();
      
      const providerList = SOCIAL_PROVIDERS.map(provider => {
        const account = (data?.accounts || []).find((a: any) => a.provider === provider);
        
        if (account) {
          return {
            provider,
            status: 'connected' as const,
            connected_account: {
              id: account.id,
              account_name: account.account_name,
            }
          };
        }
        
        return {
          provider,
          status: 'not_configured' as const,
        };
      });
      
      setProviders(providerList);
    } catch (e) {
      console.error('Error loading providers:', e);
      setError('Error cargando información de proveedores');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (provider: string) => {
    setSuccess('');
    setError('');
    
    // Redirigir al proceso de OAuth
    window.location.href = `/api/auth/${provider}/connect`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
      case 'configured':
        return 'bg-amber-500/20 border-amber-500/40 text-amber-400';
      default:
        return 'bg-rose-500/20 border-rose-500/40 text-rose-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Conectada';
      case 'configured':
        return 'Configurada';
      default:
        return 'No configurada';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Estado de Redes Sociales</h3>
        <p className="text-xs text-slate-400 mb-6">
          Estado de conexión de tus cuentas sociales
        </p>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[#00d4ff]" />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-200 mb-4">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="grid gap-4">
          {providers.map((provider) => (
            <div key={provider.provider} className="border border-white/10 rounded-xl p-4 bg-[#0a1931]/30">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-white capitalize">{provider.provider}</h4>
                  {provider.connected_account && (
                    <p className="text-xs text-slate-400">
                      @{provider.connected_account.account_name}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(provider.status)}`}>
                    {getStatusLabel(provider.status)}
                  </span>
                  
                  {provider.status !== 'connected' && (
                    <button
                      onClick={() => handleConnect(provider.provider)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#00d4ff] px-3 py-1.5 text-xs font-medium text-[#06152b] hover:bg-cyan-300 transition"
                    >
                      <Plug className="h-3.5 w-3.5" />
                      Conectar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-200">
          <Check className="h-4 w-4" />
          {success}
        </div>
      )}
    </div>
  );
}