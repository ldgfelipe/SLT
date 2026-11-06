'use client';

import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileText,
  Loader2,
  Mail,
  Pause,
  Play,
  Plus,
  Send,
  Trash2,
  X,
  Pencil,
  RefreshCw,
  ListTree,
  Sparkles,
} from 'lucide-react';
import {
  continueMailCampaign,
  deleteMailCampaign,
  duplicateMailCampaign,
  estimateMailCampaignRecipients,
  listMailCampaignSends,
  listMailCampaigns,
  pauseMailCampaign,
  resumeMailCampaign,
  cancelMailCampaign,
  saveMailCampaign,
  startMailCampaign,
  tickDueMailCampaigns,
  getCampaignStats,
  type SaveCampaignInput,
} from '@/app/actions/mail-campaigns';
import type { MailCampaign } from '@/types/database';

interface CampaignsWorkspaceProps {
  clientId: string;
  currentClientName: string | null;
  initialStats?: {
    hoy: number;
    limite: number;
    cupoRestante: number;
    activas: number;
    programadas: number;
    pausadas: number;
    conError: number;
    totalContactos: number;
  };
  initialCampaigns: MailCampaign[];
  lists: Array<{ id: string; name: string; contact_count?: number }>;
  connections: Array<{ id: string; nombre: string; proveedor: string; activo: boolean }>;
}

