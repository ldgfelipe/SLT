/**
 * Plantilla de variables del correo:
 *   {{nombre}}        → solo nombre (o nombre + apellido si falta nombre)
 *   {{nombre_completo}} → "Nombre Apellido"
 *   {{email}}         → correo
 *   {{empresa}}       → Empresa (data.empresa / data.company / data.organization)
 *   {{giro}}          → Giro (data.giro / data.industry)
 *   {{cargo}}         → Cargo (data.cargo / data.role / data.position)
 *   {{telefono}}      → Teléfono
 *   {{sitio_web}}     → Sitio web (data.sitio_web / data.website)
 *   {{empleados}}     → # empleados (data.empleados / data.num_empleados / data. employees)
 *   {{camara}}        → Cámara (data.camara)
 *   {{region}}        → Región (data.region / data.estado / data.state)
 *   {{fuente}}        → Fuente (data.fuente / data.source)
 */

export interface ContactForVars {
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  data?: Record<string, unknown> | null;
}

function pickData(source: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!source) return '';
  for (const key of keys) {
    const value = source[key];
    if (value != null && value !== '') return String(value);
  }
  // Búsqueda insensible a mayúsculas/guiones/underscores
  const normalized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(source)) {
    normalized[k.toLowerCase().replace(/[-_\s]+/g, '')] = v;
  }
  for (const key of keys) {
    const match = normalized[key.toLowerCase().replace(/[-_\s]+/g, '')];
    if (match != null && match !== '') return String(match);
  }
  return '';
}

export function renderTemplate(
  template: string,
  contact: ContactForVars | null | undefined
): string {
  if (!template) return '';

  const firstName = contact?.first_name?.trim() || '';
  const lastName = (contact?.last_name || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const data = (contact?.data as Record<string, unknown> | null | undefined) || {};

  const vars: Record<string, string> = {
    nombre: firstName || lastName || '',
    nombre_completo: fullName,
    email: contact?.email || '',
    telefono: contact?.phone || '',
    empresa: pickData(data, ['empresa', 'company', 'organization', 'company_name']),
    giro: pickData(data, ['giro', 'industry', 'sector']),
    cargo: pickData(data, ['cargo', 'position', 'role']),
    sitio_web: pickData(data, ['sitio_web', 'website', 'url']),
    empleados: pickData(data, ['empleados', 'num_empleados', 'employees', 'size']),
    camara: pickData(data, ['camara', 'chamber']),
    region: pickData(data, ['region', 'estado', 'state']),
    fuente: pickData(data, ['fuente', 'source', 'origin']),
  };

  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => {
    const value = vars[key.toLowerCase()];
    return value ?? '';
  });
}
