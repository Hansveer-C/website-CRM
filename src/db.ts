import { Contact, Opportunity, Activity, Pipeline } from './types';

export const mockContacts: Contact[] = [
  {
    id: 'c1',
    name: 'John Doe',
    phone: '555-0101',
    email: 'john@example.com',
    address: '123 Pine St, Seattle, WA',
    tags: ['residential', 'referral'],
    source: 'Google Search',
    status: 'customer',
    created_at: '2026-02-15T10:00:00Z',
  },
  {
    id: 'c2',
    name: 'Jane Smith',
    phone: '555-0202',
    email: 'jane@smithresidence.com',
    address: '456 Oak Ave, Portland, OR',
    tags: ['lead', 'driveway'],
    source: 'Facebook Ad',
    status: 'lead',
    created_at: '2026-03-01T14:30:00Z',
  },
];

export const mockPipelines: Pipeline[] = [
  {
    id: 'p1',
    name: 'Residential Cleaning Pipeline',
    stages: ['New Lead', 'Quote Sent', 'Scheduled', 'Completed', 'Paid'],
  },
];

export const mockOpportunities: Opportunity[] = [
  {
    id: 'o1',
    contact_id: 'c2',
    pipeline_stage: 'New Lead',
    value: 250,
    assigned_to: 'Hansveer',
    status: 'open',
    created_at: '2026-03-01T14:35:00Z',
  },
  {
    id: 'o2',
    contact_id: 'c1',
    pipeline_stage: 'Completed',
    value: 450,
    assigned_to: 'Hansveer',
    status: 'won',
    created_at: '2026-02-15T10:05:00Z',
  },
];

export const mockActivities: Activity[] = [
  {
    id: 'a1',
    contact_id: 'c2',
    type: 'call',
    description: 'Initial follow-up call about driveway cleaning',
    due_date: '2026-03-02T09:00:00Z',
    completed: true,
  },
  {
    id: 'a2',
    contact_id: 'c2',
    type: 'sms',
    description: 'Sent quote via text',
    due_date: '2026-03-05T10:00:00Z',
    completed: false,
  },
];
