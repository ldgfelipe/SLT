'use client';

import { useState } from 'react';
import { Brain, ChevronRight } from 'lucide-react';
import { VirtualAgentDialog } from '@/components/ai/VirtualAgentDialog';

export default function AIAgentPage() {
  const [showAgent, setShowAgent] = useState(false);

  return (
    <>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Agente Virtual de Contenido</h1>
          <p className="text-sm text-slate-400 mt-1">
            Analiza tu negocio y genera planes de publicación con IA
          </p>
        </div>

        <div className="grid gap-6">
          <div className="rounded-2xl border border-white/10 bg-[#0c1f3d] p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Brain className="h-5 w-5 text-[#00d4ff]" />
              <span>¿Qué puedo hacer?</span>
            </h2>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-[#00d4ff] mt-0.5">•</span>
                <span>Analizar tu negocio y generar insights de marketing</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#00d4ff] mt-0.5">•</span>
                <span>Crear planes de publicación semanales con contenido optimizado</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#00d4ff] mt-0.5">•</span>
                <span>Generar prompts para imágenes y contenidos visuales</span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0c1f3d] p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Cómo funciona</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#00d4ff]/10 flex items-center justify-center text-[#00d4ff] font-bold">1</div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Analiza tu negocio</h3>
                  <p className="text-sm text-slate-400">
                    Proporcione información básica sobre su empresa, categoría y audiencia objetivo.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#00d4ff]/10 flex items-center justify-center text-[#00d4ff] font-bold">2</div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Genera planes de contenido</h3>
                  <p className="text-sm text-slate-400">
                    El agente crea un plan semanal con publicaciones optimizadas para cada red social.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#00d4ff]/10 flex items-center justify-center text-[#00d4ff] font-bold">3</div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Publica automáticamente</h3>
                  <p className="text-sm text-slate-400">
                    Programa o publica directamente desde múltiples cuentas (Facebook, Instagram, etc.).
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0c1f3d] p-6">
            <h2 className="text-lg font-semibold text-white mb-3">Próximos pasos</h2>
            <p className="text-sm text-slate-400 mb-4">
              Conecta tus cuentas de redes sociales desde <a href="/dashboard/social-accounts" className="text-[#00d4ff] hover:underline">Cuentas Sociales</a> para publicar el contenido generado.
            </p>
            <button
              onClick={() => setShowAgent(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#00d4ff] px-4 py-2 text-sm font-medium text-white hover:bg-[#00d4ff]/90 transition"
            >
              <Brain className="h-4 w-4" />
              Empezar ahora
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <VirtualAgentDialog open={showAgent} onClose={() => setShowAgent(false)} />
        </div>
      </div>
    </>
  );
}