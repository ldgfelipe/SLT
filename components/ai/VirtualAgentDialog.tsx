'use client';

import { useState, useEffect } from 'react';
import { X, Brain, Calendar, Image as ImageIcon, BarChart3, Save, RefreshCw } from 'lucide-react';
import type { SocialProvider } from '@/types/database';
import { PROVIDERS, SOCIAL_PROVIDERS } from '@/lib/growth/providers';

interface VirtualAgentDialogProps {
  open: boolean;
  onClose: () => void;
}

type ActiveTab = 'analyze' | 'plans' | 'images' | 'generate';

interface BusinessForm {
  business_name: string;
  category: string;
  description: string;
  target_audience: string;
  competitors: string;
  brand_colors: string;
  tone: string;
}

interface PlanForm {
  name: string;
  duration_weeks: number;
  platforms: SocialProvider[];
  posts_per_week: number;
  business_name: string;
  category: string;
  description: string;
  target_audience: string;
  competitors: string[];
  brand_colors: string[];
  tone: string;
}

export function VirtualAgentDialog({ open, onClose }: VirtualAgentDialogProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('analyze');
  const [saving, setSaving] = useState(false);
  const [savedAnalysis, setSavedAnalysis] = useState<any>(null);
  const [businessForm, setBusinessForm] = useState<BusinessForm>({
    business_name: '',
    category: '',
    description: '',
    target_audience: '',
    competitors: '',
    brand_colors: '#0a1931, #00d4ff',
    tone: 'Profesional'
  });

  const [planForm, setPlanForm] = useState<PlanForm>({
    name: 'Plan de publicación semanal',
    duration_weeks: 1,
    platforms: ['facebook', 'instagram'],
    posts_per_week: 3,
    business_name: '',
    category: '',
    description: '',
    target_audience: '',
    competitors: [],
    brand_colors: ['#0a1931', '#00d4ff'],
    tone: 'Profesional'
  });

  const [imagePrompt, setImagePrompt] = useState('');
  const [imageType, setImageType] = useState<'image' | 'carousel' | 'video'>('image');

  // Sincronizar planForm con el análisis guardado
  useEffect(() => {
    if (savedAnalysis) {
      setPlanForm(prev => ({
        ...prev,
        business_name: savedAnalysis.business_name || prev.business_name,
        category: savedAnalysis.category || prev.category,
        description: savedAnalysis.description || prev.description,
        target_audience: savedAnalysis.target_audience || prev.target_audience,
        competitors: savedAnalysis.competitors || prev.competitors,
        brand_colors: savedAnalysis.brand_colors || prev.brand_colors,
        tone: savedAnalysis.tone || prev.tone
      }));
    }
  }, [savedAnalysis]);

  const handleBusinessSubmit = async () => {
    if (!businessForm.business_name) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze_business',
          ...businessForm,
          competitors: businessForm.competitors 
            ? businessForm.competitors.split(',').map(c => c.trim())
            : [],
          brand_colors: businessForm.brand_colors
            ? businessForm.brand_colors.split(',').map(c => c.trim())
            : []
        })
      });
      const data = await response.json();
      if (response.ok) {
        setSavedAnalysis(data.analysis);
        setActiveTab('plans');
      } else {
        alert(data.error || 'Error al analizar el negocio');
      }
    } catch (e) {
      alert('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handlePlanSubmit = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_content_plan',
          ...planForm
        })
      });
      const data = await response.json();
      if (response.ok) {
        setActiveTab('images');
      } else {
        alert(data.error || 'Error al generar el plan');
      }
    } catch (e) {
      alert('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleImageGenerate = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_image_prompt',
          prompt: imagePrompt,
          type: imageType
        })
      });
      const data = await response.json();
      if (response.ok) {
        alert('Prompt generado: ' + data.prompt);
      }
    } catch (e) {
      alert('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#0a1931] rounded-2xl border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-[#00d4ff]" />
            <h2 className="text-xl font-bold text-white">Asistente Virtual de Contenido</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-5 py-3 border-b border-white/10 overflow-x-auto">
          <button
            onClick={() => setActiveTab('analyze')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === 'analyze'
                ? 'bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Analizar Negocio
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === 'plans'
                ? 'bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Calendar className="h-4 w-4" />
            Generar Plan
          </button>
          <button
            onClick={() => setActiveTab('images')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === 'images'
                ? 'bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            Generar Imagen
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'analyze' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Información del Negocio</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Proporcione detalles sobre su negocio para que el agente analice y genere estrategias de contenido.
                </p>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Nombre del negocio
                  </label>
                  <input
                    type="text"
                    value={businessForm.business_name}
                    onChange={(e) => setBusinessForm({ ...businessForm, business_name: e.target.value })}
                    placeholder="Ej: Mi Empresa S.A."
                    className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Categoría
                  </label>
                  <input
                    type="text"
                    value={businessForm.category}
                    onChange={(e) => setBusinessForm({ ...businessForm, category: e.target.value })}
                    placeholder="Ej: Retail, Servicios, Tecnología..."
                    className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Descripción breve
                  </label>
                  <textarea
                    value={businessForm.description}
                    onChange={(e) => setBusinessForm({ ...businessForm, description: e.target.value })}
                    placeholder="Cuéntanos qué hace tu negocio..."
                    rows={3}
                    className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff] resize-y"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Audiencia objetivo
                  </label>
                  <input
                    type="text"
                    value={businessForm.target_audience}
                    onChange={(e) => setBusinessForm({ ...businessForm, target_audience: e.target.value })}
                    placeholder="Ej: Mujeres 25-40, hombres 18-35..."
                    className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Competidores (separados por coma)
                  </label>
                  <input
                    type="text"
                    value={businessForm.competitors}
                    onChange={(e) => setBusinessForm({ ...businessForm, competitors: e.target.value })}
                    placeholder="Ej: Competidor1, Competidor2"
                    className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Colores de marca (hex)
                  </label>
                  <input
                    type="text"
                    value={businessForm.brand_colors}
                    onChange={(e) => setBusinessForm({ ...businessForm, brand_colors: e.target.value })}
                    placeholder="Ej: #0a1931, #00d4ff, #ff6b35"
                    className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Tono de marca
                  </label>
                  <select
                    value={businessForm.tone}
                    onChange={(e) => setBusinessForm({ ...businessForm, tone: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]"
                  >
                    <option value="Profesional">Profesional</option>
                    <option value="Amistoso">Amistoso</option>
                    <option value="Creativo">Creativo</option>
                    <option value="Serio">Serio</option>
                    <option value="Divertido">Divertido</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'plans' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Generar Plan de Contenido</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Crea un plan de publicación basado en el análisis de tu negocio.
                </p>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Nombre del plan
                  </label>
                  <input
                    type="text"
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    placeholder="Ej: Plan de marketing 2026"
                    className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Duración (semanas)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={4}
                      value={planForm.duration_weeks}
                      onChange={(e) => setPlanForm({ ...planForm, duration_weeks: parseInt(e.target.value) || 1 })}
                      className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Publicaciones por semana
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={planForm.posts_per_week}
                      onChange={(e) => setPlanForm({ ...planForm, posts_per_week: parseInt(e.target.value) || 3 })}
                      className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Redes sociales
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {SOCIAL_PROVIDERS.map((provider) => (
                      <label key={provider} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={planForm.platforms.includes(provider)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPlanForm({
                                ...planForm,
                                platforms: [...planForm.platforms, provider]
                              });
                            } else {
                              setPlanForm({
                                ...planForm,
                                platforms: planForm.platforms.filter(p => p !== provider)
                              });
                            }
                          }}
                          className="h-4 w-4 rounded border-white/20 bg-[#0a1931]"
                        />
                        <span className="text-sm text-slate-300">{PROVIDERS[provider].label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Negocio (copiar del análisis)
                  </label>
                  <input
                    type="text"
                    value={planForm.business_name}
                    onChange={(e) => setPlanForm({ ...planForm, business_name: e.target.value })}
                    placeholder="Nombre del negocio"
                    className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'images' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Generar Imagen</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Crea un prompt para generar contenido visual usando IA.
                </p>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Prompt
                  </label>
                  <textarea
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="Describe la imagen que deseas generar..."
                    rows={4}
                    className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff] resize-y"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Tipo de contenido
                  </label>
                  <div className="flex gap-2">
                    {(['image', 'carousel', 'video'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setImageType(type)}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                          imageType === type
                            ? 'bg-[#00d4ff] text-white'
                            : 'border border-white/10 bg-[#0c1f3d] text-slate-300 hover:border-white/20'
                        }`}
                      >
                        {type === 'image' ? 'Imagen' : type === 'carousel' ? 'Carrusel' : 'Video'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#0c1f3d]/50 rounded-xl p-4">
                  <p className="text-xs text-slate-400">
                    <strong>Nota:</strong> La generación real de imágenes se realizará mediante DALL-E, Midjourney o Similar.
                    El prompt generado se guardará para uso posterior.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            Cerrar
          </button>
          {activeTab === 'analyze' && (
            <button
              onClick={handleBusinessSubmit}
              disabled={saving || !businessForm.business_name}
              className="inline-flex items-center gap-2 rounded-lg bg-[#00d4ff] px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#00d4ff]/90"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              Analizar Negocio
            </button>
          )}
          {activeTab === 'plans' && (
            <button
              onClick={handlePlanSubmit}
              disabled={saving || !planForm.name || planForm.platforms.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-[#00d4ff] px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#00d4ff]/90"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Generar Plan
            </button>
          )}
          {activeTab === 'images' && (
            <button
              onClick={handleImageGenerate}
              disabled={saving || !imagePrompt}
              className="inline-flex items-center gap-2 rounded-lg bg-[#00d4ff] px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#00d4ff]/90"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              Generar Prompt
            </button>
          )}
        </div>
      </div>
    </div>
  );
}