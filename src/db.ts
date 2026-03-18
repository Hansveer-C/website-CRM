import { Contact, Opportunity, Activity, Pipeline, Quote, QuoteItem, Invoice, Page, PageSection, Component } from './types';

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

export const mockQuotes: Quote[] = [
  {
    id: 'q1',
    contact_id: 'c2',
    opportunity_id: 'o1',
    status: 'sent',
    total_amount: 250,
    notes: 'Standard driveway cleaning quote',
    created_at: '2026-03-02T10:00:00Z',
  },
];

export const mockQuoteItems: QuoteItem[] = [
  {
    id: 'qi1',
    quote_id: 'q1',
    service_name: 'Driveway Cleaning',
    description: 'High pressure wash for standard 2-car driveway',
    quantity: 1,
    unit_price: 250,
    total: 250,
  },
];

export const mockInvoices: Invoice[] = [
  {
    id: 'i1',
    contact_id: 'c2',
    quote_id: 'q1',
    status: 'unpaid',
    amount: 250,
    due_date: '2026-03-24T12:00:00Z',
    created_at: '2026-03-17T15:00:00Z',
  },
];

export const mockPages: Page[] = [
  {
    id: 'p1',
    name: 'Home',
    slug: 'home',
    status: 'published',
    seo_title: 'PressurePro - Professional Pressure Washing Services',
    seo_description: 'High-quality pressure washing for residential and commercial properties.',
    seo_keywords: ['pressure washing', 'exterior cleaning', 'roof cleaning'],
    created_at: '2026-01-01T09:00:00Z',
  },
  {
    id: 'p2',
    name: 'About Us',
    slug: 'about',
    status: 'draft',
    seo_title: 'About PressurePro | Our Story',
    seo_description: 'Learn more about PressurePro and our commitment to excellence.',
    seo_keywords: ['about us', 'quality service', 'professional cleaners'],
    created_at: '2026-01-05T10:00:00Z',
  }
];

export const mockPageSections: PageSection[] = [
  {
    id: 'ps1',
    page_id: 'p1',
    type: 'hero',
    content: { title: 'Welcome to PressurePro', subtitle: 'Leading pressure washing experts in the Pacific Northwest.' },
    order: 1,
    styles: { backgroundColor: '#007bff', textColor: '#ffffff' }
  },
  {
    id: 'ps2',
    page_id: 'p1',
    type: 'text',
    content: { text: 'We offer professional cleaning for your driveway, roof, and more.' },
    order: 2,
    styles: { padding: '40px' }
  },
  {
    id: 'ps3',
    page_id: 'p2',
    type: 'hero',
    content: { title: 'About Us', subtitle: 'Founded in 2026 with a mission to clean up the world.' },
    order: 1,
    styles: { backgroundColor: '#333' }
  }
];

export const mockComponents: Component[] = [
  {
    id: 'comp1',
    name: 'Standard Hero',
    type: 'hero',
    default_content: { title: 'New Hero', subtitle: 'Hero Subtitle' },
    default_styles: { padding: '60px', textAlign: 'center' }
  },
  {
    id: 'comp2',
    name: 'Rich Text Block',
    type: 'text',
    default_content: { text: 'Lorem ipsum...' },
    default_styles: { fontSize: '16px', lineHeight: '1.5' }
  },
  {
    id: 'comp3',
    name: 'Contact Form',
    type: 'form',
    default_content: { fields: ['name', 'email', 'message'] },
    default_styles: { border: '1px solid #ccc' }
  }
];
