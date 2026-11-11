'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, Plug } from 'lucide-react';
import { SOCIAL_PROVIDERS } from '@/lib/growth/sandbox-config';

interface SocialAccount {
  id: string;
  provider: string;
  account_name: string;
  status: string;
}

interface ProviderStatus {
  provider: string;
  state: 'red' | 'yellow' | 'green';
  label: string;
  connected_account?: SocialAccount;
}

export function SocialAccountsStatus() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProvidersInfo();
  }, []);

  const loadProvidersInfo = async () => {
    try {
      const response = await fetch('/api/accounts');
      const data = await response.json();
      const accounts: SocialAccount[] = data?.accounts || [];
      
      const providerList: ProviderStatus[] = SOCIAL_PROVIDERS.map(provider => {
        const account = accounts.find((a: SocialAccount) => a.provider === provider);
        
        if (account && account.status === 'active') {
          return {
            provider,
            state: 'green',
            label: 'Conectada',
            connected_account: account
          };
        } else if (account) {
          return {
            provider,
            state: 'yellow',
            label: 'Sin conectar',
            connected_account: account
          };
        }
        
        return {
          provider,
          state: 'red',
          label: 'No configurada',
        };
      });
      
      setProviders(providerList);
    } catch (e) {
      setError('Error cargando estado de redes');
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
        };
      case 'yellow':
        return {
          bg: 'bg-amber-500/20',
          border: 'border-amber-500/40',
          text: 'text-amber-400',
          icon: '⚠️',
        };
      default:
        return {
          bg: 'bg-rose-500/20',
          border: 'border-rose-500/40',
          text: 'text-rose-400',
          icon: '○',
        };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-[#00d4ff]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-200">
        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-white mb-3">Estado de Redes Sociales</h3>
      <div className="grid gap-3">
        {providers.map((provider) => {
          const indicator = getStatusIndicator(provider.state);
          return (
            <div key={provider.provider} className={`border ${indicator.border} rounded-xl p-3 ${indicator.bg}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-medium text-white capitalize">{provider.provider}</h4>
                  {provider.connected_account && (
                    <p className="text-xs text-slate-400">
                      @{provider.connected_account.account_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${indicator.text}`}>
                    {indicator.icon} {provider.label}
                  </span>
                  {provider.state !== 'green' && (
                    <a
                      href={`/social-accounts/connect/${provider.provider}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#00d4ff] px-2 py-1 text-xs font-medium text-[#06152b] hover:bg-cyan-300 transition"
                    >
                      <Plug className="h-3 w-3" />
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
  );
}