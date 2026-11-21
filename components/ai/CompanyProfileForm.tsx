'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Loader2, Search, Settings, MapPin, Flag, FileText, Calendar, Shield, CalendarDays, Megaphone, Users, File, AlertCircle, Trash2, Edit3 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Client } from '@/types/database';
import { useRouter } from 'next/navigation';

interface CompanyProfileFormProps {
  open: boolean;
  onClose: () => void;
  clientId?: string;
  isRoot?: boolean;
}

interface BusinessField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

interface CompanyProfileData {
  business_name: string;
  category: string;
  description: string;
  target_audience: string;
  competitors: string;
  brand_colors: string;
  tone: string;
  years_in_activity?: number;
  main_objectives: string;
  unique_value_proposition: string;
  geographic_location: string;
  social_platforms: string[];
  yearly_revenue?: string;
  number_employees?: number;
}

export function CompanyProfileForm({
  open,
  onClose,
  clientId,
  isRoot,
}: CompanyProfileFormProps) {
  const pathname = usePathname();
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10>(1);
  const [profile, setProfile] = useState<CompanyProfileData>({
    business_name: '',
    category: '',
    description: '',
    target_audience: '',
    competitors: '',
    brand_colors: '#0a1931, #00d4ff',
    tone: 'Profesional',
    years_in_activity: undefined,
    main_objectives: '',
    unique_value_proposition: '',
    geographic_location: '',
    social_platforms: ['instagram', 'facebook'],
    yearly_revenue: undefined,
    number_employees: undefined,
  });
  const [saving, setSaving] = useState(false);
  const [savingStep, setSavingStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10>(1);
  const [savedProfiles, setSavedProfiles] = useState<any[]>([]);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [scrollRef] = useRef<HTMLDivElement>(null);

  // Campos del formulario paso a paso
  const fieldsStep1: BusinessField[] = [
    { key: 'business_name', label: 'Nombre del negocio *', type: 'text', required: true, placeholder: 'Ej: Mi Empresa S.A.' },
    { key: 'category', label: 'Categoría *', type: 'select', required: true, options: [
      { value: 'retail', label: 'Retail / Comercio' },
      { value: 'food', label: 'Alimentación / Restaurantes' },
      { value: 'service', label: 'Servicios' },
      { value: 'tech', label: 'Tecnología' },
      { value: 'beauty', label: 'Belleza / Estética' },
      { value: 'health', label: 'Salud / Bienestar' },
      { value: 'education', label: 'Educación' },
      { value: 'travel', label: 'Viajes / Alojamiento' },
    ]},
    { key: 'years_in_activity', label: 'Años en actividad', type: 'text', placeholder: 'Ej: 5' },
  ];

  fieldsStep2: BusinessField[] = [
    { key: 'description', label: 'Descripción breve *', type: 'textarea', required: true, placeholder: 'Describe tu negocio en 2-3 frases clave...' },
    { key: 'target_audience', label: 'Audiencia objetivo *', type: 'text', required: true, placeholder: 'Ej: Mujeres 25-40 años en CDMX' },
  ];

  fieldsStep3: BusinessField[] = [
    { key: 'competitors', label: 'Competidores *', type: 'text', required: true, placeholder: 'Ej: Competidor1, Competidor2' },
    { key: 'brand_colors', label: 'Colores de marca', type: 'text', placeholder: 'Ej: #0a1931, #00d4ff' },
  ];

  fieldsStep4: BusinessField[] = [
    { key: 'tone', label: 'Tono de comunicación *', type: 'select', required: true, options: [
      { value: 'Profesional', label: 'Profesional' },
      { value: 'Amigable', label: 'Amigable' },
      { value: 'Creativo', label: 'Creativo' },
      { value: 'Divertido', label: 'Divertido' },
      { value: 'Serio', label: 'Serio' },
      { value: 'Inspirador', label: 'Inspirador' },
    ]},
    { key: 'unique_value_proposition', label: 'Propuesta de valor única *', type: 'textarea', required: true, placeholder: '¿Qué diferencia a tu negocio de la competencia?' },
  ];

  fieldsStep5: BusinessField[] = [
    { key: 'geographic_location', label: 'Ubicación geográfica *', type: 'text', required: true, placeholder: 'Ej: Ciudad de México, México' },
    { key: 'social_platforms', label: 'Plataformas sociales *', type: 'multiselect', required: true, options: [
      { value: 'instagram', label: 'Instagram' },
      { value: 'facebook', label: 'Facebook' },
      { value: 'tiktok', label: 'TikTok' },
      { value: 'linkedin', label: 'LinkedIn' },
      { value: 'x', label: 'X / Twitter' },
      { value: 'threads', label: 'Threads' },
      { value: 'youtube', label: 'YouTube' },
    ]},
    { key: 'yearly_revenue', label: 'Ingresos anuales aproximados', type: 'text', placeholder: 'Ej: $5M USD' },
  ];

  // Guardar perfil
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // Verificar si ya existe un perfil para este cliente
      const existingIndex = savedProfiles.findIndex(p => p.client_id === clientId);
      
      const profileData = {
        ...profile,
        client_id: clientId,
        updated_at: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        // Actualizar perfil existente
        setSavedProfiles(prev => prev.map((p, i) =>
          p.client_id === clientId ? profileData : p
        ));
      } else {
        // Agregar nuevo perfil
        setSavedProfiles(prev => [...prev, profileData]);
      }

      // Guardar también en business_analyses si no existe
      const { data: existingAnalysis } = await fetch(`/api/ai-agent?action=get_analyses`)
        .then(res => res.json())
        .then(data => data.analyses.find((a: any) => a.client_id === clientId));

      if (!existingAnalysis) {
        await fetch('/api/ai-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'analyze_business',
            ...profile,
            competitors: profile.competitors.split(',').map((c: string) => c.trim()).filter(Boolean),
            brand_colors: profile.brand_colors.split(',').map((c: string) => c.trim()).filter(Boolean),
          }),
        });
      }

      setSaving(false);
      setShowForm(false);
      onClose();
      alert('Perfil de empresa guardado exitosamente');
    } catch (error) {
      console.error('Error guardando perfil:', error);
      alert('Error al guardar el perfil. Inténtalo de nuevo.');
      setSaving(false);
    }
  };

  // Navegar entre pasos
  const nextStep = () => {
    if (step < 10) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  // Validar paso actual
  const isStepValid = (step: number): boolean => {
    const stepFields = getStepFields(step);
    return stepFields.every(f => !f.required || profile[f.key]);
  };

  const getStepFields = (step: number): BusinessField[] => {
    switch (step) {
      case 1: return fieldsStep1;
      case 2: return fieldsStep2;
      case 3: return fieldsStep3;
      case 4: return fieldsStep4;
      case 5: return fieldsStep5;
      default: return [];
    }
  };

  // Efecto para cargar perfiles guardados
  useEffect(() => {
    // Cargar perfiles existentes desde la API
    fetch('/api/ai-agent?action=get_analyses')
      .then(res => res.json())
      .then(data => {
        setSavedProfiles(data.analyses || []);
      });
  }, [clientId]);

  return (
    <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[#0a1931] rounded-2xl border border-white/10 shadow-2xl max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-xl font-bold text-white">Perfil de Empresa</h2>
          <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Stepper */}
        <div className="p-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((step, index) => (
            <div key={step} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-700/50 flex items-center justify-center text-sm font-medium transition-colors ${
                step <= step ? 'bg-cyan-500 text-white' : 'text-slate-400'
              }">
                {step}
              </div>
              {step < 10 ? (
                <div className="w-1 h-6 bg-slate-500 rounded-full transition-all duration-300 ${
                  step <= step ? 'bg-cyan-500' : 'transparent'
                } mx-1 mt-2"/>
              ) : null}
            </div>
          ))}
        </div>

        {/* Contenido del paso actual */}
        <div className="p-6 space-y-6">
          {step === 1 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Información Básica</h3>
              {fieldsStep1.map((field) => (
                <div key={field.key} className={`space-y-2 ${
                  focusedField === field.key ? 'ring-2 ring-cyan-500' : ''
                }`}
                  <label className="block text-sm font-medium text-slate-300">
                    {field.label}{field.required && <span className="text-red-500"> *</span>}
                  </label>
                  <input
                    type={field.type === 'select' ? 'select' : 'text'}
                    value={profile[field.key] || ''}
                    onChange={(e) => {
                      setProfile(prev => ({ ...prev, [field.key]: field.type === 'select' ? e.target.value : e.target.value }));
                      setFocusedField(field.key);
                    }}
                    placeholder={field.placeholder}
                    required={field.required}
                    className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white placeholder:text-slate-500 transition-colors focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-60"
                  )
                  {field.required && !profile[field.key] && (
                    <p className="text-xs text-red-500 mt-1">Este campo es obligatorio</p>
                  )}
                </div>
              ))}
              <div className="flex justify-end">
                <button onClick={prevStep} disabled={step === 1} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800/40 transition">Anterior</button>
                <button onClick={nextStep} className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-500 transition">
                  Siguiente
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Descripción y Audiencia</h3>
              {fieldsStep2.map((field) => (
                <div key={field.key} className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">
                    {field.label}{field.required && <span className="text-red-500"> *</span>}
                  </label>
                  <textarea
                    value={profile[field.key] || ''}
                    onChange={(e) => {
                      setProfile(prev => ({ ...prev, [field.key]: e.target.value }));
                      setFocusedField(field.key);
                    }}
                    placeholder={field.placeholder}
                    required={field.required}
                    rows={field.rows || 3}
                    className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white placeholder:text-slate-500 transition-colors focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-60"
                  )
                  {field.required && !profile[field.key] && (
                    <p className="text-xs text-red-500 mt-1">Este campo es obligatorio</p>
                  )}
                </div>
              ))}
              <div className="flex justify-end">
                <button onClick={prevStep} disabled={step === 1} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800/40 transition">Anterior</button>
                <button onClick={nextStep} disabled={!isStepValid(step)} className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-500 transition">
                  Siguiente
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Competencia y Marca</h3>
              {fieldsStep3.map((field) => (
                <div key={field.key} className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">
                    {field.label}{field.required && <span className="text-red-500"> *</span>}
                  </label>
                  <input
                    type="text"
                    value={profile[field.key] || ''}
                    onChange={(e) => {
                      setProfile(prev => ({ ...prev, [field.key]: e.target.value }));
                      setFocusedField(field.key);
                    }}
                    placeholder={field.placeholder}
                    required={field.required}
                    className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white placeholder:text-slate-500 transition-colors focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-60"
                  )
                  {field.required && !profile[field.key] && (
                    <p className="text-xs text-red-500 mt-1">Este campo es obligatorio</p>
                  )}
                </div>
              ))}
              <div className="flex justify-end">
                <button onClick={prevStep} disabled={step === 1} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800/40 transition">Anterior</button>
                <button onClick={nextStep} disabled={!isStepValid(step)} className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-500 transition">
                  Siguiente
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Tonos y Diferenciador</h3>
              {fieldsStep4.map((field) => (
                <div key={field.key} className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">
                    {field.label}{field.required && <span className="text-red-500"> *</span>}
                  </label>
                  <select
                    value={profile[field.key] || ''}
                    onChange={(e) => {
                      setProfile(prev => ({ ...prev, [field.key]: e.target.value }));
                      setFocusedField(field.key);
                    }}
                    className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  >
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {field.key === 'unique_value_proposition' && (
                    <textarea
                      value={profile[field.key] || ''}
                      onChange={(e) => {
                        setProfile(prev => ({ ...prev, [field.key]: e.target.value }));
                        setFocusedField(field.key);
                      }}
                      placeholder={field.placeholder}
                      rows={4}
                      className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white placeholder:text-slate-500 transition-colors focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-60"
                    />
                  )}
                </div>
              ))}
              <div className="flex justify-end">
                <button onClick={prevStep} disabled={step === 1} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800/40 transition">Anterior</button>
                <button onClick={nextStep} disabled={!isStepValid(step)} className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-500 transition">
                  Siguiente
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Posición Geográfica y Redes</h3>
              {fieldsStep5.map((field) => {
                if (field.key === 'social_platforms') {
                  return (
                    <div key={field.key} className="space-y-2">
                      <label className="block text-sm font-medium text-slate-300">
                        {field.label} *</label>
                    <div className="grid grid-cols-3 gap-2">
                      {field.options?.map((opt) => (
                        <label key={opt.value} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/40 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={profile[field.key]?.includes(opt.value)}
                            onChange={(e) => {
                              const current = profile[field.key] || [];
                              if (e.target.checked) {
                                setProfile(prev => ({ ...prev, [field.key]: [...current, opt.value] }));
                              } else {
                                setProfile(prev => ({
                                  ...prev,
                                  [field.key]: current.filter((c: string) => c !== opt.value),
                                }));
                              }
                            }}
                            className="rounded border-slate-600"
                          >
                          <span className="text-sm text-slate-300">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  );
                }
                return null;
              })}
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Ingresos anuales aproximados</label>
                <input
                  type="text"
                  value={profile.yearly_revenue || ''}
                  onChange={(e) => {
                    setProfile(prev => ({ ...prev, yearly_revenue: e.target.value }));
                    setFocusedField(field.key);
                  }}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white placeholder:text-slate-500"
                />
              </div>
              <div className="flex justify-end">
                <button onClick={prevStep} disabled={step === 1} className="px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800/40 transition">Anterior</button>
                <button onClick={nextStep} disabled={!isStepValid(step)} className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-500 transition">
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex justify-end">
          {step === 10 && (
            <button onClick={handleSaveProfile} disabled={saving} className="px-6 py-3 text-lg font-bold bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition">
              {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> <span>Guardando...</span> : 'Guardar Perfil'}
            </button>
          )}
          {step < 10 && (
            <button onClick={handleSaveProfile} disabled={saving} className="px-6 py-3 text-lg font-bold bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition">
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}