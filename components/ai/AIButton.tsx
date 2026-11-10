'use client';

import { Brain } from 'lucide-react';

interface AIButtonProps {
  onClick: () => void;
}

export function AIButton({ onClick }: AIButtonProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg bg-[#00d4ff]/10 px-3 py-2 text-sm font-medium text-[#00d4ff] hover:bg-[#00d4ff]/20 transition"
    >
      <Brain className="h-4 w-4" />
      Agente Virtual
    </button>
  );
}