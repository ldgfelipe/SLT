'use client';

import React, { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { Stage } from '@/types/database';
import { updateStageName } from '@/app/actions/stages';

interface UpdateStageDialogProps {
  open: boolean;
  onClose: () => void;
  stage: Stage | null;
  onUpdated?: (stage: Stage) => void;
}

export function UpdateStageDialog({ open, onClose, stage, onUpdated }: UpdateStageDialogProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');

  React.useEffect(() => {
    if (stage) setName(stage.name);
  }, [stage]);

  if (!open || !stage) return null;

  const handleSave = async () => {
    if (!name.trim()) return;

    setSaving(true);
    const result = await updateStageName(stage.id, name.trim());
    setSaving(false);

    if (result.success) {
      onUpdated?.({ ...stage, name: name.trim() });
      onClose();
    } else {
      alert(result.error || 'Error al actualizar el nombre');
    }
  };

  return (
    <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#0a1931] p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Editar etapa</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="mb-4">
          <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
            Nombre de la etapa
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Prospección, Cotización, Cerrado"
            className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white placeholder:text-slate-500"
            disabled={saving}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-400 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}