const ESTADO_META: Record<MailCampaign['estado'], { label: string; classes: string }> = {
  borrador: {
    label: 'Borrador',
    classes: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  },
  programada: {
    label: 'Programada',
    classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  enviando: {
    label: 'Enviando',
    classes: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  },
  pausada: {
    label: 'Pausada',
    classes: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  },
  enviada: {
    label: 'Enviada',
    classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  cancelada: {
    label: 'Cancelada',
    classes: 'bg-slate-600/15 text-slate-400 border-slate-600/30',
  },
  error: {
    label: 'Error',
    classes: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
};

const TEMPLATE_HTML = `<div style="font-family:system-ui,sans-serif;background:#0a1931;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#0c1f3d;border:1px solid rgba(0,212,255,.2);border-radius:16px;padding:28px">
    <h1 style="color:#00d4ff;font-size:22px;margin:0 0 12px">¡Hola {{nombre}}!</h1>
    <p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:0 0 16px">
      En <strong>Inventser</strong> ayudamos a negocios como <strong>{{empresa}}</strong> a centralizar su inventario, ventas y clientes en un solo lugar.
    </p>
    <p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:0 0 20px">
      Te invito a una demostración de 15 minutos, sin costo.
    </p>
    <a href="https://inventser.com" style="display:inline-block;background:#00d4ff;color:#06152b;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px">Agenda tu demo</a>
    <p style="color:#64748b;font-size:11px;margin:24px 0 0">Inventser — Inventario, ventas y clientes en un solo lugar.</p>
  </div>
</div>`;

const VARIABLES = [
  { label: '{{nombre}}', value: '{{nombre}}' },
  { label: '{{nombre_completo}}', value: '{{nombre_completo}}' },
  { label: '{{empresa}}', value: '{{empresa}}' },
  { label: '{{email}}', value: '{{email}}' },
  { label: '{{telefono}}', value: '{{telefono}}' },
  { label: '{{giro}}', value: '{{giro}}' },
  { label: '{{cargo}}', value: '{{cargo}}' },
  { label: '{{sitio_web}}', value: '{{sitio_web}}' },
  { label: '{{region}}', value: '{{region}}' },
  { label: '{{fuente}}', value: '{{fuente}}' },
];

export function CampaignsWorkspace({
  clientId,
  currentClientName,
  initialStats,
  initialCampaigns,
  lists,
  connections,
}: CampaignsWorkspaceProps) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<MailCampaign[]>(initialCampaigns);
  const [stats, setStats] = useState(initialStats);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MailCampaign | null>(null);
  const [bitacoraFor, setBitacoraFor] = useState<MailCampaign | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const reload = useCallback(async () => {
    const [c, s] = await Promise.all([
      listMailCampaigns(clientId),
      getCampaignStats(clientId),
    ]);
    if (c.success) setCampaigns(c.campaigns);
    if (s.success) setStats(s.stats);
  }, [clientId]);

  // Arranca automáticamente las campañas vencidas al abrir la vista (como pide el spec)
  useEffect(() => {
    tickDueMailCampaigns(clientId).finally(() => {
      reload();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (campaign: MailCampaign) => {
    setEditing(campaign);
    setEditorOpen(true);
  };

  const rowAction = (id: string, action: () => Promise<any>, okMessage: string) => {
    setBusyRow(id);
    setError('');
    setMessage('');
    startTransition(async () => {
      const result = await action();
      setBusyRow(null);
      if (!result?.success) {
        setError(result?.error || 'Error.');
        return;
      }
      setMessage(okMessage);
      await reload();
    });
  };

  const statsCards = [
    { label: 'Enviados hoy', value: stats?.hoy.toLocaleString('es-MX') ?? '—' },
    { label: 'Cupo restante', value: stats?.cupoRestante.toLocaleString('es-MX') ?? '—' },
    { label: 'Activas', value: stats?.activas ?? '—' },
    { label: 'Programadas', value: stats?.programadas ?? '—' },
    { label: 'Pausadas', value: stats?.pausadas ?? '—' },
    { label: 'Contactos', value: stats?.totalContactos.toLocaleString('es-MX') ?? '—' },
  ];

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Campañas de Email</h1>
            {currentClientName && (
              <span className="rounded-full border border-[#00d4ff]/30 bg-[#00d4ff]/10 px-2.5 py-1 text-[11px] font-semibold text-[#00d4ff]">
                {currentClientName}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Programa y envía campañas por listas, con lotes de 200 y supresión automática.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#00d4ff] px-4 py-2.5 text-xs font-semibold text-[#06152b] transition hover:bg-cyan-300"
        >
          <Plus className="h-4 w-4" /> Nueva campaña
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

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {statsCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 text-center"
          >
            <p className="text-lg font-bold text-[#00d4ff]">{card.value}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              {card.label}
            </p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1f3d]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Historial de campañas
          </h2>
          <button
            onClick={reload}
            className="rounded-lg p-1.5 text-slate-500 transition hover:text-white"
            title="Actualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="border-b border-white/10 bg-white/[0.02] text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Lista</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Enviados</th>
                <th className="px-4 py-3 text-right">Apert.</th>
                <th className="px-4 py-3 text-right">Clics</th>
                <th className="px-4 py-3 text-right">Rebotes</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Mail className="mx-auto mb-2 h-8 w-8 text-slate-700" />
                    <p className="text-sm text-slate-500">Aún no hay campañas.</p>
                    <button onClick={openNew} className="mt-2 text-xs text-[#00d4ff] underline">
                      Crear la primera
                    </button>
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => {
                  const meta = ESTADO_META[campaign.estado];
                  const busy = busyRow === campaign.id;
                  const canSend = ['programada', 'pausada', 'borrador'].includes(campaign.estado);
                  const canPause = campaign.estado === 'enviando';
                  const canResume = campaign.estado === 'pausada';
                  const canCancel = ['programada', 'enviando', 'pausada'].includes(campaign.estado);

                  return (
                    <tr key={campaign.id} className="transition hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="max-w-[220px]">
                          <p className="truncate font-medium text-slate-200">{campaign.name}</p>
                          <p className="truncate text-[10px] text-slate-500">{campaign.subject}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[140px] truncate text-slate-400">
                        {campaign.lista?.name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-bold text-sky-300">
                          {campaign.canal_tipo === 'smtp' ? 'SMTP' : 'API'}
                        </span>
                        <span className="ml-1 text-[9px] text-slate-500">
                          {campaign.conexion?.nombre || ''}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${meta.classes}`}>
                          {meta.label}
                        </span>
                        {campaign.scheduled_at && campaign.estado === 'programada' && (
                          <p className="mt-0.5 text-[9px] text-slate-500">
                            {new Date(campaign.scheduled_at).toLocaleString('es-MX')}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {campaign.enviados.toLocaleString('es-MX')}
                        <span className="text-slate-600"> / {campaign.total_destinatarios.toLocaleString('es-MX')}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">{campaign.abiertos}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{campaign.clics}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{campaign.rebotados}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <IconAction
                            title={canSend ? 'Enviar ahora' : 'Enviar'}
                            busy={busy}
                            onClick={() =>
                              rowAction(
                                campaign.id,
                                () => startMailCampaign(campaign.id),
                                'Envío iniciado (lotes de 200).'
                              )
                            }
                          >
                            <Send className="h-3.5 w-3.5" />
                          </IconAction>
                          <IconAction
                            title="Editar"
                            busy={busy}
                            onClick={() => openEdit(campaign)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </IconAction>
                          <IconAction
                            title="Duplicar"
                            busy={busy}
                            onClick={() =>
                              rowAction(
                                campaign.id,
                                () => duplicateMailCampaign(campaign.id),
                                'Campaña duplicada.'
                              )
                            }
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </IconAction>
                          <IconAction
                            title="Bitácora"
                            busy={busy}
                            onClick={() => setBitacoraFor(campaign)}
                          >
                            <ListTree className="h-3.5 w-3.5" />
                          </IconAction>
                          {canPause && (
                            <IconAction
                              title="Pausar"
                              busy={busy}
                              onClick={() =>
                                rowAction(
                                  campaign.id,
                                  () => pauseMailCampaign(campaign.id),
                                  'Campaña pausada.'
                                )
                              }
                            >
                              <Pause className="h-3.5 w-3.5" />
                            </IconAction>
                          )}
                          {canResume && (
                            <IconAction
                              title="Reanudar"
                              busy={busy}
                              onClick={() =>
                                rowAction(
                                  campaign.id,
                                  () => resumeMailCampaign(campaign.id),
                                  'Campaña reanudada.'
                                )
                              }
                            >
                              <Play className="h-3.5 w-3.5" />
                            </IconAction>
                          )}
                          {canCancel && (
                            <IconAction
                              title="Cancelar"
                              busy={busy}
                              onClick={() =>
                                rowAction(
                                  campaign.id,
                                  () => cancelMailCampaign(campaign.id),
                                  'Campaña cancelada.'
                                )
                              }
                            >
                              <X className="h-3.5 w-3.5" />
                            </IconAction>
                          )}
                          <IconAction
                            title="Eliminar"
                            busy={busy}
                            onClick={() => {
                              if (!confirm('¿Eliminar esta campaña y su bitácora?')) return;
                              rowAction(
                                campaign.id,
                                () => deleteMailCampaign(campaign.id),
                                'Campaña eliminada.'
                              );
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconAction>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editorOpen && (
        <CampaignEditor
          clientId={clientId}
          campaign={editing}
          lists={lists}
          connections={connections}
          onClose={() => setEditorOpen(false)}
          onSaved={async () => {
            setEditorOpen(false);
            await reload();
            setMessage('Campaña guardada.');
          }}
        />
      )}

      {bitacoraFor && (
        <BitacoraModal
          campaign={bitacoraFor}
          onClose={() => setBitacoraFor(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Botón de acción                                                        */
/* ------------------------------------------------------------------ */

function IconAction({
  title,
  onClick,
  busy,
  children,
}: {
  title: string;
  onClick: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={title}
      className="rounded-lg p-1.5 text-slate-400 transition hover:text-[#00d4ff] hover:bg-white/5 disabled:opacity-40"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Editor de campaña                                                      */
/* ------------------------------------------------------------------ */

function CampaignEditor({
  clientId,
  campaign,
  lists,
  connections,
  onClose,
  onSaved,
}: {
  clientId: string;
  campaign: MailCampaign | null;
  lists: Array<{ id: string; name: string; contact_count?: number }>;
  connections: Array<{ id: string; nombre: string; proveedor: string; activo: boolean }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(campaign);
  const [nombre, setNombre] = useState(campaign?.name || '');
  const [asunto, setAsunto] = useState(campaign?.subject || '');
  const [html, setHtml] = useState(campaign?.html || TEMPLATE_HTML);
  const [listaId, setListaId] = useState(campaign?.lista_id || lists[0]?.id || '');
  const [canalTipo, setCanalTipo] = useState<'api' | 'smtp'>(campaign?.canal_tipo || 'api');
  const [canalId, setCanalId] = useState(campaign?.canal_id || connections[0]?.id || '');
  const [senderName, setSenderName] = useState(campaign?.sender_name || 'Inventser');
  const [senderEmail, setSenderEmail] = useState(campaign?.sender_email || '');
  const [sendMode, setSendMode] = useState<'draft' | 'schedule' | 'now'>('draft');
  const [scheduledAt, setScheduledAt] = useState(
    campaign?.scheduled_at
      ? new Date(campaign.scheduled_at).toISOString().slice(0, 16)
      : ''
  );
  const [estimate, setEstimate] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [saving, startTransition] = useTransition();
  const htmlRef = React.useRef<HTMLTextAreaElement>(null);

  const selectedList = lists.find((l) => l.id === listaId);

  useEffect(() => {
    if (!listaId) {
      setEstimate(null);
      return;
    }
    estimateMailCampaignRecipients(clientId, listaId).then((res) => {
      if (res.success) setEstimate(res.total);
    });
  }, [clientId, listaId]);

  const insertVariable = (variable: string) => {
    const el = htmlRef.current;
    if (!el) {
      setHtml((v) => v + variable);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = html.slice(0, start) + variable + html.slice(end);
    setHtml(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + variable.length;
    });
  };

  const save = (mode: 'draft' | 'schedule' | 'now') => {
    setError('');

    if (!nombre.trim() || !asunto.trim()) {
      setError('Nombre y asunto son obligatorios.');
      return;
    }
    if (!listaId) {
      setError('Selecciona una lista.');
      return;
    }
    if (mode === 'schedule' && !scheduledAt) {
      setError('Elige una fecha y hora para programar.');
      return;
    }

    const scheduledIso =
      mode === 'schedule' && scheduledAt
        ? new Date(`${scheduledAt}:00-06:00`).toISOString()
        : mode === 'now'
          ? null
          : campaign?.estado === 'programada'
            ? campaign?.scheduled_at
            : null;

    const payload: SaveCampaignInput = {
      id: campaign?.id || null,
      nombre,
      asunto,
      html,
      listaId,
      canalTipo,
      canalId: canalId || null,
      senderName,
      senderEmail,
      scheduledAt: scheduledIso,
      sendNow: mode === 'now',
      saveAsDraft: mode === 'draft',
    };

    startTransition(async () => {
      const result = await saveMailCampaign(clientId, payload);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (mode === 'now') {
        await startMailCampaign(result.campaignId);
      }
      onSaved();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-2xl flex-col bg-[#0a1931]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-white">
            <Mail className="h-5 w-5 text-[#00d4ff]" />
            {isEdit ? 'Editar campaña' : 'Nueva campaña'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Nombre de la campaña *
            </label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Prospectos Octubre — Demo"
              className="w-full rounded-lg border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white outline-none focus:border-[#00d4ff]"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Asunto *
            </label>
            <input
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="Ej. {{nombre}}, prueba Inventser gratis 14 días"
              className="w-full rounded-lg border border-white/10 bg-[#0c1f3d] px-3 py-2 text-sm text-white outline-none focus:border-[#00d4ff]"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Lista *
              </label>
              <select
                value={listaId}
                onChange={(e) => setListaId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0c1f3d] px-3 py-2 text-xs text-white outline-none focus:border-[#00d4ff]"
              >
                <option value="">Selecciona…</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name} ({(list.contact_count ?? 0).toLocaleString('es-MX')})
                  </option>
                ))}
              </select>
              {estimate !== null && (
                <p className="mt-1 text-[10px] text-emerald-400">
                  {estimate.toLocaleString('es-MX')} destinatarios estimados (entregables)
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Conexión *
              </label>
              <select
                value={canalId}
                onChange={(e) => setCanalId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0c1f3d] px-3 py-2 text-xs text-white outline-none focus:border-[#00d4ff]"
              >
                <option value="">Selecciona…</option>
                {connections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.nombre} ({connection.proveedor})
                    {!connection.activo ? ' — inactiva' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Canal
              </label>
              <div className="grid grid-cols-2 gap-1">
                {(['api', 'smtp'] as const).map((tipo) => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setCanalTipo(tipo)}
                    className={`rounded-lg border px-2 py-2 text-[11px] font-bold uppercase transition ${
                      canalTipo === tipo
                        ? 'border-[#00d4ff] bg-[#00d4ff]/10 text-[#00d4ff]'
                        : 'border-white/10 text-slate-500'
                    }`}
                  >
                    {tipo}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Remitente
              </label>
              <input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0c1f3d] px-3 py-2 text-xs text-white outline-none focus:border-[#00d4ff]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Correo remitente *
              </label>
              <input
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="hola@tudominio.com"
                className="w-full rounded-lg border border-white/10 bg-[#0c1f3d] px-3 py-2 text-xs text-white outline-none focus:border-[#00d4ff]"
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Contenido HTML *
              </label>
              <div className="flex flex-wrap gap-1">
                {VARIABLES.map((variable) => (
                  <button
                    key={variable.value}
                    type="button"
                    onClick={() => insertVariable(variable.value)}
                    className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-slate-400 transition hover:border-[#00d4ff]/40 hover:text-[#00d4ff]"
                  >
                    {variable.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              ref={htmlRef}
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={12}
              spellCheck={false}
              className="w-full resize-y rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5 font-mono text-[11px] leading-relaxed text-slate-200 outline-none focus:border-[#00d4ff]"
            />
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-[10px] leading-relaxed text-amber-200/80">
            <Sparkles className="mr-1 inline h-3 w-3" />
            Al enviarse, cada correo incluye baja firmada, píxel de apertura y reescritura de clics.
            Los dados de baja nunca recibirán el correo y se marcarán como “no suscrito”, y el envío
            se procesa en lotes de 200.
          </div>
        </div>

        <div className="border-t border-white/10 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSendMode('draft')}
                className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition ${
                  sendMode === 'draft' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Guardar borrador
              </button>
              <button
                onClick={() => setSendMode('schedule')}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-[11px] font-semibold transition ${
                  sendMode === 'schedule' ? 'bg-amber-500/15 text-amber-300' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Calendar className="h-3.5 w-3.5" /> Programar
              </button>
              <button
                onClick={() => setSendMode('now')}
                className={`flex items-center gap-1 rounded-lg px-3 py-2 text-[11px] font-semibold transition ${
                  sendMode === 'now' ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Send className="h-3.5 w-3.5" /> Enviar ahora
              </button>
            </div>

            <div className="flex items-center gap-2">
              {sendMode === 'schedule' && (
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="rounded-lg border border-white/10 bg-[#0c1f3d] px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                />
              )}
              <button
                onClick={() => save(sendMode)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#00d4ff] px-4 py-2 text-xs font-semibold text-[#06152b] transition hover:bg-cyan-300 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {sendMode === 'draft' ? 'Guardar' : sendMode === 'schedule' ? 'Programar' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bitácora modal                                                      */
/* ------------------------------------------------------------------ */

const SEND_ESTADO: Record<string, string> = {
  pendiente: 'bg-slate-500/15 text-slate-400',
  enviando: 'bg-sky-500/15 text-sky-300',
  enviado: 'bg-emerald-500/15 text-emerald-300',
  error: 'bg-rose-500/15 text-rose-300',
  no_suscrito: 'bg-amber-500/15 text-amber-300',
};

function BitacoraModal({
  campaign,
  onClose,
}: {
  campaign: MailCampaign;
  onClose: () => void;
}) {
  const [sends, setSends] = useState<Array<{ id: string; email: string; estado: string; detalle: string | null; sent_at: string | null; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMailCampaignSends(campaign.id, 100).then((res) => {
      if (res.success) setSends(res.sends as any);
      setLoading(false);
    });
  }, [campaign.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a1931]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-white">Bitácora — {campaign.name}</h2>
            <p className="text-[10px] text-slate-500">Últimos 100 envíos</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-slate-600" />
          ) : (
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 border-b border-white/10 bg-[#0a1931] text-[9px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Correo</th>
                  <th className="px-4 py-2">Estado</th>
                  <th className="px-4 py-2">Detalle</th>
                  <th className="px-4 py-2 text-right">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sends.map((send) => (
                  <tr key={send.id}>
                    <td className="px-4 py-1.5 text-slate-300">{send.email}</td>
                    <td className="px-4 py-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase ${SEND_ESTADO[send.estado]}`}>
                        {send.estado}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 max-w-[200px] truncate text-slate-500">{send.detalle || '—'}</td>
                    <td className="px-4 py-1.5 text-right text-slate-500">
                      {send.sent_at ? new Date(send.sent_at).toLocaleString('es-MX') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
