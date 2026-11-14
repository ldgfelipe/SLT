'use client';

import { useState, useEffect } from 'react';
import { X, Brain, Calendar, Image as ImageIcon, BarChart3, Save, Loader2, Copy, ExternalLink, Check } from 'lucide-react';
import type { SocialProvider } from '@/types/database';
import { PROVIDERS, SOCIAL_PROVIDERS } from '@/lib/growth/providers';
import { Client } from '@/types/database';
import { ClientSwitcher } from '@/components/layout/ClientSwitcher';

interface VirtualAgentDialogProps {
  open: boolean;
  onClose: () => void;
  clients?: Client[];
  activeClientId?: string;
  isRoot?: boolean;
}

type ActiveTab = 'analyze' | 'plans' | 'images';

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
  analysis_id: string;
}

export function VirtualAgentDialog({ 
  open, 
  onClose,
  clients = [],
  activeClientId,
  isRoot = false
}: VirtualAgentDialogProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('analyze');
  const [saving, setSaving] = useState(false);
  const [savedAnalysis, setSavedAnalysis] = useState<any>(null);
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
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
    tone: 'Profesional',
    analysis_id: '',
  });

  const [openaiApiKey, setOpenaiApiKey] = useState('');

  useEffect(() => {
    if (open) {
      loadLatestAnalysis();
      loadOpenaiApiKey();
    }
  }, [open]);

  useEffect(() => {
    if (savedAnalysis) {
      setPlanForm(prev => ({
        ...prev,
        business_name: savedAnalysis.business_name,
        category: savedAnalysis.category,
        description: savedAnalysis.description,
        target_audience: savedAnalysis.target_audience,
        competitors: savedAnalysis.competitors || [],
        brand_colors: savedAnalysis.brand_colors || ['#0a1931', '#00d4ff'],
        tone: savedAnalysis.tone,
        analysis_id: savedAnalysis.id,
      }));
    }
  }, [savedAnalysis]);

  const loadOpenaiApiKey = async () => {
    try {
      const response = await fetch('/api/settings/get?name=openai_api_key');
      const data = await response.json();
      if (data?.value) setOpenaiApiKey(data.value);
    } catch (e) { /* ignore */ }
  };

  const loadLatestAnalysis = async () => {
    try {
      const response = await fetch('/api/ai-agent?action=get_analyses');
      const data = await response.json();
      if (data?.analyses?.length > 0) setSavedAnalysis(data.analyses[0]);
    } catch (e) { console.error('Error cargando análisis:', e); }
  };

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
          competitors: businessForm.competitors.split(',').map(c => c.trim()).filter(Boolean),
          brand_colors: businessForm.brand_colors.split(',').map(c => c.trim()).filter(Boolean)
        })
      });
      const data = await response.json();
      if (response.ok) {
        setSavedAnalysis(data.analysis);
        setBusinessForm({ business_name: '', category: '', description: '', target_audience: '', competitors: '', brand_colors: '#0a1931, #00d4ff', tone: 'Profesional' });
        setActiveTab('plans');
      } else {
        alert(data.error || 'Error al analizar el negocio');
      }
    } catch (e) { alert('Error de conexión'); }
    finally { setSaving(false); }
  };

  const handlePlanSubmit = async () => {
    if (!planForm.name) return;
    setSaving(true);
    try {
      const response = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_content_plan',
          ...planForm,
          competitors: planForm.competitors || [],
          brand_colors: planForm.brand_colors || ['#0a1931', '#00d4ff'],
          tone: planForm.tone || 'Profesional'
        })
      });
      const data = await response.json();
      if (response.ok) {
        setGeneratedPlan(data.plan);
        schedulePosts(data.plan);
        setActiveTab('images');
      } else {
        alert(data.error || 'Error al generar el plan');
      }
    } catch (e) { alert('Error de conexión'); }
    finally { setSaving(false); }
  };

  const schedulePosts = (plan: any) => {
    const newPosts = plan.plan?.posts 
      ? plan.plan.posts.map((p: any, index: number) => ({
          ...p,
          platform: planForm.platforms[0] || 'instagram',
        }))
      : [];
    setPosts(newPosts);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#0a1931] rounded-2xl border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-[#00d4ff]" />
            <h2 className="text-xl font-bold text-white">Asistente de Contenido IA</h2>
            {savedAnalysis && (
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Analizado</span>
            )}
            {generatedPlan && (
              <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full">Plan: {generatedPlan.name}</span>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/10 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Client Switcher para root */}
        {isRoot && clients.length > 0 && (
          <div className="px-5 py-3 border-b border-white/10 bg-slate-900/50">
            <ClientSwitcher clients={clients} activeClientId={activeClientId} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 px-5 py-3 border-b border-white/10 overflow-x-auto">
          <button onClick={() => setActiveTab('analyze')} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === 'analyze' ? 'bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analizar Negocio</span>
            <span className="sm:inline">Analizar</span>
          </button>
          <button onClick={() => setActiveTab('plans')} disabled={!savedAnalysis} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === 'plans' ? 'bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Generar Plan</span>
            <span className="sm:inline">Plan</span>
          </button>
          <button onClick={() => setActiveTab('images')} disabled={!generatedPlan || posts.length === 0} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === 'images' ? 'bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <ImageIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Imágenes</span>
            <span className="sm:inline">Img ({posts.length})</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'analyze' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white mb-2">1. Análisis del Negocio</h3>
              <p className="text-sm text-slate-400 mb-4">Completa la información para generar insights y recomendaciones.</p>
              <div className="grid gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Nombre del negocio *</label>
                  <input type="text" value={businessForm.business_name} onChange={(e) => setBusinessForm({...businessForm, business_name: e.target.value})} placeholder="Ej: Mi Empresa S.A." className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white placeholder:text-slate-500" disabled={saving} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Categoría</label>
                  <select value={businessForm.category} onChange={(e) => setBusinessForm({...businessForm, category: e.target.value})} className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white" disabled={saving}>
                    <option value="">Selecciona</option>
                    <option value="retail">Retail / Comercio</option>
                    <option value="food">Alimentación / Restaurantes</option>
                    <option value="service">Servicios</option>
                    <option value="tech">Tecnología</option>
                    <option value="beauty">Belleza / Estética</option>
                    <option value="health">Salud / Bienestar</option>
                    <option value="education">Educación</option>
                    <option value="travel">Viajes / Alojamiento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Descripción breve</label>
                  <textarea value={businessForm.description} onChange={(e) => setBusinessForm({...businessForm, description: e.target.value})} placeholder="Describe tu negocio en 2-3 frases clave..." rows={3} className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white placeholder:text-slate-500 resize-y" disabled={saving} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Audiencia objetivo</label>
                  <input type="text" value={businessForm.target_audience} onChange={(e) => setBusinessForm({...businessForm, target_audience: e.target.value})} placeholder="Ej: Mujeres 25-40 años en CDMX" className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white placeholder:text-slate-500" disabled={saving} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Competidores</label>
                  <input type="text" value={businessForm.competitors} onChange={(e) => setBusinessForm({...businessForm, competitors: e.target.value})} placeholder="Ej: Competidor1, Competidor2" className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white placeholder:text-slate-500" disabled={saving} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Colores de marca</label>
                  <input type="text" value={businessForm.brand_colors} onChange={(e) => setBusinessForm({...businessForm, brand_colors: e.target.value})} placeholder="#0a1931, #00d4ff" className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white placeholder:text-slate-500" disabled={saving} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Tonos de comunicación</label>
                  <select value={businessForm.tone} onChange={(e) => setBusinessForm({...businessForm, tone: e.target.value})} className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white" disabled={saving}>
                    <option value="Profesional">Profesional</option>
                    <option value="Amigable">Amigable</option>
                    <option value="Creativo">Creativo</option>
                    <option value="Divertido">Divertido</option>
                    <option value="Serio">Serio</option>
                    <option value="Inspirador">Inspirador</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'plans' && savedAnalysis && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white mb-2">2. Generar Plan de Contenido</h3>
              <p className="text-sm text-slate-400 mb-4">Basado en el análisis de: <strong>{savedAnalysis.business_name}</strong></p>
              <div className="grid gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Nombre del plan</label>
                  <input type="text" value={planForm.name} onChange={(e) => setPlanForm({...planForm, name: e.target.value})} placeholder="Ej: Plan de verano 2024" className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white placeholder:text-slate-500" disabled={saving} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Duración (semanas)</label>
                  <input type="number" value={planForm.duration_weeks} onChange={(e) => setPlanForm({...planForm, duration_weeks: parseInt(e.target.value) || 1})} min={1} max={4} className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white" disabled={saving} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Plataformas</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SOCIAL_PROVIDERS.map((provider) => {
                      const meta = PROVIDERS[provider];
                      return (
                        <label key={provider} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40 cursor-pointer">
                          <input type="checkbox" checked={planForm.platforms.includes(provider)} onChange={(e) => {
                            if (e.target.checked) setPlanForm({...planForm, platforms: [...planForm.platforms, provider]});
                            else setPlanForm({...planForm, platforms: planForm.platforms.filter(p => p !== provider)});
                          }} className="rounded border-slate-600" disabled={saving} />
                          <span className="text-xs text-slate-300">{meta.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Posts por semana</label>
                  <input type="number" value={planForm.posts_per_week} onChange={(e) => setPlanForm({...planForm, posts_per_week: parseInt(e.target.value) || 3})} min={1} max={14} className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white" disabled={saving} />
                </div>
              </div>
              <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 p-4">
                <p className="text-sm text-cyan-200"><strong className="text-cyan-300">Insight IA:</strong> Datos del negocio se sincronizan automáticamente.</p>
              </div>
            </div>
          )}

          {activeTab === 'images' && posts.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-white mb-2">3. Generar Imágenes</h3>
              <p className="text-sm text-slate-400 mb-4">{posts.length} posts listos • Usa OpenAI DALL-E 3</p>
              
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">API Key de OpenAI</label>
                <div className="flex gap-2">
                  <input type="text" value={openaiApiKey} onChange={(e) => setOpenaiApiKey(e.target.value)} placeholder="sk-..." className="flex-1 rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white placeholder:text-slate-500" />
                  <button onClick={() => {}} className="rounded-xl px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/40 transition"><Save className="h-4 w-4" /></button>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Necessary para generar imágenes reales.</p>
              </div>
              
              <div className="flex gap-3">
                <button onClick={handlePlanSubmit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-400">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar en calendario
                </button>
              </div>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {posts.map((post, idx) => (
                  <div key={idx} className="rounded-xl border border-white/10 bg-[#0c1f3d] p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-white">{post.titulo}</h4>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{post.descripcion}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                          <span>📅 {post.fecha_posteo || 'Fecha sugerida'}</span>
                          <span>⏰ {post.hora_sugerida}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-slate-800/40 text-slate-300 hover:bg-slate-700/40">
                          <ExternalLink className="h-3 w-3" />
                          Image
                        </button>
                        <button className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-slate-800/40 text-slate-300 hover:bg-slate-700/40">
                          <ExternalLink className="h-3 w-3" />
                          Carousel
                        </button>
                        <button className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-slate-800/40 text-slate-300 hover:bg-slate-700/40">
                          <ExternalLink className="h-3 w-3" />
                          Video
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <button onClick={() => {}} className="flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-400"><Copy className="h-3 w-3" /> Copiar prompt</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-white/10">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition">Cerrar</button>
          {activeTab === 'analyze' && (
            <button onClick={handleBusinessSubmit} disabled={saving || !businessForm.business_name} className="inline-flex items-center gap-2 rounded-lg bg-[#00d4ff] px-4 py-2 text-sm font-medium text-[#06152b] transition hover:bg-cyan-300 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              Analizar
            </button>
          )}
          {activeTab === 'plans' && (
            <button onClick={handlePlanSubmit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-400">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Generar Plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}