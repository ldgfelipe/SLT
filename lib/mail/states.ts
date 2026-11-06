/**
 * Estados por defecto de listas de correo y mapeo color → clases Tailwind.
 */

export const DEFAULT_MAIL_STATES = [
  { estado: 'activo',        etiqueta: 'Activo',        color: 'green',  orden: 1 },
  { estado: 'suscrito',      etiqueta: 'Suscrito',      color: 'blue',   orden: 2 },
  { estado: 'pausado',       etiqueta: 'Pausado',       color: 'yellow', orden: 3 },
  { estado: 'no_interesado', etiqueta: 'No interesado', color: 'gray',   orden: 4 },
  { estado: 'no_suscrito',   etiqueta: 'No suscrito',   color: 'gray',   orden: 5 },
  { estado: 'rebotado',      etiqueta: 'Rebotado',      color: 'red',    orden: 6 },
  { estado: 'bloqueado',     etiqueta: 'Bloqueado',     color: 'red',    orden: 7 },
];

export const MAIL_COLOR_TO_BG: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  blue: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
  yellow: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  gray: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  red: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
  purple: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900',
};

export function mailBadgeClass(color?: string): string {
  return (color && MAIL_COLOR_TO_BG[color]) || MAIL_COLOR_TO_BG.gray;
}

export function stateLabel(
  states: Array<{ estado: string; etiqueta: string }>,
  estado: string
): string {
  return states.find((s) => s.estado === estado)?.etiqueta || estado;
}
