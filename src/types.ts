export type ContactStatus = 'lead' | 'customer' | 'lost';
export type OpportunityStatus = 'open' | 'won' | 'lost';
export type ActivityType = 'call' | 'note' | 'sms' | 'visit';

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string;
  tags: string[];
  source: string;
  service?: string;
  status: ContactStatus;
  notes?: string;
  created_at: string;
  invalid_phone?: boolean;
  lead_status?: string;
  follow_up_required?: boolean;
}

export interface Opportunity {
  id: string;
  contact_id: string;
  pipeline_stage: string;
  value: number;
  assigned_to: string;
  status: OpportunityStatus;
  notes?: string;
  source?: string;
  created_at: string;
}

export interface Activity {
  id: string;
  contact_id: string;
  type: ActivityType;
  description: string;
  due_date: string;
  completed: boolean;
}

export interface Pipeline {
  id: string;
  name: string;
  stages: string[];
}

export type TriggerType = 'OPPORTUNITY_CREATED' | 'OPPORTUNITY_STAGE_UPDATED';
export type ActionType = 'CREATE_TASK' | 'SEND_NOTIFICATION';

export interface Automation {
  id: string;
  name: string;
  trigger: TriggerType;
  condition?: (context: any) => boolean;
  action: ActionType;
  actionParams: any;
}

export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected';

export interface Quote {
  id: string;
  contact_id: string;
  opportunity_id: string;
  status: QuoteStatus;
  total_amount: number;
  selected_tier?: 'basic' | 'standard' | 'premium';
  notes: string;
  created_at: string;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  service_name: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  tier?: 'basic' | 'standard' | 'premium';
}

export type InvoiceStatus = 'unpaid' | 'paid' | 'overdue';

export interface Invoice {
  id: string;
  contact_id: string;
  quote_id: string;
  amount: number;
  status: InvoiceStatus;
  due_date: string;
  created_at: string;
}

export type PageStatus = 'draft' | 'published';

export interface Page {
  id: string;
  name: string;
  slug: string; // unique
  status: PageStatus;
  seo_title: string;
  seo_description: string;
  seo_keywords: string[];
  created_at: string;
}

export interface PageSection {
  id: string;
  page_id: string; // foreign key to Page.id
  type: string; // hero, text, image, form, gallery, etc.
  content: any; // JSON
  order: number;
  styles: any; // JSON
}

export interface Component {
  id: string;
  name: string;
  type: string;
  default_content: any; // JSON
  default_styles: any; // JSON
}

export interface Asset {
  id: string;
  url: string;
  name: string;
  type: 'image' | 'video';
  tags: string[];
}

export interface Template {
  id: string;
  name: string;
  category: string;
  sections: {
    type: string;
    content: any;
    styles?: any;
    order: number;
  }[];
  created_at: string;
}

export interface WebsiteSettings {
  id: string;
  business_name: string;
  phone: string;
  email: string;
  logo_url: string;
  primary_color: string;
  facebook_pixel_id?: string;
  gtm_id?: string;
  auto_lead_sms_enabled: boolean;
  auto_lead_sms_template: string;
  created_at: string;
}

export interface EventLog {
  id: string;
  event_name: string;
  payload: Record<string, any>;
  status: string;
  created_at: string;
}

export type MessageDirection = 'outbound' | 'inbound';
export type MessageStatus = 'pending' | 'sent' | 'failed';

export interface Message {
  id: string;
  contact_id: string;
  opportunity_id?: string;
  direction: MessageDirection;
  type: 'sms';
  content: string;
  status: MessageStatus;
  provider_message_id?: string;
  retryable?: boolean;
  source?: string; // e.g. 'automation'
  created_at: string;
}

export interface TimelineItem {
  type: 'form_submission' | 'message' | 'event';
  reference_id: string;
  contact_id: string;
  content: string;
  created_at: string;
  metadata?: Record<string, any>;
  is_latest?: boolean;
}

export interface Call {
  id: string;
  phone: string;
  status: 'received' | 'answered' | 'missed' | 'ended';
  contact_id?: string;
  opportunity_id?: string;
  created_at: string;
}
