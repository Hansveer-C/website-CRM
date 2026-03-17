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
