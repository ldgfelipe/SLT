'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';
import type { FormConfig, FormField } from '@/types/forms';

interface HostedFormProps {
  formId: string;
  config: FormConfig;
}

type Status = 'idle' | 'submitting' | 'success' | 'error';

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500';

const labelClass =
  'mb-1.5 block text-[13px] font-semibold text-slate-700 dark:text-slate-300';

function fieldWrapperClass(field: FormField): string {
  return field.type === 'textarea' || field.type === 'checkbox' ? 'sm:col-span-2' : '';
}

function RequiredMark({ required }: { required?: boolean }) {
  if (!required) return null;
  return (
    <span className="ml-0.5 text-rose-500" aria-hidden="true">
      *
    </span>
  );
}

export function HostedForm({ formId, config }: HostedFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [serverMessage, setServerMessage] = useState('');
  const [error, setError] = useState('');
  const [visitor, setVisitor] = useState<{ visitorId?: string; siteId?: string }>({});
  const [renderedAt, setRenderedAt] = useState(0);

  const captchaProvider = config.captcha?.provider ?? 'none';
  const captchaSiteKey = config.captcha?.site_key?.trim() ?? '';
  const hasCaptcha = captchaProvider !== 'none' && captchaSiteKey !== '';

  // Marca de tiempo para la trampa anti-bot del servidor.
  useEffect(() => {
    setRenderedAt(Date.now());
  }, []);

  // Carga el script del captcha elegido (reCAPTCHA o Turnstile).
  useEffect(() => {
    if (!hasCaptcha) return;

    const src =
      captchaProvider === 'recaptcha'
        ? 'https://www.google.com/recaptcha/api.js'
        : 'https://challenges.cloudflare.com/turnstile/v0/api.js';

    if (document.querySelector(`script[src^="${src}"]`)) return;

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, [captchaProvider, hasCaptcha]);

  // Recibe el visitante del píxel desde el script contenedor (embed).
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'slt-visitor') return;
      setVisitor({
        visitorId: typeof data.visitorId === 'string' ? data.visitorId : undefined,
        siteId: typeof data.siteId === 'string' ? data.siteId : undefined,
      });
    };
    window.addEventListener('message', onMessage);

    try {
      const slt = (window as any).slt;
      if (slt?.getVisitorId) {
        setVisitor({ visitorId: slt.getVisitorId(), siteId: slt.siteId });
      }
    } catch {
      // sin píxel
    }

    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Ajusta la altura del iframe en el sitio anfitrión.
  const reportHeight = useCallback(() => {
    if (typeof window === 'undefined' || window.parent === window) return;
    const height = Math.ceil(document.documentElement.scrollHeight);
    window.parent.postMessage({ type: 'slt-form-height', height }, '*');
  }, []);

  useEffect(() => {
    reportHeight();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(reportHeight);
    observer.observe(document.body);
    window.addEventListener('resize', reportHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', reportHeight);
    };
  }, [reportHeight, status, serverMessage, error]);

  function handleRedirect(url: string) {
    const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'slt-form-redirect', url: target }, '*');
      // Fallback si el sitio anfitrión no escucha el mensaje.
      setTimeout(() => {
        try {
          window.location.href = target;
        } catch {
          // sin permiso de navegación
        }
      }, 700);
      return;
    }
    window.location.href = target;
  }

  /** Reinicia el widget de captcha para que pida una verificación nueva. */
  function resetCaptcha() {
    if (!hasCaptcha) return;
    try {
      if (captchaProvider === 'recaptcha') {
        (window as any).grecaptcha?.reset?.();
      } else {
        (window as any).turnstile?.reset?.();
      }
    } catch {
      // widget todavía no cargado
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formRef.current || status === 'submitting') return;

    setError('');
    setServerMessage('');
    setStatus('submitting');

    const data = new FormData(formRef.current);
    if (visitor.visitorId && !data.get('visitor_id')) data.set('visitor_id', visitor.visitorId);
    if (visitor.siteId && !data.get('site_id')) data.set('site_id', visitor.siteId);

    // Los widgets suelen inyectar el token dentro del formulario, pero lo leemos
    // del DOM por si el navegador lo coloca fuera del contenedor.
    if (hasCaptcha) {
      const captchaField =
        captchaProvider === 'recaptcha' ? 'g-recaptcha-response' : 'cf-turnstile-response';
      if (!data.get(captchaField)) {
        const token = (
          document.querySelector(`[name="${captchaField}"]`) as HTMLTextAreaElement | null
        )?.value?.trim();
        if (token) data.set(captchaField, token);
      }
    }

    const body = new URLSearchParams();
    data.forEach((value, key) => {
      if (typeof value === 'string') body.append(key, value);
    });

    try {
      const response = await fetch(`/api/forms/${formId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok || json.success === false) {
        if (json.code === 'captcha_failed' || json.code === 'captcha_not_configured') {
          resetCaptcha();
        }
        const failure: any = new Error(json.error || 'No se pudo enviar el formulario.');
        failure.code = json.code;
        throw failure;
      }

      if (json.redirect_url) {
        handleRedirect(json.redirect_url);
        return;
      }

      formRef.current.reset();
      setServerMessage(json.message || '¡Gracias! Hemos recibido tus datos.');
      setStatus('success');
    } catch (err: any) {
      setError(err?.message || 'Ocurrió un error. Intenta de nuevo.');
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-[220px] w-full items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
          <CheckCircle2 className="mx-auto mb-3 h-11 w-11 text-emerald-600 dark:text-emerald-400" />
          <p className="text-base font-semibold text-emerald-800 dark:text-emerald-200">
            {serverMessage}
          </p>
        </div>
      </div>
    );
  }

  const fields = config.fields || [];

  return (
    <div className="flex w-full justify-center px-3 py-4 sm:px-5 sm:py-6">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        {fields.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Este formulario todavía no tiene campos configurados.
          </p>
        ) : (
          <form ref={formRef} method="POST" action={`/api/forms/${formId}/submit`} onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {fields.map((field, index) => {
                const wrapper = fieldWrapperClass(field);
                const label = field.label || field.key;

                if (field.type === 'checkbox') {
                  return (
                    <div key={`${field.key}-${index}`} className={wrapper}>
                      <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          name={field.key}
                          value="Sí"
                          required={field.required}
                          className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                        />
                        <span>
                          {label}
                          <RequiredMark required={field.required} />
                        </span>
                      </label>
                    </div>
                  );
                }

                if (field.type === 'textarea') {
                  return (
                    <div key={`${field.key}-${index}`} className={wrapper}>
                      <label className={labelClass} htmlFor={`slt_${field.key}`}>
                        {label}
                        <RequiredMark required={field.required} />
                      </label>
                      <textarea
                        id={`slt_${field.key}`}
                        name={field.key}
                        rows={4}
                        required={field.required}
                        placeholder={field.placeholder || ''}
                        className={`${inputClass} resize-y`}
                      />
                    </div>
                  );
                }

                if (field.type === 'select') {
                  return (
                    <div key={`${field.key}-${index}`} className={wrapper}>
                      <label className={labelClass} htmlFor={`slt_${field.key}`}>
                        {label}
                        <RequiredMark required={field.required} />
                      </label>
                      <select
                        id={`slt_${field.key}`}
                        name={field.key}
                        required={field.required}
                        defaultValue=""
                        className={inputClass}
                      >
                        <option value="">Selecciona una opción</option>
                        {(field.options || []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }

                return (
                  <div key={`${field.key}-${index}`} className={wrapper}>
                    <label className={labelClass} htmlFor={`slt_${field.key}`}>
                      {label}
                      <RequiredMark required={field.required} />
                    </label>
                    <input
                      id={`slt_${field.key}`}
                      name={field.key}
                      type={field.type}
                      required={field.required}
                      placeholder={field.placeholder || ''}
                      className={inputClass}
                    />
                  </div>
                );
              })}
            </div>

            {/* Honeypot: invisibles para personas, tentadores para bots. */}
            <div className="hidden" aria-hidden="true">
              <label>
                No completar este campo
                <input type="text" name="hp" tabIndex={-1} autoComplete="off" />
              </label>
              <label>
                Sitio web
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            {/* Trampa de tiempo: marca cuándo se renderizó el formulario. */}
            <input type="hidden" name="_slt_ts" value={renderedAt || ''} readOnly />

            {hasCaptcha && (
              <div className="mt-4 flex justify-center">
                {captchaProvider === 'recaptcha' ? (
                  <div className="g-recaptcha" data-sitekey={captchaSiteKey} />
                ) : (
                  <div
                    className="cf-turnstile"
                    data-sitekey={captchaSiteKey}
                    data-theme="auto"
                  />
                )}
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === 'submitting' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Enviar
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
