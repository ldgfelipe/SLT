'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Mail,
  Plus,
  Plug,
  Trash2,
  X,
  Play,
  ShieldCheck,
  Trash,
  UserCheck,
  Settings2,
  RefreshCw,
} from 'lucide-react';
import {
  addBajas,
  deleteMailConnection,
  listBajas,
  listMailConnections,
  getSesConfigAction,
  getMailSettingsAction,
  saveSesConfigAction,
  saveMailConnection,
  saveMailSettingsAction,
  testMailConnectionAction,
  toggleMailConnection,
  removeBaja,
} from '@/app/actions/mail-data';
import {
  MAIL_PROVIDERS,
  MAIL_PROVIDER_MAP,
  providerFields,
  type ProviderId,
} from '@/lib/mail/providers';
import type { SesBaja, MailConnection } from '@/types/database';

interface ConnectionsWorkspaceProps {
  clientId: string;
}

const PROVIDER_COLOR: Record<string, string> = Object.fromEntries(
  MAIL_PROVIDERS.map((p) => [p.id, p.color])
);

export function ConnectionsWorkspace({ clientId }: ConnectionsWorkspaceProps) {
  const [connections, setConnections] = useState<MailConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [envLimit, setEnvLimit] = useState(300);
  const [envEditing, setEnvEditing] = useState(false);
  const [envValue, setEnvValue] = useState(String(300));
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [testOk, setTestOk] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formProvider, setFormProvider] = useState<ProviderId>('brevo');
  const [formVia, setFormVia] = useState<'api' | 'smtp'>('api');
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, startTransition] = useTransition();
  const [busyRow, startRowTransition] = useTransition();

  const providerDef = MAIL_PROVIDER_MAP[formProvider];
  const activeFields = providerFields(formProvider, formVia);

  useEffect(() => {
    setLoading(true);
    listMailConnections(clientId).then((res) => {
      if (res.success) setConnections(res.connections as any);
      else setError(res.error);
      setLoading(false);
    });
    getMailSettingsAction(clientId).then((res) => {
      if (res.success) {
        setEnvLimit(res.settings.limite_diario);
        setEnvValue(String(res.settings.limite_diario));
      }
    });
  }, [clientId]);

  const showOk = (text: string) => {
    setMessage(text);
    setError('');
  };

  const openNew = () => {
    setEditId(null);
    setFormName('');
    setFormProvider('brevo');
    setFormVia('api');
    setFormValues({});
    setDialogOpen(true);
  };

  const openEdit = (connection: MailConnection) => {
    setEditId(connection.id);
    setFormName(connection.nombre);
    setFormProvider(connection.proveedor as ProviderId);
    const def = MAIL_PROVIDER_MAP[connection.proveedor as ProviderId];
    setFormVia(def?.viaApi ? 'api' : 'smtp');
    setFormValues({});
    setDialogOpen(true);
  };

  const save = () => {
    setError('');
    startTransition(async () => {
      const result = await saveMailConnection(clientId, {
        connectionId: editId,
        nombre: formName,
        proveedor: formProvider,
        activo: true,
        config: formValues,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setDialogOpen(false);
      listMailConnections(clientId).then((res) => {
        if (res.success) setConnections(res.connections as any);
      });
      showOk(editId ? 'Conexión actualizada.' : 'Conexión creada.');
    });
  };

  const runTest = (connectionId: string) => {
    setTestingId(connectionId);
    setTestResult((r) => ({ ...r, [connectionId]: '' }));
    setTestOk((r) => ({ ...r, [connectionId]: false }));
    startRowTransition(async () => {
      const result = await testMailConnectionAction(connectionId);
      if (!result.success) {
        setTestResult((r) => ({ ...r, [connectionId]: result.error }));
        setTestOk((r) => ({ ...r, [connectionId]: false }));
      } else {
        setTestResult((r) => ({
          ...r,
          [connectionId]: result.result.ok
            ? result.result.detail || 'OK'
            : result.result.error || 'Falló la prueba',
        }));
        setTestOk((r) => ({ ...r, [connectionId]: Boolean(result.result.ok) }));
      }
      setTestingId(null);
    });
  };

  const remove = (id: string) => {
    if (!confirm('¿Eliminar esta conexión? Las campañas que la usen quedarán sin envío.')) return;
    startRowTransition(async () => {
      const result = await deleteMailConnection(id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setConnections((current) => current.filter((c) => c.id !== id));
      showOk('Conexión eliminada.');
    });
  };

  const toggle = (connection: MailConnection) => {
    startRowTransition(async () => {
      const result = await toggleMailConnection(connection.id, !connection.activo);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setConnections((current) =>
        current.map((c) =>
          c.id === connection.id ? { ...c, activo: !c.activo } : c
        )
      );
    });
  };

  const saveEnvLimit = () => {
    startRowTransition(async () => {
      const result = await saveMailSettingsAction(clientId, Number(envValue));
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEnvLimit(result.limite_diario);
      setEnvValue(String(result.limite_diario));
      setEnvEditing(false);
      showOk(`Límite del ambiente: ${result.limite_diario} envíos/día (no aplica a Amazon SES).`);
    });
  };

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Integraciones SMTP / API
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Conecta tus proveedores de envío. Las claves se cifran y nunca salen al navegador.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#00d4ff] px-4 py-2.5 text-xs font-semibold text-[#06152b] transition hover:bg-cyan-300"
        >
          <Plus className="h-4 w-4" /> Nueva conexión
        </button>
      </div>

      {(message || error) && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-xs ${
            error
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          {error || message}
        </div>
      )}

      {/* Límite del ambiente */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0c1f3d] p-4">
        <div>
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Settings2 className="h-4 w-4 text-[#00d4ff]" />
            Límite diario del ambiente
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Aplica a Brevo y proveedores vía API/SMTP. Amazon SES usa su propia cuota de AWS.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {envEditing ? (
            <>
              <input
                type="number"
                min={1}
                value={envValue}
                onChange={(e) => setEnvValue(e.target.value)}
                className="w-28 rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-sm text-white outline-none focus:border-[#00d4ff]"
              />
              <button onClick={saveEnvLimit} className="rounded-lg bg-[#00d4ff] p-2 text-[#06152b]">
                <Check className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <span className="rounded-xl border border-[#00d4ff]/20 bg-[#00d4ff]/5 px-4 py-2 text-lg font-bold text-[#00d4ff]">
                {envLimit.toLocaleString('es-MX')}<span className="text-xs text-slate-400 font-medium">/día</span>
              </span>
              <button
                onClick={() => setEnvEditing(true)}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:border-white/25 hover:text-white"
              >
                Editar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Conexiones */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1f3d]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/10 bg-white/[0.02] text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3">Vías</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Prueba</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-600" />
                </td>
              </tr>
            ) : connections.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <Plug className="mx-auto mb-2 h-8 w-8 text-slate-700" />
                  <p className="text-sm text-slate-500">Aún no hay conexiones.</p>
                  <button onClick={openNew} className="mt-2 text-xs text-[#00d4ff] underline">
                    Crear la primera
                  </button>
                </td>
              </tr>
            ) : (
              connections.map((connection) => {
                const def = MAIL_PROVIDER_MAP[connection.proveedor as ProviderId];
                const testing = testingId === connection.id;
                const result = testResult[connection.id];
                const ok = testOk[connection.id];

                return (
                  <tr key={connection.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-slate-200">{connection.nombre}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ background: PROVIDER_COLOR[connection.proveedor], borderColor: 'transparent' }}
                      >
                        {def?.short || connection.proveedor}
                        <span className="opacity-80">{def?.label || connection.proveedor}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {def?.viaApi && (
                          <span className="rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-bold text-sky-300">API</span>
                        )}
                        {def?.viaSmtp && (
                          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">SMTP</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggle(connection)}
                        className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase transition ${
                          connection.activo
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                            : 'border-slate-600 bg-slate-800 text-slate-400'
                        }`}
                      >
                        {connection.activo ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      {result ? (
                        <span
                          className={`text-[10px] leading-snug ${
                            ok ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                          title={result}
                        >
                          {result.slice(0, 90)}
                        </span>
                      ) : (
                        <button
                          onClick={() => runTest(connection.id)}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#00d4ff] hover:underline"
                        >
                          {testing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                          Probar
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(connection)}
                          className="rounded-lg border border-white/10 px-2 py-1.5 text-[10px] font-medium text-slate-300 transition hover:border-white/25 hover:text-white"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => remove(connection.id)}
                          className="rounded-lg p-1.5 text-slate-500 transition hover:text-rose-400"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* SES Config + bajas */}
      <SesSection clientId={clientId} connections={connections} />
      <BajasSection clientId={clientId} />

      {/* Diálogo nueva/editar conexión */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a1931] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="flex items-center gap-2 text-base font-bold text-white">
                <Plug className="h-5 w-5 text-[#00d4ff]" />
                {editId ? 'Editar conexión' : 'Nueva conexión'}
              </h2>
              <button onClick={() => setDialogOpen(false)} className="rounded-lg p-2 text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Nombre *
                </label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej. Cuenta principal Amazon SES"
                  className="w-full rounded-lg border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white outline-none focus:border-[#00d4ff]"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Proveedor
                </label>
                <select
                  value={formProvider}
                  onChange={(e) => {
                    const id = e.target.value as ProviderId;
                    setFormProvider(id);
                    const def = MAIL_PROVIDER_MAP[id];
                    setFormVia(def?.viaApi ? 'api' : 'smtp');
                    setFormValues({});
                  }}
                  className="w-full rounded-lg border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white outline-none focus:border-[#00d4ff]"
                >
                  {MAIL_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                {providerDef?.note && (
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{providerDef.note}</p>
                )}
              </div>

              {providerDef?.viaApi && providerDef?.viaSmtp && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFormVia('api')}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      formVia === 'api'
                        ? 'border-[#00d4ff] bg-[#00d4ff]/10 text-[#00d4ff]'
                        : 'border-white/10 text-slate-400'
                    }`}
                  >
                    Vía API
                  </button>
                  <button
                    onClick={() => setFormVia('smtp')}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      formVia === 'smtp'
                        ? 'border-[#00d4ff] bg-[#00d4ff]/10 text-[#00d4ff]'
                        : 'border-white/10 text-slate-400'
                    }`}
                  >
                    Vía SMTP
                  </button>
                </div>
              )}

              {activeFields.map((field) => (
                <div key={field.name}>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {field.label}
                    {editId && (
                      <span className="ml-2 text-[9px] text-slate-600 normal-case">vacío = conservar</span>
                    )}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={formValues[field.name] || ''}
                      onChange={(e) => setFormValues((v) => ({ ...v, [field.name]: e.target.value }))}
                      className="w-full rounded-lg border border-white/10 bg-[#0c1f3d] px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#00d4ff]"
                    >
                      <option value="">{field.required ? 'Selecciona…' : 'Sin valor'}</option>
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={formValues[field.name] || ''}
                      onChange={(e) => setFormValues((v) => ({ ...v, [field.name]: e.target.value }))}
                      placeholder={field.placeholder || (editId ? '••••••••' : '')}
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-white/10 bg-[#0c1f3d] px-3 py-2 font-mono text-xs text-white outline-none placeholder:text-slate-600 focus:border-[#00d4ff]"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-3">
              <button
                onClick={() => setDialogOpen(false)}
                className="rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving || !formName.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#00d4ff] px-4 py-2 text-xs font-semibold text-[#06152b] transition hover:bg-cyan-300 disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Guardar conexión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SES Config                                                            */
/* ------------------------------------------------------------------ */

function SesSection({
  clientId,
  connections,
}: {
  clientId: string;
  connections: MailConnection[];
}) {
  const sesConnections = connections.filter((c) => c.proveedor === 'ses');
  const [selectedId, setSelectedId] = useState(sesConnections[0]?.id || '');
  const [config, setConfig] = useState({
    limite_diario: 50000,
    max_por_minuto: '',
    max_por_segundo: 14,
    usar_tracking: true,
    dominio_tracking: '',
    correo_bajas: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!selectedId && sesConnections.length > 0) {
      setSelectedId(sesConnections[0].id);
    }
  }, [sesConnections, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    getSesConfigAction(selectedId).then((res) => {
      if (!res.success) return;
      setConfig({
        limite_diario: res.config.limite_diario,
        max_por_minuto: res.config.max_por_minuto ? String(res.config.max_por_minuto) : '',
        max_por_segundo: res.config.max_por_segundo,
        usar_tracking: res.config.usar_tracking,
        dominio_tracking: res.config.dominio_tracking || '',
        correo_bajas: res.config.correo_bajas || '',
      });
    });
  }, [selectedId]);

  if (sesConnections.length === 0) return null;

  const save = async () => {
    setSaving(true);
    setMsg('');
    setErr('');
    const perMinute = config.max_por_minuto.trim()
      ? Number(config.max_por_minuto)
      : null;
    const result = await saveSesConfigAction(selectedId, {
      limite_diario: config.limite_diario,
      max_por_minuto: Number.isFinite(perMinute as any) ? perMinute : null,
      max_por_segundo: config.max_por_segundo,
      usar_tracking: config.usar_tracking,
      dominio_tracking: config.dominio_tracking.trim() || null,
      correo_bajas: config.correo_bajas.trim() || null,
    });
    setSaving(false);
    if (!result.success) {
      setErr(result.error);
      return;
    }
    setMsg(`Guardado. Aplicado: ${result.applied.max_por_segundo}/s, tope diario ${result.applied.limite_diario.toLocaleString('es-MX')}.`);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c1f3d] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <ShieldCheck className="h-4 w-4 text-[#00d4ff]" />
            Amazon SES — cuotas y tracking
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Los topes nunca superarán lo que AWS permite (14/s). El tope por minuto se deriva del por segundo.
          </p>
        </div>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#00d4ff]"
        >
          {sesConnections.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Tope diario">
          <input
            type="number"
            min={1}
            max={50000}
            value={config.limite_diario}
            onChange={(e) => setConfig((c) => ({ ...c, limite_diario: Number(e.target.value) }))}
            className="w-full rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-xs text-white outline-none focus:border-[#00d4ff]"
          />
        </Field>
        <Field label="Máx. por segundo">
          <input
            type="number"
            min={1}
            max={14}
            value={config.max_por_segundo}
            onChange={(e) => setConfig((c) => ({ ...c, max_por_segundo: Number(e.target.value) }))}
            className="w-full rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-xs text-white outline-none focus:border-[#00d4ff]"
          />
        </Field>
        <Field label="Máx. por minuto (opcional)">
          <input
            type="number"
            min={1}
            value={config.max_por_minuto}
            onChange={(e) => setConfig((c) => ({ ...c, max_por_minuto: e.target.value }))}
            placeholder="Se deriva de /s si se deja vacío"
            className="w-full rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-xs text-white outline-none placeholder:text-slate-600 focus:border-[#00d4ff]"
          />
        </Field>
        <div className="sm:col-span-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={config.usar_tracking}
              onChange={(e) => setConfig((c) => ({ ...c, usar_tracking: e.target.checked }))}
              className="h-4 w-4 rounded accent-[#00d4ff]"
            />
            Seguimiento de aperturas y clics
          </label>
          <input
            value={config.dominio_tracking}
            onChange={(e) => setConfig((c) => ({ ...c, dominio_tracking: e.target.value }))}
            placeholder="Dominio de tracking (opcional), ej. trk.inventser.com"
            className="flex-1 min-w-[200px] rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-xs text-white outline-none placeholder:text-slate-600 focus:border-[#00d4ff]"
          />
          <input
            value={config.correo_bajas}
            onChange={(e) => setConfig((c) => ({ ...c, correo_bajas: e.target.value }))}
            placeholder="Correo para bajas (List-Unsubscribe)"
            className="flex-1 min-w-[200px] rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-xs text-white outline-none placeholder:text-slate-600 focus:border-[#00d4ff]"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[10px] text-slate-500">
          Webhook de rebotes: <code className="text-slate-300">/api/mail/ses-webhook</code> (SNS → Bounce, Complaint, Delivery). Configura X-Ses-Secret = CRON_SECRET.
        </p>
        <div className="flex items-center gap-2">
          {err && <span className="text-[11px] text-rose-400">{err}</span>}
          {msg && <span className="text-[11px] text-emerald-400">{msg}</span>}
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-lg bg-[#00d4ff] px-3 py-2 text-xs font-semibold text-[#06152b] transition hover:bg-cyan-300 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Guardar SES
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Bajas (supresión)                                                   */
/* ------------------------------------------------------------------ */

function BajasSection({ clientId }: { clientId: string }) {
  const [rawText, setRawText] = useState('');
  const [motivo, setMotivo] = useState('baja voluntaria');
  const [bajas, setBajas] = useState<SesBaja[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = () => {
    setLoading(true);
    listBajas(clientId).then((res) => {
      if (res.success) setBajas(res.bajas as any);
      setLoading(false);
    });
  };

  useEffect(reload, [clientId]);

  const add = async () => {
    setSaving(true);
    setMsg('');
    setErr('');
    const result = await addBajas(clientId, { rawText, motivo });
    setSaving(false);
    if (!result.success) {
      setErr(result.error);
      return;
    }
    setMsg(`${result.added} correo(s) dados de baja.`);
    setRawText('');
    reload();
  };

  const act = async (id: string, action: 'reactivate' | 'delete') => {
    const result = await removeBaja(clientId, id, action);
    if (!result.success) {
      setErr(result.error);
      return;
    }
    reload();
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c1f3d] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Trash className="h-4 w-4 text-rose-400" />
            Base de bajas (supresión) — {bajas.length}
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Un correo aquí nunca vuelve a recibir envíos. Se puede reactivar.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={3}
          placeholder="Pega correos dados de baja (uno por línea o separados por coma)…"
          className="md:col-span-3 rounded-xl border border-white/10 bg-[#0a1931] px-3 py-2 font-mono text-[11px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-rose-400"
        />
        <div className="space-y-2">
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#0a1931] px-3 py-2 text-xs text-slate-200 outline-none focus:border-rose-400"
          >
            <option value="baja voluntaria">Baja voluntaria</option>
            <option value="rebote duro">Rebote duro</option>
            <option value="marcado como spam">Marcado como spam</option>
            <option value="motivo interno">Motivo interno</option>
          </select>
          <button
            onClick={add}
            disabled={saving || !rawText.trim()}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            Dar de baja
          </button>
        </div>
      </div>

      {err && <p className="mt-2 text-[11px] text-rose-400">{err}</p>}
      {msg && <p className="mt-2 text-[11px] text-emerald-400">{msg}</p>}

      {loading ? (
        <Loader2 className="mx-auto mt-4 h-5 w-5 animate-spin text-slate-600" />
      ) : bajas.length > 0 ? (
        <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-white/5">
          <table className="w-full text-left text-[10px]">
            <thead className="sticky top-0 bg-[#0a1931] text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2">Correo</th>
                <th className="px-3 py-2">Motivo</th>
                <th className="px-3 py-2">Origen</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {bajas.slice(0, 100).map((baja) => (
                <tr key={baja.id}>
                  <td className="px-3 py-1.5 text-slate-300">{baja.email}</td>
                  <td className="px-3 py-1.5 text-slate-500">{baja.motivo}</td>
                  <td className="px-3 py-1.5">
                    <span className="rounded border border-slate-600 px-1.5 py-0.5 text-[8px] uppercase text-slate-400">
                      {baja.origen}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-slate-500">
                    {new Date(baja.created_at).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => act(baja.id, 'reactivate')}
                        className="rounded border border-emerald-500/20 px-2 py-1 text-[9px] text-emerald-400 hover:bg-emerald-500/10"
                        title="Reactivar"
                      >
                        Reactivar
                      </button>
                      <button
                        onClick={() => act(baja.id, 'delete')}
                        className="rounded border border-rose-500/20 px-2 py-1 text-[9px] text-rose-400 hover:bg-rose-500/10"
                        title="Borrar registro"
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
