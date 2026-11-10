import { Metadata } from 'next';
import { VirtualAgentDialog } from '@/components/ai/VirtualAgentDialog';

export const metadata: Metadata = {
  title: 'Agente Virtual de Contenido - SLT',
  description: 'Asistente de IA para analizar tu negocio y generar planes de publicación'
};

export default function AIAgentPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Agente Virtual de Contenido</h1>
        <p className="text-sm text-slate-400 mt-1">
          Analiza tu negocio y genera planes de publicación con IA
        </p>
      </div>

      <div className="grid gap-6">
        <div className="rounded-2xl border border-white/10 bg-[#0c1f3d] p-6">
          <h2 className="text-lg font-semibold text-white mb-3">¿Qué puedo hacer?</h2>
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
          <h2 className="text-lg font-semibold text-white mb-3">Recomendaciones</h2>
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Antes de empezar</h3>
              <p className="text-sm text-slate-400">
                Ten a mano información sobre tu negocio: nombre, categoría, descripción del producto/servicio,
                tu público objetivo y tus competidores principales.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Siguiente paso</h3>
              <p className="text-sm text-slate-400">
                Conecta tus cuentas de redes sociales desde Growth Hub para publicar el contenido generado.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <VirtualAgentDialog open={true} onClose={() => {}} />
        </div>
      </div>
    </div>
  );
}