'use client';

import React, { useState, useTransition } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { StageColumn } from './StageColumn';
import { DealCard } from './DealCard';
import { updateDealStage } from '@/app/actions/deals';
import { Stage, Deal } from '@/types/database';

interface KanbanBoardProps {
  initialStages: Stage[];
}

export function KanbanBoard({ initialStages }: KanbanBoardProps) {
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const deal = stages
      .flatMap((s) => s.deals)
      .find((d) => d.id === active.id);
    if (deal) setActiveDeal(deal);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over) return;

    const activeDealId = active.id as string;
    const overId = over.id as string;

    // Detectar si se soltó sobre una columna o sobre otra tarjeta de deal
    let targetStageId = overId;
    const overDeal = stages
      .flatMap((s) => s.deals)
      .find((d) => d.id === overId);

    if (overDeal) {
      targetStageId = overDeal.stage_id;
    }

    const sourceStage = stages.find((s) =>
      s.deals.some((d) => d.id === activeDealId)
    );

    if (!sourceStage || sourceStage.id === targetStageId) return;

    const movedDeal = sourceStage.deals.find((d) => d.id === activeDealId)!;
    const updatedDeal: Deal = { ...movedDeal, stage_id: targetStageId };

    // Actualización optimista instantánea
    setStages((prevStages) =>
      prevStages.map((stage) => {
        if (stage.id === sourceStage.id) {
          return {
            ...stage,
            deals: stage.deals.filter((d) => d.id !== activeDealId),
          };
        }
        if (stage.id === targetStageId) {
          return {
            ...stage,
            deals: [...stage.deals, updatedDeal],
          };
        }
        return stage;
      })
    );

    // Persistir el cambio en Supabase
    startTransition(async () => {
      try {
        const result = await updateDealStage(activeDealId, targetStageId);
        if (!result.success) {
          setStages(initialStages); // Rollback
        }
      } catch (err) {
        setStages(initialStages); // Rollback
        console.error(err);
      }
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex w-full h-[calc(100vh-10rem)] gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <StageColumn key={stage.id} stage={stage} deals={stage.deals || []} />
        ))}
      </div>

      <DragOverlay>
        {activeDeal ? <DealCard deal={activeDeal} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
