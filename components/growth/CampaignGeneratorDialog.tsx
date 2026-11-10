'use client';

import { useState } from 'react';
import { X, Loader2, CheckCircle2, Target, Calendar, TrendingUp } from 'lucide-react';
import { Client } from '@/types/database';

interface CampaignGeneratorDialogProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  existingAnalyses?: Array<{
    id: string;
    business_name: string;
    category: string;
    target_audience: string;
    competitors: string[];
    key_messages: string[];
    insights: string[];
    created_at: string;
  }>;
}

const CAMPAIGN_OBJECTIVES = [
  { value: 'REACH', label: 'Alcance', description: 'Llegar a más personas' },
  { value: 'ENGAGEMENT', label: 'Interacción', description: 'Mejorar likes y comentarios' },
  { value: 'APP_INSTALLS', label: 'Instalaciones', description: 'Descargas de app' },
  { value: 'CONVERSIONS', label: 'Conversiones', description: 'Compras/ventas' },
  { value: 'LEAD_GENERATION', label: 'Generación de leads', description: 'Captar clientes potenciales' },
  { value: 'VIDEO_VIEWS', label: 'Vistas de video', description: 'Ver videos promocionales' },
];

const CAMPAIGN_CYCLES = [
  'diario',
  'semanal',
  'mensual',
];

export function CampaignGeneratorDialog({
  open,
  onClose,
  clientId,
  clientName,
  existingAnalyses = [],
}: CampaignGeneratorDialogProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>('');
  const [campaignName, setCampaignName] = useState(`Campaña ${clientName} - `);
  const [objective, setObjective] = useState(CAMPAIGN_OBJECTIVES[0].value);
  const [budget, setBudget] = useState('1000');
  const [cycle, setCycle] = useState('semanal');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });

  const handleGenerate = async () => {
    setLoading(true);
    setSuccess('');
    setError('');

    try {
      const response = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          analysis_id: selectedAnalysisId || null,
          name: campaignName,
          objective,
          budget: parseFloat(budget) || 1000,
          start_date: startDate,
          end_date: endDate,
          cycle,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo generar la campaña.');
      }

      setSuccess(`✅ Campaña "${data.campaign?.name}" creada con presupuesto de $${budget}`);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (e: any) {
      setError(e.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const totalDays = (() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  })();

  const dailyBudget = (parseFloat(budget) || 1000) / totalDays;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a1931] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <Target className="h-6 w-6 text-[#00d4ff]" />
            <h2 className="text-xl font-bold text-white">Generar Campaña</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-sm text-slate-400">
            Genera una campaña publicitaria basada en el análisis de tu negocio.
          </p>

          {existingAnalyses.length > 0 && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Análisis de negocio (opcional)
              </label>
              <select
                value={selectedAnalysisId}
                onChange={(e) => setSelectedAnalysisId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]"
              >
                <option value="">Crear campaña desde cero</option>
                {existingAnalyses.map((analysis) => (
                  <option key={analysis.id} value={analysis.id}>
                    {analysis.business_name} ({new Date(analysis.created_at).toLocaleDateString('es-MX')})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Nombre de la campaña
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder={`Ej: ${clientName} - Q4 2024`}
              className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Objetivo
              </label>
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]"
              >
                {CAMPAIGN_OBJECTIVES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Ciclo
              </label>
              <select
                value={cycle}
                onChange={(e) => setCycle(e.target.value as any)}
                className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]"
              >
                {CAMPAIGN_CYCLES.map((c) => (
                  <option key={c} value={c}>
                    {c === 'diario' ? 'Diario' : c === 'semanal' ? 'Semanal' : 'Mensual'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Presupuesto total
              </label>
              <input
                type="number"
                min="1"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]"
              />
              <p className="text-xs text-slate-400 mt-1">
                Prorrateado: ${dailyBudget.toFixed(2)}/día por {totalDays} días
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Fecha de inicio
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Fecha de fin
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]"
              />
            </div>
          </div>

          <div className="bg-[#0c1f3d]/30 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-2">Resumen de la campaña</h3>
            <ul className="space-y-1 text-sm text-slate-300">
              <li className="flex justify-between">
                <span>Objetivo:</span>
                <span className="text-white font-medium">{CAMPAIGN_OBJECTIVES.find(o => o.value === objective)?.label}</span>
              </li>
              <li className="flex justify-between">
                <span>Duración:</span>
                <span className="text-white font-medium">{totalDays} días</span>
              </li>
              <li className="flex justify-between">
                <span>Presupuesto diario:</span>
                <span className="text-white font-medium">${dailyBudget.toFixed(2)}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || !campaignName.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#00d4ff] px-4 py-2 text-sm font-medium text-[#06152b] font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cyan-300"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TrendingUp className="h-4 w-4" />
            )}
            Generar Campaña
          </button>
        </div>

        {/* Mensaje de éxito */}
        {success && (
          <div className="absolute top-4 right-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-sm text-emerald-200 shadow-lg">
            <CheckCircle2 className="h-4 w-4" />
            {success}
          </div>
        )}

        {/* Mensaje de error */}
        {error && (
          <div className="absolute top-4 right-4 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-2 text-sm text-amber-200 shadow-lg max-w-sm">
            <X className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}