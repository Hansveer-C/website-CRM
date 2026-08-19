export type ContactStatus = 'lead' | 'customer' | 'lost';
export type OpportunityStatus = 'open' | 'won' | 'lost';
export type ActivityType = 'call' | 'note' | 'sms' | 'visit';

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
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
  user_id: string;
  contact_id: string;
  pipeline_stage: string;
  value: number;
  assigned_to?: string;
  status: OpportunityStatus;
  notes?: string;
  source?: string;
  funnel_id?: string;
  page_slug?: string;
  service?: string;
  city?: string;
  created_at: string;
}

export interface Activity {
  id: string;
  user_id: string; // Ownership
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
export type ActionType = 'CREATE_TASK' | 'SEND_NOTIFICATION' | 'SEND_AUTO_REPLY';

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
  user_id: string;
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
  user_id: string;
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
  user_id: string;
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
  user_id: string;
  name: string;
  slug: string; // unique
  status: PageStatus;
  seo_title: string;
  seo_description: string;
  seo_keywords: string[];
  schema_markup?: string; // JSON-LD
  created_at: string;
  funnel_id?: string;
  step_type?: string;
  step_order?: number;
}

export type FunnelStatus = 'draft' | 'published';

export interface Funnel {
  id: string;
  user_id: string;
  name: string;
  status: FunnelStatus;
  created_at: string;
  updated_at: string;
  service_type?: string;
  city?: string;
}

export type FunnelTemplateCategory = 'pressure_washing' | 'general_service';
export type FunnelTemplateServiceType = 'driveway' | 'house_wash' | 'generic';
export type TemplateStepType = 'landing' | 'form' | 'thank_you';

export interface TemplateStep {
  id: string;
  template_id: string;
  type: TemplateStepType;
  order: number;
  template_content: Record<string, any>;
}

export interface FunnelTemplate {
  id: string;
  name: string;
  category: FunnelTemplateCategory;
  service_type: FunnelTemplateServiceType;
  city_placeholder_enabled: boolean;
  created_at: string;
  steps?: TemplateStep[]; // eagerly loaded by getTemplateById
}

export interface PageSection {
  id: string;
  page_id: string; // foreign key to Page.id
  funnel_id?: string; // optional funnel scope
  type: string; // hero, text, image, form, gallery, etc.
  content: any; // JSON
  order: number;
  styles: any; // JSON
  variant?: string; // variant switcher (A/B/C)
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

export interface WebsiteBuildBrief {
  business_type: 'residential' | 'soft_washing' | 'commercial' | 'mixed';
  services_offered: string[];
  cities_served: string[];
  tone: 'professional' | 'friendly' | 'bold' | 'modern';
  main_offer: string;
  focus_mode: 'residential' | 'soft_washing' | 'commercial' | 'mixed';
  generate_service_pages: boolean;
  generate_city_pages: boolean;
  generate_service_city_pages: boolean;
}

export interface PromptPageBrief {
  prompt: string;
  page_type: 'service_page' | 'city_page' | 'service_city_page' | 'section';
  target_service?: string;
  target_city?: string;
  tone?: 'professional' | 'friendly' | 'bold' | 'modern';
  main_offer?: string;
  suggested_sections?: string[];
}

export interface GalleryItem {
  id: string;
  user_id: string;
  before_image_url: string;
  after_image_url: string;
  title?: string;
  service_type?: string;
  city?: string;
  description?: string;
  sort_order?: number;
  is_featured?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  user_id: string;
  name: string;
  rating: number; // 1-5
  text: string;
  location?: string;
  created_at: string;
}

export interface WebsiteSettings {
  id: string;
  user_id?: string;
  website_id?: string;
  business_name: string;
  phone: string;
  /** Separate SMS/text number. If absent, SMS CTAs fall back to phone. */
  sms_number?: string;
  email: string;
  logo_url: string;
  primary_color: string;
  facebook_pixel_id?: string;
  gtm_id?: string;
  ga4_measurement_id?: string;
  auto_lead_sms_enabled: boolean;
  auto_lead_sms_template: string;
  missed_call_sms_enabled: boolean;
  missed_call_sms_template: string;
  created_at: string;
  // Extended fields used by website generator & mock data
  cities_served?: string[];
  services_offered?: string[];
  publish_status?: 'draft' | 'published' | 'unpublished';
  website_preset?: string;
  google_business_link?: string;
  google_rating?: number;
  google_reviews_count?: number;
  /** Guided builder brief — created during website generation */
  build_brief?: WebsiteBuildBrief;
}

export interface Website {
  id: string;
  user_id: string;
  name: string;
  domain: string | null;
  subdomain: string;
  homepage_funnel_id: string | null;
  draft_homepage_funnel_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebsiteRoute {
  id: string;
  website_id: string;
  path: string;
  slug?: string;
  funnel_id: string;
  is_seo_page?: boolean;
  city?: string;
  service?: string;
  created_at: string;
}

export interface NavItem {
  label: string;
  path: string;
  visible?: boolean;
  children?: NavItem[];
}

export interface HeaderConfig {
  logo_text: string;
  logo_url?: string;
  nav_items: NavItem[];
  cta_text?: string;
  cta_link?: string;
}

export interface WebsiteLayout {
  id: string;
  website_id: string;
  header_config: HeaderConfig;
  footer_config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface EventLog {
  id: string;
  user_id: string;
  event_name: string;
  payload: Record<string, any>;
  status: string;
  created_at: string;
  contact_id?: string;
}

export type MessageDirection = 'outbound' | 'inbound';
export type MessageStatus = 'pending' | 'sent' | 'failed';

export interface Message {
  id: string;
  user_id: string;
  contact_id: string;
  opportunity_id?: string;
  direction: MessageDirection;
  type: 'sms';
  content: string;
  status: MessageStatus;
  provider_message_id?: string;
  retryable?: boolean;
  source?: string; // e.g. 'automation'
  trigger_event_id?: string; // link to event_logs
  created_at: string;
}

export interface TimelineItem {
  type: 'form_submission' | 'message' | 'event' | 'call_missed';
  reference_id: string;
  contact_id: string;
  content: string;
  created_at: string;
  metadata?: Record<string, any>;
  is_latest?: boolean;
}

export interface Call {
  id: string;
  user_id: string;
  phone: string;
  direction: 'inbound' | 'outbound';
  status: 'received' | 'answered' | 'missed' | 'failed' | 'ended';
  duration?: number;
  contact_id?: string;
  opportunity_id?: string;
  recording_url?: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface ApiRequest {
  method?: string;
  url?: string;
  cookies?: Record<string, string>;
  user?: User | null;
  body?: any;
}

export interface RepoResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  source?: 'database' | 'sms';
}
