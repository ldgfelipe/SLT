export interface Client {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export type UserRole = 'root' | 'client_admin';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  client_id?: string | null;
  client?: Client | null;
  created_at: string;
}

export interface Contact {
  id: string;
  client_id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  data?: Record<string, any>;
  created_at?: string;
}

export interface Deal {
  id: string;
  client_id: string;
  title: string;
  value: number;
  stage_id: string;
  contact_id: string | null;
  status: 'open' | 'won' | 'lost';
  created_at: string;
  contact?: Contact | null;
  stage?: { id: string; name: string } | null;
}

export interface Stage {
  id: string;
  pipeline_id: string;
  name: string;
  order: number;
  deals: Deal[];
}

export interface Pipeline {
  id: string;
  client_id: string;
  name: string;
  created_at: string;
  stages?: Stage[];
}

export interface Form {
  id: string;
  client_id: string;
  pipeline_id: string;
  stage_id: string;
  name: string;
  fields_config: import('./forms').FormConfig | import('./forms').FormField[];
  created_at: string;
}

export interface TrackingSite {
  id: string;
  client_id: string;
  domain: string;
  created_at: string;
}

export interface TrackingEvent {
  id: string;
  tracking_site_id: string;
  visitor_id: string;
  contact_id: string | null;
  event_type: 'pageview' | 'conversion';
  url: string;
  created_at: string;
  referrer?: string | null;
  landing_url?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  fingerprint?: string | null;
  metadata?: Record<string, any> | null;
  site?: { domain: string } | null;
  tracking_sites?: { domain: string } | null;
}

/** Origen de un lead, guardado en `contacts.data._attribution`. */
export interface LeadAttribution {
  form_id?: string;
  form_name?: string;
  page_url?: string;
  page_title?: string;
  referrer?: string;
  landing_url?: string;
  /** Etiqueta opcional de la ubicación del formulario (data-source / placement). */
  placement?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  visitor_id?: string;
  fingerprint?: string;
  captured_at?: string;
}

export interface LeadJourneyEvent {
  id: string;
  tracking_site_id: string;
  visitor_id: string;
  contact_id: string | null;
  event_type: 'pageview' | 'conversion';
  url: string;
  created_at: string;
  referrer?: string | null;
  landing_url?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  fingerprint?: string | null;
  metadata?: Record<string, any> | null;
  tracking_sites?: { domain: string } | null;
}

export interface LeadDetailsPayload {
  contact: Contact;
  deal: Deal | null;
  events: LeadJourneyEvent[];
}
