import { Contact, Opportunity, Activity, Pipeline, Quote, QuoteItem, Invoice, Page, PageSection, Component, Asset, Template, WebsiteSettings, EventLog, Message, Call, Funnel, WebsiteLayout, Website, WebsiteRoute } from './types';

export const mockFunnels: Funnel[] = [
  {
    id: 'fnl-1',
    user_id: 'system',
    name: 'Home Page',
    status: 'published',
    created_at: '2026-03-24T10:00:00Z',
    updated_at: '2026-03-24T10:00:00Z'
  },
  {
    id: 'fnl-2',
    user_id: 'system',
    name: 'House Washing Page',
    status: 'draft',
    created_at: '2026-03-25T14:30:00Z',
    updated_at: '2026-03-25T14:30:00Z'
  }
];

export const mockContacts: Contact[] = [];

export const mockPipelines: Pipeline[] = [
  {
    id: 'p1',
    name: 'Residential Cleaning Pipeline',
    stages: ['New Lead', 'Quote Sent', 'Scheduled', 'Completed', 'Paid'],
  },
];

export const mockOpportunities: Opportunity[] = [];

export const mockActivities: Activity[] = [
  {
    id: 'a1',
    user_id: 'system',
    contact_id: 'c2',
    type: 'call',
    description: 'Initial follow-at-up call about driveway cleaning',
    due_date: '2026-03-02T09:00:00Z',
    completed: true,
  },
  {
    id: 'a2',
    user_id: 'system',
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
    user_id: 'system',
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
    user_id: 'system',
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
    user_id: 'system',
    funnel_id: 'fnl-1',
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
    user_id: 'system',
    funnel_id: 'fnl-1',
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
    content: {
      heading: 'Handyman Hans Pressure Washing Demo',
      subheading: 'Exterior cleaning and driveway cleaning demo site for soft-launch testing.',
      button_text: 'Get Free Estimate',
      button_link: '#quote-form'
    },
    order: 1,
    styles: { text_alignment: 'center' }
  },
  {
    id: 'ps-d1',
    page_id: 'p3',
    type: 'hero',
    content: { 
        heading: 'Pristine Driveways, Every Time.',
        subheading: 'We remove years of stains, oil, and moss with ease.',
        button_text: 'Get an Instant Quote',
    },
    order: 1,
    styles: { text_alignment: 'center' }
  },
  {
    id: 'ps-home-services',
    page_id: 'fnl-1',
    type: 'services',
    content: { title: 'Our Core Services', subtitle: 'Explore how we can restore your home and business.' },
    order: 2,
    styles: { padding: '80px 20px', background: '#ffffff' }
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
    styles: { padding: '40px', visible: false }
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
    id: 'comp-hero',
    name: 'Hero Section',
    type: 'hero',
    default_content: { 
      heading: 'Restore Your Home’s Beauty', 
      subheading: 'Professional pressure washing that makes your surfaces look like new again.',
      button_text: 'Get a Free Estimate',
      background_image: 'https://images.unsplash.com/photo-1541604193435-22077a288934?auto=format&fit=crop&w=1200&q=80'
    },
    default_styles: { padding: '100px 20px', text_alignment: 'center', background: '#ffffff', visible: true }
  },
  {
    id: 'comp-proof',
    name: 'Proof (Testimonials)',
    type: 'proof',
    default_content: {
      title: 'Trusted by Hundreds of Local Homeowners',
      testimonials: [
        { name: 'Sarah J.', quote: 'Our driveway went from gray to brilliant white in hours. Highly recommend!', stars: 5 },
        { name: 'Mike T.', quote: 'Professional service and great communication. The house looks brand new.', stars: 5 }
      ]
    },
    default_styles: { padding: '80px 20px', background: '#f8fafc', visible: true }
  },
  {
    id: 'comp-offer',
    name: 'Offer Section',
    type: 'offer',
    default_content: {
      headline: 'Special Driveway Cleaning Package',
      description: 'Get your driveway and walkway cleaned for just $199. Limited time offer!',
      button_text: 'Claim Offer',
      expiry: 'Offer ends this Sunday'
    },
    default_styles: { padding: '80px 20px', background: '#4f46e5', color: '#ffffff', visible: true }
  },
  {
    id: 'comp-gallery',
    name: 'Gallery (Before/After)',
    type: 'gallery',
    default_content: {
      title: 'Our Recent Work',
      items: [
        { before: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=600', after: 'https://images.unsplash.com/photo-1527335932348-4dbe058525cc?auto=format&fit=crop&q=80&w=600' }
      ]
    },
    default_styles: { padding: '80px 20px', background: '#ffffff', visible: true }
  },
  {
    id: 'comp-form',
    name: 'Lead Capture Form',
    type: 'form',
    default_content: {
      title: 'Get My Free Quote',
      fields: ['name', 'phone'],
      pipeline_id: 'p1'
    },
    default_styles: { padding: '60px 20px', background: '#f8fafc', visible: true }
  },
  {
    id: 'comp-faq',
    name: 'FAQ Section',
    type: 'faq',
    default_content: {
      heading: 'Frequently Asked Questions',
      items: [
        { question: 'How long does it take?', answer: 'Most residential driveways take 1.5 to 3 hours.' },
        { question: 'Do I need to be home?', answer: 'No, as long as we have access to an external water source.' }
      ]
    },
    default_styles: { padding: '80px 20px', background: '#ffffff', visible: true }
  }
];


export const mockMedia: Asset[] = [
  {
    id: 'm1',
    name: 'Clean Driveway',
    url: 'https://images.unsplash.com/photo-1541604193435-22077a288934?auto=format&fit=crop&w=800&q=80',
    type: 'image',
    tags: ['driveway', 'clean', 'concrete']
  },
  {
    id: 'm2',
    name: 'Power Washing Patio',
    url: 'https://images.unsplash.com/photo-1516743618621-af979b8d49b1?auto=format&fit=crop&w=800&q=80',
    type: 'image',
    tags: ['patio', 'washing', 'stone']
  },
  {
    id: 'm3',
    name: 'Siding Cleaning',
    url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
    type: 'image',
    tags: ['house', 'siding', 'clean']
  },
  {
    id: 'm4',
    name: 'Roof Moss Removal',
    url: 'https://images.unsplash.com/photo-1626700051175-6518a4993f57?auto=format&fit=crop&w=800&q=80',
    type: 'image',
    tags: ['roof', 'moss', 'washing']
  },
  {
    id: 'm5',
    name: 'Commercial Exterior',
    url: 'https://images.unsplash.com/photo-1621905252507-b35221ad889a?auto=format&fit=crop&w=800&q=80',
    type: 'image',
    tags: ['commercial', 'brick', 'clean']
  }
];

export const mockTemplates: Template[] = [
  {
    id: 'tpl1',
    name: 'Standard Landing Page',
    category: 'Landing Pages',
    sections: [
      {
        type: 'hero',
        content: { heading: 'Welcome to our Service', subheading: 'The best experience you ever had.' },
        styles: { padding: '100px 20px', background: '#f8fafc', text_alignment: 'center' },
        order: 1
      },
      {
        type: 'text',
        content: { heading: 'Our Features', body: 'Discover why thousands of users trust us every day.' },
        styles: { padding: '60px 20px', background: '#ffffff' },
        order: 2
      },
      {
        type: 'form',
        content: { title: 'Contact Us', fields: ['name', 'email', 'message'] },
        styles: { padding: '60px 20px', background: '#f8fafc' },
        order: 3
      }
    ],
    created_at: new Date().toISOString()
  },
  {
    id: 'tpl-generic',
    name: 'Generic Service Template',
    category: 'Landing Pages',
    sections: [
      {
        type: 'hero',
        content: { heading: '', subheading: '', button_text: '' },
        styles: { padding: '100px 20px', background: '#f8fafc', text_alignment: 'center' },
        order: 1
      },
      {
        type: 'text',
        content: { heading: 'Our Service', text: '' },
        styles: { padding: '60px 20px', background: '#ffffff' },
        order: 2
      },
      {
        type: 'text',
        content: { heading: 'Key Benefits', text: '' },
        styles: { padding: '60px 20px', background: '#f1f5f9' },
        order: 3
      },
      {
        type: 'text',
        content: { heading: 'Frequently Asked Questions', text: '' },
        styles: { padding: '60px 20px', background: '#ffffff' },
        order: 4
      }
    ],
    created_at: new Date().toISOString()
  },
  {
    id: 'tpl-quote-funnel',
    name: 'Quote Page Template',
    category: 'conversion',
    sections: [
      {
        type: 'hero',
        content: { heading: 'Expert Exterior Cleaning', subheading: 'Professional pressure washing for your home or business.', button_text: 'See Our Services' },
        styles: { padding: '100px 20px', background: '#f8fafc', text_alignment: 'center' },
        order: 1
      },
      {
        type: 'cta',
        content: { heading: 'Quick Price Check', subheading: 'Need an estimate fast? Fill out our form below.', button_text: 'Jump to Form' },
        styles: { padding: '60px 20px', cta_background: '#f1f5f9' },
        order: 2
      },
      {
        type: 'form',
        content: { title: 'Request Your Free Quote', fields: ['name', 'phone', 'address', 'service_type', 'message'] },
        styles: { padding: '80px 20px', background: '#ffffff' },
        order: 3
      },
      {
        type: 'social-proof',
        content: {
          title: 'See The Difference',
          subtitle: 'Join over 500 local families who trust our results.',
          before_after: {
            before: 'https://images.unsplash.com/photo-1541888946425-d81bb19480c5?auto=format&fit=crop&q=80&w=800',
            after: 'https://images.unsplash.com/photo-1517646288021-22c16196a60e?auto=format&fit=crop&q=80&w=800'
          },
          testimonials: [
            { name: 'John D.', quote: 'Hans is the best! My driveway looks brand new.', stars: 5 },
            { name: 'Sarah M.', quote: 'Professional service and great results.', stars: 5 }
          ]
        },
        styles: { padding: '80px 20px', background: '#f8fafc' },
        order: 4
      },
      {
        type: 'cta',
        content: { heading: 'Start Your Project Today', subheading: 'Professional results are just a click away.', button_text: 'Get Started Now' },
        styles: { padding: '100px 20px', cta_background: '#4f46e5' },
        order: 5
      }
    ],
    created_at: new Date().toISOString()
  }
];

export const mockWebsites: Website[] = [
  {
    id: 'ws-1',
    user_id: 'system',
    name: 'Handyman Hans Demo',
    domain: 'website-crm-one.vercel.app',
    subdomain: 'pressurepro-demo',
    homepage_funnel_id: 'fnl-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const mockWebsiteRoutes: WebsiteRoute[] = [
  {
    id: 'r1',
    website_id: 'ws-1',
    path: '/',
    funnel_id: 'fnl-1',
    created_at: new Date().toISOString()
  },
  {
    id: 'r2',
    website_id: 'ws-1',
    path: '/driveway',
    funnel_id: 'fnl-1',
    created_at: new Date().toISOString()
  },
  {
    id: 'r3',
    website_id: 'ws-1',
    path: '/driveway-cleaning',
    funnel_id: 'fnl-1',
    created_at: new Date().toISOString()
  }
];

export const mockWebsiteSettings: WebsiteSettings = {
  id: 'settings-001',
  business_name: 'Handyman Hans Pressure Washing Demo',
  phone: '604-555-0199',
  sms_number: '',
  email: 'demo@handymanhans.com',
  logo_url: 'https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?q=80&w=200&h=200&auto=format&fit=crop',
  primary_color: '#4f46e5',
  facebook_pixel_id: '',
  gtm_id: '',
  ga4_measurement_id: '',
  auto_lead_sms_enabled: true,
  auto_lead_sms_template: "Hey {name}, thanks for reaching out! I'll get back to you ASAP.",
  missed_call_sms_enabled: true,
  missed_call_sms_template: '',
  created_at: new Date().toISOString(),
  publish_status: 'draft',
  cities_served: [
    'Port Moody',
    'Coquitlam',
    'Port Coquitlam',
    'Burnaby'
  ],
  services_offered: [
    'Pressure Washing',
    'Driveway Cleaning',
    'Sidewalk Cleaning',
    'Patio Cleaning',
    'Deck Cleaning',
    'House Washing',
    'Gutter Cleaning',
    'Roof Moss Treatment',
    'Commercial Pressure Washing'
  ],
  website_preset: 'residential'
};

export const mockWebsiteSettingsMap = new Map<string, WebsiteSettings>();

export const mockWebsiteLayouts: WebsiteLayout[] = [
  {
    id: 'layout-1',
    website_id: 'ws-1',
    header_config: {
      logo_text: 'Handyman Hans Demo',
      nav_items: [
        { label: 'Home', path: '/' },
        { label: 'Driveway Cleaning', path: '/driveway-cleaning' }
      ],
      cta_text: 'Get Quote',
      cta_link: '/quote'
    },
    footer_config: {
      business_name: 'Handyman Hans Demo',
      phone_number: '604-555-0199',
      service_area: 'Port Moody, Coquitlam, Port Coquitlam & Burnaby',
      cta_text: 'Get an Instant Estimate',
      links: [
        { label: 'Privacy Policy', path: '/privacy' },
        { label: 'Terms of Service', path: '/terms' }
      ]
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// End of db.ts
