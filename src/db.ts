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
    status: 'published',
    seo_title: 'About HansSays | Our Mission',
    seo_description: 'Professional exterior cleaning services you can trust.',
    seo_keywords: ['about us', 'quality service', 'professional cleaners'],
    created_at: '2026-01-05T10:00:00Z',
  },
  {
    id: 'p3',
    name: 'Driveway Cleaning',
    slug: 'driveway-cleaning',
    status: 'published',
    seo_title: 'Driveway Cleaning Services | Professional Pressure Washing',
    seo_description: 'Transform your driveway with our professional pressure washing services.',
    seo_keywords: ['driveway cleaning', 'concrete washing', 'restore driveway'],
    created_at: '2026-03-10T09:00:00Z',
  },
  {
    id: 'p4',
    name: 'Patio Cleaning',
    slug: 'patio-cleaning',
    status: 'published',
    seo_title: 'Patio Cleaning & Restoration | Garden Services',
    seo_description: 'Get your patio ready for summer with our high-pressure cleaning solutions.',
    seo_keywords: ['patio cleaning', 'stone washing', 'patio restoration'],
    created_at: '2026-03-12T09:00:00Z',
  }
];

export const mockPageSections: PageSection[] = [
  {
    id: 'ps1',
    page_id: 'p1',
    type: 'hero',
    content: { heading: 'Welcome to HansSays', subheading: 'Leading pressure washing experts in the region.' },
    order: 1,
    styles: { background: '#007bff' }
  },
  {
    id: 'ps-d1',
    page_id: 'p3',
    type: 'hero',
    content: { 
        heading: 'Pristine Driveways, Every Time.',
        subheading: 'We remove years of stains, oil, and moss with ease.',
        button_text: 'Get an Instant Quote',
        background_image: 'https://images.unsplash.com/photo-1541604193435-22077a288934?auto=format&fit=crop&w=1200'
    },
    order: 1,
    styles: { text_alignment: 'center' }
  },
  {
    id: 'ps-p1',
    page_id: 'p4',
    type: 'hero',
    content: { 
        heading: 'Revitalize Your Patio.',
        subheading: 'Enjoy your outdoor space again without the grime.',
        button_text: 'See Pricing',
        background_image: 'https://images.unsplash.com/photo-1590150117409-51a66e13885d?auto=format&fit=crop&w=1200'
    },
    order: 1,
    styles: { text_alignment: 'left' }
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
    name: 'Advanced Hero',
    type: 'hero',
    default_content: { 
      heading: 'Experience the Power of Clean', 
      subheading: 'Professional pressure washing for your home and business.',
      button_text: 'Get a Free Quote',
      button_link: '#contact',
      background_image: 'https://images.unsplash.com/photo-1521791136064-7986c2959210?auto=format&fit=crop&w=1200&q=80'
    },
    default_styles: { 
      padding: '100px 20px', 
      text_alignment: 'center' 
    }
  },
  {
    id: 'comp2',
    name: 'Rich Text Block',
    type: 'text',
    default_content: { 
      text: '<p>Standard text block for your content. Supporting <b>bold</b> and <i>italic</i> styling where needed.</p>' 
    },
    default_styles: { 
      font_size: '18px', 
      alignment: 'left' 
    }
  },
  {
    id: 'comp3',
    name: 'Lead Capture Form',
    type: 'form',
    default_content: { 
      title: 'Get a Free Quote',
      fields: ['name', 'phone', 'email', 'message'] 
    },
    default_styles: { 
      padding: '30px', 
      background: '#f8fafc' 
    }
  },
  {
    id: 'comp4',
    name: 'Styled Image',
    type: 'image',
    default_content: { 
      image_url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80' 
    },
    default_styles: { 
      width: '100%', 
      border_radius: '12px' 
    }
  },
  {
    id: 'comp5',
    name: 'Link Button',
    type: 'button',
    default_content: { 
      label: 'Visit Website', 
      link: '#' 
    },
    default_styles: { 
      color: '#007bff', 
      size: 'medium' 
    }
  }
];
