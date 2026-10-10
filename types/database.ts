export interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  created_at?: string;
}

export interface Deal {
  id: string;
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
  name: string;
  created_at: string;
}

export interface TrackingSite {
  id: string;
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
