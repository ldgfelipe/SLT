'use client';

import React, { useEffect, useState, useTransition } from 'react';
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
import { LeadDetailDrawer } from '@/components/lead/LeadDetailDrawer';
import { AddLeadDialog } from './AddLeadDialog';
import { updateDealStage } from '@/app/actions/deals';
import { deleteStage, updateStageName } from '@/app/actions/stages';
import { Stage, Deal } from '@/types/database';

interface KanbanBoardProps {
  initialStages: Stage[];
  clientId?: string;
}

export function KanbanBoard({ initialStages, clientId }: KanbanBoardProps) {
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
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

  // Sincronizar con el servidor (p. ej. tras eliminar una oportunidad).
  useEffect(() => {
    setStages(initialStages);
  }, [initialStages]);

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

  const handleStageUpdated = (updatedStage: Stage) => {
    setStages((prev) =>
      prev.map((s) => (s.id === updatedStage.id ? updatedStage : s))
    );
  };

  const handleStageDeleted = (deletedStageId: string) => {
    setStages((prev) => prev.filter((s) => s.id !== deletedStageId));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="mb-2 flex items-center justify-end">
        <AddLeadDialog clientId={clientId} stages={stages} />
      </div>

      <div className="flex w-full h-[calc(100vh-12rem)] gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            deals={stage.deals || []}
            onOpenDeal={(deal) => setSelectedDealId(deal.id)}
            onStageUpdated={handleStageUpdated}
            onStageDeleted={handleStageDeleted}
            onDeleteDeal={(dealId, success) => {
              if (success) {
                // Eliminar del estado local
                setStages((prev) =>
                  prev.map((stage) => ({
                    ...stage,
                    deals: stage.deals.filter((d) => d.id !== dealId),
                  }))
                );
              }
            }}
          />
        ))}
      </div>

      <DragOverlay>
        {activeDeal ? <DealCard deal={activeDeal} isOverlay /> : null}
      </DragOverlay>

      <LeadDetailDrawer
        open={!!selectedDealId}
        dealId={selectedDealId || undefined}
        onClose={() => setSelectedDealId(null)}
      />
    </DndContext>
  );
}