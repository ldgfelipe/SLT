'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';

interface CampaignsSyncButtonProps {
  clientId: string;
}

export function CampaignsSyncButton({ clientId }: CampaignsSyncButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const sync = async () => {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch(
        `/api/campaigns/sync?client_id=${encodeURIComponent(clientId)}`,
        { method: 'POST' }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo sincronizar.');
      }

      const result = data?.results?.[0];
      if (result?.error) {
        setError(result.error);
      } else {
        setMessage(`${result?.synced || 0} campañas sincronizadas.`);
        router.refresh();
      }
    } catch (syncError: any) {
      setError(syncError?.message || 'No se pudo sincronizar Meta Ads.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={sync}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl bg-[#00d4ff] px-4 py-2.5 text-sm font-semibold text-[#06152b] shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300 disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Sincronizar Meta Ads
      </button>

      {message && (
        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
          <CheckCircle2 className="h-3 w-3" /> {message}
        </span>
      )}

      {error && (
        <span className="inline-flex max-w-xs items-start gap-1 text-right text-[11px] text-amber-300">
          <TriangleAlert className="mt-0.5 h-3 w-3 flex-shrink-0" /> {error}
        </span>
      )}
    </div>
  );
}
