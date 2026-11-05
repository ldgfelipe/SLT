'use client';

import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Plus,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { PostComposerDialog } from './PostComposerDialog';
import { PostDetailDialog } from './PostDetailDialog';
import { StatusBadge } from './StatusBadge';
import { ProviderIcon } from './ProviderIcon';
import { seedDemoCalendar } from '@/app/actions/growth';
import { setActiveClient } from '@/app/actions/clients';
import { PROVIDERS, SOCIAL_PROVIDERS } from '@/lib/growth/providers';
import type {
  Client,
  Post,
  PostStatus,
  SocialAccount,
  SocialProvider,
} from '@/types/database';

interface PublisherCalendarProps {
  clientId: string;
  clients: Client[];
  isRoot: boolean;
  initialPosts: Post[];
  accounts: SocialAccount[];
}

const TZ = 'America/Mexico_City';
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const STATUS_DOT: Record<PostStatus, string> = {
  draft: 'bg-slate-400',
  queued: 'bg-[#00d4ff]',
  publishing: 'bg-amber-400',
  published: 'bg-emerald-400',
  failed: 'bg-rose-400',
};

const STATUS_OPTIONS: Array<{ value: '' | PostStatus; label: string }> = [
  { value: '', label: 'Todos los estados' },
  { value: 'draft', label: 'Borradores' },
  { value: 'queued', label: 'Programados' },
  { value: 'publishing', label: 'Publicando' },
  { value: 'published', label: 'Publicados' },
  { value: 'failed', label: 'Fallidos' },
];

function tzParts(iso: string) {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || '';

  const hour = get('hour') === '24' ? '00' : get('hour');

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: hour.padStart(2, '0'),
    minute: get('minute').padStart(2, '0'),
  };
}

