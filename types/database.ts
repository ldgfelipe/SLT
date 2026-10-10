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
  fields_config: any[];
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
}
