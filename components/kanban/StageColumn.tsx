'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { DealCard } from './DealCard';
import { Stage, Deal } from '@/types/database';

interface StageColumnProps {
  stage: Stage;
  deals: Deal[];
}

export function StageColumn({ stage, deals }: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const totalValue = deals.reduce((acc, deal) => acc + Number(deal.value || 0), 0);

  return (
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
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          {deals.length}
        </span>
      </div>

      <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto min-h-[200px] p-0.5">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
        {deals.length === 0 && (
          <div className="h-24 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-center text-xs text-slate-400">
            Arrastra leads aquí
          </div>
        )}
      </div>
    </div>
  );
}