function dateKeyInTz(iso: string): string {
  const parts = tzParts(iso);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(
    parts.day
  ).padStart(2, '0')}`;
}

function timeInTz(iso: string): string {
  const parts = tzParts(iso);
  return `${parts.hour}:${parts.minute}`;
}

function mexicoCityToISO(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): string {
  // México abolió el horario de verano: UTC-6 todo el año.
  return new Date(
    Date.UTC(year, month - 1, day, hour + 6, minute)
  ).toISOString();
}

function monthGrid(cursor: Date) {
  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, month, 1 - offset));

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getTime() + index * 86400000);
    return {
      key: date.toISOString().slice(0, 10),
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === month,
      date,
    };
  });
}

function monthLabel(cursor: Date): string {
  const label = new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(cursor);

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function PublisherCalendar({
  clientId,
  clients,
  isRoot,
  initialPosts,
  accounts,
}: PublisherCalendarProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [cursor, setCursor] = useState<Date>(() => {
    const now = tzParts(new Date().toISOString());
    const currentMonth = `${now.year}-${String(now.month).padStart(2, '0')}`;

    // Si hay publicaciones este mes, abrimos el mes actual. Si no, el mes
    // de la primera publicación programada.
    const hasCurrentMonth = initialPosts.some(
      (post) =>
        post.scheduled_at &&
        dateKeyInTz(post.scheduled_at).startsWith(currentMonth)
    );

    if (hasCurrentMonth || initialPosts.length === 0) {
      return new Date(Date.UTC(now.year, now.month - 1, 1));
    }

    const first = initialPosts.find((post) => post.scheduled_at);
    if (first?.scheduled_at) {
      const parts = tzParts(first.scheduled_at);
      return new Date(Date.UTC(parts.year, parts.month - 1, 1));
    }

    return new Date(Date.UTC(now.year, now.month - 1, 1));
  });
  const [providerFilter, setProviderFilter] = useState<'' | SocialProvider>('');
  const [statusFilter, setStatusFilter] = useState<'' | PostStatus>('');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (statusFilter && post.status !== statusFilter) return false;
      if (
        providerFilter &&
        !(post.plataformas || []).includes(providerFilter)
      ) {
        return false;
      }
      return true;
    });
  }, [posts, providerFilter, statusFilter]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of filteredPosts) {
      if (!post.scheduled_at) continue;
      const key = dateKeyInTz(post.scheduled_at);
      const list = map.get(key) || [];
      list.push(post);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(a.scheduled_at || 0).getTime() -
          new Date(b.scheduled_at || 0).getTime()
      );
    }
    return map;
  }, [filteredPosts]);

  const unscheduled = filteredPosts.filter((post) => !post.scheduled_at);
  const cells = useMemo(() => monthGrid(cursor), [cursor]);
  const todayKey = dateKeyInTz(new Date().toISOString());

  const metrics = useMemo(() => {
    return {
      total: posts.length,
      queued: posts.filter((post) => post.status === 'queued').length,
      published: posts.filter((post) => post.status === 'published').length,
      failed: posts.filter((post) => post.status === 'failed').length,
    };
  }, [posts]);

  const handleClientChange = (value: string) => {
    startTransition(async () => {
      await setActiveClient(value);
      router.refresh();
    });
  };

  const handleSeed = async () => {
    setSeeding(true);
    setError('');

    const result = await seedDemoCalendar(clientId);
    if (!result.success) {
      setError(result.error || 'No se pudo cargar el calendario.');
    } else {
      router.refresh();
    }

    setSeeding(false);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const overId = event.over?.id ? String(event.over.id) : '';
    if (!overId.startsWith('day|')) return;

    const post = posts.find((item) => item.id === event.active.id);
    if (!post?.scheduled_at) return;

    const newKey = overId.slice(4);
    if (dateKeyInTz(post.scheduled_at) === newKey) return;

    const [year, month, day] = newKey.split('-').map(Number);
    const [hour, minute] = timeInTz(post.scheduled_at)
      .split(':')
      .map(Number);

    const newIso = mexicoCityToISO(year, month, day, hour, minute);
    const previous = posts;

    setPosts((current) =>
      current.map((item) =>
        item.id === post.id ? { ...item, scheduled_at: newIso } : item
      )
    );

    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_at: newIso }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo reprogramar.');
      }
      router.refresh();
    } catch (dragError: any) {
      setPosts(previous);
      setError(dragError?.message || 'No se pudo reprogramar.');
    }
  };

  const openComposer = () => {
    setEditingPost(null);
    setComposerOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Calendario Publicador
            </h1>
            <span className="rounded-full border border-[#00d4ff]/30 bg-[#00d4ff]/10 px-2.5 py-1 text-[11px] font-semibold text-[#00d4ff]">
              {metrics.total} publicaciones
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Arrastra una publicación para reprogramarla. Las publicaciones
            encoladas se envían solas a la hora programada (America/Mexico_City).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isRoot && clients.length > 1 && (
            <select
              value={clientId}
              onChange={(event) => handleClientChange(event.target.value)}
              className="rounded-lg border border-white/10 bg-[#0c1f3d] px-3 py-2 text-xs text-white outline-none focus:border-[#00d4ff]"
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={providerFilter}
            onChange={(event) =>
              setProviderFilter(event.target.value as '' | SocialProvider)
            }
            className="rounded-lg border border-white/10 bg-[#0c1f3d] px-3 py-2 text-xs text-white outline-none focus:border-[#00d4ff]"
          >
            <option value="">Todas las redes</option>
            {SOCIAL_PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>
                {PROVIDERS[provider].label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as '' | PostStatus)
            }
            className="rounded-lg border border-white/10 bg-[#0c1f3d] px-3 py-2 text-xs text-white outline-none focus:border-[#00d4ff]"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            onClick={openComposer}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#00d4ff] px-3 py-2 text-xs font-semibold text-[#06152b] transition hover:bg-cyan-300"
          >
            <Plus className="h-3.5 w-3.5" /> Nueva publicación
          </button>

          {posts.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#00d4ff]/40 bg-[#00d4ff]/10 px-3 py-2 text-xs font-semibold text-[#00d4ff] transition hover:bg-[#00d4ff]/20 disabled:opacity-60"
            >
              {seeding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              Cargar calendario demo
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Total" value={metrics.total} accent="text-white" />
        <Metric label="Programadas" value={metrics.queued} accent="text-[#00d4ff]" />
        <Metric label="Publicadas" value={metrics.published} accent="text-emerald-300" />
        <Metric label="Fallidas" value={metrics.failed} accent="text-rose-300" />
      </div>

      {/* Calendar */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1f3d]/50">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#00d4ff]" />
            <h2 className="text-sm font-semibold text-white">
              {monthLabel(cursor)}
            </h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                setCursor(
                  new Date(
                    Date.UTC(
                      cursor.getUTCFullYear(),
                      cursor.getUTCMonth() - 1,
                      1
                    )
                  )
                )
              }
              className="rounded-lg border border-white/10 p-1.5 text-slate-400 transition hover:border-white/25 hover:text-white"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                const now = tzParts(new Date().toISOString());
                setCursor(new Date(Date.UTC(now.year, now.month - 1, 1)));
              }}
              className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-white/25 hover:text-white"
            >
              Hoy
            </button>
            <button
              onClick={() =>
                setCursor(
                  new Date(
                    Date.UTC(
                      cursor.getUTCFullYear(),
                      cursor.getUTCMonth() + 1,
                      1
                    )
                  )
                )
              }
              className="rounded-lg border border-white/10 p-1.5 text-slate-400 transition hover:border-white/25 hover:text-white"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.02]">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {cells.map((cell) => (
                  <DayCell
                    key={cell.key}
                    cell={cell}
                    posts={postsByDay.get(cell.key) || []}
                    isToday={cell.key === todayKey}
                    onOpen={setSelectedPost}
                  />
                ))}
              </div>
            </div>
          </div>
        </DndContext>
      </div>

      {unscheduled.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#0c1f3d]/50 p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Filter className="h-3.5 w-3.5" /> Sin programar
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unscheduled.map((post) => (
              <button
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className="rounded-xl border border-white/10 bg-[#0a1931] p-3 text-left transition hover:border-[#00d4ff]/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={post.status} />
                  <div className="flex gap-1">
                    {(post.plataformas as SocialProvider[]).map((provider) => (
                      <ProviderIcon
                        key={provider}
                        provider={provider}
                        className="h-3 w-3"
                      />
                    ))}
                  </div>
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs font-medium text-white">
                  {post.titulo}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      <PostComposerDialog
        open={composerOpen}
        clientId={clientId}
        accounts={accounts}
        post={editingPost}
        onClose={() => {
          setComposerOpen(false);
          setEditingPost(null);
        }}
        onSaved={() => router.refresh()}
      />

      <PostDetailDialog
        open={Boolean(selectedPost)}
        post={selectedPost}
        accounts={accounts}
        onClose={() => setSelectedPost(null)}
        onEdit={(post) => {
          setEditingPost(post);
          setSelectedPost(null);
          setComposerOpen(true);
        }}
        onChanged={() => router.refresh()}
      />

      <p className="flex items-center gap-1.5 text-[10px] text-slate-500">
        <Sparkles className="h-3 w-3" />
        Las fechas se muestran en America/Mexico_City (UTC-6). Arrastrar cambia
        el día pero conserva la hora original.
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0c1f3d] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className={`mt-0.5 text-xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function DayCell({
  cell,
  posts,
  isToday,
  onOpen,
}: {
  cell: { key: string; day: number; inMonth: boolean };
  posts: Post[];
  isToday: boolean;
  onOpen: (post: Post) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day|${cell.key}` });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[124px] border-b border-r border-white/5 p-1.5 transition ${
        cell.inMonth ? 'bg-transparent' : 'bg-black/10'
      } ${isOver ? 'bg-[#00d4ff]/10 ring-2 ring-inset ring-[#00d4ff]/50' : ''}`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
            isToday
              ? 'bg-[#00d4ff] text-[#06152b]'
              : cell.inMonth
                ? 'text-slate-300'
                : 'text-slate-600'
          }`}
        >
          {cell.day}
        </span>
        {posts.length > 0 && (
          <span className="text-[9px] text-slate-500">{posts.length}</span>
        )}
      </div>

      <div className="space-y-1">
        {posts.map((post) => (
          <CalendarPost key={post.id} post={post} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function CalendarPost({
  post,
  onOpen,
}: {
  post: Post;
  onOpen: (post: Post) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: post.id });
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const platforms = (post.plataformas || []) as SocialProvider[];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onPointerDownCapture={(event) => {
        pointerStart.current = { x: event.clientX, y: event.clientY };
      }}
      onClick={(event) => {
        const start = pointerStart.current;
        if (start) {
          const distance = Math.hypot(
            event.clientX - start.x,
            event.clientY - start.y
          );
          if (distance > 6) return;
        }
        onOpen(post);
      }}
      className={`cursor-grab rounded-lg border border-white/10 bg-[#0a1931] px-1.5 py-1 transition hover:border-[#00d4ff]/40 active:cursor-grabbing ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] font-medium text-slate-400">
          {post.scheduled_at ? timeInTz(post.scheduled_at) : '—'}
        </span>
        <span
          className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[post.status]}`}
        />
      </div>
      <p className="line-clamp-2 text-[10px] font-medium leading-tight text-slate-100">
        {post.titulo}
      </p>
      {platforms.length > 0 && (
        <div className="mt-0.5 flex gap-0.5">
          {platforms.slice(0, 4).map((provider) => (
            <ProviderIcon
              key={provider}
              provider={provider}
              className="h-2.5 w-2.5"
            />
          ))}
        </div>
      )}
    </div>
  );
}
