'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Deal } from '@/types/database';

interface DealCardProps {
  deal: Deal;
  isOverlay?: boolean;
}

export function DealCard({ deal, isOverlay = false }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm cursor-grab active:cursor-grabbing hover:border-slate-300 transition-all select-none ${
        isDragging ? 'opacity-40' : ''
      } ${isOverlay ? 'shadow-2xl ring-2 ring-indigo-500 rotate-2' : ''}`}
    >
      <div className="flex justify-between items-start mb-2 gap-2">
        <h4 className="font-medium text-sm text-slate-900 dark:text-slate-100 line-clamp-2">
          {deal.title}
        </h4>
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 whitespace-nowrap">
          ${Number(deal.value || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
        </span>
      </div>

      {deal.contact && (
        <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700/60 pt-2 mt-2">
          <p className="truncate font-medium text-slate-700 dark:text-slate-300">
            {deal.contact.first_name} {deal.contact.last_name || ''}
          </p>
          <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
            {deal.contact.email}
          </p>
        </div>
      )}
    </div>
  );
}
