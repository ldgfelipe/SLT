'use client';

import { useState } from 'react';
import { Play, Loader2, CheckCircle2 } from 'lucide-react';
import { CampaignGeneratorDialog } from '@/components/growth/CampaignGeneratorDialog';

interface CampaignGenerateButtonProps {
  clientId: string;
  clientName: string;
}

export function CampaignGenerateButton({ clientId, clientName }: CampaignGenerateButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition"
      >
        <Play className="h-4 w-4" />
        Generar Campaña
      </button>

      <CampaignGeneratorDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        clientId={clientId}
        clientName={clientName}
      />
    </>
  );
}