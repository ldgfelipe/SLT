'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DataDeletionPage() {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (email: string) => {
    setProcessing(true);
    setError(null);
    setSuccess(false);

    try {
      // Simulación de petición al backend
      // En producción, esto sería una llamada API real
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Aquí iría: await fetch('/api/data-deletion', {
      //   method: 'POST',
      //   body: JSON.stringify({ email }),
      // });

      setSuccess(true);
      setShowForm(false);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Error procesando la solicitud');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1931] text-slate-100 p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white mb-4">
            Eliminación de Datos Personales
          </h1>
          <p className="text-[18px] text-slate-400 leading-relaxed">
            Solicita la eliminación de tus datos personales de nuestra base de datos.
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 mb-6">
            <p className="text-rose-300 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-semibold text-emerald-300 mb-3">
              ✅ Solicitud Enviada
            </h2>
            <p className="text-emerald-200 text-sm leading-relaxed">
              Hemos recibido tu solicitud de eliminación de datos personales. Nuestro
              equipo la procesará en un plazo máximo de 30 días hábiles. Recibirás una
              confirmación por email en <strong className="font-medium">hola@inventser.com</strong>.
            </p>
          </div>
        )}

        {!success && !error && showForm ? (
          <div className="bg-[#0c1f3d] border border-white/10 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              Solicitar Eliminación de Datos
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              Por favor, ingresa tu dirección de email para solicitar la eliminación
              de tus datos personales de nuestra base de datos.
            </p>

            <form
              onSubmit={async (e: React.FormEvent) => {
                e.preventDefault();
                const input = e.target.elements.email as HTMLInputElement;
                await handleSubmit(input.value);
              }}
            >
              <div className="grid gap-3 mb-4">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-slate-300 mb-2"
                  >
                    Email *
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    required
                    value={''}
                    onChange={(e) => {}}
                    className="w-full rounded-lg border border-white/10 bg-[#0a1931] px-4 py-2.5 text-xs text-white outline-none placeholder:text-slate-500 focus:border-[#00d4ff]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={processing}
                  className="sm:col-span-2 rounded-lg bg-[#00d4ff] px-4 py-2.5 text-xs font-semibold text-[#06152b] transition hover:bg-cyan-300 disabled:opacity-40"
                >
                  {processing ? (
                    <span className="align-middle">
                      <svg
                        className="h-4 w-4 animate-spin mr-2"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          strokeOpacity="0.25"
                        />
                        <path
                          d="M8 12l4 4L16 8"
                          className="transition"
                        />
                      </svg>
                      Enviando...
                    </span>
                  ) : (
                    'Solicitar Eliminación'
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="mt-8 pt-8 border-t border-white/10 text-center">
          <p className="text-sm text-slate-500">
            Si no recibes respuesta en un plazo de 30 días, ponte en contacto con
            <a href="mailto:hola@inventser.com" className="text-[#00d4ff] hover:underline">
            hola@inventser.com
            </a>
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Ejercicio de derechos bajo el RGPD / LFPDPPP.
          </p>
        </div>
      </div>
    </div>
  );
}