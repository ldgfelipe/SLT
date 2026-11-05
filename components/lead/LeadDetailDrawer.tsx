'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Loader2,
  Mail,
  Phone,
  Globe2,
  Eye,
  MousePointerClick,
  Fingerprint,
  ExternalLink,
  Calendar,
  Tag,
  Compass,
  User,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { getLeadDetails } from '@/app/actions/lead';
import type {
  LeadDetailsPayload,
  LeadJourneyEvent,
} from '@/types/database';
import {
  describeAttribution,
  getAttribution,
  getExternalContactData,
  getFirstTouch,
  type AttributionKind,
} from '@/lib/attribution';

interface LeadDetailDrawerProps {
  open: boolean;
  dealId?: string;
  contactId?: string;
  onClose: () => void;
}

const KIND_STYLES: Record<AttributionKind, string> = {
  paid: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900',
  organic: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  referral: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
  direct: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  form: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900',
};

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatValue(value: number | null | undefined): string {
  return `$${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
  })}`;
}

function hostname(url?: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
}

function shortId(value?: string | null): string {
  if (!value) return '—';
  return value.length > 14 ? `${value.slice(0, 10)}…` : value;
}

export function LeadDetailDrawer({
  open,
  dealId,
  contactId,
  onClose,
}: LeadDetailDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState<LeadDetailsPayload | null>(null);
  const [tab, setTab] = useState<'journey' | 'data'>('journey');

  const lookupKey = dealId || contactId || '';

  useEffect(() => {
    if (!open || !lookupKey) return;

    let cancelled = false;
    setLoading(true);
    setError('');
    setPayload(null);

    getLeadDetails({
      dealId: dealId || undefined,
      contactId: contactId || undefined,
    })
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          setError(result.error);
          return;
        }
        setPayload(result.data);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || 'Error al cargar el lead.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, lookupKey, dealId, contactId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const contact = payload?.contact;
  const deal = payload?.deal;
  const events = payload?.events || [];

  const attribution = useMemo(() => getAttribution(contact), [contact]);
  const firstTouch = useMemo(() => getFirstTouch(contact), [contact]);
  const source = useMemo(() => describeAttribution(attribution), [attribution]);
  const extraData = useMemo(() => getExternalContactData(contact), [contact]);

  const conversions = events.filter((event) => event.event_type === 'conversion').length;

  if (!open) return null;

  const displayName = contact
    ? `${contact.first_name} ${contact.last_name || ''}`.trim()
    : 'Lead';

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              {contact ? (contact.first_name[0] || 'L').toUpperCase() : <User className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {displayName}
              </h2>
              <p className="text-xs text-slate-500">
                {contact?.email || 'Cargando información…'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : error ? (
          <div className="m-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${KIND_STYLES[source.kind]}`}
                >
                  <Compass className="h-3 w-3" />
                  {source.label}
                </span>
                {attribution?.utm_campaign && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <Tag className="h-3 w-3" /> {attribution.utm_campaign}
                  </span>
                )}
                {attribution?.placement && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <Sparkles className="h-3 w-3" /> {attribution.placement}
                  </span>
                )}
              </div>

              {deal && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {deal.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatValue(deal.value)}
                    </span>
                    {deal.stage?.name && <span>Etapa: {deal.stage.name}</span>}
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {formatDateTime(deal.created_at)}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <a
                  href={`mailto:${contact?.email || ''}`}
                  className="flex items-center gap-1.5 truncate rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-800 dark:text-slate-300"
                >
                  <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{contact?.email || '—'}</span>
                </a>
                <a
                  href={contact?.phone ? `tel:${contact.phone}` : undefined}
                  className="flex items-center gap-1.5 truncate rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-800 dark:text-slate-300"
                >
                  <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{contact?.phone || 'Sin teléfono'}</span>
                </a>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200 px-5 dark:border-slate-800">
              <button
                onClick={() => setTab('journey')}
                className={`border-b-2 px-3 py-2 text-xs font-semibold transition ${
                  tab === 'journey'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Journey ({events.length})
              </button>
              <button
                onClick={() => setTab('data')}
                className={`border-b-2 px-3 py-2 text-xs font-semibold transition ${
                  tab === 'data'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Datos
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {tab === 'journey' ? (
                <JourneyTab
                  events={events}
                  conversions={conversions}
                  attribution={attribution}
                  firstTouch={firstTouch}
                />
              ) : (
                <DataTab
                  attribution={attribution}
                  firstTouch={firstTouch}
                  extraData={extraData}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function JourneyTab({
  events,
  conversions,
  attribution,
  firstTouch,
}: {
  events: LeadJourneyEvent[];
  conversions: number;
  attribution: ReturnType<typeof getAttribution>;
  firstTouch: ReturnType<typeof getFirstTouch>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Eventos" value={String(events.length)} />
        <Metric label="Conversiones" value={String(conversions)} />
        <Metric
          label="Sesiones"
          value={String(
            new Set(
              events
                .map((event) => event.metadata?.session_id)
                .filter((value): value is string => typeof value === 'string')
            ).size || 0
          )}
        />
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 px-4 py-8 text-center dark:border-slate-800">
          <Globe2 className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Sin visitas registradas todavía
          </p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-slate-400">
            Instala el píxel de SLT en el sitio del cliente para ver las páginas que vio
            antes de convertirse. La atribución del formulario ya quedó guardada.
          </p>
        </div>
      ) : (
        <ol className="relative space-y-4 border-l border-slate-200 pl-5 dark:border-slate-800">
          {events.map((event, index) => (
            <JourneyItem
              key={event.id}
              event={event}
              isFirst={index === 0}
              isLast={index === events.length - 1}
            />
          ))}
        </ol>
      )}

      {firstTouch && firstTouch !== attribution && firstTouch.page_url && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-950/50">
          <p className="font-semibold text-slate-600 dark:text-slate-300">
            Primer contacto registrado
          </p>
          <p className="mt-1 break-all">{firstTouch.page_url}</p>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function JourneyItem({
  event,
  isFirst,
  isLast,
}: {
  event: LeadJourneyEvent;
  isFirst: boolean;
  isLast: boolean;
}) {
  const isConversion = event.event_type === 'conversion';
  const host = hostname(event.url) || event.tracking_sites?.domain || '—';
  const utm =
    event.utm_source || event.utm_medium
      ? [event.utm_source, event.utm_medium].filter(Boolean).join(' · ')
      : null;
  const formName =
    event.metadata && typeof event.metadata.form_name === 'string'
      ? event.metadata.form_name
      : null;

  return (
    <li className="relative">
      <span
        className={`absolute -left-[30px] flex h-5 w-5 items-center justify-center rounded-full border-2 bg-white dark:bg-slate-900 ${
          isConversion
            ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
            : 'border-indigo-400 text-indigo-600 dark:text-indigo-400'
        }`}
      >
        {isConversion ? (
          <MousePointerClick className="h-2.5 w-2.5" />
        ) : (
          <Eye className="h-2.5 w-2.5" />
        )}
      </span>

      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
            {isConversion ? 'Conversión' : isFirst ? 'Primera visita' : isLast ? 'Última visita' : 'Visita'}
            {utm && (
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                {utm}
              </span>
            )}
          </span>
          <span className="text-[10px] text-slate-400">
            {formatDateTime(event.created_at)}
          </span>
        </div>

        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
          <Globe2 className="h-3 w-3 flex-shrink-0" />
          <span className="font-medium text-slate-600 dark:text-slate-300">{host}</span>
          {event.metadata?.session_id && (
            <span className="ml-auto font-mono text-[10px] text-slate-400">
              sesión {shortId(String(event.metadata.session_id))}
            </span>
          )}
        </div>

        {event.url && (
          <a
            href={event.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block truncate text-[11px] text-indigo-600 hover:underline dark:text-indigo-400"
            title={event.url}
          >
            {event.url}
          </a>
        )}

        {formName && (
          <p className="mt-1 text-[10px] text-slate-400">Formulario: {formName}</p>
        )}
      </div>
    </li>
  );
}

function DataTab({
  attribution,
  firstTouch,
  extraData,
}: {
  attribution: ReturnType<typeof getAttribution>;
  firstTouch: ReturnType<typeof getFirstTouch>;
  extraData: Array<[string, string]>;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Compass className="h-3.5 w-3.5" /> Origen del lead
        </h3>
        <dl className="space-y-1.5 text-[11px]">
          <Row label="Página" value={attribution?.page_url} link />
          <Row label="Referrer" value={attribution?.referrer} link />
          <Row label="Aterrizaje" value={attribution?.landing_url} link />
          <Row label="Formulario" value={attribution?.form_name} />
          <Row label="Colocación" value={attribution?.placement} />
          <Row
            label="UTM"
            value={
              attribution
                ? [
                    attribution.utm_source,
                    attribution.utm_medium,
                    attribution.utm_campaign,
                    attribution.utm_content,
                    attribution.utm_term,
                  ]
                    .filter(Boolean)
                    .join(' / ')
                : undefined
            }
          />
          <Row label="Registrado" value={formatDateTime(attribution?.captured_at)} />
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Fingerprint className="h-3.5 w-3.5" /> Identificadores
        </h3>
        <dl className="space-y-1.5 text-[11px]">
          <Row label="Visitante" value={attribution?.visitor_id} mono />
          <Row label="Fingerprint" value={attribution?.fingerprint} mono />
          {firstTouch?.visitor_id &&
            firstTouch.visitor_id !== attribution?.visitor_id && (
              <Row label="Visitante inicial" value={firstTouch.visitor_id} mono />
            )}
          {firstTouch?.fingerprint &&
            firstTouch.fingerprint !== attribution?.fingerprint && (
              <Row label="Fingerprint inicial" value={firstTouch.fingerprint} mono />
            )}
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Tag className="h-3.5 w-3.5" /> Campos del formulario
        </h3>
        {extraData.length === 0 ? (
          <p className="text-[11px] text-slate-400">Sin datos extra.</p>
        ) : (
          <dl className="space-y-1.5 text-[11px]">
            {extraData.map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <dt className="w-32 flex-shrink-0 font-mono text-indigo-600 dark:text-indigo-400">
                  {key}
                </dt>
                <dd className="break-all text-slate-600 dark:text-slate-300">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-400">
        <Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0" />
        El origen combina la página donde se envió el formulario, el referrer, los UTM y
        una huella técnica del navegador (hash, sin datos personales crudos).
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  link = false,
  mono = false,
}: {
  label: string;
  value?: string | null;
  link?: boolean;
  mono?: boolean;
}) {
  if (!value) return null;

  return (
    <div className="flex gap-2">
      <dt className="w-28 flex-shrink-0 text-slate-400">{label}</dt>
      <dd
        className={`min-w-0 flex-1 break-all text-slate-600 dark:text-slate-300 ${
          mono ? 'font-mono' : ''
        }`}
      >
        {link ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-start gap-1 text-indigo-600 hover:underline dark:text-indigo-400"
          >
            <span className="break-all">{value}</span>
            <ExternalLink className="mt-0.5 h-3 w-3 flex-shrink-0" />
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
