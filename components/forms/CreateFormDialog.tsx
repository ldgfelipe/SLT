'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Stage } from '@/types/database';
import { FormEditorDialog } from '@/components/forms/FormEditorDialog';

interface CreateFormDialogProps {
  clientId: string;
  stages: Stage[];
}

export function CreateFormDialog({ clientId, stages }: CreateFormDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition shadow-sm"
      >
        <Plus className="w-4 h-4" /> Nuevo Formulario
      </button>

      <FormEditorDialog
        clientId={clientId}
        stages={stages}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
