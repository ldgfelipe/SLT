'use client';

import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { MoreVertical, Trash2, Edit3, AlertCircle } from 'lucide-react';
import { DealCard } from './DealCard';
import { Stage, Deal } from '@/types/database';
import { deleteStage } from '@/app/actions/stages';
import { UpdateStageDialog } from './UpdateStageDialog';

interface StageColumnProps {
  stage: Stage;
  deals: Deal[];
  onOpenDeal?: (deal: Deal) => void;
  onStageUpdated?: (stage: Stage) => void;
  onStageDeleted?: (stageId: string) => void;
}

export function StageColumn({ stage, deals, onOpenDeal, onStageUpdated, onStageDeleted }: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const totalValue = deals.reduce((acc, deal) => acc + Number(deal.value || 0), 0);

  const handleDeleteStage = async () => {
    setDeleting(true);
    setDeleteError('');

    const result = await deleteStage(stage.id);

    setDeleting(false);

    if (!result.success) {
      setDeleteError(result.error || 'No se pudo eliminar la etapa.');
      return;
    }

    onStageUpdated?.({ ...stage, name: '', deals: [] });
    setShowDeleteConfirm(false);
  };

  return (
    <div className="relative flex flex-col flex-shrink-0 w-80 bg-slate-50/80 dark:bg-slate-900/60 rounded-xl p-3 border transition-colors">
      {/* Delete confirmation overlay */}
      {showDeleteConfirm && !showMenu && (
        <div className="absolute inset-0 z-10 bg-black/50 backdrop-blur-sm rounded-xl flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 w-72 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Eliminar etapa
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  ¿Eliminar la etapa "{stage.name}"? 
                  <br />
                  Todas las oportunidades se moverán a la primera etapa disponible.
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteStage}
                disabled={deleting}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-60"
              >
                {deleting ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Eliminar
              </button>
            </div>
            {deleteError && (
              <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{deleteError}</p>
            )}
          </div>
        </div>
      )}

      <div
        ref={setNodeRef}
        className={`flex flex-col flex-shrink-0 w-80 bg-slate-50/80 dark:bg-slate-900/60 rounded-xl p-3 border transition-colors ${
          isOver
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20'
            : 'border-slate-200 dark:border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
              {stage.name}
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </span>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-full p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-slate-200"
              aria-label="Menú de etapa"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-6 z-50 w-48 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-800 py-1">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowEditDialog(true);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                >
                  <Edit3 className="h-3 w-3" />
                  Editar nombre
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowDeleteConfirm(true);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 flex items-center gap-2"
                >
                  <Trash2 className="h-3 w-3" />
                  Eliminar etapa
                </button>
              </div>
            )}
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {deals.length}
          </span>
        </div>

        <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto min-h-[200px] p-0.5">
          {deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              onOpen={onOpenDeal ? () => onOpenDeal(deal) : undefined}
            />
          ))}
          {deals.length === 0 && (
            <div className="h-24 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-center text-xs text-slate-400">
              Arrastra leads aquí
            </div>
          )}
        </div>
      </div>

      <UpdateStageDialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        stage={stage}
        onUpdated={onStageUpdated}
      />
    </div>
  );
}