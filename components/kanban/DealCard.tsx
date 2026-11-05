'use client';

import React, { useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Compass, Eye } from 'lucide-react';
import { Deal } from '@/types/database';
import { describeAttribution, getAttribution } from '@/lib/attribution';

interface DealCardProps {
  deal: Deal;
  isOverlay?: boolean;
  onOpen?: () => void;
}

export function DealCard({ deal, isOverlay = false, onOpen }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
  });
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const source = describeAttribution(getAttribution(deal.contact));

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onOpen || isOverlay) return;

    // Si el puntero se movió, fue un arrastre: no abrimos la ficha.
    const start = pointerStart.current;
    if (start) {
      const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (distance > 6) return;
    }
    onOpen();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onPointerDownCapture={(event) => {
        pointerStart.current = { x: event.clientX, y: event.clientY };
      }}
      onClick={handleClick}
      className={`p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm cursor-grab active:cursor-grabbing hover:border-indigo-300 hover:shadow-md transition-all select-none ${
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

      {source.kind !== 'form' && (
        <div className="mb-2 inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          <Compass className="h-3 w-3 flex-shrink-0 text-indigo-500" />
          <span className="truncate">{source.label}</span>
          {source.detail && (
            <span className="truncate text-slate-400">· {source.detail}</span>
          )}
        </div>
      )}

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

      {onOpen && !isOverlay && (
        <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-indigo-500 dark:text-indigo-400">
          <Eye className="h-3 w-3" /> Ver journey
        </div>
      )}
    </div>
  );
}
