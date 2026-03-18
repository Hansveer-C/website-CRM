export type ContactStatus = 'lead' | 'customer' | 'lost';
export type OpportunityStatus = 'open' | 'won' | 'lost';
export type ActivityType = 'call' | 'note' | 'sms' | 'visit';

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  tags: string[];
  source: string;
  service?: string;
  status: ContactStatus;
  notes?: string;
  created_at: string;
}

export interface Opportunity {
  id: string;
  contact_id: string;
  pipeline_stage: string;
  value: number;
  assigned_to: string;
  status: OpportunityStatus;
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
