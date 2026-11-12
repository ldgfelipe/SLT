'use client';

import { useState, useEffect } from 'react';
import { X, Brain, Calendar, Image as ImageIcon, BarChart3, Save, RefreshCw, Check, Loader2 } from 'lucide-react';
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
  analysis_id: string;
}

interface GeneratedPost {
  titulo: string;
  descripcion: string;
  hashtag: string;
  hora_sugerida: string;
  tipo: 'imagen' | 'texto' | 'video' | 'carousel';
  fecha_posteo: string;
}

export function VirtualAgentDialog({ open, onClose }: VirtualAgentDialogProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('analyze');
  const [saving, setSaving] = useState(false);
  const [savedAnalysis, setSavedAnalysis] = useState<any>(null);
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
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

  const [imagePrompt, setImagePrompt] = useState('');
  const [imageType, setImageType] = useState<'image' | 'carousel' | 'video'>('image');
  const [generatingImages, setGeneratingImages] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<any[]>([]);

  // Sincronizar formulario con análisis guardado
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

  // Cargar análisis existentes al abrir
  useEffect(() => {
    if (open) {
      loadLatestAnalysis();
    }
  }, [open]);

  const loadLatestAnalysis = async () => {
    try {
      const response = await fetch('/api/ai-agent?action=get_analyses');
      const data = await response.json();
      if (data?.analyses?.length > 0) {
        setSavedAnalysis(data.analyses[0]);
      }
    } catch (e) {
      console.error('Error cargando análisis:', e);
    }
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
        setBusinessForm({
          business_name: '',
          category: '',
          description: '',
          target_audience: '',
          competitors: '',
          brand_colors: '#0a1931, #00d4ff',
          tone: 'Profesional'
        });
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
        const schedulePosts(data.plan);
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

  const schedulePosts = (plan: any) => {
    const newPosts: GeneratedPost[] = plan.plan?.posts || [];
    setPosts(newPosts);
  };

  const handleImageGenerate = async () => {
    if (!imagePrompt.trim()) return;
    
    setGeneratingImages(true);
    setGeneratedImages(prev => [...prev, { id: Date.now(), prompt: imagePrompt, type: imageType, status: 'generating' }]);
    
    try {
      const response = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_image_prompt',
          prompt: imagePrompt,
          type: imageType,
          plan_id: savedAnalysis?.id
        })
      });
      const data = await response.json();
      if (response.ok) {
        const lastIdx = generatedImages.length - 1;
        setGeneratedImages(prev => [
          ...prev.slice(0, lastIdx),
          { ...prev[lastIdx], prompt: data.prompt, status: 'completed' }
        ]);
      }
    } catch (e) {
      const lastIdx = generatedImages.length - 1;
      setGeneratedImages(prev => [
        ...prev.slice(0, lastIdx),
        { ...prev[lastIdx], status: 'error', error: 'Error al generar prompt' }
      ]);
    } finally {
      setGeneratingImages(false);
      setImagePrompt('');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#0a1931] rounded-2xl border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-[#00d4ff]" />
            <h2 className="text-xl font-bold text-white">Asistente de Contenido IA</h2>
            {savedAnalysis && (
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                Analizado
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/10 transition"
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
            disabled={!generatedPlan}
          >
            <ImageIcon className="h-4 w-4" />
            Imágenes
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Tabs content */}
          {activeTab === 'analyze' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Información del Negocio</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Proporcione detalles sobre su negocio para generar estrategias de contenido.
                </p>
              </div>
              {/* Form fields */}
              <div className="grid gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Nombre del negocio *
                  </label>
                  <input
                    type="text"
                    value={businessForm.business_name}
                    onChange={(e) => setBusinessForm({ ...businessForm, business_name: e.target.value })}
                    placeholder="Ej: Mi Empresa S.A."
                    className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white placeholder:text-slate-500"
                    disabled={saving}
                  />
                </div>
                {/* ... más campos */}
              </div>
            </div>
          )}

          {activeTab === 'plans' && savedAnalysis && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Generar Plan de Contenido</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Basado en el análisis: <strong>{savedAnalysis.business_name}</strong>
                </p>
              </div>
              {/* Plan form */}
            </div>
          )}

          {activeTab === 'images' && posts.length > 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Generar Imágenes</h3>
                <p className="text-sm text-slate-400 mb-4">
                  {posts.length} posts generados • Crea prompts para cada contenido
                </p>
              </div>
              {/* Image generation */}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition"
            disabled={saving}
          >
            Cerrar
          </button>
          {activeTab === 'analyze' && (
            <button
              onClick={handleBusinessSubmit}
              disabled={saving || !businessForm.business_name}
              className="inline-flex items-center gap-2 rounded-lg bg-[#00d4ff] px-4 py-2 text-sm font-medium text-[#06152b] transition hover:bg-cyan-300 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              Analizar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}