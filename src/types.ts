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
