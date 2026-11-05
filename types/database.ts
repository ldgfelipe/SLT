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
  campaign_id?: string | null;
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

/* ------------------------------------------------------------------ */
/* Growth Hub                                                          */
/* ------------------------------------------------------------------ */

export type SocialProvider =
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'linkedin'
  | 'x'
  | 'threads'
  | 'youtube';

export type PostStatus = 'draft' | 'queued' | 'publishing' | 'published' | 'failed';

/** Cuenta social sin secretos: nunca incluye tokens. */
export interface SocialAccount {
  id: string;
  client_id: string;
  provider: SocialProvider;
  account_name: string;
  page_id: string | null;
  ig_user_id: string | null;
  token_expires_at: string | null;
  status: string;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at?: string | null;
}

export interface Campaign {
  id: string;
  client_id: string;
  name: string;
  objective: string | null;
  provider: string;
  external_campaign_id: string | null;
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversions: number;
  revenue: number;
  visits: number;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  client_id: string;
  social_account_id: string | null;
  campaign_id: string | null;
  titulo: string;
  descripcion: string | null;
  imagen_url: string | null;
  plataformas: SocialProvider[] | string[];
  scheduled_at: string | null;
  status: PostStatus;
  external_post_ids: Record<string, string>;
  error_log: string | null;
  attempts: number;
  published_at: string | null;
  created_at: string;
  updated_at?: string | null;
  campaign?: Pick<Campaign, 'id' | 'name'> | null;
  social_account?: Pick<SocialAccount, 'id' | 'account_name' | 'provider'> | null;
}

export interface PublishLog {
  id: string;
  post_id: string;
  provider: string | null;
  attempt: number;
  status: string | null;
  response: Record<string, any>;
  created_at: string;
}

/** Cuenta descubierta durante el callback OAuth (ya con token cifrado). */
export interface PendingSocialAccount {
  account_name: string;
  page_id?: string | null;
  ig_user_id?: string | null;
  token_expires_at?: string | null;
  metadata?: Record<string, any>;
}

export interface PendingOAuthSession {
  id: string;
  provider: SocialProvider;
  accounts: PendingSocialAccount[];
  expires_at: string;
}
