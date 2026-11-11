'use client';

import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Power, Plug } from 'lucide-react';
import { SOCIAL_PROVIDERS } from '@/lib/growth/sandbox-config';

interface SocialAccount {
  id: string;
  provider: string;
  account_name: string;
  status: string;
  created_at: string;
  token_expires_at?: string;
}

interface ProviderStatus {
  provider: string;
  state: 'red' | 'yellow' | 'green';
  label: string;
  connected_account?: SocialAccount;
}

export function SandboxSettings() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProvidersInfo();
  }, []);

  const loadProvidersInfo = async () => {
    setLoading(true);
    setError('');
    try {
      // Usar el endpoint de accounts que ya tiene el clientId desde cookie
      const response = await fetch('/api/accounts');
      const data = await response.json();
      const accounts: SocialAccount[] = data?.accounts || [];
      
      const providerList: ProviderStatus[] = SOCIAL_PROVIDERS.map(provider => {
        const account = accounts.find((a: SocialAccount) => a.provider === provider);
        
        if (account && account.status === 'active') {
          // 🟢 VERDE - Conectada y activa
          return {
            provider,
            state: 'green',
            label: 'Conectada',
            connected_account: account
          };
        } else if (account) {
          // 🟡 AMARILLO - Configurada pero con problemas
          return {
            provider,
            state: 'yellow',
            label: 'Conectada (sin access)',
            connected_account: account
          };
        }
        
        // 🔴 ROJO - No configurada
        return {
          provider,
          state: 'red',
          label: 'No configurada',
        };
      });
      
      setProviders(providerList);
    } catch (e) {
      console.error('Error loading providers:', e);
      setError('Error cargando información de proveedores');
      // Set defaults
      const providerList: ProviderStatus[] = SOCIAL_PROVIDERS.map(provider => ({
        provider,
        state: 'red',
        label: 'No configurada',
      }));
      setProviders(providerList);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIndicator = (state: string) => {
    switch (state) {
      case 'green':
        return {
          bg: 'bg-emerald-500/20',
          border: 'border-emerald-500/40',
          text: 'text-emerald-400',
          icon: '✓',
          label: 'Conectada'
        };
      case 'yellow':
        return {
          bg: 'bg-amber-500/20',
          border: 'border-amber-500/40',
          text: 'text-amber-400',
          icon: '⚠️',
          label: 'Conectada (problema)'
        };
      case 'red':
      default:
        return {
          bg: 'bg-rose-500/20',
          border: 'border-rose-500/40',
          text: 'text-rose-400',
          icon: '○',
          label: 'No configurada'
        };
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
          {providers.map((provider) => {
            const indicator = getStatusIndicator(provider.state);
            return (
              <div key={provider.provider} className={`border ${indicator.border} rounded-xl p-4 ${indicator.bg}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-white capitalize">{provider.provider}</h4>
                    {provider.connected_account && (
                      <p className="text-xs text-slate-400">
                        @{provider.connected_account.account_name}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${indicator.text}`}>
                      {indicator.icon} {provider.label}
                    </span>
                    {provider.state !== 'green' && (
                      <a
                        href={`/social-accounts/connect/${provider.provider}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#00d4ff] px-3 py-1.5 text-xs font-medium text-[#06152b] hover:bg-cyan-300 transition"
                      >
                        <Plug className="h-3.5 w-3.5" />
                        Conectar
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}