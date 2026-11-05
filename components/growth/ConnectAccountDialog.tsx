'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  KeyRound,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { ProviderIcon } from './ProviderIcon';
import {
  PROVIDERS,
  SOCIAL_PROVIDERS,
} from '@/lib/growth/providers';
import type {
  Client,
  PendingOAuthSession,
  SocialProvider,
} from '@/types/database';

interface ConnectAccountDialogProps {
  clients: Client[];
  activeClientId: string;
  configured: SocialProvider[];
  isRoot: boolean;
  pendingSession: PendingOAuthSession | null;
}

const STEPS = [
  { id: 1, label: 'Cliente' },
  { id: 2, label: 'Red' },
  { id: 3, label: 'Permisos' },
  { id: 4, label: 'Cuenta' },
];

export function ConnectAccountDialog({
  clients,
  activeClientId,
  configured,
  isRoot,
  pendingSession,
}: ConnectAccountDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(pendingSession));
  const [step, setStep] = useState(pendingSession ? 4 : 1);
  const [clientId, setClientId] = useState(activeClientId);
  const [provider, setProvider] = useState<SocialProvider | null>(
    pendingSession?.provider || null
  );
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savedIndexes, setSavedIndexes] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pendingSession) return;
    setOpen(true);
    setStep(4);
    setProvider(pendingSession.provider);
  }, [pendingSession?.id]);

  const close = () => {
    setOpen(false);
    setSavingIndex(null);
    setSavedIndexes(new Set());
    if (pendingSession) {
      router.replace('/dashboard/social-accounts');
    }
  };

  const openDialog = () => {
    setOpen(true);
    setStep(pendingSession ? 4 : 1);
    setError('');
  };

  const authorize = () => {
    if (!provider) return;
    window.location.href = `/api/auth/${provider}?client_id=${encodeURIComponent(
      clientId
    )}`;
  };

  const saveAccount = async (index: number) => {
    if (!pendingSession) return;

    setSavingIndex(index);
    setError('');

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: pendingSession.id,
          account_index: index,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo guardar la cuenta.');
      }

      setSavedIndexes((prev) => new Set(prev).add(index));
      router.refresh();
    } catch (saveError: any) {
      setError(saveError?.message || 'No se pudo guardar la cuenta.');
    } finally {
      setSavingIndex(null);
    }
  };

  const selectedClient = clients.find((client) => client.id === clientId);
  const allSaved =
    Boolean(pendingSession) &&
    pendingSession!.accounts.length > 0 &&
    savedIndexes.size >= pendingSession!.accounts.length;

  return (
    <>
      <button
        onClick={openDialog}
        className="inline-flex items-center gap-2 rounded-xl bg-[#00d4ff] px-4 py-2.5 text-sm font-semibold text-[#06152b] shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300"
      >
        <Plus className="h-4 w-4" />
        Conectar nueva cuenta
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a1931] shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-white">
                  Conectar cuenta social
                </h2>
                <p className="text-xs text-slate-400">
                  Autoriza Inventser para publicar en nombre del cliente.
                </p>
              </div>
              <button
                onClick={close}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Steps */}
            <div className="flex items-center gap-1 border-b border-white/10 px-5 py-3">
              {STEPS.map((item) => {
                const active = step === item.id;
                const done = step > item.id;
                return (
                  <React.Fragment key={item.id}>
                    <div
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        active
                          ? 'bg-[#00d4ff]/15 text-[#00d4ff]'
                          : done
                            ? 'text-emerald-300'
                            : 'text-slate-500'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full border text-[9px] ${
                          active
                            ? 'border-[#00d4ff]'
                            : done
                              ? 'border-emerald-400 bg-emerald-400/10'
                              : 'border-slate-600'
                        }`}
                      >
                        {done ? <Check className="h-2.5 w-2.5" /> : item.id}
                      </span>
                      {item.label}
                    </div>
                    {item.id < 4 && (
                      <ChevronRight className="h-3 w-3 text-slate-600" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white">
                    ¿Para qué cliente?
                  </h3>
                  {isRoot ? (
                    <select
                      value={clientId}
                      onChange={(event) => setClientId(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff]"
                    >
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-sm text-white">
                      {selectedClient?.name || 'Cliente asignado'}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500">
                    Las cuentas y publicaciones quedan aisladas por cliente.
                  </p>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white">
                    Selecciona la red social
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {SOCIAL_PROVIDERS.map((item) => {
                      const meta = PROVIDERS[item];
                      const enabled = configured.includes(item);
                      const active = provider === item;

                      return (
                        <button
                          key={item}
                          onClick={() => {
                            if (!enabled) return;
                            setProvider(item);
                            setStep(3);
                          }}
                          disabled={!enabled}
                          className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                            active
                              ? 'border-[#00d4ff] bg-[#00d4ff]/10'
                              : enabled
                                ? 'border-white/10 bg-[#0c1f3d] hover:border-white/25'
                                : 'cursor-not-allowed border-white/5 bg-[#0c1f3d]/40 opacity-50'
                          }`}
                        >
                          <span
                            className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5"
                            style={{ color: meta.color }}
                          >
                            <ProviderIcon provider={item} className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold text-white">
                              {meta.label}
                            </span>
                            <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-400">
                              {enabled
                                ? meta.description
                                : 'Falta configurar credenciales en Vercel.'}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 3 && provider && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5"
                      style={{ color: PROVIDERS[provider].color }}
                    >
                      <ProviderIcon provider={provider} className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        Autorizar {PROVIDERS[provider].label}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Cliente: {selectedClient?.name || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-[#0c1f3d] p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <KeyRound className="h-3.5 w-3.5" /> Permisos solicitados
                    </p>
                    <ul className="space-y-1">
                      {PROVIDERS[provider].scopes.map((scope) => (
                        <li
                          key={scope}
                          className="flex items-start gap-2 text-[11px] text-slate-300"
                        >
                          <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-emerald-400" />
                          <span className="break-all font-mono">{scope}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {!PROVIDERS[provider].canPublish && (
                    <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                      {PROVIDERS[provider].publishNote}
                    </p>
                  )}

                  <button
                    onClick={authorize}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00d4ff] px-4 py-2.5 text-sm font-semibold text-[#06152b] transition hover:bg-cyan-300"
                  >
                    Autorizar con {PROVIDERS[provider].label}
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  <p className="text-center text-[10px] text-slate-500">
                    Serás redirigido a {PROVIDERS[provider].label}. Los tokens se
                    guardan cifrados y nunca llegan al navegador.
                  </p>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-3">
                  {!pendingSession ? (
                    <div className="rounded-xl border border-white/10 bg-[#0c1f3d] px-4 py-8 text-center">
                      <p className="text-sm font-semibold text-white">
                        Esperando autorización…
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Vuelve a este paso después de autorizar la red social.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          Elige qué cuenta guardar
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Encontramos {pendingSession.accounts.length} cuenta(s)
                          en {PROVIDERS[pendingSession.provider].label}.
                        </p>
                      </div>

                      <div className="space-y-2">
                        {pendingSession.accounts.map((account, index) => {
                          const saved = savedIndexes.has(index);
                          return (
                            <div
                              key={`${account.account_name}-${index}`}
                              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-white">
                                  {account.account_name}
                                </p>
                                <p className="truncate text-[10px] text-slate-500">
                                  {account.ig_user_id
                                    ? `IG ${account.ig_user_id}`
                                    : account.page_id
                                      ? `ID ${account.page_id}`
                                      : 'Cuenta'}
                                </p>
                              </div>
                              <button
                                onClick={() => saveAccount(index)}
                                disabled={saved || savingIndex === index}
                                className={`inline-flex flex-shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                                  saved
                                    ? 'bg-emerald-500/15 text-emerald-300'
                                    : 'bg-[#00d4ff] text-[#06152b] hover:bg-cyan-300'
                                }`}
                              >
                                {savingIndex === index ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : saved ? (
                                  <Check className="h-3 w-3" />
                                ) : null}
                                {saved ? 'Guardada' : 'Guardar'}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {allSaved && (
                        <button
                          onClick={close}
                          className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                        >
                          Listo, finalizar
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
              <button
                onClick={() => setStep((current) => Math.max(1, current - 1))}
                disabled={step === 1}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Atrás
              </button>

              {step < 3 && (
                <button
                  onClick={() => setStep((current) => Math.min(4, current + 1))}
                  disabled={step === 2 && !provider}
                  className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-30"
                >
                  Siguiente <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
