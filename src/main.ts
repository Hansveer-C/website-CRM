import { mockContacts, mockOpportunities, mockPipelines, mockActivities, mockQuotes, mockQuoteItems, mockInvoices, mockPages, mockPageSections, mockComponents, mockMedia, mockWebsiteSettings, mockFunnels, mockWebsiteLayouts, mockWebsites, mockWebsiteRoutes } from './db';
import { templates } from './templates';
import { Activity, WebsiteLayout } from './types';
import { resolveWebsiteRequest } from './website_resolver';
import { normalizePhone, normalizeEmail, normalizeName } from './utils/validators';

/**
 * 🌐 FRONTEND API BRIDGE
 * These stubs replace direct backend function calls to prevent credential leakage.
 * These utilize regional mock data (db.ts) to maintain UI functionality without direct DB access.
 */
const getWebsiteSettings = () => mockWebsiteSettings;
const getWebsiteLayout = (id?: string) => mockWebsiteLayouts[0]; // Simplified for now
const persistWebsiteSettings = async (data: any) => { 
    console.log('[API STUB] Saving settings:', data);
    return { success: true }; 
};
const getEvents = (user?: any) => [];
const getAllMessagesOrdered = (user?: any) => [];
const getConversation = (id: string, user?: any) => [];
const getCallsForContact = (id: string, phone?: string, user?: any) => [];
const getCall = (id: string) => null;
const runAutomations = (type: string, data: any) => {};
const checkOverdueInvoices = () => { console.log('[API STUB] Checking overdue invoices'); };
const emitEvent = (name: string, payload: any, user_id?: string) => {
    console.log(`[FRONTEND EVENT] ${name}:`, payload);
};
const getContactTimeline = (id: string, user?: any) => [];
const getLatestActivity = (id: string, user?: any) => null;
const createLead = async (data: any, request?: any) => {
    return fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }).then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to create lead');
        return json;
    });
};
const handleInboundCall = async (payload: { phone: string }) => {
    return fetch('/api/calls/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to start call');
        return json;
    });
};
const endCall = async (payload: { call_id: string, answered?: boolean, duration?: number }) => {
    return fetch('/api/calls/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to end call');
        return json;
    });
};
const sendMessageToContact = async (id: string, msg: string, source: string = 'manual', user_id?: string) => {
    return fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: id, message: msg, source })
    }).then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to send SMS');
        return json;
    });
};
const retryMessage = async (id: string, user_id?: string) => {
    return fetch(`/api/messages/${id}/retry`, { method: 'POST' }).then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to retry message');
        return json;
    });
};

const getContact = (id: string, user?: any) => mockContacts.find(c => c.id === id);
const getOpportunity = (id: string, user?: any) => mockOpportunities.find(o => o.id === id);






// Initialize and Validate Configs
// Twilio check removed from frontend for security (Phase 7.5 Migration)

// Globals for Phase testing
(window as any).sendMessageToContact = sendMessageToContact;
(window as any).retryMessage = retryMessage;
(window as any).getAllMessagesOrdered = getAllMessagesOrdered;

/**
 * Mock API Interceptor (Service Layer simulated via fetch)
 * This allows the frontend to call fetch('/api/...') and have it handled
 * by the actual backend controller logic in a unified way.
 */
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as any).url;
    
    if (url.startsWith('/api/')) {
        const method = init?.method || 'GET';
        const bodyString = init?.body ? (init.body as string) : undefined;
        console.log(`[MOCK INTERCEPTOR] Intercepting ${method} ${url}`);
        
        // Build the simulated request context
        const reqContext: any = { 
            method, 
            url,
            body: bodyString ? JSON.parse(bodyString) : undefined 
        };

        // Simulating the Backend Dispatcher/Router
        if (url === '/api/messages/send' && method === 'POST') {
            const { sendMessageApi } = await import('./messages_api');
            const response: any = await sendMessageApi(reqContext);
            const responseData = response.data || response;
            return new Response(JSON.stringify(responseData), { 
                status: response.status || 200, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }
        
        if (url.includes('/api/messages/') && url.endsWith('/retry') && init?.method === 'POST') {
            const { retryMessageApi } = await import('./messages_api');
            const message_id = url.split('/')[3];
            const response: any = await retryMessageApi({} as any, message_id);
            const responseData = response.data || response;
            return new Response(JSON.stringify(responseData), { status: response.status || 200 });
        }

        if (url === '/api/leads' && method === 'POST') {
            console.log('[MOCK] Intercepting Lead Submission:', reqContext.body);
            const isTest = reqContext.body.is_test;
            const newLead = { 
                id: `c-${Date.now()}`, 
                ...reqContext.body, 
                status: 'lead', 
                created_at: new Date().toISOString(),
                user_id: (window as any).currentUser || 'system',
                source: isTest ? 'test_submission' : 'website_form'
            };
            mockContacts.push(newLead as any);
            
            if (isTest) {
                (window as any).showToast('Test lead received! Redirecting to CRM...', 'success');
                setTimeout(() => window.navigateTo('contact-detail', newLead.id), 2000);
            }

            return new Response(JSON.stringify({ success: true, data: newLead }), { 
                status: 201,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url === '/api/contacts' && method === 'GET') {
            const userId = (window as any).currentUser || 'system';
            const userContacts = mockContacts.filter(c => c.user_id === userId);
            return new Response(JSON.stringify({ success: true, data: userContacts }), { 
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.startsWith('/api/contacts/') && url.endsWith('/timeline') && method === 'GET') {
            const id = url.split('/')[3];
            console.log(`[MOCK] Fetching timeline for contact ${id}`);
            return new Response(JSON.stringify({ success: true, data: [] }), { 
                status: 200, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        if (url.startsWith('/api/contacts/') && method === 'GET') {
            const id = url.split('/')[3];
            const contact = mockContacts.find(c => c.id === id);
            if (!contact) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
            return new Response(JSON.stringify({ success: true, data: contact }), { 
                status: 200, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        if (url === '/api/calls/inbound' && method === 'POST') {
            const { handleInboundCallApi } = await import('./calls_api');
            const response: any = await handleInboundCallApi(reqContext);
            const responseData = response.data || response;
            return new Response(JSON.stringify(responseData), { 
                status: response.status || 200, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        if (url === '/api/calls/end' && method === 'POST') {
            const { endCallApi } = await import('./calls_api');
            const response: any = await endCallApi(reqContext);
            const responseData = response.data || response;
            return new Response(JSON.stringify(responseData), { 
                status: response.status || 200, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // Funnels API (WB.1.4 Integration — Browser-safe simulation)
        if (url.startsWith('/api/funnels')) {
            let response: any;

            if (url === '/api/funnels' && method === 'GET') {
                const data = mockFunnels.map(f => ({
                    ...f,
                    step_count: mockPages.filter(p => (p as any).funnel_id === f.id).length
                }));
                response = { success: true, data };
            } else if (url === '/api/funnels' && method === 'POST') {
                const { name } = reqContext.body || {};
                const newFunnel = {
                    id: `fnl-${Date.now()}`,
                    user_id: 'system',
                    name: name || 'Untitled Funnel',
                    status: 'draft',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                mockFunnels.push(newFunnel as any);
                response = { success: true, data: newFunnel };
            } else if (url === '/api/funnels/from-template' && method === 'POST') {
                // Mock implementation of WB.2.3 for browser preview
                const { name } = reqContext.body || {};
                const newFnl = { id: `fnl-${Date.now()}`, user_id: 'system', name: name || 'Template Funnel', status: 'draft', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
                mockFunnels.push(newFnl as any);
                response = { success: true, data: { funnel_id: newFnl.id, funnel: newFnl } };
            } else if (url.startsWith('/api/funnels/') && method === 'GET') {
                const id = url.split('/')[3];
                const funnel = mockFunnels.find(f => f.id === id);
                if (funnel) {
                    const steps = mockPages.filter(p => (p as any).funnel_id === id);
                    response = { success: true, data: { ...funnel, steps } };
                } else {
                    response = { success: false, error: 'Funnel not found' };
                }
            } else if (url.startsWith('/api/funnels/') && method === 'PATCH') {
                const id = url.split('/')[3];
                const funnel = mockFunnels.find(f => f.id === id);
                if (funnel) {
                    const { name, status } = reqContext.body || {};
                    if (name) funnel.name = name;
                    if (status) funnel.status = status;
                    response = { success: true, data: funnel };
                } else {
                    response = { success: false, error: 'Funnel not found' };
                }
            }
            
            if (response) {
                return new Response(JSON.stringify(response), { status: response.success ? 200 : (response.error === 'Funnel not found' ? 404 : 500) });
            }
        }

        // Websites API (WB.2.2 Integration)
        if (url.startsWith('/api/websites/generate') && method === 'POST') {
            const { generateWebsiteApi } = await import('./websites_api');
            const response: any = await generateWebsiteApi(reqContext);
            const responseData = response.data || response;
            return new Response(JSON.stringify(responseData), { 
                status: response.status || 201, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        // ── WB.3.5 Page Sections Auto-Save ──────────────────────────────────
        if (url.match(/^\/api\/pages\/[^/]+\/sections$/) && method === 'PUT') {
            const pageId = url.split('/')[3];
            let body: any = {};
            try { body = JSON.parse(typeof reqContext.body === 'string' ? reqContext.body : await reqContext.body?.text?.() ?? '{}'); } catch {}
            const sections: any[] = body.sections || [];

            // Upsert sections to Supabase
            const { supabase, safeDbCall } = await import('./utils/db/supabase');
            const result = await safeDbCall('UPSERT_SECTIONS', reqContext.user?.id || 'system',
                supabase.from('page_sections').upsert(
                    sections.map((s: any) => ({ ...s, page_id: pageId })),
                    { onConflict: 'id' }
                )
            );

            return new Response(JSON.stringify({
                success: !result.error,
                error: result.error ?? null,
                saved: sections.length
            }), {
                status: result.error ? 500 : 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // ── WB.3.4 Bulk SEO Generation ──────────────────────────────────
        if (url === '/api/websites/bulk-seo' && method === 'POST') {
            const { services, cities } = reqContext.body || {};
            console.log(`[MOCK] Bulk SEO Generation for ${services.length} services in ${cities.length} cities`);
            
            // Simulation of generation
            const website = mockWebsites[0];
            const timestamp = new Date().toISOString();
            
            services.forEach((s: string) => {
                cities.forEach((c: string) => {
                    const slug = (s + '-' + c).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                    const existing = mockWebsiteRoutes.find(r => r.website_id === website.id && r.slug === slug);
                    if (!existing) {
                        mockWebsiteRoutes.push({
                            id: `r-seo-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
                            website_id: website.id,
                            path: `/${slug}`,
                            slug,
                            funnel_id: 'fnl-1',
                            is_seo_page: true,
                            city: c,
                            service: s,
                            created_at: timestamp
                        });
                    }
                });
            });

            return new Response(JSON.stringify({ success: true, count: services.length * cities.length }), { 
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.startsWith('/api/websites/routes/') && method === 'DELETE') {
            const routeId = url.split('/')[4];
            const idx = mockWebsiteRoutes.findIndex(r => r.id === routeId);
            if (idx > -1) {
                mockWebsiteRoutes.splice(idx, 1);
                return new Response(JSON.stringify({ success: true }), { status: 200 });
            }
            return new Response(JSON.stringify({ success: false, error: 'Route not found' }), { status: 404 });
        }
    }
    
    return originalFetch(input, init);
};

(window as any).EventLogs = getEvents();

const app = document.querySelector<HTMLDivElement>('#app')!;


// Simulated API exposed to window (Phase 1.8.1)
(window as any).handleInboundCall = handleInboundCall;
(window as any).endCall = endCall;


// Normalize existing mock data
mockContacts.forEach(c => {
  const norm = normalizePhone(c.phone);
  c.phone = norm.normalized;
  if (norm.invalid) c.invalid_phone = true;
  c.name = normalizeName(c.name);
  c.email = normalizeEmail(c.email);
});

// State Management
let currentView: string = 'dashboard';
(window as any).currentUser = 'system'; // 'user_a' or 'user_b'

// Filter & Selection State
let clientSearchQuery: string = '';
let clientStatusFilter: string = 'all';
let selectedContactId: string | null = null;
let invoiceStatusFilter: string = 'all';

// Page Builder State
let builderPageId: string = mockPages[0]?.id || '';
let builderSelectedSectionId: string | null = null;
let builderInsertOrder: number | null = null;
let builderViewport: 'mobile' | 'desktop' = 'mobile'; // WB.3.4 — mobile-first default
let builderReturnTo: string = 'pages'; // WB.3.6 — context-aware Back button
let builderReturnFunnelId: string | null = null; // set when opened from funnel detail
let compSearchQuery: string = '';
let compCategoryFilter: string = 'all';
let contactTimelineState: any[] = [];
let lastContactCount = mockContacts.length;

// SMS Composer State (Phase 2.1)
let isSmsComposerOpen: boolean = false;
let smsComposerContactId: string | null = null;

(window as any).currentUser = 'system';
(window as any).switchUser = (userId: string) => {
  (window as any).currentUser = userId;
  console.log(`[QA] Switched UI context to User: ${userId}`);
  (window as any).navigateTo(currentView, selectedContactId || undefined);
};

// QA Simulation State (Phase 3.3)
let pendingSimulationCallId: string | null = null;
let lastSimulationResult: any = null;
let isProcessingSimulation: boolean = false;

let mockGlobalSettings = {
  businessName: 'PressurePro Cleaning',
  logoUrl: '',
  phone: '1-800-CLEAN-IT',
  seoTitleFormat: '{page_name} | {business_name}',
  seoDescriptionFallback: 'Professional pressure washing and exterior cleaning services.',
  fbPixelId: '',
  gtmId: ''
};

(window as any).updateGlobalSettings = (key: string, value: string) => {
  (mockGlobalSettings as any)[key] = value;
};

(window as any).saveGlobalSettings = () => {
  alert('Global Website Settings saved successfully! All pages updated.');
  renderWebsiteSettings();
};

(window as any).setCompCategory = (cat: string) => {
  compCategoryFilter = cat;
  renderComponents();
};

(window as any).setCompSearch = (val: string) => {
  compSearchQuery = val.toLowerCase();
  renderComponents();
};

(window as any).cancelComponentPicker = () => {
  builderInsertOrder = null;
  (window as any).navigateTo('builder');
};

// New Quote State
let newQuoteLineItems: { service: string, description: string, quantity: number, price: number, tier: 'basic' | 'standard' | 'premium' }[] = [
  { service: '', description: '', quantity: 1, price: 0, tier: 'basic' }
];

// Error Logging System
interface ErrorLog {
  id: string;
  timestamp: string;
  message: string;
  step: 'contact_creation' | 'opportunity_creation' | 'normalization' | 'form_submission';
  inputData: any;
}

const mockErrorLogs: ErrorLog[] = [];

function logError(step: ErrorLog['step'], message: string, inputData: any) {
  const log: ErrorLog = {
    id: `err-${Date.now()}`,
    timestamp: new Date().toISOString(),
    message,
    step,
    inputData: { ...inputData } // Basic sanitization/cloning
  };
  mockErrorLogs.push(log);
  console.error(`[ERROR LOG - ${step.toUpperCase()}]`, log);
}
(window as any).newQuoteLineItems = newQuoteLineItems;
let newQuoteContactId: string = '';
(window as any).newQuoteContactId = newQuoteContactId;
let newQuoteOpportunityId: string = '';
(window as any).newQuoteOpportunityId = newQuoteOpportunityId;

/**
 * Standardized "New" badge logic (Phase 5.1)
 * Returns true if the provided date string is within the last 24 hours.
 */
function isNew(dateStr: string): boolean {
  if (!dateStr) return false;
  const now = new Date().getTime();
  const createdAt = new Date(dateStr).getTime();
  return (now - createdAt) < (24 * 60 * 60 * 1000);
}

/**
 * Standardized "Needs Attention" badge logic (Phase 5.2)
 * Triggers on operational blockers like failed SMS, manual follow-up flags, 
 * or recent unresolved missed calls.
 */
function needsAttention(contact: any): boolean {
  if (contact.follow_up_required) return true;
  
  // Real-time check for failed SMS
  const hasFailedSMS = (getAllMessagesOrdered() || []).some(m => m.contact_id === contact.id && m.status === 'failed');
  if (hasFailedSMS) return true;
  
  // Recent missed call (last 2 hours) implies urgency
  const now = new Date().getTime();
  const recentMissedCall = getCallsForContact(contact.id).find(c => c.status === 'missed' &&
    (now - new Date(c.created_at).getTime()) < (2 * 60 * 60 * 1000)
  );
  
  return !!recentMissedCall;
}

function renderSidebar(activeView: string) {
  return `
    <div class="sidebar">
      <h1>PressurePro</h1>
      <nav>
        <ul>
          <div class="nav-group-title" style="margin-top: 0;">Main Menu</div>
          <li onclick="window.navigateTo('dashboard')" class="${activeView === 'dashboard' ? 'active' : ''}">Dashboard</li>
          <li onclick="window.navigateTo('clients')" class="${activeView === 'clients' ? 'active' : ''}" style="display: flex; justify-content: space-between; align-items: center;">
            <span>Clients & Leads</span>
            ${(() => {
              const userId = (window as any).currentUser || 'system';
              const newCount = mockContacts.filter(c => c.user_id === userId && isNew(c.created_at)).length;
              return newCount > 0 ? `<span class="badge" style="background: #fbbf24; color: #78350f; font-size: 0.65rem; padding: 2px 6px; border-radius: 10px; font-weight: 800;">${newCount}</span>` : '';
            })()}
          </li>
          <li onclick="window.navigateTo('opportunities')" class="${activeView === 'opportunities' ? 'active' : ''}">Opportunities</li>
          <li onclick="window.navigateTo('quotes')" class="${activeView === 'quotes' ? 'active' : ''}">Quotes</li>
          <li onclick="window.navigateTo('invoices')" class="${activeView === 'invoices' ? 'active' : ''}">Invoices</li>
          <li onclick="window.navigateTo('lead-capture')" class="${activeView === 'lead-capture' ? 'active' : ''}">Lead Capture</li>
          
          <div class="nav-group-title">Marketing & Sales</div>
          <li onclick="window.navigateTo('funnels')" class="${activeView === 'funnels' ? 'active' : ''}" style="font-weight: 700; color: var(--primary-color);">Funnels <span class="badge" style="background: #3b82f6; color: white;">New</span></li>
          
          <div class="nav-group-title">Websites</div>
          <li onclick="window.navigateTo('website-structure')" class="${activeView === 'website-structure' ? 'active' : ''}">Structure</li>
          <li onclick="window.navigateTo('pages')" class="${activeView === 'pages' || activeView === 'page-sections' ? 'active' : ''}">Pages</li>
          <li onclick="window.navigateTo('seo-pages')" class="${activeView === 'seo-pages' ? 'active' : ''}">SEO Pages</li>
          <li onclick="window.navigateTo('templates')" class="${activeView === 'templates' ? 'active' : ''}" style="opacity: 0.7;">Templates</li>
          <li onclick="window.navigateTo('components')" class="${activeView === 'components' ? 'active' : ''}" style="opacity: 0.7;">Components</li>
          <li onclick="window.navigateTo('website-settings')" class="${activeView === 'website-settings' ? 'active' : ''}">Settings</li>
          
          <div class="nav-group-title">System</div>
          <li onclick="window.navigateTo('reports')" class="${activeView === 'reports' ? 'active' : ''}">Reports & Insights</li>
          <li onclick="window.navigateTo('quickstart')" class="${activeView === 'quickstart' ? 'active' : ''}">Quickstart Guide</li>
          <li onclick="window.navigateTo('event-logs')" class="${activeView === 'event-logs' ? 'active' : ''}">Event Logs</li>
          <li onclick="window.navigateTo('qa-tools')" class="${activeView === 'qa-tools' ? 'active' : ''}">QA Tools</li>
          <li>Payments</li>
          <li>Settings</li>
        </ul>
      </nav>
    </div>
  `;
}

function renderDashboard() {
  const now = new Date();

  const userId = (window as any).currentUser || 'system';

  // 🏁 WB.6.1: Check for Onboarding
  if (!window.localStorage.getItem('onboarding_seen')) {
    fetch('/api/funnels').then(r => r.json()).then(res => {
      if (res.success && (!res.data || res.data.length === 0)) {
        (window as any).showOnboardingModal();
      }
    });
  }

  // Top Level Metrics
  const openOpportunities = mockOpportunities.filter(o => o.user_id === userId && o.status === 'open');
  const pipelineValue = openOpportunities.reduce((sum, o) => sum + o.value, 0);
  const openCount = openOpportunities.length;

  const userOpps = mockOpportunities.filter(o => o.user_id === userId);
  const totalCount = userOpps.length;
  const wonCount = userOpps.filter(o => o.status === 'won').length;
  const conversionRate = totalCount > 0 ? (wonCount / totalCount) * 100 : 0;

  // 1. Revenue by Stage (Only Open/Won)
  const stages = mockPipelines[0].stages;
  const revenueByStage = stages.map(stage => {
    const value = mockOpportunities
      .filter(o => o.pipeline_stage === stage && (o.status === 'open' || o.status === 'won'))
      .reduce((sum, o) => sum + o.value, 0);
    return { stage, value };
  }).filter(s => s.value > 0);

  const maxRevenue = Math.max(...revenueByStage.map(s => s.value), 1);

  // 2. Leads by Source
  const sourceMap: Record<string, number> = {};
  mockContacts.forEach(c => {
    sourceMap[c.source] = (sourceMap[c.source] || 0) + 1;
  });
  const leadsBySource = Object.entries(sourceMap).map(([source, count]) => ({ source, count }));
  const maxLeads = Math.max(...leadsBySource.map(s => s.count), 1);

  // 3. Overdue Tasks
  const overdueTasks = mockActivities.filter((a: Activity) => !a.completed && new Date(a.due_date) < now);

  // 4. Website Performance Metrics
  const websiteLeads = mockContacts.filter(c => c.source.toLowerCase().includes('website') || c.source.toLowerCase().includes('search') || c.source.toLowerCase().includes('ad')).length;
  const formSubmissions = mockContacts.length > 0 ? Math.floor(websiteLeads * 1.5) + 3 : 0;
  const topPageName = mockPages.length > 0 ? mockPages[Math.floor(Math.random() * Math.min(mockPages.length, 3))].name : 'Home';

  app.innerHTML = `
    ${renderSidebar('dashboard')}
    <main class="main-content">
      <header class="view-header">
        <h2>Dashboard Overview</h2>
      </header>
      
      <div class="dashboard-grid" style="grid-template-columns: repeat(4, 1fr);">
        <div class="card">
          <small style="color: #666;">Cash in Pipeline</small>
          <h3>Pipeline Value</h3>
          <p class="value" style="color: var(--primary-color);">$${pipelineValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>
        <div class="card">
          <small style="color: #666;">Action Required</small>
          <h3>Open Leads</h3>
          <p class="value">${openCount}</p>
        </div>
        <div class="card">
          <small style="color: #666;">Success Rate</small>
          <h3>Conv. Rate</h3>
          <p class="value">${conversionRate.toFixed(1)}%</p>
        </div>
        <div class="card" style="border-bottom: 4px solid #ff4444;">
          <small style="color: #666;">Attention Needed</small>
          <h3 style="color: #ff4444;">Overdue</h3>
          <p class="value" style="color: #ff4444;">${overdueTasks.length}</p>
        </div>
      </div>

      <div class="stats-grid" style="margin-top: 30px;">
        <div class="card">
          <h3>Revenue by Pipeline Stage</h3>
          <div class="chart-container" style="margin-top: 20px;">
            ${revenueByStage.map(s => `
              <div class="report-item">
                <div class="report-item-header">
                  <span>${s.stage}</span>
                  <span style="font-weight: 600;">$${s.value.toLocaleString()}</span>
                </div>
                <div class="visual-bar-bg">
                  <div class="visual-bar-fill" style="width: ${(s.value / maxRevenue) * 100}%"></div>
                </div>
              </div>
            `).join('') || '<p style="color: #666; font-style: italic; padding: 20px;">No revenue data for active stages</p>'}
          </div>
        </div>
        <div class="card">
          <h3>Lead Sources Performance</h3>
          <div class="chart-container" style="margin-top: 20px;">
            ${leadsBySource.map(s => `
              <div class="report-item">
                <div class="report-item-header">
                  <span>${s.source}</span>
                  <span style="font-weight: 600;">${s.count} Leads</span>
                </div>
                <div class="visual-bar-bg">
                  <div class="visual-bar-fill" style="width: ${(s.count / maxLeads) * 100}%; background: #6c757d;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="card" style="display: flex; flex-direction: column;">
          <h3>Website Performance</h3>
          <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 20px; flex: 1;">
            
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid var(--primary-color);">
              <small style="color: #64748b; font-weight: 600; text-transform: uppercase;">Total Leads Acquired</small>
              <div style="font-size: 1.8rem; font-weight: 700; color: #1e293b; margin-top: 5px;">${websiteLeads}</div>
            </div>

            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
              <small style="color: #64748b; font-weight: 600; text-transform: uppercase;">Form Submissions</small>
              <div style="font-size: 1.8rem; font-weight: 700; color: #1e293b; margin-top: 5px;">${formSubmissions}</div>
            </div>

            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
              <small style="color: #64748b; font-weight: 600; text-transform: uppercase;">Top Converting Page</small>
              <div style="font-size: 1.2rem; font-weight: 700; color: #1e293b; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${topPageName}</div>
            </div>

          </div>
        </div>

      </div>

      ${overdueTasks.length > 0 ? `
        <div class="card" style="margin-top: 30px; border: 1px solid #ffcccc;">
          <h3 style="color: #cc0000; display: flex; align-items: center; gap: 10px;">
             🛑 Action Item: Overdue Tasks
          </h3>
          <table class="clients-table" style="box-shadow: none; border: 1px solid #eee; margin-top: 20px;">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Task</th>
                <th>Due Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${overdueTasks.map((task: Activity) => {
    const contact = mockContacts.find(c => c.id === task.contact_id);
    return `
                  <tr style="background: #fffafa;">
                    <td style="font-weight: 600;">${contact ? contact.name : 'Unknown'}</td>
                    <td>${task.description}</td>
                    <td style="color: #ff4444; font-weight: 500;">${new Date(task.due_date).toLocaleDateString()}</td>
                    <td><button class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; background: #ff4444; border-radius: 4px;">Resolve</button></td>
                  </tr>
                `;
  }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    </main>
  `;
}

async function renderClients() {
  // Show initial structure with sidebar to keep UI responsive
  app.innerHTML = `
    ${renderSidebar('clients')}
    <main class="main-content">
      <header class="view-header">
        <h2>Clients & Leads</h2>
        <button class="btn-primary" onclick="window.navigateTo('lead-capture')">+ Add Lead</button>
      </header>
      <div class="card" style="padding: 20px; text-align: center; color: #64748b;">
        <div class="skeleton" style="height: 40px; margin-bottom: 20px;"></div>
        Loading contacts...
      </div>
    </main>
  `;

  const response = await fetch('/api/contacts');
  const result = await response.json();
  const contacts: any[] = result.data || result;

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
      contact.phone.includes(clientSearchQuery);
    const matchesFilter = clientStatusFilter === 'all' || contact.status === clientStatusFilter;
    return matchesSearch && matchesFilter;
  });


  const tableRows = filteredContacts.map(contact => {
    const latest = getLatestActivity(contact.id);
    const hasAttentionFlag = needsAttention(contact);
    const isNewLead = isNew(contact.created_at);

    return `
      <tr onclick="window.navigateTo('contact-detail', '${contact.id}')" style="cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: background 0.1s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
        <td style="padding: 16px 24px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px; flex-wrap: wrap;">
            <div style="font-weight: 700; color: #1e293b; font-size: 0.95rem;">${contact.name}</div>
            ${hasAttentionFlag ? `
              <span style="background: #fee2e2; color: #991b1b; font-size: 0.65rem; padding: 1px 6px; border-radius: 4px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #fecaca;">⚠️ Needs Attention</span>
            ` : (isNewLead ? `
              <span style="background: #fbbf24; color: #78350f; font-size: 0.65rem; padding: 1px 6px; border-radius: 4px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">New</span>
            ` : '')}
          </div>
          <div style="font-size: 0.75rem; color: #64748b; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 250px;">
            ${latest ? `<span style="color: #94a3b8; font-weight: 600;">Last:</span> ${latest.content}` : '<span style="color: #cbd5e1; font-style: italic;">No activity yet</span>'}
          </div>
        </td>
        <td><div style="font-weight: 500; font-size: 0.9rem; color: #334155;">${contact.phone}</div></td>
        <td><span class="badge badge-${contact.status}" style="font-size: 0.7rem;">${contact.status}</span></td>
        <td><span style="font-size: 0.8rem; color: #64748b;">${contact.source}</span></td>
        <td style="font-size: 0.8rem; color: #64748b;">${latest ? latest.created_at : '-'}</td>
        <td>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn-primary" style="padding: 6px 14px; font-size: 0.75rem; font-weight: 600; border-radius: 6px;" onclick="event.stopPropagation(); window.navigateTo('contact-detail', '${contact.id}')">View</button>
            <button class="btn-primary" style="padding: 6px 14px; font-size: 0.75rem; font-weight: 600; border-radius: 6px; background: #6366f1;" onclick="event.stopPropagation(); window.textContact('${contact.id}')">💬 Text</button>
            ${(contact.status === 'lead' && isNewLead) ? `
              <a href="tel:${contact.phone}" class="btn-primary" style="padding: 6px 14px; font-size: 0.75rem; font-weight: 600; border-radius: 6px; background: #10b981; text-decoration: none; display: flex; align-items: center; gap: 4px;" onclick="event.stopPropagation();">
                📞 Call Now
              </a>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  app.innerHTML = `
    ${renderSidebar('clients')}
    <main class="main-content">
      <header class="view-header">
        <h2>Clients & Leads</h2>
        <button class="btn-primary" onclick="window.navigateTo('lead-capture')">+ Add Lead</button>
      </header>

      <div class="card" style="margin-bottom: 24px; padding: 16px;">
        <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 300px;">
            <input type="text" id="client-search" placeholder="Search by name or phone..." 
                   value="${clientSearchQuery}" 
                   style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn-primary" style="background: ${clientStatusFilter === 'all' ? 'var(--primary-color)' : '#eee'}; color: ${clientStatusFilter === 'all' ? 'white' : '#333'}" onclick="window.filterClients('all')">All</button>
            <button class="btn-primary" style="background: ${clientStatusFilter === 'lead' ? 'var(--primary-color)' : '#eee'}; color: ${clientStatusFilter === 'lead' ? 'white' : '#333'}" onclick="window.filterClients('lead')">Leads</button>
            <button class="btn-primary" style="background: ${clientStatusFilter === 'customer' ? 'var(--primary-color)' : '#eee'}; color: ${clientStatusFilter === 'customer' ? 'white' : '#333'}" onclick="window.filterClients('customer')">Customers</button>
            <button class="btn-primary" style="background: ${clientStatusFilter === 'lost' ? 'var(--primary-color)' : '#eee'}; color: ${clientStatusFilter === 'lost' ? 'white' : '#333'}" onclick="window.filterClients('lost')">Lost</button>
          </div>
        </div>
      </div>

      <div class="card" style="padding: 0; overflow: hidden;">
        <table class="clients-table" style="box-shadow: none; margin-top: 0;">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Source</th>
              <th>Last Activity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;">No clients found matching your criteria</td></tr>'}
          </tbody>
        </table>
      </div>
    </main>
  `;

  const searchInput = document.getElementById('client-search') as HTMLInputElement;
  searchInput?.addEventListener('input', (e) => {
    clientSearchQuery = (e.target as HTMLInputElement).value;
    renderClients();
  });
  // Keep focus and cursor at the end
  if (clientSearchQuery) {
    searchInput.focus();
    searchInput.setSelectionRange(clientSearchQuery.length, clientSearchQuery.length);
  }
}

(window as any).closeSmsComposer = () => {
  isSmsComposerOpen = false;
  smsComposerContactId = null;
  document.getElementById('sms-composer-modal')?.remove();
};

(window as any).sendSmsFromComposer = async (contactId: string) => {
  const textarea = document.getElementById('sms-composer-text') as HTMLTextAreaElement;
  const content = textarea?.value?.trim();
  
  if (!content) {
    alert('Please enter a message.');
    return;
  }

  try {
    (window as any).showToast('Sending SMS...', 2000);
    await sendMessageToContact(contactId, content);
    (window as any).showToast('Message sent! Timeline updated.');
    (window as any).closeSmsComposer();
    
    // Refresh context if visible (Phase 2.5)
    if (currentView === 'clients') {
      renderClients();
    } else if (currentView === 'contact-detail') {
      (window as any).loadTimeline(contactId);
    }
  } catch (err) {
    console.error('Text Back Error:', err);
    (window as any).showToast('Error: Could not send SMS', 5000);
  }
};

(window as any).openSmsComposer = async (contactId: string) => {
  const response = await fetch(`/api/contacts/${contactId}`);
  const contact = await response.json();
  
  if (!contact || response.status === 404) {
    (window as any).showToast('Contact not found.', 3000);
    return;
  }
  
  isSmsComposerOpen = true;
  smsComposerContactId = contactId;

  // Check for valid phone (Phase 2.6)
  const hasPhone = contact.phone && contact.phone.trim().length > 0;

  // Pre-fill with a default follow-up message (Phase 2.3)
  const defaultMessage = "Hey, I saw your request—how can I help?";
  
  // Render lightweight modal UI
  const modal = document.createElement('div');
  modal.id = 'sms-composer-modal';
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.5); 
    display: flex; align-items: center; justify-content: center; z-index: 9999;
  `;
  modal.innerHTML = `
    <div style="background: white; padding: 30px; border-radius: 12px; width: 450px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); color: #333;">
      <h3 style="margin-top: 0; margin-bottom: 5px;">Texting ${contact.name}</h3>
      <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 20px;">
        ${hasPhone 
          ? `Recieving at: <span style="font-weight: 600;">${contact.phone}</span>` 
          : `<span style="color: #dc2626; font-weight: 600;">🛑 No phone number available</span>`}
      </p>
      
      <textarea id="sms-composer-text" 
                style="width: 100%; height: 120px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: inherit; font-size: 1rem; box-sizing: border-box; resize: none; margin-bottom: 20px; ${!hasPhone ? 'background: #f8fafc; cursor: not-allowed;' : ''}" 
                placeholder="${hasPhone ? 'Type your message here...' : 'Add a phone number to send messages.'}" 
                ${!hasPhone ? 'disabled' : ''}>${hasPhone ? defaultMessage : ''}</textarea>
      
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button onclick="window.closeSmsComposer()" style="padding: 10px 20px; border: 1px solid #e2e8f0; background: white; border-radius: 8px; cursor: pointer; font-weight: 600; color: #64748b;">Cancel</button>
        <button onclick="${hasPhone ? `window.sendSmsFromComposer('${contact.id}')` : ''}" 
                class="btn-primary" 
                style="padding: 10px 25px; font-weight: 700; ${!hasPhone ? 'opacity: 0.4; cursor: not-allowed;' : ''}"
                ${!hasPhone ? 'disabled' : ''}>Send SMS</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const textarea = document.getElementById('sms-composer-text') as HTMLTextAreaElement;
  if (textarea && hasPhone) {
    textarea.focus();
    // Select all text for easy replacement
    textarea.setSelectionRange(0, textarea.value.length);
  }
};

(window as any).textContact = (contactId: string) => {
  (window as any).openSmsComposer(contactId);
};

(window as any).filterClients = (status: string) => {
  clientStatusFilter = status;
  renderClients();
};

(window as any).updatePageName = (id: string, name: string) => {
  const page = mockPages.find(p => p.id === id);
  if (page) {
    page.name = name;
    (page as any).updated_at = new Date().toISOString();
  }
};

(window as any).togglePublishFromBuilder = (id: string) => {
  const page = mockPages.find(p => p.id === id);
  if (page) {
    page.status = page.status === 'published' ? 'draft' : 'published';
    (page as any).updated_at = new Date().toISOString();
    renderBuilder();
    if (page.status === 'published') {
      (window as any).showToast('Page published');
    } else {
      (window as any).showToast('Page unpublished');
    }
  }
};

let isAutoSaving = false;
let autoSaveTimeout: any;

// WB.3.5 — Auto-save: debounced 600ms, then persists via API
(window as any).triggerAutoSave = () => {
  isAutoSaving = true;

  // Update header indicator immediately
  const indicator = document.getElementById('pb-autosave-indicator');
  if (indicator) {
    indicator.innerHTML = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ffc107;box-shadow:0 0 5px #ffc107;animation:pb-pulse 1s infinite;"></span> Saving…`;
  }

  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(async () => {
    // Persist to Supabase via internal API
    try {
      await (window as any).savePageSections();
    } catch (err) {
      console.warn('[AutoSave] Persist failed silently:', err);
    }
    isAutoSaving = false;
    const page = mockPages.find((p: any) => p.id === builderPageId);
    if (page) (page as any).updated_at = new Date().toISOString();
    const ind = document.getElementById('pb-autosave-indicator');
    if (ind) {
      ind.innerHTML = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#22c55e;"></span> Saved`;
    }
  }, 600); // 600ms debounce — within the 300–800ms WB.3.5 spec
};


// Builder Rendering Logic
let builderRightPanelTab: 'content' | 'styles' = 'content';
(window as any).setBuilderTab = (tab: 'content' | 'styles') => {
  builderRightPanelTab = tab;
  renderBuilder();
};

// WB.3.4 — Viewport toggle handler
(window as any).setBuilderViewport = (vp: 'mobile' | 'desktop') => {
  builderViewport = vp;
  // Preserve the selected section while re-rendering (no selection reset)
  renderBuilder();
};

function renderBuilder() {
  if (!(document as any).startViewTransition) {
    _renderBuilder();
    return;
  }
  (document as any).startViewTransition(() => {
    _renderBuilder();
  });
}

function _renderBuilder() {
  const page = mockPages.find(p => p.id === builderPageId);
  if (!page) return;

  const sections = mockPageSections
    .filter(s => s.page_id === builderPageId)
    .sort((a, b) => a.order - b.order);

  const selectedSection = sections.find(s => s.id === builderSelectedSectionId);

  app.innerHTML = `
    <main style="width: 100vw; padding: 0; overflow: hidden; height: 100vh; display: flex; flex-direction: column; background: #1a1a1a;">

      <!-- WB.3.6 Sticky Top Bar: always visible, 64px, 44px touch targets -->
      <header class="pb-topbar">

        <!-- Left zone: Back + Page name -->
        <div class="pb-topbar-left">
          <button class="pb-topbar-btn pb-topbar-btn--ghost"
                  id="pb-back-btn"
                  onclick="window.builderGoBack()"
                  title="${builderReturnTo === 'funnels' ? 'Back to Funnels' : 'Back to Pages'}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            ${builderReturnTo === 'funnels' ? 'Funnels' : 'Pages'}
          </button>

          <div class="pb-topbar-divider"></div>

          <input type="text"
                 id="pb-page-name-input"
                 value="${page.name}"
                 onchange="window.updatePageName('${page.id}', this.value)"
                 class="pb-topbar-pagename"
                 title="Click to rename page">
        </div>

        <!-- Center: Viewport toggle (WB.3.4) -->
        <div class="pb-viewport-toggle" role="group" aria-label="Preview viewport">
          <button id="pb-toggle-mobile"
                  class="pb-vt-btn ${builderViewport === 'mobile' ? 'active' : ''}"
                  onclick="window.setBuilderViewport('mobile')"
                  title="Mobile view (375px)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
            Mobile
          </button>
          <button id="pb-toggle-desktop"
                  class="pb-vt-btn ${builderViewport === 'desktop' ? 'active' : ''}"
                  onclick="window.setBuilderViewport('desktop')"
                  title="Desktop view (full width)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="14" rx="2"/><polyline points="8 22 12 18 16 22"/></svg>
            Desktop
          </button>
        </div>

        <!-- Right zone: autosave + actions -->
        <div class="pb-topbar-right">

          <!-- Auto-save indicator (WB.3.5) -->
          <span id="pb-autosave-indicator" class="pb-topbar-save-status">
            <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${isAutoSaving ? '#ffc107' : '#22c55e'};box-shadow:${isAutoSaving ? '0 0 6px #ffc107' : 'none'};"></span>
            ${isAutoSaving ? 'Saving…' : 'Saved'}
          </span>

          <div class="pb-topbar-divider"></div>

          <!-- Preview -->
          <button class="pb-topbar-btn pb-topbar-btn--secondary"
                  id="pb-preview-btn"
                  onclick="window.navigateTo('preview', '${page.slug}')"
                  title="Open live preview in this tab">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Preview
          </button>

          <!-- Publish / Unpublish -->
          <button class="pb-topbar-btn ${page.status === 'published' ? 'pb-topbar-btn--warning' : 'pb-topbar-btn--primary'}"
                  id="pb-publish-btn"
                  onclick="window.togglePublishFromBuilder('${page.id}')"
                  title="${page.status === 'published' ? 'Take page offline' : 'Make page live'}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${page.status === 'published'
              ? '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>'
              : '<polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>'
            }</svg>
            ${page.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </header>

      <div class="pb-layout" style="flex: 1;">
        <!-- Left Panel: Structured Sections -->
        <aside class="pb-left-panel">
          <div class="pb-panel-header">
            <h3>Sections</h3>
            <span style="font-size: 0.7rem; background: #1a472a; color: #4ade80; padding: 2px 8px; border-radius: 4px; font-weight: 700;">WB.3.3</span>
          </div>

          <div class="pb-component-list">
            <div style="font-size: 0.65rem; color: #555; margin-bottom: 14px; line-height: 1.5; padding: 10px; background: #111; border-radius: 6px; border: 1px solid #1e1e1e;">
              Click a section type below to add it to your page. Use ↑↓ on the canvas to reorder.
            </div>

            ${[
      { id: 'comp1',            icon: '🦸',  label: 'Hero',          desc: 'Full-width headline + CTA' },
      { id: 'comp-services',    icon: '⚙️',  label: 'Services',      desc: '4-card service grid' },
      { id: 'comp-testimonials', icon: '💬', label: 'Testimonials',  desc: 'Customer quote block' },
      { id: 'comp6',            icon: '🎯',  label: 'CTA',           desc: 'Conversion call-to-action' },
      { id: 'comp-faq',         icon: '❓',  label: 'FAQ',           desc: 'Expandable Q&A list' },
      { id: 'comp3',            icon: '📋',  label: 'Form',          desc: 'Lead capture form' },
      { id: 'comp4',            icon: '🖼️', label: 'Image',         desc: 'Full-width image' },
      { id: 'comp2',            icon: '📄',  label: 'Text',          desc: 'Rich text block' }
    ].map(item => `
              <div class="pb-component-item" onclick="window.addStructuredSection('${item.id}')">
                <div class="pb-component-icon" style="font-size: 1.2rem;">${item.icon}</div>
                <div>
                  <div style="font-weight: 700; font-size: 0.85rem; color: white;">${item.label}</div>
                  <div style="font-size: 0.7rem; color: #666; margin-top: 2px;">${item.desc}</div>
                </div>
              </div>
            `).join('')}
          </div>

          <div style="margin-top: auto; padding: 15px; background: #111; border-top: 1px solid #222;">
             <select onchange="window.switchBuilderPage(this.value)" style="width: 100%; padding: 10px; border-radius: 6px; background: #000; border: 1px solid #333; color: white; font-size: 0.8rem; font-weight: 600;">
                ${mockPages.map(p => `<option value="${p.id}" ${p.id === builderPageId ? 'selected' : ''}>${p.name}</option>`).join('')}
             </select>
          </div>
        </aside>

        <!-- Center Panel: Live Canvas -->
        <section class="pb-canvas-area" style="overflow-y: auto; height: 100%; padding-bottom: 50px;">

          <!-- Viewport indicator bar -->
          <div style="display:flex; justify-content:center; align-items:center; gap:10px; padding: 14px 0 8px 0; position: sticky; top: 0; z-index: 20; background: #000; border-bottom: 1px solid #111;">
            <span style="font-size:0.7rem; color:#555; font-weight:700; text-transform:uppercase; letter-spacing:0.08em;">Previewing at</span>
            <span style="font-size:0.75rem; font-weight:800; color: ${builderViewport === 'mobile' ? '#60a5fa' : '#a78bfa'}; background: ${builderViewport === 'mobile' ? 'rgba(59,130,246,0.12)' : 'rgba(139,92,246,0.12)'}; padding: 3px 10px; border-radius: 20px;">
              ${builderViewport === 'mobile' ? '📱 375px — Mobile' : '🖥️ Full Width — Desktop'}
            </span>
          </div>

          <div class="pb-canvas-inner pb-canvas-${builderViewport}" style="padding-top: 25px;">
            ${['Add Initial', ...sections].map((item) => {
      const isInitial = item === 'Add Initial';
      const section = isInitial ? null : (item as any);
      const order = isInitial ? 0 : section.order + 0.5;

      return `
                <div class="pb-add-between" onclick="window.showComponentPickerAt('${order}')">
                   <div class="pb-add-btn">+</div>
                </div>
                ${!isInitial ? `
                  <div class="pb-section-preview ${builderSelectedSectionId === section.id ? 'active' : ''}" 
                       onclick="window.selectSectionForBuilder('${section.id}')">
                      
                      <div style="padding: ${section.styles.padding || '60px 20px'}; 
                                  text-align: ${section.styles.text_alignment || section.styles.alignment || section.styles.textAlign || 'left'}; 
                                  background-image: ${section.content.background_image ? `url('${section.content.background_image}')` : 'none'};
                                  background-size: cover;
                                  background-position: center;
                                  background-color: ${section.styles.background || section.styles.backgroundColor || 'white'}; 
                                  color: ${section.styles.color || (section.content.background_image ? 'white' : 'inherit')}; 
                                  width: ${section.styles.width || '100%'};
                                  margin-left: auto; margin-right: auto;
                                  min-height: ${section.type === 'hero' ? '500px' : 'auto'};
                                  display: flex;
                                  flex-direction: column;
                                  justify-content: ${section.type === 'hero' ? 'center' : 'flex-start'};
                                  position: relative;
                                  overflow: hidden;">
                        ${section.content.background_image ? `<div style="position: absolute; inset: 0; background: rgba(0,0,0,0.4);"></div>` : ''}
                        <div style="position: relative; z-index: 1;">
                          ${renderSectionPreviewContent(section)}
                        </div>
                      </div>

                      <div class="pb-section-controls">
                        <span style="font-size: 0.65rem; color: #888; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; margin-right: 4px;">${section.type}</span>
                        <button title="Move Up" onclick="event.stopPropagation(); window.moveSection('${section.id}', -1)" style="background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 5px 10px; cursor: pointer; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">↑ Up</button>
                        <button title="Move Down" onclick="event.stopPropagation(); window.moveSection('${section.id}', 1)" style="background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 5px 10px; cursor: pointer; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">↓ Down</button>
                        <button title="Duplicate section" onclick="event.stopPropagation(); window.duplicateBuilderSection('${section.id}')" style="background: #78350f; color: #fcd34d; border: 1px solid #92400e; padding: 5px 10px; cursor: pointer; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">Copy</button>
                        <button title="Delete section" onclick="event.stopPropagation(); window.removeSection('${section.id}')" style="background: #7f1d1d; color: #fca5a5; border: 1px solid #991b1b; padding: 5px 10px; cursor: pointer; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">🗑 Delete</button>
                      </div>
                  </div>
                ` : ''}
              `;
    }).join('') || `
              <div style="padding: 100px 40px; text-align: center; color: #999; border: 2px dashed #eee; margin: 40px;">
                <h3 style="margin-bottom: 10px;">Your Canvas is Empty</h3>
                <p>Click components on the left to start building your page.</p>
              </div>
            `}
          </div>
        </section>

        <!-- Right Panel: Settings -->
        <aside class="pb-right-panel">
          <div class="pb-panel-header">
             <h3>Inspector</h3>
          </div>
          
          <div class="pb-settings-form">
            ${selectedSection ? renderSectionSettings(selectedSection) : `
              <div style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #555; padding: 40px; border: 1px dashed #333; margin: 20px; border-radius: 8px;">
                <div style="font-size: 2rem; margin-bottom: 15px; opacity: 0.3;">✨</div>
                <div style="font-weight: 700; color: #666; text-transform: uppercase; font-size: 0.65rem; letter-spacing: 1px;">Ready</div>
                <p style="font-size: 0.75rem; margin-top: 10px; color: #444;">Select a page section to edit its content and appearance</p>
              </div>
            `}
          </div>
        </aside>
      </div>
    </main>
  `;
}

function renderSectionSettings(section: any) {
  const isContent = builderRightPanelTab === 'content';
  const isStyles = builderRightPanelTab === 'styles';

  const settingsMarkup = [];

  settingsMarkup.push(`
    <div style="display: flex; border-bottom: 1px solid #333; margin-bottom: 20px;">
      <button style="flex: 1; padding: 10px; background: ${isContent ? '#222' : 'transparent'}; border: none; color: ${isContent ? 'white' : '#888'}; cursor: pointer; border-bottom: ${isContent ? '2px solid var(--primary-color)' : 'none'}; font-weight: 600;" onclick="window.setBuilderTab('content')">Content</button>
      <button style="flex: 1; padding: 10px; background: ${isStyles ? '#222' : 'transparent'}; border: none; color: ${isStyles ? 'white' : '#888'}; cursor: pointer; border-bottom: ${isStyles ? '2px solid var(--primary-color)' : 'none'}; font-weight: 600;" onclick="window.setBuilderTab('styles')">Styles</button>
    </div>
  `);

  if (isContent) {
    settingsMarkup.push(`
      <div style="display: flex; flex-direction: column; gap: 5px;">
    `);

    for (const key in section.content) {
      const val = section.content[key];
      const isImageField = key === 'background_image' || key === 'image_url' || key === 'url' && section.type === 'image';

      if (typeof val === 'string' && !isImageField && key !== 'pipeline_id') {
        settingsMarkup.push(`
           <div class="pb-control-group">
             <label>${key.replace(/_/g, ' ').toUpperCase()}</label>
             <input type="text" class="pb-control-input" value="${val.replace(/"/g, '&quot;')}" oninput="window.updateSpecificField('${section.id}', 'content', '${key}', this.value)">
           </div>
         `);
      } else if (key === 'pipeline_id') {
        settingsMarkup.push(`
           <div class="pb-control-group">
             <label>Target Pipeline</label>
             <select class="pb-control-input" onchange="window.updateSpecificField('${section.id}', 'content', '${key}', this.value)">
               ${mockPipelines.map(p => `<option value="${p.id}" ${p.id === val ? 'selected' : ''}>${p.name}</option>`).join('')}
             </select>
           </div>
         `);
      } else if (isImageField) {
        settingsMarkup.push(`
           <div class="pb-control-group">
             <label>${key.replace(/_/g, ' ').toUpperCase()}</label>
             <div class="pb-asset-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-bottom: 10px;">
               ${mockMedia.map(asset => `
                 <div class="pb-asset-thumb ${val === asset.url ? 'active' : ''}" 
                      style="width: 100%; aspect-ratio: 1; background-image: url('${asset.url}'); background-size: cover; background-position: center; border-radius: 4px; cursor: pointer; border: 2px solid ${val === asset.url ? '#2563EB' : 'transparent'};" 
                      title="${asset.name}"
                      onclick="window.updateSpecificField('${section.id}', 'content', '${key}', '${asset.url}')">
                 </div>
               `).join('')}
             </div>
             <input type="text" class="pb-control-input" style="font-size: 0.7rem;" value="${val}" 
                    oninput="window.updateSpecificField('${section.id}', 'content', '${key}', this.value)" 
                    placeholder="Or paste custom URL...">
           </div>
         `);
      }
    }
    settingsMarkup.push(`</div>`);
  }

  if (isStyles) {
    settingsMarkup.push(`
      <div style="display: flex; flex-direction: column; gap: 5px;">
    `);

    const designFields = [
      { label: 'Background Color', key: 'background', type: 'color' },
      { label: 'Text Alignment', key: 'text_alignment', type: 'select', options: ['left', 'center', 'right'] },
      { label: 'Vertical Padding', key: 'padding', type: 'text' },
      { label: 'Container Width', key: 'width', type: 'text' }
    ];

    designFields.forEach(field => {
      const val = section.styles[field.key] || '';
      settingsMarkup.push(`
        <div class="pb-control-group">
          <label>${field.label.toUpperCase()}</label>
          ${field.type === 'select'
          ? `<select class="pb-control-input" onchange="window.updateSpecificField('${section.id}', 'styles', '${field.key}', this.value)">
                ${field.options!.map(opt => `<option value="${opt}" ${opt === val ? 'selected' : ''}>${opt.toUpperCase()}</option>`).join('')}
               </select>`
          : `<input type="${field.type}" class="pb-control-input" value="${val}" oninput="window.updateSpecificField('${section.id}', 'styles', '${field.key}', this.value)">`
        }
        </div>
      `);
    });
    settingsMarkup.push(`</div>`);
  }

  return settingsMarkup.join('');
}

(window as any).updateSpecificField = (sectionId: string, area: 'content' | 'styles', key: string, value: string) => {
  const section = mockPageSections.find(s => s.id === sectionId);
  if (section) {
    (section as any)[area][key] = value;
    renderBuilder();
    (window as any).triggerAutoSave();
  }
};

/**
 * WB.3.1 — Inline text edit: save without re-rendering the builder.
 * Called from contenteditable onblur. Persists value to the in-memory
 * store and triggers the autosave indicator only.
 */
(window as any).saveInlineEdit = (sectionId: string, field: string, el: HTMLElement) => {
  const section = mockPageSections.find((s: any) => s.id === sectionId);
  if (!section) return;
  const value = el.innerText;
  (section as any).content[field] = value;
  (window as any).triggerAutoSave();
  // Sync inspector panel value if it exists (non-destructive)
  const inspectorInput = document.querySelector(
    `[data-inspector-field="${sectionId}:${field}"]`
  ) as HTMLInputElement | null;
  if (inspectorInput) inspectorInput.value = value;
};

/**
 * WB.3.1 — Inline editable text span helper.
 * Renders a contenteditable span that saves on blur without re-rendering the builder.
 */
function inlineText(sectionId: string, field: string, value: string, extraStyle: string = ''): string {
  const safe = (value || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  return `<span
    class="pb-inline-text"
    contenteditable="true"
    data-section-id="${sectionId}"
    data-field="${field}"
    style="${extraStyle}"
    onclick="event.stopPropagation()"
    onblur="window.saveInlineEdit('${sectionId}', '${field}', this)"
    onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();this.blur();}"
  >${safe}</span>`;
}

function renderSectionPreviewContent(section: any) {
  const content = section.content;
  const id = section.id;

  switch (section.type) {
    case 'hero': {
      const headingField = content.heading !== undefined ? 'heading' : 'title';
      const subField = content.subheading !== undefined ? 'subheading' : 'subtitle';
      const btnField = content.button_text !== undefined ? 'button_text' : 'buttonText';
      const textAlign = section.styles.text_alignment === 'center' ? 'auto' : '0';
      return `
        <h1 style="font-size: 3rem; margin-bottom: 1.5rem; font-weight: 800;">
          ${inlineText(id, headingField, content[headingField] || 'Hero Heading', 'display:block;width:100%;')}
        </h1>
        <p style="font-size: 1.5rem; opacity: 0.9; margin-bottom: 2.5rem; max-width: 600px; margin-left: ${textAlign}; margin-right: ${textAlign};">
          ${inlineText(id, subField, content[subField] || 'Hero Subheading', 'display:block;width:100%;')}
        </p>
        <button class="btn-primary" style="padding: 15px 30px; font-size: 1.1rem; border-radius: 50px; pointer-events: none;">
          ${inlineText(id, btnField, content[btnField] || 'Action')}
        </button>
      `;
    }
    case 'text': {
      return `
        <div style="line-height: 1.6; font-size: ${section.styles.font_size || 'inherit'}">
          ${inlineText(id, 'text', content.text || 'Text content goes here...', 'display:block;width:100%;white-space:pre-wrap;')}
        </div>`;
    }
    case 'image': {
      const imgSrc = content.image_url || content.url || '';
      const imgField = content.image_url !== undefined ? 'image_url' : 'url';
      const hasImage = Boolean(imgSrc);
      return `
        <div class="pb-image-wrapper"
             id="imgwrap-${id}"
             onclick="window.openImagePicker('${id}', '${imgField}')"
             title="Click to replace image">
          ${hasImage
            ? `<img id="pb-img-${id}" src="${imgSrc}" alt="Section image"
                    style="width: 100%; height: auto; display: block; border-radius: inherit;">`
            : `<div class="pb-image-placeholder" id="pb-img-${id}">
                 <span style="font-size:2.5rem;">🖼️</span>
                 <span style="font-size:0.9rem; font-weight:600; color:#94a3b8;">Click to add an image</span>
               </div>`
          }
          <div class="pb-image-overlay">
            <span class="pb-image-overlay-icon">📷</span>
            <span>Click to replace</span>
          </div>
          <div class="pb-image-upload-progress" id="pb-img-progress-${id}" style="display:none;">
            <div class="pb-image-spinner"></div>
            <span>Reading file…</span>
          </div>
        </div>`;
    }
    case 'form': {
      return `
        <h3 style="margin-bottom: 20px; color: var(--primary-color);">
          ${inlineText(id, 'title', content.title || 'Contact Form', 'display:block;width:100%;')}
        </h3>
        <div style="display: flex; flex-direction: column; gap: 15px;">
          ${(content.fields || []).map((f: string) => `
            <div class="form-group" style="margin-bottom: 0;">
              <input type="${f === 'email' ? 'email' : 'text'}"
                     id="pf-${f}-${id}"
                     placeholder="Your ${f.charAt(0).toUpperCase() + f.slice(1)}"
                     style="padding: 12px; border: 1px solid #cbd5e0; border-radius: 6px; width: 100%;">
            </div>
          `).join('')}
          <button class="btn-primary" style="padding: 14px; font-weight: 700; margin-top: 10px; pointer-events: none;">
            ${inlineText(id, 'submit_label', content.submit_label || 'Submit Request')}
          </button>
        </div>
      `;
    }
    case 'button': {
      const sizeMap: any = { small: '8px 16px', medium: '12px 24px', large: '16px 32px' };
      const btnField = content.label !== undefined ? 'label' : 'text';
      return `<button class="btn-primary" style="background: ${section.styles.color || 'var(--primary-color)'}; padding: ${sizeMap[section.styles.size] || '12px 24px'}; pointer-events: none;">
        ${inlineText(id, btnField, content[btnField] || 'Click Here')}
      </button>`;
    }
    case 'cta': {
      return `
        <div style="text-align: center; padding: 40px 20px;">
          <h2 style="font-size: 2.2rem; margin-bottom: 12px; font-weight: 800;">
            ${inlineText(id, 'heading', content.heading || 'Ready to get started?', 'display:block;width:100%;')}
          </h2>
          <p style="font-size: 1.1rem; opacity: 0.8; margin-bottom: 28px;">
            ${inlineText(id, 'subtext', content.subtext || 'Join thousands of happy customers.', 'display:block;width:100%;')}
          </p>
          <button class="btn-primary" style="padding: 14px 32px; font-size: 1.1rem; border-radius: 50px; pointer-events: none;">
            ${inlineText(id, 'button_text', content.button_text || 'Get Started')}
          </button>
        </div>`;
    }
    case 'testimonial': {
      return `
        <div style="text-align: center; padding: 40px 20px;">
          <p style="font-size: 1.3rem; font-style: italic; margin-bottom: 20px; opacity: 0.9;">
            &ldquo;${inlineText(id, 'quote', content.quote || 'This service changed everything for us.', 'display:inline;')}&rdquo;
          </p>
          <strong style="font-size: 1rem;">&mdash; ${inlineText(id, 'author', content.author || 'Happy Customer', 'display:inline;')}</strong>
        </div>`;
    }
    case 'pricing': {
      return `
        <div style="text-align: center; padding: 40px 20px;">
          <h2 style="font-size: 2rem; font-weight: 800; margin-bottom: 8px;">${inlineText(id, 'plan_name', content.plan_name || 'Standard Plan', 'display:block;width:100%;')}</h2>
          <div style="font-size: 3rem; font-weight: 900; color: var(--primary-color); margin: 12px 0;">${inlineText(id, 'price', content.price || '$99', 'display:inline;')}</div>
          <p style="opacity: 0.7; margin-bottom: 24px;">${inlineText(id, 'description', content.description || 'Everything you need to get started.', 'display:block;width:100%;')}</p>
          <button class="btn-primary" style="padding: 14px 32px; font-size: 1.1rem; pointer-events: none;">${inlineText(id, 'cta', content.cta || 'Choose Plan')}</button>
        </div>`;
    }
    // ── WB.3.3 Structured Section Types ─────────────────────────────────────
    case 'services': {
      const items: any[] = content.items || [];
      return `
        <div style="padding: 60px 40px;">
          <div style="text-align: center; margin-bottom: 48px;">
            <h2 style="font-size: 2.2rem; font-weight: 800; margin-bottom: 12px;">
              ${inlineText(id, 'heading', content.heading || 'Our Services', 'display:block;width:100%;')}
            </h2>
            <p style="font-size: 1.1rem; opacity: 0.7; max-width: 560px; margin: 0 auto;">
              ${inlineText(id, 'subheading', content.subheading || 'Everything you need, done right.', 'display:block;width:100%;')}
            </p>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px;">
            ${items.map((item: any, idx: number) => `
              <div style="background: #f8fafc; border-radius: 12px; padding: 28px 20px; text-align: center; border: 1px solid #e2e8f0; transition: box-shadow 0.2s;">
                <div style="font-size: 2.5rem; margin-bottom: 14px;">${item.icon || '✨'}</div>
                <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 8px; color: #1e293b;">${item.title || 'Service ' + (idx + 1)}</h3>
                <p style="font-size: 0.875rem; color: #64748b; line-height: 1.6;">${item.description || ''}</p>
              </div>
            `).join('')}
          </div>
        </div>`;
    }
    case 'faq': {
      const faqs: any[] = content.items || [];
      return `
        <div style="padding: 60px 40px; max-width: 800px; margin: 0 auto;">
          <h2 style="font-size: 2.2rem; font-weight: 800; margin-bottom: 36px; text-align: center;">
            ${inlineText(id, 'heading', content.heading || 'Frequently Asked Questions', 'display:block;width:100%;')}
          </h2>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${faqs.map((faq: any, idx: number) => `
              <div class="pb-faq-item" style="border: 2px solid #f1f5f9; border-radius: 12px; overflow: hidden; background: #fff; transition: border-color 0.2s;">
                <button class="pb-faq-toggle" onclick="this.closest('.pb-faq-item').classList.toggle('open'); event.stopPropagation();"
                        style="width: 100%; text-align: left; padding: 20px 24px; background: transparent; border: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 1.1rem; font-weight: 700; color: #1e293b;">
                  <span>${faq.question || 'Question ' + (idx + 1)}</span>
                  <span class="pb-faq-chevron" style="font-size: 0.85rem; color: #94a3b8; transition: transform 250ms ease;">▼</span>
                </button>
                <div class="pb-faq-answer" style="padding: 0 24px; max-height: 0; overflow: hidden; transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);">
                  <p style="padding-bottom: 20px; color: #475569; line-height: 1.7; font-size: 1rem;">${faq.answer || 'Answer goes here...'}</p>
                </div>
              </div>
            `).join('')}
          </div>
          <style>
            .pb-faq-item.open { border-color: var(--primary-color) !important; }
            .pb-faq-item.open .pb-faq-chevron { transform: rotate(180deg); color: var(--primary-color) !important; }
            .pb-faq-item.open .pb-faq-answer { max-height: 500px !important; padding-top: 5px !important; }
          </style>
        </div>`;
    }
    case 'social-proof': {
      const tests: any[] = content.testimonials || [];
      const ba = content.before_after || {};
      return `
        <div class="social-proof-container" style="text-align: center;">
          <h2 style="font-size: 2.2rem; font-weight: 800; margin-bottom: 12px;">
            ${inlineText(id, 'title', content.title || 'Don’t Just Take Our Word For It', 'display:block;width:100%;')}
          </h2>
          <p style="font-size: 1.1rem; opacity: 0.7; margin-bottom: 48px;">
            ${inlineText(id, 'subtitle', content.subtitle || 'See the results we achieve for homeowners like you.', 'display:block;width:100%;')}
          </p>
          
          <div class="ba-grid">
            <div class="ba-card" onclick="window.openImagePicker('${id}', 'before_after.before'); event.stopPropagation();" title="Click to replace BEFORE image">
              <img src="${ba.before}" alt="Before">
              <span class="ba-label">Before</span>
              <div class="pb-image-overlay" style="display:flex; justify-content:center; align-items:center; background:rgba(0,0,0,0.4);"><span style="color:white; font-size:1.5rem;">📷 Replace</span></div>
            </div>
            <div class="ba-card" onclick="window.openImagePicker('${id}', 'before_after.after'); event.stopPropagation();" title="Click to replace AFTER image">
              <img src="${ba.after}" alt="After">
              <span class="ba-label">After</span>
              <div class="pb-image-overlay" style="display:flex; justify-content:center; align-items:center; background:rgba(0,0,0,0.4);"><span style="color:white; font-size:1.5rem;">📷 Replace</span></div>
            </div>
          </div>

          <div class="testimonials-row">
            ${tests.map((t: any, idx: number) => `
              <div class="testimonial-card">
                <div class="testimonial-stars">
                  ${'★'.repeat(t.stars || 5)}${'☆'.repeat(5 - (t.stars || 5))}
                </div>
                <p class="testimonial-quote">&ldquo;${t.quote}&rdquo;</p>
                <div class="testimonial-author">&mdash; ${t.name}</div>
              </div>
            `).join('')}
          </div>
          <p style="font-size: 0.8rem; color: #94a3b8; margin-top: 15px;">* Testimonials can be edited via the data panel or direct JSON for now.</p>
        </div>
      `;
    }
    case 'urgency': {
      return `
        <div class="urgency-container">
          <div class="urgency-badge">${inlineText(id, 'badge', content.badge || 'Limited Time', 'display:inline;')}</div>
          <div class="urgency-headline">${inlineText(id, 'headline', content.headline || 'Same-Day Service Available', 'display:block;width:100%;')}</div>
          <div class="urgency-subtext">${inlineText(id, 'subtext', content.subtext || 'Don’t wait — spots are filling up fast!', 'display:block;width:100%;')}</div>
        </div>
      `;
    }
    default:
      return `<pre>${JSON.stringify(content, null, 2)}</pre>`;
  }
}

// ── WB.3.2 Image Picker ─────────────────────────────────────────────────────
/**
 * Opens a hidden file-input, reads the selected image as a data URL,
 * updates the canvas img element in-place (no re-render flicker),
 * persists to the in-memory store, and fires auto-save.
 */
(window as any).openImagePicker = (sectionId: string, field: string) => {
  // Avoid stacking inputs
  const existingInput = document.getElementById('pb-hidden-file-input');
  if (existingInput) existingInput.remove();

  const input = document.createElement('input');
  input.id = 'pb-hidden-file-input';
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;

    // Show loading overlay on the image wrapper
    const progress = document.getElementById(`pb-img-progress-${sectionId}`);
    const wrapper  = document.getElementById(`imgwrap-${sectionId}`);
    if (progress) progress.style.display = 'flex';
    if (wrapper)  wrapper.style.pointerEvents = 'none';

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;

      // ── 1. Instant DOM patch (no full re-render) ──────────────────────
      const imgEl = document.getElementById(`pb-img-${sectionId}`) as HTMLImageElement | null;
      if (imgEl && imgEl.tagName === 'IMG') {
        imgEl.src = dataUrl;
      } else if (imgEl) {
        // Was placeholder div — replace with real img
        const newImg = document.createElement('img');
        newImg.id = `pb-img-${sectionId}`;
        newImg.src = dataUrl;
        newImg.alt = 'Section image';
        newImg.style.cssText = 'width:100%;height:auto;display:block;border-radius:inherit;';
        imgEl.replaceWith(newImg);
      }

      // ── 2. Persist to in-memory store ──────────────────────────────────
      const section = mockPageSections.find((s: any) => s.id === sectionId);
      if (section) {
        (section as any).content[field] = dataUrl;
        (window as any).triggerAutoSave();
      }


(window as any).openBuilderFromFunnel = (pageId: string, funnelId: string) => {
  builderPageId = pageId;
  builderReturnTo = 'funnels';
  builderReturnFunnelId = funnelId;
  (window as any).navigateTo('builder');
};

      // ── 3. Dismiss loading state ──────────────────────────────────────
      if (progress) progress.style.display = 'none';
      if (wrapper)  wrapper.style.pointerEvents = '';
      (window as any).showToast('Image updated ✓');

      input.remove();
    };

    reader.onerror = () => {
      if (progress) progress.style.display = 'none';
      if (wrapper)  wrapper.style.pointerEvents = '';
      (window as any).showToast('Could not read image file.');
      input.remove();
    };

    reader.readAsDataURL(file);
  });

  // Trigger the native file picker
  input.click();
};

// Global functions for Builder interaction

// WB.3.6 — Builder Navigation Handlers
(window as any).builderGoBack = () => {
  const target = builderReturnTo === 'funnels' ? 'funnel-detail' : 'pages';
  const param = builderReturnTo === 'funnels' ? builderReturnFunnelId : undefined;
  (window as any).navigateTo(target, param);
};

(window as any).openBuilderFromFunnel = (pageId: string, funnelId: string) => {
  builderPageId = pageId;
  builderReturnTo = 'funnels';
  builderReturnFunnelId = funnelId;
  (window as any).navigateTo('builder');
};

(window as any).switchBuilderPage = (id: string, source: 'pages' | 'footer' = 'pages', noSkeleton = false) => {
  builderPageId = id;
  builderSelectedSectionId = null;
  builderInsertOrder = null;

  if (source === 'pages') {
    builderReturnTo = 'pages';
    builderReturnFunnelId = null;
  }

  if (!noSkeleton) {
    app.innerHTML = `
      <main style="width: 100vw; padding: 0; overflow: hidden; height: 100vh; display: flex; flex-direction: column; background: #1a1a1a;">
        <header style="background: #111; border-bottom: 1px solid #333; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 100; flex-shrink: 0; height: 60px; box-sizing: border-box;">
           <div class="skeleton skeleton-title" style="width: 200px; margin: 0;"></div>
           <div class="skeleton skeleton-title" style="width: 300px; margin: 0;"></div>
        </header>
        <div class="pb-layout" style="flex: 1; display: flex;">
           <div style="width: 280px; background: #161616; padding: 20px; border-right: 1px solid #222;">
              <div class="skeleton skeleton-row" style="margin-bottom: 20px;"></div>
              <div class="skeleton skeleton-rect" style="height: 120px; margin-bottom: 20px;"></div>
              <div class="skeleton skeleton-rect" style="height: 120px; margin-bottom: 20px;"></div>
           </div>
           <div style="flex: 1; padding: 40px; display: flex; flex-direction: column; gap: 30px; background: #000;">
              <div class="skeleton skeleton-rect" style="height: 400px; border-radius: 8px;"></div>
              <div class="skeleton skeleton-rect" style="height: 200px; border-radius: 8px;"></div>
           </div>
        </div>
      </main>
    `;
    setTimeout(() => renderBuilder(), 400);
  } else {
    renderBuilder();
  }
};

(window as any).selectSectionForBuilder = (id: string) => {
  builderSelectedSectionId = id;
  builderInsertOrder = null;
  renderBuilder();
};

(window as any).showComponentPickerAt = (order: string) => {
  builderInsertOrder = parseFloat(order);
  (window as any).navigateTo('components');
};
(window as any).duplicateBuilderSection = (id: string) => {
  const section = mockPageSections.find(s => s.id === id);
  if (!section) return;
  const newSection = {
    ...section,
    id: `sec-${Date.now()}`,
    content: JSON.parse(JSON.stringify(section.content)),
    styles: JSON.parse(JSON.stringify(section.styles)),
    order: section.order + 0.1
  };
  mockPageSections.push(newSection);
  renderBuilder();
  (window as any).triggerAutoSave();
};

(window as any).addStructuredSection = (componentId: string) => {
  const component = mockComponents.find((c: any) => c.id === componentId);
  if (!component) return;

  const currentSections = mockPageSections.filter((s: any) => s.page_id === builderPageId);
  const orderToInsertAt = builderInsertOrder !== null
    ? builderInsertOrder
    : Math.max(...currentSections.map((s: any) => s.order), 0) + 1;

  builderInsertOrder = null;

  const newSection = {
    id: `sec-${Date.now()}`,
    page_id: builderPageId,
    type: component.type,
    content: JSON.parse(JSON.stringify(component.default_content)),
    styles: JSON.parse(JSON.stringify(component.default_styles)),
    order: orderToInsertAt
  };

  mockPageSections.push(newSection);
  builderSelectedSectionId = newSection.id;
  (window as any).triggerAutoSave();
  renderBuilder(); // stay on builder — no navigation
  // Scroll newly added section into view
  setTimeout(() => {
    document.getElementById(`sec-preview-${newSection.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 80);
};

// Keep legacy addSectionToPage working (used by duplicateBuilderSection + right-panel)
(window as any).addSectionToPage = (componentId: string) => {
  (window as any).addStructuredSection(componentId);
};

(window as any).removeSection = (id: string) => {
  const index = mockPageSections.findIndex(s => s.id === id);
  if (index !== -1) {
    mockPageSections.splice(index, 1);
    if (builderSelectedSectionId === id) builderSelectedSectionId = null;
    builderInsertOrder = null;
    renderBuilder();
    (window as any).triggerAutoSave();
  }
};

(window as any).moveSection = (id: string, direction: number) => {
  const pageSections = mockPageSections
    .filter(s => s.page_id === builderPageId)
    .sort((a, b) => a.order - b.order);

  const index = pageSections.findIndex(s => s.id === id);
  const newIndex = index + direction;

  if (newIndex >= 0 && newIndex < pageSections.length) {
    const section1 = pageSections[index];
    const section2 = pageSections[newIndex];

    const tempOrder = section1.order;
    section1.order = section2.order;
    section2.order = tempOrder;

    renderBuilder();
    (window as any).triggerAutoSave();
  }
};

(window as any).updateSectionData = (id: string, field: 'content' | 'styles', value: string) => {
  const section = mockPageSections.find(s => s.id === id);
  if (!section) return;

  try {
    section[field] = JSON.parse(value);
    renderBuilder(); // Live update!
  } catch (e) {
    // Silently ignore invalid JSON while typing
  }
};

// ── WB.3.5 Toast with type variants ──────────────────────────────────────────
(window as any).showToast = (message: string, type: 'success' | 'error' | 'saving' | 'info' = 'info') => {
  // Remove any existing same-type toast to avoid stacking
  document.querySelectorAll(`.pb-toast-${type}`).forEach(el => el.remove());

  const colours: Record<string, { border: string; bg: string; icon: string }> = {
    success: { border: '#22c55e', bg: '#052e16',  icon: '✓' },
    error:   { border: '#ef4444', bg: '#1c0a0a',  icon: '✕' },
    saving:  { border: '#f59e0b', bg: '#1c1405',  icon: '↑' },
    info:    { border: '#3b82f6', bg: '#0c1a2e',  icon: 'ℹ' },
  };
  const c = colours[type] ?? colours.info;

  const toast = document.createElement('div');
  toast.className = `pb-toast-${type}`;
  toast.innerHTML = `
    <span style="font-size:1rem;line-height:1;">${c.icon}</span>
    <span>${message}</span>
  `;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${c.bg};
    color: #fff;
    padding: 12px 20px;
    border-radius: 10px;
    font-size: 0.875rem;
    font-weight: 600;
    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
    z-index: 10000;
    opacity: 0;
    transform: translateY(16px) scale(0.96);
    transition: opacity 220ms ease, transform 220ms cubic-bezier(0.34,1.56,0.64,1);
    border: 1px solid ${c.border};
    border-left: 4px solid ${c.border};
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 320px;
    pointer-events: none;
  `;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0) scale(1)';
  });

  // Auto-dismiss
  const ttl = type === 'saving' ? 2000 : 3500;
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(16px) scale(0.96)';
    setTimeout(() => toast.remove(), 250);
  }, ttl);
};

// ── WB.3.5 savePageSections — persists current page sections to Supabase via API
(window as any).savePageSections = async () => {
  const sections = mockPageSections.filter((s: any) => s.page_id === builderPageId);
  try {
    const res = await fetch(`/api/pages/${builderPageId}/sections`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${(window as any).__authToken ?? ''}` },
      body: JSON.stringify({ sections })
    });
    const data = await res.json();
    if (data.success) {
      (window as any).showToast('Saved ✓', 'success');
    } else {
      // Fail silently in indicator but log for debugging
      console.warn('[AutoSave] Section persist failed:', data.error);
    }
  } catch (err) {
    // Network errors don't disrupt editing
    console.warn('[AutoSave] Fetch error:', err);
  }
};

// Attach to window for global access/testing
(window as any).createLead = createLead;

(window as any).submitBuilderForm = async (sectionId: string, isPublic: boolean = false) => {
  const section = mockPageSections.find(s => s.id === sectionId);
  if (!section) return;

  const prefix = isPublic ? 'site-f-' : 'pf-';

  const nameInput = document.getElementById(`${prefix}name-${sectionId}`) as HTMLInputElement;
  const phoneInput = document.getElementById(`${prefix}phone-${sectionId}`) as HTMLInputElement;
  const emailInput = document.getElementById(`${prefix}email-${sectionId}`) as HTMLInputElement;
  const addressInput = document.getElementById(`${prefix}address-${sectionId}`) as HTMLInputElement;
  const serviceInput = document.getElementById(`${prefix}service_type-${sectionId}`) as HTMLSelectElement;
  const messageInput = document.getElementById(`${prefix}message-${sectionId}`) as HTMLTextAreaElement;

  const sectionWrapper = document.getElementById(`form-wrapper-${sectionId}`);
  const submitBtn = document.querySelector(`#form-wrapper-${sectionId} .btn-primary`) as HTMLButtonElement;
  const originalBtnText = submitBtn?.innerHTML || 'Submit';

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span style="display:inline-flex; align-items:center; gap:8px;"><svg class="animate-spin" style="width:18px; height:18px;" viewBox="0 0 24 24"><circle style="opacity:0.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path style="opacity:0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Sending...</span>';
    }

    // 🌿 WB.5.1: Attach Funnel Attribution
    const page = mockPages.find(p => p.id === section.page_id);
    const leadData = {
      name: nameInput?.value || '',
      phone: phoneInput?.value,
      email: emailInput?.value,
      address: addressInput?.value,
      service_type: serviceInput?.value,
      message: messageInput?.value,
      source: 'funnel',
      funnel_id: page?.funnel_id,
      page_id: section.page_id
    };

    const res = await createLead(leadData);

    console.log("Lead created:", res);
    
    // Confident Success State (WB.4.3)
    if (sectionWrapper) {
      sectionWrapper.innerHTML = `
        <div style="text-align: center; padding: 40px 10px; animation: fadeIn 0.5s ease-out;">
          <div style="font-size: 4rem; margin-bottom: 24px; display: inline-block; animation: bounce 1s cubic-bezier(0.175, 0.885, 0.32, 1.275);">✅</div>
          <h3 style="font-size: 2rem; font-weight: 800; margin-bottom: 16px; color: #1e293b; letter-spacing: -0.5px;">Thanks! We'll call you shortly.</h3>
          <p style="font-size: 1.15rem; color: #64748b; line-height: 1.6; max-width: 320px; margin: 0 auto 30px;">
            Most customers hear back within <b style="color: var(--primary-color);">5 minutes</b>.
          </p>
          <div style="padding-top: 20px; border-top: 1px solid #f1f5f9;">
             <p style="font-weight: 700; color: #94a3b8; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">Request Captured Successfully</p>
          </div>
        </div>
      `;
    }

  } catch (error: any) {
    console.error("Lead submission failed:", error);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
    alert('Something went wrong. Please try again.');
  }
};

function renderPublicHeader(config: any, settings: any) {
  return `
    <header style="padding: 20px 40px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: rgba(255,255,255,0.9); backdrop-filter: blur(8px); z-index: 100; transition: top 0.3s ease;">
      <div style="display: flex; align-items: center; gap: 15px;">
         ${config.logo_url || settings.logo_url ? `<img src="${config.logo_url || settings.logo_url}" style="height: 40px; width: 40px; border-radius: 8px; object-fit: cover;">` : ''}
         <span style="font-weight: 800; font-size: 1.25rem; color: #1e293b;">${config.logo_text || settings.business_name}</span>
      </div>
      <nav style="display: flex; gap: 24px; align-items: center;">
         ${(config.nav_items || []).map((item: any) => `
           <a href="${item.path}" 
              onclick="event.preventDefault(); window.navigateTo('site', '${item.path}')"
              style="text-decoration: none; color: #475569; font-weight: 600; font-size: 0.95rem; transition: color 0.2s;" 
              onmouseover="this.style.color='var(--primary-color)'" 
              onmouseout="this.style.color='#475569'">
              ${item.label}
           </a>
         `).join('')}
         ${config.cta_text ? `
           <a href="${config.cta_link || '#'}" class="btn-primary" style="padding: 10px 20px; font-size: 0.9rem; border-radius: 8px; text-decoration: none;">${config.cta_text}</a>
         ` : `
           <a href="tel:${settings.phone}" style="color: var(--primary-color); font-weight: 700; text-decoration: none;">📞 ${settings.phone}</a>
         `}
      </nav>
    </header>
  `;
}

function renderPublicFooter(config: any, settings: any) {
  const businessName = config.business_name || settings.business_name;
  const phone = config.phone_number || settings.phone;
  const serviceArea = config.service_area || 'Your Local Area';
  const cta = config.cta_text || 'Get My Free Quote';
  const links = config.links || [];
  const copyright = `© ${new Date().getFullYear()} ${businessName}. All rights reserved.`;

  return `
    <footer style="padding: 60px 20px; background: #0f172a; color: #f8fafc; margin-top: 80px; border-top: 4px solid var(--primary-color);">
      <div style="max-width: 1200px; margin: 0 auto;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 40px; margin-bottom: 40px;">
          
          <!-- Trust & Branding -->
          <div>
            <h3 style="color: white; font-size: 1.5rem; font-weight: 800; margin-bottom: 16px; letter-spacing: -0.5px;">${businessName}</h3>
            <p style="color: #94a3b8; line-height: 1.6; font-size: 0.95rem; margin-bottom: 24px;">
              Providing professional exterior cleaning and restoration services with a focus on quality, reliability, and customer satisfaction.
            </p>
            <div style="display: flex; align-items: center; gap: 10px; color: #3b82f6; font-weight: 600;">
              <span style="font-size: 1.2rem;">📍</span>
              <span>Serving ${serviceArea}</span>
            </div>
          </div>

          <!-- Quick Navigation -->
          <div>
            <h4 style="color: white; font-size: 1.1rem; font-weight: 700; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px;">Navigation</h4>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${links.map((l: any) => `
                <a href="${l.path}" 
                   onclick="event.preventDefault(); window.navigateTo('site', '${l.path}')"
                   style="color: #94a3b8; text-decoration: none; font-size: 0.9rem; transition: all 0.2s;" onmouseover="this.style.color='white'; this.style.paddingLeft='4px'" onmouseout="this.style.color='#94a3b8'; this.style.paddingLeft='0'">
                  ${l.label}
                </a>
              `).join('')}
            </div>
          </div>

          <!-- Immediate Contact -->
          <div>
            <h4 style="color: white; font-size: 1.1rem; font-weight: 700; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px;">Contact Us</h4>
            <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 20px;">Questions? Call us directly for immediate assistance.</p>
            <a href="tel:${phone}" style="display: flex; align-items: center; gap: 12px; color: white; text-decoration: none; font-size: 1.4rem; font-weight: 800; margin-bottom: 20px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
               <span style="background: var(--primary-color); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 1.1rem;">📞</span>
               <span>${phone}</span>
            </a>
            <button class="btn-primary" style="width: 100%; padding: 14px; border-radius: 8px; font-weight: 700; font-size: 1rem; box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4); border: none; cursor: pointer;" onclick="document.querySelector('.site-form-section')?.scrollIntoView({behavior: 'smooth'})">
              ${cta}
            </button>
          </div>

        </div>

        <!-- Footer Bottom -->
        <div style="padding-top: 30px; border-top: 1px solid #1e293b; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 20px; color: #64748b; font-size: 0.85rem;">
          <div>${copyright}</div>
          <div style="display: flex; gap: 20px; flex-wrap: wrap;">
             <span style="display: flex; align-items: center; gap: 6px;"><span style="color: #22c55e;">●</span> Fully Insured</span>
             <span style="display: flex; align-items: center; gap: 6px;"><span style="color: #22c55e;">●</span> Licensed Professionals</span>
          </div>
          <button onclick="window.navigateTo('dashboard')" style="background: none; border: 1px solid #334155; padding: 6px 16px; border-radius: 6px; cursor: pointer; color: inherit; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.borderColor='#475569'; this.style.color='white'" onmouseout="this.style.borderColor='#334155'; this.style.color='inherit'">
            Admin Access
          </button>
        </div>
      </div>
    </footer>
  `;
}

function render404(message?: string) {
  app.innerHTML = `
    <div style="padding: 100px; text-align: center; font-family: 'Inter', sans-serif; background: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
      <h1 style="font-size: 8rem; font-weight: 900; color: #e2e8f0; margin: 0; line-height: 1;">404</h1>
      <h2 style="font-size: 2rem; color: #1e293b; margin-top: -20px; font-weight: 800;">Page Not Found</h2>
      <p style="color: #64748b; margin: 20px 0 40px; font-size: 1.1rem; max-width: 400px; line-height: 1.6;">
        ${message || 'The requested URL was not found on this server.'}
      </p>
      <div style="display: flex; gap: 16px;">
        <button class="btn-primary" onclick="window.location.href='/'" style="padding: 12px 30px; border-radius: 50px;">Go Home</button>
        <button style="background: white; border: 1px solid #e2e8f0; padding: 12px 30px; border-radius: 50px; cursor: pointer; font-weight: 600; color: #475569;" onclick="window.navigateTo('dashboard')">Back to CRM</button>
      </div>
    </div>
  `;
}

async function renderSitePage(funnel_id: string, website: any, isPreview: boolean = false) {
  // 1. Fetch Funnel Data
  const funnel = mockFunnels.find(f => f.id === funnel_id);
  // In the resolver, it correctly identifies the funnel_id.
  
  // 2. Identify primary page/step in that funnel
  const page = mockPages.find(p => p.funnel_id === funnel_id);
  
  if (!page || (!isPreview && page.status !== 'published')) {
    render404(!page ? 'No page mapped to this funnel.' : 'This page is currently a draft.');
    return;
  }

  const settings = getWebsiteSettings();
  // Fetch layout for this specific website
  const layout = mockWebsiteLayouts.find(l => l.website_id === website.id) || getWebsiteLayout(); 
  
  const sections = mockPageSections
    .filter(s => s.page_id === page.id)
    .sort((a, b) => a.order - b.order);

  // Inject Tracking Scripts
  if (!isPreview) {
    if (settings.facebook_pixel_id) {
      const script = document.createElement('script');
      script.innerHTML = `
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${settings.facebook_pixel_id}'); fbq('track', 'PageView');
        `;
      document.head.appendChild(script);
    }
    if (settings.gtm_id) {
      const script = document.createElement('script');
      script.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s),j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${settings.gtm_id}');`;
      document.head.appendChild(script);
    }
  }

  app.innerHTML = `
    <div class="public-site ${!isPreview ? 'has-cta-bar' : ''}" style="min-height: 100vh; background: white; font-family: 'Inter', sans-serif;">
      ${isPreview ? `<div style="background: #fdf2f2; color: #dc2626; padding: 10px; text-align: center; font-weight: 700; border-bottom: 1px solid #fee2e2; position: sticky; top: 0; z-index: 9999;">PREVIEW MODE: You are viewing a draft version of "${page.name}"</div>` : ''}
      
      ${!isPreview ? `
        <div id="site-cta-bar" class="cta-bar">
          <a href="tel:${settings.phone}" class="cta-bar-btn cta-bar-btn--call">
            <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
            <span>Call Now</span>
          </a>
          <button class="cta-bar-btn cta-bar-btn--quote" onclick="document.querySelector('.site-form-section')?.scrollIntoView({behavior: 'smooth'})">
            <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            <span>Get Free Quote</span>
          </button>
        </div>
      ` : ''}

      ${renderPublicHeader(layout.header_config, settings)}

      ${sections.map(section => {
    // Inject global variables into section content if needed
    const content = { ...section.content, business_name: settings.business_name, phone: settings.phone };
    return renderSection(section.type, content, section.styles, section.id);
  }).join('')}

      ${renderPublicFooter(layout.footer_config, settings)}
    </div>
  `;

  // Update SEO
  const seoTitle = page.seo_title || page.name;
  document.title = `${seoTitle} | ${settings.business_name}`;
  updateMetaTag('description', page.seo_description || '');
  updateMetaTag('keywords', (page.seo_keywords || []).join(', '));

  // Tracking Simulations (Phase Debug)
  if ((window as any).mockGlobalSettings?.fbPixelId) {
    if (!document.getElementById('fb-pixel-sim')) {
      const t = document.createElement('script');
      t.id = 'fb-pixel-sim';
      t.innerHTML = `console.log("FB Pixel [${(window as any).mockGlobalSettings.fbPixelId}] Initialized"); window.fbq = function() { console.log('fbq:', arguments); };`;
      document.head.appendChild(t);
    }
  }
  if ((window as any).mockGlobalSettings?.gtmId) {
    if (!document.getElementById('gtm-sim')) {
      const t = document.createElement('script');
      t.id = 'gtm-sim';
      t.innerHTML = `console.log("GTM [${(window as any).mockGlobalSettings.gtmId}] Initialized"); window.dataLayer = window.dataLayer || [];`;
      document.head.appendChild(t);
    }
  }
}

function updateMetaTag(name: string, content: string) {
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', name);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content || '');
}

function renderSection(type: string, content: any, styles: any, id: string) {
  return `
    <section id="section-${id}" style="
      padding: ${styles.padding || '60px 20px'};
      text-align: ${styles.text_alignment || styles.alignment || styles.textAlign || 'left'};
      background-image: ${content.background_image ? `url('${content.background_image}')` : 'none'};
      background-size: cover;
      background-position: center;
      background-color: ${styles.background || styles.backgroundColor || 'transparent'};
      color: ${styles.color || (content.background_image ? 'white' : 'inherit')};
      width: ${styles.width || '100%'};
      margin: 0 auto;
      min-height: ${type === 'hero' ? '70vh' : 'auto'};
      display: flex;
      flex-direction: column;
      justify-content: ${type === 'hero' ? 'center' : 'flex-start'};
      position: relative;
    ">
      ${content.background_image ? `<div style="position: absolute; inset: 0; background: rgba(0,0,0,0.4);"></div>` : ''}
      <div style="position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; width: 100%;">
        ${renderSectionBody(type, content, styles, id)}
      </div>
    </section>
  `;
}

function renderSectionBody(type: string, content: any, styles: any, id: string) {
  switch (type) {
    case 'hero':
      return `
        <h1 style="font-size: clamp(2.5rem, 8vw, 4rem); margin-bottom: 1.5rem; font-weight: 800; line-height: 1.1;">${content.heading || 'Hero Heading'}</h1>
        <p style="font-size: clamp(1.1rem, 3vw, 1.5rem); opacity: 0.9; margin-bottom: 2.5rem; max-width: 700px; margin-left: ${styles.text_alignment === 'center' ? 'auto' : '0'}; margin-right: ${styles.text_alignment === 'center' ? 'auto' : '0'};">${content.subheading || 'Hero Subheading'}</p>
        <a href="${content.button_link || '#'}" class="btn-primary" style="display: inline-block; text-decoration: none; padding: 18px 40px; font-size: 1.2rem; border-radius: 50px; text-align: center;">${content.button_text || 'Get Started'}</a>
      `;
    case 'text':
      return `<div style="line-height: 1.8; font-size: ${styles.font_size || '1.1rem'}; max-width: 800px; margin: 0 auto;">${content.text || ''}</div>`;
    case 'image':
      return `<img src="${content.image_url}" alt="Site Image" style="width: 100%; height: auto; border-radius: ${styles.border_radius || '0'}; display: block; margin: 0 auto;">`;
    case 'cta':
      return `
        <div style="background: ${styles.cta_background || 'var(--primary-color)'}; color: white; padding: 60px 40px; border-radius: 20px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
          <h2 style="font-size: clamp(2rem, 5vw, 3rem); margin-bottom: 1rem; font-weight: 800;">${content.heading || 'Ready to Start?'}</h2>
          <p style="font-size: 1.25rem; opacity: 0.9; margin-bottom: 2.5rem; max-width: 600px; margin-left: auto; margin-right: auto;">${content.subheading || 'Join hundreds of happy customers today.'}</p>
          <button class="btn-primary" 
                  style="background: white; color: var(--primary-color); border: none; padding: 18px 45px; font-size: 1.2rem; border-radius: 50px; font-weight: 700; cursor: pointer; transition: transform 0.2s;"
                  onmouseover="this.style.transform='scale(1.05)'"
                  onmouseout="this.style.transform='scale(1)'"
                  onclick="document.querySelector('.site-form-section')?.scrollIntoView({behavior: 'smooth'})">
            ${content.button_text || 'Get Quote Now'}
          </button>
        </div>
      `;
    case 'form':
      return `
        <div id="form-wrapper-${id}" class="site-form-section" style="max-width: 500px; margin: 0 auto; background: white; padding: 45px; border-radius: 20px; box-shadow: 0 15px 45px rgba(0,0,0,0.1); color: #1e293b; text-align: left;">
          <h3 style="margin-bottom: 25px; font-size: 1.85rem; text-align: center; font-weight: 800; letter-spacing: -0.5px;">${content.title || 'Get My Free Quote'}</h3>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div class="form-group">
                <input type="text" id="site-f-name-${id}" placeholder="Your Full Name" required style="padding: 16px; border: 2px solid #f1f5f9; background: #f8fafc; border-radius: 12px; width: 100%; font-family: inherit; font-size: 1.1rem; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--primary-color)'" onblur="this.style.borderColor='#f1f5f9'">
            </div>
            <div class="form-group">
                <input type="tel" id="site-f-phone-${id}" placeholder="Phone Number" required style="padding: 16px; border: 2px solid #f1f5f9; background: #f8fafc; border-radius: 12px; width: 100%; font-family: inherit; font-size: 1.1rem; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--primary-color)'" onblur="this.style.borderColor='#f1f5f9'">
            </div>
            
            ${(content.fields || []).includes('service_type') ? `
              <details style="margin-top: 8px;">
                <summary style="cursor: pointer; color: #64748b; font-weight: 600; font-size: 0.9rem; padding: 8px 0;">+ Add Service Details (Optional)</summary>
                <div style="padding-top: 15px;">
                  <div class="form-group">
                    <label style="display: block; font-weight: 700; margin-bottom: 8px; font-size: 0.85rem; color: #475569;">Preferred Service</label>
                    <select id="site-f-service_type-${id}" style="padding: 14px; border: 2px solid #f1f5f9; border-radius: 12px; width: 100%; background: #f8fafc; font-family: inherit; font-size: 1rem;">
                        <option value="Residential">Driveway Cleaning</option>
                        <option value="Commercial">House Washing</option>
                        <option value="Roof/Gutter">Roof & Gutter</option>
                        <option value="Other">Other Service</option>
                    </select>
                  </div>
                </div>
              </details>
            ` : ''}

            <button class="btn-primary" 
              style="padding: 20px; margin-top: 15px; font-size: 1.25rem; font-weight: 800; border-radius: 50px; background: var(--primary-color); color: white; border: none; cursor: pointer; transition: all 0.3s; box-shadow: 0 8px 25px rgba(79, 70, 229, 0.35);" 
              onmouseover="this.style.transform='scale(1.02) translateY(-2px)'"
              onmouseout="this.style.transform='scale(1) translateY(0)'"
              onclick="window.submitBuilderForm('${id}', true)">
              ${content.submit_label || 'Get My Free Quote ✨'}
            </button>
            <p style="text-align: center; font-size: 0.8rem; color: #94a3b8; margin-top: 15px;">🔒 Your data is safe. We value your privacy.</p>
          </div>
        </div>
      `;
    case 'button':
      const sizeMap: any = { small: '10px 20px', medium: '15px 35px', large: '20px 50px' };
      return `<a href="${content.link || '#'}" class="btn-primary" style="display: inline-block; text-decoration: none; background: ${styles.color || 'var(--primary-color)'}; padding: ${sizeMap[styles.size] || '15px 35px'}; border-radius: 8px; font-weight: 600; text-align: center;">${content.label || 'Click Here'}</a>`;
    case 'social-proof': {
      const tests: any[] = content.testimonials || [];
      const ba = content.before_after || {};
      return `
        <div class="social-proof-container" style="text-align: center;">
          <h2 style="font-size: clamp(1.8rem, 5vw, 2.5rem); font-weight: 800; margin-bottom: 12px; color: #1e293b;">${content.title || 'Don’t Just Take Our Word For It'}</h2>
          <p style="font-size: 1.1rem; opacity: 0.8; margin-bottom: 48px; color: #475569;">${content.subtitle || ''}</p>
          
          <div class="ba-grid">
            <div class="ba-card">
              <img src="${ba.before}" alt="Before">
              <span class="ba-label">Before</span>
            </div>
            <div class="ba-card">
              <img src="${ba.after}" alt="After">
              <span class="ba-label">After</span>
            </div>
          </div>

          <div class="testimonials-row">
            ${tests.map((t: any) => `
              <div class="testimonial-card">
                <div class="testimonial-stars">
                  ${'★'.repeat(t.stars || 5)}${'☆'.repeat(5 - (t.stars || 5))}
                </div>
                <p class="testimonial-quote">&ldquo;${t.quote}&rdquo;</p>
                <div class="testimonial-author">&mdash; ${t.name}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    case 'urgency': {
      return `
        <div class="urgency-container">
          ${content.badge ? `<div class="urgency-badge">${content.badge}</div>` : ''}
          <div class="urgency-headline">${content.headline || 'Act Now!'}</div>
          <div class="urgency-subtext">${content.subtext || ''}</div>
        </div>
      `;
    }
    case 'faq': {
      const faqs: any[] = content.items || [];
      const schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqs.map(f => ({
          "@type": "Question",
          "name": f.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": f.answer
          }
        }))
      };
      return `
        <div style="padding: 60px 40px; max-width: 800px; margin: 0 auto;">
          <h2 style="font-size: clamp(1.8rem, 5vw, 2.5rem); font-weight: 800; margin-bottom: 36px; text-align: center; color: #1e293b;">
            ${content.heading || 'Frequently Asked Questions'}
          </h2>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${faqs.map((faq: any, idx: number) => `
              <div class="pb-faq-item site-faq" style="border: 2px solid #f1f5f9; border-radius: 12px; overflow: hidden; background: #fff; transition: all 0.3s ease;">
                <button class="pb-faq-toggle" onclick="this.closest('.pb-faq-item').classList.toggle('open')"
                        style="width: 100%; text-align: left; padding: 20px 24px; background: transparent; border: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 1.1rem; font-weight: 700; color: #1e293b; outline: none;">
                  <span>${faq.question}</span>
                  <span class="pb-faq-chevron" style="font-size: 0.85rem; color: #94a3b8; transition: transform 0.3s ease;">▼</span>
                </button>
                <div class="pb-faq-answer" style="padding: 0 24px; max-height: 0; overflow: hidden; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);">
                  <p style="padding-bottom: 20px; color: #475569; line-height: 1.7; font-size: 1.05rem;">${faq.answer}</p>
                </div>
              </div>
            `).join('')}
          </div>
          <script type="application/ld+json">
            ${JSON.stringify(schema)}
          </script>
          <style>
            .site-faq.open { border-color: var(--primary-color) !important; box-shadow: 0 10px 20px rgba(0,0,0,0.05); }
            .site-faq.open .pb-faq-chevron { transform: rotate(180deg); color: var(--primary-color) !important; }
            .site-faq.open .pb-faq-answer { max-height: 600px !important; padding-top: 10px !important; }
          </style>
        </div>`;
    }
    default:
      return `<div>Component type "${type}" not implemented</div>`;
  }
}

function renderReports() {
  app.innerHTML = `
    ${renderSidebar('reports')}
    <main class="main-content">
      <header class="view-header">
        <h2>Reports & Insights</h2>
      </header>
      <div class="stats-grid">
        <div class="card">
          <h3>Lead Sources</h3>
          <div class="chart-placeholder">Lead Distribution Chart</div>
          <div class="report-item"><span>Google Search</span> <span>45%</span></div>
          <div class="report-item"><span>Facebook Ads</span> <span>30%</span></div>
          <div class="report-item"><span>Referrals</span> <span>25%</span></div>
        </div>
        <div class="card">
          <h3>Revenue Breakdown</h3>
          <div class="chart-placeholder">Revenue Over Time</div>
          <div class="report-item"><span>House Washing</span> <span>$5,200</span></div>
          <div class="report-item"><span>Gutter Cleaning</span> <span>$1,800</span></div>
          <div class="report-item"><span>Roof Cleaning</span> <span>$3,400</span></div>
        </div>
      </div>
    </main>
  `;
}

(window as any).openNewPageModal = (type: string) => {
  if (type === 'template') {
    (window as any).navigateTo('templates');
    return;
  }
  const titles: Record<string, string> = {
    'blank': 'Create Blank Page',
    'ai': 'Generate Page with AI'
  };

  const modal = document.createElement('div');
  modal.id = 'page-name-modal';
  modal.innerHTML = `
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;">
      <div style="background: white; padding: 40px; border-radius: 12px; width: 400px; box-shadow: var(--shadow-lg);">
        <h2 style="margin-top: 0; margin-bottom: 20px; font-size: 1.5rem;">${titles[type]}</h2>
        <div class="form-group" style="margin-bottom: 20px;">
          <label style="display: block; font-weight: 600; margin-bottom: 8px;">Page Name</label>
          <input type="text" id="new_page_name_input" placeholder="e.g. About Us" style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; width: 100%; box-sizing: border-box;" onkeydown="if(event.key === 'Enter') window.submitNewPage('${type}')">
        </div>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button onclick="document.getElementById('page-name-modal').remove()" style="padding: 10px 20px; border: 1px solid #e2e8f0; background: white; border-radius: 8px; cursor: pointer; font-weight: 600; color: #666;">Cancel</button>
          <button onclick="window.submitNewPage('${type}')" class="btn-primary" style="padding: 10px 20px;">Create Page</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('new_page_name_input')?.focus(), 100);
};

(window as any).submitNewPage = (type: string) => {
  const input = document.getElementById('new_page_name_input') as HTMLInputElement;
  const newName = input.value.trim();
  if (!newName) {
    alert('Please enter a page name');
    return;
  }

  document.getElementById('page-name-modal')?.remove();

  const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const newPage = {
    id: `p${Date.now()}`,
    name: newName,
    slug: slug,
    status: 'draft',
    seo_title: newName,
    seo_description: '',
    seo_keywords: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  mockPages.push(newPage as any);

  if (type === 'template') {
    mockPageSections.push({
      id: `ps-tpl-${Date.now()}`,
      page_id: newPage.id,
      type: 'hero',
      content: { heading: 'Stunning Template Applied', subheading: 'Ready for you to customize visually!' },
      order: 1,
      styles: { background: '#2c3e50', color: '#ffffff' }
    });
  } else if (type === 'ai') {
    mockPageSections.push({
      id: `ps-ai-${Date.now()}`,
      page_id: newPage.id,
      type: 'text',
      content: { text: '✨ This content was generated by AI specifically for ' + newName },
      order: 1,
      styles: { padding: '40px', background: '#fdfbfe' }
    });
  }

  (window as any).switchBuilderPage(newPage.id);
  (window as any).navigateTo('builder');
};

(window as any).duplicatePage = (id: string) => {
  const page = mockPages.find(p => p.id === id);
  if (!page) return;
  const newPage = {
    ...page,
    id: `p${Date.now()}`,
    name: `${page.name} (Copy)`,
    slug: `${page.slug}-copy`,
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  mockPages.push(newPage as any);

  const sections = mockPageSections.filter(s => s.page_id === id);
  sections.forEach(s => {
    mockPageSections.push({
      ...s,
      id: `ps${Date.now()}-${Math.random().toString().slice(2, 6)}`,
      page_id: newPage.id
    });
  });

  renderPages();
};

(window as any).togglePublish = (id: string) => {
  const page = mockPages.find(p => p.id === id);
  if (page) {
    page.status = page.status === 'published' ? 'draft' : 'published';
    (page as any).updated_at = new Date().toISOString();
    renderPages();
  }
};

(window as any).generatePageWithAI = (id: string) => {
  // Mock AI generation
  mockPageSections.push({
    id: `ps-ai-${Date.now()}`,
    page_id: id,
    type: 'text',
    content: { text: '✨ This content was generated by AI specifically for this page.' },
    order: 1,
    styles: { padding: '40px', background: '#fdfbfe' }
  });
  (window as any).switchBuilderPage(id);
  (window as any).navigateTo('builder');
};

(window as any).applyTemplate = (id: string) => {
  // Mock template application
  mockPageSections.push({
    id: `ps-tpl-${Date.now()}`,
    page_id: id,
    type: 'hero',
    content: { heading: 'Stunning Template Applied', subheading: 'Ready for you to customize visually!' },
    order: 1,
    styles: { background: '#2c3e50', color: '#ffffff' }
  });
  (window as any).switchBuilderPage(id);
  (window as any).navigateTo('builder');
};

function renderPages() {
  const tableRows = mockPages.map(page => {
    const lastEdited = (page as any).updated_at ? new Date((page as any).updated_at).toLocaleDateString() : new Date(page.created_at).toLocaleDateString();
    return `
    <tr class="clickable-row" onclick="window.switchBuilderPage('${page.id}'); window.navigateTo('builder');">
      <td style="font-weight: 600; color: var(--primary-color);">${page.name}</td>
      <td><code>/${page.slug}</code></td>
      <td><span class="badge badge-${page.status}">${page.status}</span></td>
      <td style="color: #666; font-size: 0.9rem;">${lastEdited}</td>
      <td>
        <div style="font-size: 0.85rem; color: #666; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${page.seo_title}">
          ${page.seo_title}
        </div>
      </td>
      <td style="text-align: center;">
        <span class="badge" style="background: #eef2f6; color: #333;">${mockPageSections.filter(s => s.page_id === page.id).length}</span>
      </td>
      <td>
        <div style="display: flex; gap: 5px; flex-wrap: wrap; max-width: 380px;">
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="event.stopPropagation(); window.switchBuilderPage('${page.id}'); window.navigateTo('builder');">Edit</button>
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #6c757d;" onclick="event.stopPropagation(); window.duplicatePage('${page.id}')">Duplicate</button>
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: ${page.status === 'published' ? '#ea580c' : '#28a745'};" onclick="event.stopPropagation(); window.togglePublish('${page.id}')">${page.status === 'published' ? 'Unpublish' : 'Publish'}</button>
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #8a2be2;" onclick="event.stopPropagation(); window.generatePageWithAI('${page.id}')">✨ AI Gen</button>
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #17a2b8;" onclick="event.stopPropagation(); window.applyTemplate('${page.id}')">Template</button>
        </div>
      </td>
    </tr>
  `;
  }).join('');

  app.innerHTML = `
    ${renderSidebar('pages')}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; gap: 10px; align-items: center;">
          <h2>Website Pages</h2>
          <button class="btn-primary" style="background: #6c757d; padding: 5px 15px; font-size: 0.85rem;" onclick="window.downloadSitemap()">Export sitemap.xml</button>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <button class="btn-primary" style="background: #8a2be2;" onclick="window.openNewPageModal('ai')">✨ Generate with AI</button>
          <button class="btn-primary" style="background: #17a2b8;" onclick="window.openNewPageModal('template')">📄 Use Template</button>
          <button class="btn-primary" onclick="window.openNewPageModal('blank')">+ New Page</button>
        </div>
      </header>

      <div class="card" style="padding: 0; overflow: hidden;">
        <table class="clients-table" style="box-shadow: none; margin-top: 0;">
          <thead>
            <tr>
              <th>Page Name</th>
              <th>Slug</th>
              <th>Status</th>
              <th>Last Edited</th>
              <th>SEO Title</th>
              <th>Sections</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #666;">No pages found</td></tr>'}
          </tbody>
        </table>
      </div>

      </div>
    </main>
  `;
}

function renderPageSections(pageId: string) {
  const page = mockPages.find(p => p.id === pageId);
  if (!page) return;

  const sections = mockPageSections
    .filter(s => s.page_id === pageId)
    .sort((a, b) => a.order - b.order);

  const tableRows = sections.map(section => `
    <tr>
      <td style="font-weight: 600;">#${section.order}</td>
      <td><span class="badge" style="background: #e9ecef; color: #495057;">${section.type.toUpperCase()}</span></td>
      <td>
        <pre style="font-size: 0.75rem; background: #f8f9fa; padding: 10px; border-radius: 4px; max-width: 300px; overflow: auto;">${JSON.stringify(section.content, null, 2)}</pre>
      </td>
      <td>
        <pre style="font-size: 0.75rem; background: #f8f9fa; padding: 10px; border-radius: 4px; max-width: 300px; overflow: auto;">${JSON.stringify(section.styles, null, 2)}</pre>
      </td>
      <td>
        <div style="display: flex; gap: 5px;">
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="alert('Edit Section: ${section.id}')">Edit</button>
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #dc3545;" onclick="alert('Delete Section: ${section.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  app.innerHTML = `
    ${renderSidebar('pages')}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; align-items: center; gap: 15px;">
          <button onclick="window.navigateTo('pages')" class="btn-primary" style="background: #eee; color: #333; padding: 5px 10px;">← Back</button>
          <h2>Sections for: ${page.name}</h2>
        </div>
        <button class="btn-primary">+ Add Section</button>
      </header>

      <div class="card" style="padding: 0; overflow: hidden;">
        <table class="clients-table" style="box-shadow: none; margin-top: 0;">
          <thead>
            <tr>
              <th>Order</th>
              <th>Type</th>
              <th>Content (JSON)</th>
              <th>Styles (JSON)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="5" style="text-align: center; padding: 40px; color: #666;">No sections found for this page</td></tr>'}
          </tbody>
        </table>
      </div>
    </main>
  `;
}

function renderComponents() {
  const isPickerMode = builderInsertOrder !== null;

  let filtered = mockComponents;
  if (compSearchQuery) {
    filtered = filtered.filter(c => c.name.toLowerCase().includes(compSearchQuery) || c.type.toLowerCase().includes(compSearchQuery));
  }
  if (compCategoryFilter !== 'all') {
    if (compCategoryFilter === 'basic') filtered = filtered.filter(c => ['text', 'button', 'image'].includes(c.type));
    else if (compCategoryFilter === 'layout') filtered = filtered.filter(c => ['hero', 'section'].includes(c.type));
    else if (compCategoryFilter === 'forms') filtered = filtered.filter(c => ['form'].includes(c.type));
    else if (compCategoryFilter === 'advanced') filtered = filtered.filter(c => !['text', 'button', 'image', 'hero', 'section', 'form'].includes(c.type));
  }

  const gridItems = filtered.map(comp => `
    <div class="card" style="display: flex; flex-direction: column; gap: 15px;">
      <!-- Visual Preview -->
      <div style="width: 100%; height: 250px; overflow: hidden; border: 1px solid #e2e8f0; border-radius: 8px; position: relative; background: #f8fafc;">
        <div style="width: 200%; height: 500px; transform: scale(0.5); transform-origin: top left; pointer-events: none;">
           ${renderSection(comp.type, comp.default_content, comp.default_styles, comp.id)}
        </div>
      </div>
      
      <!-- Name & Type -->
      <div>
        <h3 style="margin: 0; font-size: 1.1rem; color: var(--primary-color);">${comp.name}</h3>
        <span class="badge" style="background: #e9ecef; color: #495057; font-size: 0.7rem; margin-top: 5px; display: inline-block;">${comp.type.toUpperCase()}</span>
      </div>
      
      <!-- Actions -->
      <div style="display: flex; gap: 10px;">
        ${isPickerMode ? `
          <button class="btn-primary" style="flex: 1; padding: 8px; font-size: 0.85rem; background: var(--primary-color);" onclick="window.addSectionToPage('${comp.id}')">Insert</button>
        ` : `
          <button class="btn-primary" style="flex: 1; padding: 8px; font-size: 0.85rem; background: #222;" onclick="alert('Edit Content for ${comp.name}')">Edit Content</button>
          <button class="btn-primary" style="flex: 1; padding: 8px; font-size: 0.85rem; background: #222;" onclick="alert('Edit Styles for ${comp.name}')">Edit Styles</button>
        `}
      </div>
      
      ${!isPickerMode ? `
      <!-- Advanced JSON -->
      <details style="background: #f8f9fa; border-radius: 6px; padding: 10px; border: 1px solid #e2e8f0;">
        <summary style="cursor: pointer; font-size: 0.8rem; font-weight: 600; color: #666; outline: none;">Advanced JSON</summary>
        <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 10px;">
          <div>
            <label style="font-size: 0.7rem; color: #999; text-transform: uppercase;">Default Content</label>
            <pre style="font-size: 0.7rem; background: #1e1e1e; color: #d4d4d4; padding: 10px; border-radius: 4px; overflow-x: auto; margin: 0;">${JSON.stringify(comp.default_content, null, 2)}</pre>
          </div>
          <div>
            <label style="font-size: 0.7rem; color: #999; text-transform: uppercase;">Default Styles</label>
            <pre style="font-size: 0.7rem; background: #1e1e1e; color: #d4d4d4; padding: 10px; border-radius: 4px; overflow-x: auto; margin: 0;">${JSON.stringify(comp.default_styles, null, 2)}</pre>
          </div>
        </div>
      </details>` : ''}
    </div>
  `).join('');

  app.innerHTML = `
    ${isPickerMode ? '' : renderSidebar('components')}
    <main class="${isPickerMode ? '' : 'main-content'}" style="${isPickerMode ? 'width: 100vw; height: 100vh; overflow-y: auto; padding: 20px;' : ''}">
      <header class="view-header" style="${isPickerMode ? 'border-bottom: 1px solid #eee; padding-bottom: 20px; display: flex; flex-direction: column; gap: 15px;' : ''}">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <h2>${isPickerMode ? 'Select Component to Insert' : 'Component Library'}</h2>
          <div>
            ${isPickerMode ? `
              <button class="btn-primary" style="background: transparent; color: #666; border: 1px solid #ccc; margin-right: 10px;" onclick="window.cancelComponentPicker()">Cancel</button>
            ` : `
              <button class="btn-primary" onclick="alert('Register New Component')">+ New Component</button>
            `}
          </div>
        </div>
        
        <!-- Search and Filter Bar -->
        <div style="display: flex; gap: 20px; align-items: center; width: 100%; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; flex-wrap: wrap;">
          <input type="text" placeholder="Search components by name or type..." value="${compSearchQuery}" oninput="window.setCompSearch(this.value)" style="flex: 1; min-width: 250px; padding: 10px 15px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.95rem; outline: none;">
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${['all', 'basic', 'layout', 'forms', 'advanced'].map(cat => `
              <button onclick="window.setCompCategory('${cat}')" style="padding: 8px 16px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 1px solid ${compCategoryFilter === cat ? 'var(--primary-color)' : '#e2e8f0'}; background: ${compCategoryFilter === cat ? 'var(--primary-color)' : 'white'}; color: ${compCategoryFilter === cat ? 'white' : '#64748b'};">${cat.charAt(0).toUpperCase() + cat.slice(1)}</button>
            `).join('')}
          </div>
        </div>
      </header>

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 24px; padding-top: 20px;">
        ${gridItems || '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666; font-size: 1.1rem;">No components match your search.</div>'}
      </div>

      </div>
    </main>
  `;
}

(window as any).useTemplate = (templateId: string) => {
  const template = templates.find((t: any) => t.id === templateId);
  if (!template) return;

  const newName = prompt('Enter new page name:', template.name + ' Copy');
  if (!newName) return;

  const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const newPage = {
    id: `p${Date.now()}`,
    name: newName,
    slug: slug,
    status: 'draft',
    seo_title: newName,
    seo_description: '',
    seo_keywords: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  mockPages.push(newPage as any);

  template.blocks.forEach((block: any, index: number) => {
    let mappedContent = { ...block.data };
    let mappedStyles: any = {
      background: '#ffffff',
      color: '#333333'
    };

    if (block.type === 'hero') {
      mappedContent = { heading: block.data.heading || block.data.title, subheading: block.data.subheading || block.data.subtitle, button_text: block.data.cta_text || block.data.buttonText };
      mappedStyles = { background: template.theme.primary, color: 'white', text_alignment: 'center', padding: '100px 20px' };
    } else if (block.type === 'services') {
      mappedContent = { heading: block.data.title, items: block.data.items };
      mappedStyles = { background: '#ffffff', color: '#333', padding: '80px 20px' };
    } else if (block.type === 'gallery') {
      mappedContent = { heading: block.data.title, images: block.data.images };
      mappedStyles = { background: '#fdfbfe', color: '#333', padding: '80px 20px' };
    } else if (block.type === 'contact') {
      mappedContent = { title: block.data.title, fields: block.data.fields || ['name', 'email', 'phone', 'message'] };
      mappedStyles = { background: template.theme.secondary, color: 'white', padding: '80px 20px' };
    }

    mockPageSections.push({
      id: `ps-tpl-${Date.now()}-${index}`,
      page_id: newPage.id,
      type: block.type === 'services' || block.type === 'gallery' ? 'text' : (block.type === 'contact' ? 'form' : block.type),
      content: mappedContent,
      order: index + 1,
      styles: mappedStyles
    });
  });

  (window as any).switchBuilderPage(newPage.id);
  (window as any).navigateTo('builder');
};

function renderTemplates() {
  const cardsHtml = templates.map((t: any) => `
    <div class="card" style="padding: 0; overflow: hidden; display: flex; flex-direction: column; height: 100%;">
      <div style="height: 200px; width: 100%; background: #e2e8f0; background-image: url('${t.image}'); background-size: cover; background-position: center; border-bottom: 1px solid #e2e8f0;"></div>
      <div style="padding: 24px; flex: 1; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 1.25rem; color: var(--primary-color);">${t.name}</h3>
          <span class="badge" style="background: #eef2f6; color: #64748b; font-size: 0.75rem;">${t.category}</span>
        </div>
        <p style="color: #666; font-size: 0.95rem; margin-bottom: 24px; flex: 1; line-height: 1.5;">${t.description}</p>
        <button class="btn-primary" style="width: 100%; padding: 14px; font-weight: 600; font-size: 1rem; border-radius: 8px;" onclick="window.useTemplate('${t.id}')">Use Template</button>
      </div>
    </div>
  `).join('');

  app.innerHTML = `
    ${renderSidebar('templates')}
    <main class="main-content">
      <header class="view-header">
        <h2>Website Templates</h2>
      </header>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 30px; padding: 10px;">
        ${cardsHtml}
      </div>
    </main>
  `;
}

function renderWebsiteSettings() {
  const settings = getWebsiteSettings();
  app.innerHTML = `
    ${renderSidebar('website-settings')}
    <main class="main-content">
      <header class="view-header">
        <h2>Website Branding & Tracking</h2>
        <div style="display: flex; gap: 10px;">
           <button class="btn-primary" style="background: var(--primary-color);" onclick="window.saveGlobalSettings()">Save Settings</button>
        </div>
      </header>
      <div style="max-width: 800px;">
        <div class="card" style="margin-bottom: 24px;">
          <h3>Business Profile</h3>
          <div style="display: flex; flex-direction: column; gap: 15px;">
            <div class="form-group">
              <label>Business Name</label>
              <input type="text" value="${settings.business_name}" onchange="window.updateSettingsField('business_name', this.value)" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
               <div class="form-group">
                 <label>Public Phone</label>
                 <input type="text" value="${settings.phone}" onchange="window.updateSettingsField('phone', this.value)" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
               </div>
               <div class="form-group">
                 <label>Public Email</label>
                 <input type="email" value="${settings.email}" onchange="window.updateSettingsField('email', this.value)" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
               </div>
            </div>
            <div class="form-group">
              <label>Logo URL</label>
              <div style="display: flex; gap: 10px;">
                 <input type="text" value="${settings.logo_url}" onchange="window.updateSettingsField('logo_url', this.value)" style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                 ${settings.logo_url ? `<img src="${settings.logo_url}" style="height: 42px; width: 42px; border-radius: 4px; object-fit: cover; border: 1px solid #ddd;">` : ''}
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <h3>Tracking & Marketing</h3>
          <p style="color: #666; font-size: 0.9rem; margin-bottom: 20px;">Connect your marketing tools for analytics and ad tracking.</p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="form-group">
              <label>Facebook Pixel ID</label>
              <input type="text" placeholder="e.g. 1234567890" value="${settings.facebook_pixel_id || ''}" onchange="window.updateSettingsField('facebook_pixel_id', this.value)" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div class="form-group">
              <label>GTM Container ID</label>
              <input type="text" placeholder="e.g. GTM-XXXXXX" value="${settings.gtm_id || ''}" onchange="window.updateSettingsField('gtm_id', this.value)" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
          </div>
        </div>
      </div>
    </main>
  `;
}

function renderWebsiteStructure() {
  const userId = (window as any).currentUser || 'system';
  const website = mockWebsites.find(w => w.user_id === userId) || mockWebsites[0];
  const routes = mockWebsiteRoutes.filter(r => r.website_id === website.id);
  
  const websiteUrl = website.domain ? `https://${website.domain}` : `https://${website.subdomain}.pressurepro.io`;

  app.innerHTML = `
    ${renderSidebar('website-structure')}
    <main class="main-content">
      <header class="view-header">
        <div>
          <h2>Website Structure</h2>
          <p style="color: #64748b; margin-top: 4px;">Map your custom URLs to marketing funnels.</p>
        </div>
        <div style="display: flex; gap: 10px;">
           <button class="btn-primary" onclick="window.showAddRouteModal('${website.id}')">Add New Route</button>
        </div>
      </header>
      
      <div class="card" style="margin-bottom: 24px; border-left: 4px solid var(--primary-color);">
        <div style="display: flex; align-items: center; justify-content: space-between;">
           <div>
             <small style="color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em;">Public Website Address</small>
             <div style="font-size: 1.2rem; font-weight: 600; color: #1e293b; margin-top: 4px;">${websiteUrl}</div>
           </div>
           <a href="${websiteUrl}" target="_blank" class="btn-primary" style="background: white; color: #1e293b; border: 1px solid #e2e8f0; font-size: 0.85rem;">Visit Site ↗</a>
        </div>
      </div>

      <div class="card" style="padding: 0; overflow: hidden;">
        <div style="padding: 20px; border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
          <h3 style="margin: 0; font-size: 1.1rem;">Mapped Routes</h3>
        </div>
        
        <table class="data-table">
          <thead>
            <tr>
              <th style="padding-left: 20px;">URL Path</th>
              <th>Destination Funnel</th>
              <th>Status</th>
              <th style="text-align: right; padding-right: 20px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${routes.map(route => {
              const funnel = mockFunnels.find(f => f.id === route.funnel_id);
              const isHome = route.path === '/';
              return `
                <tr>
                  <td style="padding-left: 20px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <code style="font-size: 0.95rem; color: var(--primary-color); font-weight: 700; background: #eff6ff; padding: 4px 8px; border-radius: 4px;">${route.path}</code>
                      ${isHome ? '<span class="badge" style="background: #ecfdf5; color: #059669; font-size: 0.7rem;">Homepage</span>' : ''}
                    </div>
                  </td>
                  <td>
                    <div style="font-weight: 500; color: #1e293b;">${funnel ? funnel.name : 'Unknown Funnel'}</div>
                    <small style="color: #64748b;">${route.funnel_id}</small>
                  </td>
                  <td><span class="badge badge-published">Live</span></td>
                  <td style="text-align: right; padding-right: 20px;">
                    <button class="btn-outline" style="color: #64748b; border-color: #e2e8f0; padding: 4px 10px; font-size: 0.8rem;" onclick="window.navigateTo('funnel-detail', '${route.funnel_id}')">Edit Funnel</button>
                    ${!isHome ? `<button class="btn-outline" style="color: #ef4444; border-color: #fee2e2; padding: 4px 10px; font-size: 0.8rem; margin-left: 5px;" onclick="window.deleteRoute('${route.id}')">Delete</button>` : ''}
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="4" style="text-align:center; padding: 60px; color: #94a3b8;">No routes configured yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </main>
  `;
}

(window as any).showAddRouteModal = (websiteId: string) => {
  const modal = document.createElement('div');
  modal.id = 'route-modal';
  modal.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center;">
      <div class="card" style="width: 100%; max-width: 450px; padding: 30px;">
        <h3 style="margin-top: 0; margin-bottom: 20px;">Add Website Route</h3>
        
        <div class="form-group" style="margin-bottom: 20px;">
          <label>URL Path</label>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #64748b; font-weight: 600;">/</span>
            <input type="text" id="route-path" placeholder="e.g. driveway-cleaning" style="flex: 1; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
          </div>
          <small style="color: #64748b; margin-top: 4px; display: block;">The URL relative to your domain.</small>
        </div>

        <div class="form-group" style="margin-bottom: 30px;">
          <label>Destination Funnel</label>
          <select id="route-funnel-id" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
            ${mockFunnels.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
          </select>
          <small style="color: #64748b; margin-top: 4px; display: block;">Which funnel should load at this path?</small>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button class="btn-outline" onclick="document.getElementById('route-modal').remove()">Cancel</button>
          <button class="btn-primary" onclick="window.saveRoute('${websiteId}')">Create Route</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
};

(window as any).saveRoute = async (websiteId: string) => {
  const pathInput = document.getElementById('route-path') as HTMLInputElement;
  const funnelSelect = document.getElementById('route-funnel-id') as HTMLSelectElement;
  
  if (!pathInput || !funnelSelect) return;
  
  const path = pathInput.value.trim().replace(/^\/+/, '');
  const funnelId = funnelSelect.value;
  
  if (!path) {
    alert('Please enter a valid path.');
    return;
  }

  const normalizedPath = '/' + path;

  // Check for duplicates
  if (mockWebsiteRoutes.some(r => r.website_id === websiteId && r.path === normalizedPath)) {
    alert('This route path is already in use.');
    return;
  }

  const newRoute = {
    id: `r-${Date.now()}`,
    website_id: websiteId,
    path: normalizedPath,
    funnel_id: funnelId,
    created_at: new Date().toISOString()
  };

  mockWebsiteRoutes.push(newRoute);
  document.getElementById('route-modal')?.remove();
  renderWebsiteStructure();
  console.log('[UI: ROUTES] Added new route:', newRoute);
};

(window as any).deleteRoute = (id: string) => {
  if (!confirm('Are you sure you want to delete this route? This path will no longer load its funnel.')) return;
  
  const index = mockWebsiteRoutes.findIndex(r => r.id === id);
  if (index !== -1) {
    mockWebsiteRoutes.splice(index, 1);
    renderWebsiteStructure();
  }
};

(window as any).updateSettingsField = (field: string, value: string) => {
    const s = getWebsiteSettings(); (s as any)[field] = value; require('./website_settings_repo').persistWebsiteSettings(s);
    renderWebsiteSettings();
    console.log('Settings updated:', field, value);
  };

function renderQuickstart() {
  app.innerHTML = `
    ${renderSidebar('quickstart')}
    <main class="main-content">
      <header class="view-header">
        <h2>Quickstart Guide</h2>
      </header>
      <ul class="guide-list">
        <li class="guide-step"><input type="checkbox" checked> <span>Complete your Business Profile</span></li>
        <li class="guide-step"><input type="checkbox"> <span>Connect your Domain</span></li>
        <li class="guide-step"><input type="checkbox"> <span>Create your first Pressure Washing Funnel</span></li>
        <li class="guide-step"><input type="checkbox"> <span>Import existing Client List</span></li>
        <li class="guide-step"><input type="checkbox"> <span>Set up Stripe for Automated Billing</span></li>
      </ul>
    </main>
  `;
}

function renderLeadCapture() {
  app.innerHTML = `
    ${renderSidebar('lead-capture')}
    <main class="main-content">
      <header class="view-header">
        <h2>Lead Capture Form</h2>
      </header>
      <div class="lead-form-container">
        <p style="margin-bottom: 24px; color: var(--secondary-color);">Complete the form below to register a new lead and create a sales opportunity.</p>
        <form id="lead-form">
          <div class="form-group">
            <label for="lead_name">Full Name</label>
            <input type="text" id="lead_name" placeholder="John Doe" required>
          </div>
          <div class="form-group">
            <label for="lead_phone">Phone Number</label>
            <input type="tel" id="lead_phone" placeholder="555-012-3456" required>
          </div>
          <div class="form-group">
            <label for="lead_email">Email Address</label>
            <input type="email" id="lead_email" placeholder="john@example.com" required>
          </div>
          <div class="form-group">
            <label for="lead_address">Service Address</label>
            <input type="text" id="lead_address" placeholder="123 Main St, Anytown" required>
          </div>
          <div class="form-group">
            <label for="lead_service_type">Service Type</label>
            <select id="lead_service_type" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; background: white;">
              <option value="">Select a service...</option>
              <option value="Residential Pressure Washing">Residential Pressure Washing</option>
              <option value="Commercial Exterior Cleaning">Commercial Exterior Cleaning</option>
              <option value="Roof & Gutter Cleaning">Roof & Gutter Cleaning</option>
              <option value="Driveway & Walkway Restore">Driveway & Walkway Restore</option>
              <option value="Deck & Patio Wash">Deck & Patio Wash</option>
            </select>
          </div>
          <div class="form-group">
            <label for="lead_message">Message / Details</label>
            <textarea id="lead_message" placeholder="Description of what needs cleaning..." required></textarea>
          </div>
          <div class="form-footer">
            <button type="submit" class="btn-primary">Submit Lead Info</button>
          </div>
        </form>
      </div>
    </main>
  `;

  document.getElementById('lead-form')?.addEventListener('submit', handleLeadCaptureSubmission);
}

async function handleLeadCaptureSubmission(e: Event) {
  e.preventDefault();
  const name = (document.getElementById('lead_name') as HTMLInputElement).value;
  const phone = (document.getElementById('lead_phone') as HTMLInputElement).value;
  const email = (document.getElementById('lead_email') as HTMLInputElement).value;
  const address = (document.getElementById('lead_address') as HTMLInputElement).value;
  const service_type = (document.getElementById('lead_service_type') as HTMLSelectElement).value;
  const message = (document.getElementById('lead_message') as HTMLTextAreaElement).value;

  if (!name) {
    alert('Please provide at least a name.');
    return;
  }

  try {
    (window as any).showToast('Creating lead...', 2000);
    const result = await createLead({
      name,
      phone,
      email,
      address,
      service_type,
      message,
      source: 'internal'
    });

    console.log("Internal Lead Created:", result);
    alert(`Success! Lead created for ${name}.`);
    window.navigateTo('clients');

  } catch (error: any) {
    console.error("Internal Lead Submission Error:", error);
    alert(`Failed to create lead: ${error.message}`);
  }
}

function renderOpportunities() {
  const userId = (window as any).currentUser || 'system';
  const defaultPipeline = mockPipelines[0];
  const stages = defaultPipeline.stages;

  const columnsHtml = stages.map(stage => {
    const stageOpportunities = mockOpportunities.filter(opp => opp.user_id === userId && opp.pipeline_stage === stage);
    const cardsHtml = stageOpportunities.map(opp => {
      const contact = mockContacts.find(c => c.id === opp.contact_id);
      return `
        <div class="kanban-card" draggable="true" ondragstart="drag(event, '${opp.id}')" onclick="window.navigateTo('contact-detail', '${opp.contact_id}')" style="cursor: pointer; display: flex; flex-direction: column; gap: 4px;">
          <div class="contact-name">${contact ? contact.name : 'Unknown Contact'}</div>
          <div class="opportunity-value" style="display: flex; align-items: center; gap: 4px;">
            <span>$</span>
            <input type="number" 
                   value="${opp.value}" 
                   class="inline-input" 
                   style="font-weight: 600; width: 80px;"
                   onclick="event.stopPropagation()" 
                   onchange="window.updateOpportunityField('${opp.id}', 'value', this.value)">
          </div>
          <div class="contact-phone">${contact ? contact.phone : 'N/A'}</div>
          ${opp.notes ? `<div style="font-size: 0.7rem; color: #94a3b8; font-style: italic; border-top: 1px solid #f1f5f9; padding-top: 4px; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${opp.notes.replace(/\n/g, ' ')}</div>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="kanban-column" ondragover="allowDrop(event)" ondrop="drop(event, '${stage}')">
        <h4>${stage} <span>${stageOpportunities.length}</span></h4>
        <div class="kanban-cards">
          ${cardsHtml}
        </div>
      </div>
    `;
  }).join('');

  app.innerHTML = `
    ${renderSidebar('opportunities')}
    <main class="main-content">
      <header class="view-header">
        <h2>Sales Pipeline: ${defaultPipeline.name}</h2>
        <button class="btn-primary">+ New Opportunity</button>
      </header>
      <div class="kanban-board">
        ${columnsHtml}
      </div>
    </main>
  `;
}

function renderQuotes() {
  const tableRows = mockQuotes.map(quote => {
    const contact = mockContacts.find(c => c.id === quote.contact_id);
    return `
      <tr onclick="window.navigateTo('contact-detail', '${quote.contact_id}')" style="cursor: pointer;">
        <td style="font-weight: 600; color: var(--primary-color);">Q-${quote.id}</td>
        <td>${contact ? contact.name : 'Unknown'}</td>
        <td><span class="badge badge-${quote.status}">${quote.status}</span></td>
        <td style="font-weight: 600;">$${quote.total_amount.toLocaleString()}</td>
        <td>${new Date(quote.created_at).toLocaleDateString()}</td>
        <td>
          <div style="display: flex; gap: 5px;">
            <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="event.stopPropagation(); window.navigateTo('quote-preview', '${quote.id}')">Preview</button>
            <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="event.stopPropagation(); window.navigateTo('contact-detail', '${quote.contact_id}')">View</button>
            ${quote.status === 'draft' ? `<button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #28a745;" onclick="event.stopPropagation(); window.sendQuote('${quote.id}')">Send</button>` : ''}
            ${quote.status === 'sent' ? `
              <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #28a745;" onclick="event.stopPropagation(); window.approveQuote('${quote.id}')">Approve</button>
              <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #dc3545;" onclick="event.stopPropagation(); window.rejectQuote('${quote.id}')">Reject</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  app.innerHTML = `
    ${renderSidebar('quotes')}
    <main class="main-content">
      <header class="view-header">
        <h2>Quotes</h2>
        <button class="btn-primary" onclick="window.navigateTo('new-quote')">+ New Quote</button>
      </header>

      <div class="card" style="padding: 0; overflow: hidden;">
        <table class="clients-table" style="box-shadow: none; margin-top: 0;">
          <thead>
            <tr>
              <th>Quote #</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;">No quotes found</td></tr>'}
          </tbody>
        </table>
      </div>
    </main>
  `;
}

function renderInvoices() {
  const filteredInvoices = mockInvoices.filter(i => {
    if (invoiceStatusFilter === 'all') return true;
    return i.status === invoiceStatusFilter;
  });

  const tableRows = filteredInvoices.map(invoice => {
    const contact = mockContacts.find(c => c.id === invoice.contact_id);
    return `
      <tr onclick="window.navigateTo('contact-detail', '${invoice.contact_id}')" style="cursor: pointer;">
        <td style="font-weight: 600; color: var(--primary-color);">INV-${invoice.id}</td>
        <td>${contact ? contact.name : 'Unknown'}</td>
        <td style="font-weight: 600;">$${invoice.amount.toLocaleString()}</td>
        <td><span class="badge badge-${invoice.status}">${invoice.status}</span></td>
        <td>${new Date(invoice.due_date).toLocaleDateString()}</td>
        <td>
          <div style="display: flex; gap: 5px;">
            <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="event.stopPropagation(); window.navigateTo('contact-detail', '${invoice.contact_id}')">View</button>
            ${invoice.status !== 'paid' ? `<button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #28a745;" onclick="event.stopPropagation(); window.markAsPaid('${invoice.id}')">Mark as Paid</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  app.innerHTML = `
    ${renderSidebar('invoices')}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; align-items: center; gap: 20px;">
          <h2>Invoices</h2>
          <select onchange="window.updateInvoiceFilter(this.value)" style="padding: 8px 12px; border-radius: 4px; border: 1px solid #ddd; background: white; font-family: inherit;">
            <option value="all" ${invoiceStatusFilter === 'all' ? 'selected' : ''}>All Invoices</option>
            <option value="unpaid" ${invoiceStatusFilter === 'unpaid' ? 'selected' : ''}>Unpaid</option>
            <option value="paid" ${invoiceStatusFilter === 'paid' ? 'selected' : ''}>Paid</option>
            <option value="overdue" ${invoiceStatusFilter === 'overdue' ? 'selected' : ''}>Overdue</option>
          </select>
        </div>
        <button class="btn-primary" onclick="alert('Create Invoice from Quote or Client Detail page')">+ New Invoice</button>
      </header>

      <div class="card" style="padding: 0; overflow: hidden;">
        <table class="clients-table" style="box-shadow: none; border: none; margin-top: 0;">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Contact Name</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;">No invoices match your selection</td></tr>'}
          </tbody>
        </table>
      </div>
    </main>
  `;
}

(window as any).updateInvoiceFilter = (status: string) => {
  invoiceStatusFilter = status;
  renderInvoices();
};

function renderNewQuote() {
  const contacts = mockContacts;
  const nqcId = (window as any).newQuoteContactId;
  const nqoId = (window as any).newQuoteOpportunityId;
  const nqItems = (window as any).newQuoteLineItems;

  const opportunities = nqcId
    ? mockOpportunities.filter(o => o.contact_id === nqcId)
    : [];

  const renderTierGroup = (tier: 'basic' | 'standard' | 'premium') => {
    const tierItems = nqItems.map((item: any, index: number) => ({ ...item, index })).filter((item: any) => item.tier === tier);
    const tierTotal = tierItems.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);

    return `
      <div style="flex: 1; min-width: 320px; background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #eef2f6; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin:0; text-transform: capitalize; color: var(--secondary-color); font-size: 1.1rem;">${tier} Option</h3>
          <button class="btn-primary" style="padding: 4px 10px; font-size: 0.8rem; background: #f0f7ff; color: var(--primary-color); border: 1px solid var(--primary-color);" onclick="window.addLineItem('${tier}')">+ Add Item</button>
        </div>
        
        <div style="flex: 1; overflow-y: auto; max-height: 500px;">
          ${tierItems.map((item: any) => `
            <div style="padding: 15px; border: 1px solid #f0f0f0; border-radius: 8px; margin-bottom: 15px; position: relative;">
              <button onclick="window.removeLineItem(${item.index})" style="position: absolute; right: 8px; top: 8px; background: none; border: none; color: #ccc; cursor: pointer; font-size: 1.2rem;">×</button>
              <div style="margin-bottom: 10px;">
                <input type="text" placeholder="Service Name" value="${item.service}" style="width: 100%; border: none; font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;" oninput="window.updateLineItem(${item.index}, 'service', this.value, false)">
                <input type="text" placeholder="Short description" value="${item.description}" style="width: 100%; border: none; font-size: 0.85rem; color: #666;" oninput="window.updateLineItem(${item.index}, 'description', this.value, false)">
              </div>
              <div style="display: flex; gap: 10px; align-items: center; background: #f8fafc; padding: 10px; border-radius: 6px;">
                <div style="flex: 1;">
                  <label style="font-size: 0.7rem; color: #999; display: block;">QTY</label>
                  <input type="number" value="${item.quantity}" style="width: 100%; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px;" oninput="window.updateLineItem(${item.index}, 'quantity', this.value, true)">
                </div>
                <div style="flex: 1;">
                  <label style="font-size: 0.7rem; color: #999; display: block;">PRICE</label>
                  <input type="number" value="${item.price}" style="width: 100%; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px;" oninput="window.updateLineItem(${item.index}, 'price', this.value, true)">
                </div>
                <div style="flex: 1; text-align: right;">
                  <label style="font-size: 0.7rem; color: #999; display: block;">TOTAL</label>
                  <span id="line-total-${item.index}" style="font-weight: 700; color: var(--primary-color);">$${(item.quantity * item.price).toLocaleString()}</span>
                </div>
              </div>
            </div>
          `).join('')}
          ${tierItems.length === 0 ? '<div style="text-align: center; color: #ccc; padding: 20px; font-style: italic; border: 1px dashed #eee; border-radius: 8px;">No items in this tier</div>' : ''}
        </div>

        <div style="margin-top: 20px; padding-top: 15px; border-top: 2px solid #f1f5f9; text-align: right;">
          <div style="font-size: 0.85rem; color: #64748b; font-weight: 500;">Option Total</div>
          <div id="tier-total-${tier}" style="font-size: 1.5rem; font-weight: 800; color: #1e293b;">$${tierTotal.toLocaleString()}</div>
        </div>
      </div>
    `;
  };

  app.innerHTML = `
    ${renderSidebar('quotes')}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; align-items: center; gap: 15px;">
          <button onclick="window.navigateTo('quotes')" class="btn-primary" style="background: #eee; color: #333; padding: 5px 10px;">← Back</button>
          <h2>Create Multi-Tier Quote</h2>
        </div>
        <button class="btn-primary" style="padding: 10px 25px;" onclick="window.saveQuote()">Create Quote</button>
      </header>

      <div style="padding: 24px;">
        <div class="card" style="margin-bottom: 24px; padding: 20px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="form-group" style="margin: 0;">
              <label>Select Contact</label>
              <select id="quote-contact" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;" onchange="window.updateNewQuoteContact(this.value)">
                <option value="">-- Choose Contact --</option>
                ${contacts.map(c => `<option value="${c.id}" ${nqcId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="margin: 0;">
              <label>Select Opportunity (Optional)</label>
              <select id="quote-opportunity" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;" onchange="window.newQuoteOpportunityId = this.value">
                <option value="">-- No Opportunity --</option>
                ${opportunities.map(o => `<option value="${o.id}" ${nqoId === o.id ? 'selected' : ''}>$${o.value} - ${o.pipeline_stage}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 24px; overflow-x: auto; padding-bottom: 10px;">
          ${renderTierGroup('basic')}
          ${renderTierGroup('standard')}
          ${renderTierGroup('premium')}
        </div>

        <div class="card" style="margin-top: 24px; padding: 20px;">
           <label>Add internal notes or terms</label>
           <textarea id="quote-notes" style="width: 100%; height: 80px; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-family: inherit;" placeholder="e.g. Terms & conditions or specific project details..."></textarea>
        </div>
      </div>
    </main>
  `;
}

(window as any).updateNewQuoteContact = (id: string) => {
  (window as any).newQuoteContactId = id;
  (window as any).newQuoteOpportunityId = '';
  renderNewQuote();
};

(window as any).addLineItem = (tier: 'basic' | 'standard' | 'premium' = 'basic') => {
  (window as any).newQuoteLineItems.push({ service: '', description: '', quantity: 1, price: 0, tier });
  renderNewQuote();
};

(window as any).removeLineItem = (index: number) => {
  (window as any).newQuoteLineItems.splice(index, 1);
  renderNewQuote();
};

(window as any).updateLineItem = (index: number, field: string, value: string | number, shouldUpdateTotals: boolean) => {
  const nqItems = (window as any).newQuoteLineItems;
  const item = nqItems[index] as any;
  if (field === 'quantity' || field === 'price') {
    item[field] = parseFloat(value as string) || 0;
  } else {
    item[field] = value;
  }

  if (shouldUpdateTotals) {
    const lineTotalEl = document.getElementById(`line-total-${index}`);
    if (lineTotalEl) {
      lineTotalEl.textContent = `$${(item.quantity * item.price).toLocaleString()}`;
    }

    // Update the tier total
    const tier = item.tier;
    const tierTotal = nqItems
      .filter((i: any) => i.tier === tier)
      .reduce((sum: number, i: any) => sum + (i.quantity * i.price), 0);

    const tierTotalEl = document.getElementById(`tier-total-${tier}`);
    if (tierTotalEl) {
      tierTotalEl.textContent = `$${tierTotal.toLocaleString()}`;
    }
  }
};

(window as any).saveQuote = () => {
  const nqcId = (window as any).newQuoteContactId;
  const nqoId = (window as any).newQuoteOpportunityId;
  const nqItems = (window as any).newQuoteLineItems;

  if (!nqcId) {
    alert("Please select a contact.");
    return;
  }

  const notes = (document.getElementById('quote-notes') as HTMLTextAreaElement)?.value || '';

  const quoteId = 'q' + (mockQuotes.length + 1) + '-' + Math.floor(Math.random() * 100);

  // Default to Basic total initially
  const basicTotal = nqItems.filter((i: any) => i.tier === 'basic').reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);

  mockQuotes.push({
    id: quoteId,
    contact_id: nqcId,
    opportunity_id: nqoId || '',
    status: 'draft',
    total_amount: basicTotal,
    selected_tier: 'basic',
    notes: notes,
    created_at: new Date().toISOString()
  });

  // Sync with Opportunity value
  if (nqoId) {
    const opportunity = mockOpportunities.find(o => o.id === nqoId);
    if (opportunity) {
      opportunity.value = basicTotal;
    }
  }

  nqItems.forEach((item: any, idx: number) => {
    mockQuoteItems.push({
      id: 'qi-' + quoteId + '-' + idx,
      quote_id: quoteId,
      service_name: item.service,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.price,
      total: item.quantity * item.price,
      tier: item.tier
    });
  });

  (window as any).newQuoteLineItems = [{ service: '', description: '', quantity: 1, price: 0, tier: 'basic' }];
  (window as any).newQuoteContactId = '';
  (window as any).newQuoteOpportunityId = '';

  (window as any).navigateTo('quotes');
};

function updateOpportunityStage(opportunity_id: string, new_stage: string) {
  const opp = mockOpportunities.find(o => o.id === opportunity_id);
  if (opp) {
    opp.pipeline_stage = new_stage;

    // Simple logic to update status based on stage
    if (new_stage === 'Completed' || new_stage === 'Paid') {
      opp.status = 'won';
    } else if (new_stage === 'Lost') {
      opp.status = 'lost';
    } else {
      opp.status = 'open';
    }

    // UI Refresh without reload
    (window as any).navigateTo(currentView, selectedContactId || undefined);
    console.log(`Opportunity ${opportunity_id} updated: Stage=[${new_stage}], Status=[${opp.status}]`);

    // Trigger Automation
    runAutomations('OPPORTUNITY_STAGE_UPDATED', opp);
  }
}

(window as any).updateOpportunityStage = updateOpportunityStage;

// Drag & Drop Handlers
(window as any).allowDrop = (ev: DragEvent) => {
  ev.preventDefault();
};

(window as any).drag = (ev: DragEvent, id: string) => {
  ev.dataTransfer?.setData("text", id);
};

(window as any).drop = (ev: DragEvent, stage: string) => {
  ev.preventDefault();
  const id = ev.dataTransfer?.getData("text");
  if (id) {
    updateOpportunityStage(id, stage);
  }
};

function renderSkeleton(type: 'pages' | 'templates' | 'builder' | 'generic') {
  if (type === 'pages') {
    return `
      <div class="skeleton-pages-list">
        ${Array(8).fill(0).map(() => `<div class="skeleton skeleton-row"></div>`).join('')}
      </div>
    `;
  }
  if (type === 'templates') {
    return `
      <div class="skeleton-card-grid">
        ${Array(6).fill(0).map(() => `
          <div class="card" style="padding: 0; overflow: hidden; height: 350px;">
            <div class="skeleton skeleton-rect" style="height: 180px;"></div>
            <div style="padding: 20px;">
              <div class="skeleton skeleton-title" style="width: 80%;"></div>
              <div class="skeleton skeleton-text"></div>
              <div class="skeleton skeleton-text" style="width: 40%;"></div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  return `<div class="skeleton skeleton-rect" style="height: 100%; border-radius: 12px;"></div>`;
}

async function renderFunnels() {
  currentView = 'funnels';
  app.innerHTML = `
    ${renderSidebar('funnels')}
    <main class="main-content">
      <header class="view-header">
        <h2>Funnels</h2>
        <button class="btn-primary" onclick="window.createFunnelPrompt()">+ Create New Funnel</button>
      </header>
      <div id="funnels-top-container" style="padding: 0 20px;">
        ${(window as any).renderFunnelsChecklist()}
      </div>
      <div id="funnels-container" style="padding: 20px;">
        <div class="loading">Loading your funnels...</div>
      </div>
    </main>
  `;

  try {
    const res = await fetch('/api/funnels').then(r => r.json());
    const container = document.getElementById('funnels-container');
    if (!container) return;

    if (!res.success || !res.data || res.data.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="text-align: center; padding: 60px 20px; background: white; border-radius: 12px; border: 2px dashed #e2e8f0;">
          <div style="font-size: 3rem; margin-bottom: 16px;">🚀</div>
          <h3 style="color: #1e293b; margin-bottom: 8px;">No funnels yet</h3>
          <p style="color: #64748b; max-width: 400px; margin: 0 auto 24px;">Your first funnel will help you capture leads fast. Create one to start growing your business.</p>
          <button class="btn-primary" onclick="window.createFunnelPrompt()">Build My First Funnel</button>
        </div>
      `;
      return;
    }

    // 🌿 WB.5.5: Fetch metrics for funnels
    const oppsRes = await fetch('/api/opportunities').then(r => r.json());
    const allOpps = oppsRes.success ? oppsRes.data : [];
    const today = new Date().toISOString().split('T')[0];

    const funnelsHtml = res.data.map((f: any) => {
      const funnelOpps = allOpps.filter((o: any) => o.funnel_id === f.id);
      const totalLeads = funnelOpps.length;
      const leadsToday = funnelOpps.filter((o: any) => o.created_at.startsWith(today)).length;

      return `
      <div class="card funnel-card" 
           style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; transition: transform 0.2s; cursor: pointer; border: 1px solid #eef2f6;" 
           onclick="window.navigateTo('funnel-detail', '${f.id}')"
           onmouseover="this.style.boxShadow='0 10px 25px rgba(0,0,0,0.05)'; this.style.borderColor='var(--primary-color)';"
           onmouseout="this.style.boxShadow='none'; this.style.borderColor='#eef2f6';">
        <div style="display: flex; align-items: center; gap: 20px;">
          <div style="background: #f0f7ff; width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">🎯</div>
          <div>
            <h4 style="margin: 0; color: #1e293b; font-size: 1.1rem;">${f.name}</h4>
            <div style="font-size: 0.85rem; color: #64748b; margin-top: 4px;">Created ${new Date(f.created_at).toLocaleDateString()}</div>
          </div>
        </div>
        <div style="text-align: right; display: flex; align-items: center; gap: 30px;">
          <div style="text-align: center; min-width: 60px;">
            <div style="font-weight: 700; color: #1e293b; font-size: 1.1rem;">${totalLeads}</div>
            <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Total Leads</div>
          </div>
          <div style="text-align: center; min-width: 80px; padding: 0 15px; border-left: 1px solid #eef2f6; border-right: 1px solid #eef2f6;">
            <div style="font-weight: 700; color: var(--primary-color); font-size: 1.1rem;">${leadsToday}</div>
            <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Leads Today</div>
          </div>
          <div style="text-align: center; min-width: 40px;">
            <div style="font-weight: 700; color: #1e293b; font-size: 1.1rem;">${f.step_count || 0}</div>
            <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Steps</div>
          </div>
          <span class="badge badge-${f.status}" style="text-transform: capitalize; padding: 6px 12px; border-radius: 6px; font-weight: 600;">${f.status}</span>
        </div>
      </div>
    `;}).join('');

    container.innerHTML = `
      <div class="funnels-grid">
        ${funnelsHtml}
      </div>
    `;
  } catch (err) {
    console.error('Failed to load funnels:', err);
    const container = document.getElementById('funnels-container');
    if (container) container.innerHTML = '<div class="error">Failed to load funnels. Please try again.</div>';
  }
}

async function renderFunnelDetail(funnelId: string) {
  app.innerHTML = `
    ${renderSidebar('funnels')}
    <main class="main-content">
      <div id="funnel-detail-container" style="padding: 20px;">
        <div class="loading">Loading funnel details...</div>
      </div>
    </main>
  `;

  try {
    const res = await fetch(`/api/funnels/${funnelId}`).then(r => r.json());
    const container = document.getElementById('funnel-detail-container');
    if (!container || !res.success) throw new Error(res.error || 'Failed to load');

    const funnel = res.data;
    const steps = funnel.steps || [];

    // 📊 WB.7.1: Calculate Metrics
    const [oppsAll, logsAll] = await Promise.all([
      fetch('/api/opportunities').then(r => r.json()),
      fetch('/api/events/logs').then(r => r.json())
    ]);

    const funnelOpps = (oppsAll.data || []).filter((o: any) => o.funnel_id === funnelId);
    const totalLeads = funnelOpps.length;
    const todayLeads = funnelOpps.filter((o: any) => new Date(o.created_at).toDateString() === new Date().toDateString()).length;
    
    // Average Response Time calculation
    const logs = logsAll.data || [];
    const leadLogs = logs.filter((l: any) => l.event_name === 'lead_captured' && (l.payload?.funnel_id === funnelId || l.funnel_id === funnelId));
    
    let totalRespTime = 0;
    let respCount = 0;
    leadLogs.forEach((lead: any) => {
       const contactId = lead.payload?.contact_id || lead.contact_id;
       const smsLog = logs.find((l: any) => l.event_name === 'auto_sms_sent' && (l.payload?.contact_id === contactId || l.contact_id === contactId));
       if (smsLog) {
         const diff = new Date(smsLog.created_at).getTime() - new Date(lead.created_at).getTime();
         totalRespTime += Math.max(0, diff);
         respCount++;
       }
    });
    
    const avgRespTimeSec = respCount > 0 ? Math.round((totalRespTime / respCount) / 1000) : 0;
    const respTimeStr = avgRespTimeSec === 0 ? 'No data yet' : (avgRespTimeSec < 60 ? `${avgRespTimeSec}s` : `${Math.round(avgRespTimeSec/60)}m`);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weeklyLeads = funnelOpps.filter((o: any) => new Date(o.created_at) >= oneWeekAgo).length;

    const stepsHtml = steps.map((step: any, index: number) => `
      <div class="step-card" style="display: flex; gap: 24px; align-items: flex-start; margin-bottom: 24px;">
        <div style="flex-shrink: 0; width: 40px; height: 40px; background: var(--primary-color); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.2rem; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);">${index + 1}</div>
        <div class="card" style="flex: 1; padding: 24px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #eef2f6;">
          <div>
            <div style="font-size: 0.75rem; color: #3b82f6; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">${step.step_type}</div>
            <h4 style="margin: 0; font-size: 1.1rem; color: #1e293b;">${step.name}</h4>
            <div style="font-size: 0.85rem; color: #64748b; margin-top: 4px;">Linked Page: <span style="font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">/${step.slug}</span></div>
          </div>
          <button class="btn-primary" style="background: white; color: var(--primary-color); border: 1px solid var(--primary-color); padding: 8px 16px; font-weight: 600;" onclick="window.openBuilderFromFunnel('${step.id}', '${funnelId}')">Edit Step</button>
        </div>
      </div>
      ${index < steps.length - 1 ? `<div style="width: 2px; height: 30px; background: #e2e8f0; margin-left: 19px; margin-top: -24px; margin-bottom: 4px;"></div>` : ''}
    `).join('');

    container.innerHTML = `
      <div id="live-url-banner" class="card" style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.5rem;">🌐</span>
            <div>
              <div style="font-size: 0.75rem; color: #166534; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Your Funnel is Live & Public</div>
              <div id="funnel-public-url" style="font-weight: 600; color: #1e293b; font-family: monospace; font-size: 1rem;">https://${(window as any).userSlug || 'app'}.pressurepro.io/${funnel.id}</div>
            </div>
          </div>
          <button class="btn-primary" style="background: white; color: #166534; border: 1px solid #166534; padding: 8px 16px; font-size: 0.85rem;" onclick="window.copyFunnelUrl()">Copy Link</button>
        </div>
        
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <button class="btn-primary" style="background: #1877f2; border: none; padding: 10px 20px; font-size: 0.9rem; flex: 1; min-width: 140px;" onclick="window.shareToSocial('${funnel.id}', 'facebook')">Share to Facebook</button>
          <button class="btn-primary" style="background: #25d366; border: none; padding: 10px 20px; font-size: 0.9rem; flex: 1; min-width: 140px;" onclick="window.shareToSocial('${funnel.id}', 'whatsapp')">Share to WhatsApp</button>
          <button class="btn-primary" style="background: #6366f1; border: none; padding: 10px 20px; font-size: 0.9rem; flex: 1; min-width: 140px;" onclick="window.testFunnel('${funnel.id}')">Test My Funnel</button>
        </div>
      </div>

      <div style="margin-bottom: 12px; font-size: 0.9rem; color: #475569; font-weight: 600; display: flex; align-items: center; gap: 8px;">
        <span style="color: #10b981;">📈</span>
        <span>${weeklyLeads} leads this week</span>
      </div>

      <div id="funnel-metrics" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 32px;">
        <div class="card" style="padding: 24px; text-align: center; border: 1px solid #e2e8f0; background: white;">
          <div style="font-size: 2.5rem; font-weight: 800; color: #1e293b; margin-bottom: 4px;">${totalLeads}</div>
          <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Total Leads</div>
        </div>
        <div class="card" style="padding: 24px; text-align: center; border: 1px solid #e2e8f0; background: white;">
          <div style="font-size: 2.5rem; font-weight: 800; color: #3b82f6; margin-bottom: 4px;">${todayLeads}</div>
          <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Leads Today</div>
        </div>
        <div class="card" style="padding: 24px; text-align: center; border: 1px solid #e2e8f0; background: white;">
          <div style="font-size: ${respTimeStr === 'No data yet' ? '1.5rem' : '2.5rem'}; font-weight: 800; color: #10b981; margin-bottom: 4px;">${respTimeStr}</div>
          <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Avg. response time</div>
          <div style="font-size: 0.7rem; color: #059669; font-weight: 600; margin-top: 8px;">Faster responses = more bookings</div>
        </div>
      </div>

      <header class="view-header" style="padding-left: 0; margin-bottom: 32px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <button onclick="window.navigateTo('funnels')" class="btn-primary" style="background: #f1f5f9; color: #475569; padding: 8px 12px; border-radius: 8px; border: none;">←</button>
          <div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <h2 style="margin: 0;">${funnel.name}</h2>
              <span class="badge badge-${funnel.status}" style="text-transform: capitalize; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem;">${funnel.status}</span>
            </div>
            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 0.9rem;">Configure your automation flow and pages</p>
          </div>
        </div>
      </header>

      <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 32px; max-width: 1200px;">
        <div id="steps-section">
          <h3 style="margin-bottom: 24px; color: #1e293b; font-size: 1.25rem;">Funnel Steps</h3>
          <div class="steps-flow">
            ${stepsHtml}
          </div>
          
          <div style="margin-top: 32px; text-align: center; padding: 32px; border: 2px dashed #e2e8f0; border-radius: 12px;">
            <button class="btn-primary" style="background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0;">+ Add New Step</button>
          </div>
        </div>

        <div id="activity-section">
          <div class="card" style="padding: 24px; position: sticky; top: 20px;">
            <h3 style="margin-top: 0; margin-bottom: 20px; color: #1e293b; font-size: 1.15rem; display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.25rem;">⚡</span> Recent Activity
            </h3>
            <div id="activity-feed-container">
               <div id="activity-feed-list"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    // 🌿 WB.5.6: Populate activity feed
    const activityList = document.getElementById('activity-feed-list');
    if (activityList) {
      const contactIds = new Set(funnelOpps.map((o: any) => o.contact_id));
      const rawLogs = (logsAll.data || []).filter((l: any) => 
        contactIds.has(l.payload?.contact_id || l.contact_id) || 
        (l.payload?.funnel_id === funnelId)
      );

      const sortedLogs = rawLogs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 15);

      if (sortedLogs.length === 0) {
        activityList.innerHTML = '<div style="color: #64748b; font-size: 0.9rem; text-align: center; padding: 20px;">No activity yet. Share your funnel to start seeing leads!</div>';
      } else {
        activityList.innerHTML = sortedLogs.map((l: any) => {
          let icon = '📝';
          let label = l.event_name.replace(/_/g, ' ');
          let color = '#64748b';

          if (l.event_name.includes('lead')) { icon = '👤'; color = '#3b82f6'; label = 'Lead Captured'; }
          if (l.event_name.includes('sms')) { icon = '💬'; color = '#10b981'; label = 'SMS Sent'; }
          if (l.event_name.includes('call')) { icon = '📞'; color = '#f59e0b'; label = 'Missed Call'; }

          const timeStr = new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const contactName = l.payload?.name || 'Lead';

          return `
            <div style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; display: flex; gap: 12px; align-items: flex-start;">
              <div style="background: ${color}15; color: ${color}; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 0.9rem;">${icon}</div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                  <span style="font-weight: 700; color: #1e293b; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${contactName}</span>
                  <span style="font-size: 0.75rem; color: #94a3b8;">${timeStr}</span>
                </div>
                <div style="font-size: 0.8rem; color: #64748b; text-transform: capitalize;">${label}</span></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  } catch (err: any) {
    console.error('Failed to load funnel detail:', err);
    const container = document.getElementById('funnel-detail-container');
    if (container) container.innerHTML = `<div class="error">Failed to load funnel: ${err.message}</div>`;
  }
}

(window as any).createFunnelPrompt = async () => {
    const name = prompt("Enter a name for your new funnel:");
    if (!name) return;

    try {
        (window as any).showToast('Creating funnel and setting up steps...', 3000);
        const res = await fetch('/api/funnels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        }).then(r => r.json());

        if (res.success) {
            (window as any).showToast('Funnel created successfully!', 2000);
            window.navigateTo('funnel-detail', res.data.id);
        } else {
            alert('Failed to create funnel: ' + res.error);
        }
    } catch (err: any) {
        alert('Error creating funnel: ' + err.message);
    }
};

(window as any).navigateTo = async (view: string, id?: string, context?: any) => {
  const previousView = currentView;
  currentView = view;
  if (id) selectedContactId = id;

  checkOverdueInvoices();

  // Show skeleton if switching to major data-heavy views
  if (view !== previousView && ['pages', 'templates', 'builder'].includes(view)) {
    const sidebar = (view === 'builder') ? '' : renderSidebar(view);
    app.innerHTML = `
      ${sidebar}
      <main class="${view === 'builder' ? '' : 'main-content'}">
        <header class="view-header">
          <div class="skeleton skeleton-title" style="width: 300px; margin: 0;"></div>
        </header>
        ${renderSkeleton(view as any)}
      </main>
    `;
    setTimeout(() => executeNavigation(view, id, context), 350);
  } else {
    executeNavigation(view, id, context);
  }

  // Update URL for standard CRM navigation
  if (!['site', 'preview'].includes(view)) {
    const newHash = id ? `#/${view}/${id}` : `#/${view}`;
    if (window.location.hash !== newHash) {
       window.history.pushState({}, "", newHash);
    }
  }
};

async function executeNavigation(view: string, id?: string, context?: any) {
  switch (view) {
    case 'dashboard': renderDashboard(); break;
    case 'clients': renderClients(); break;
    case 'contact-detail': if (id) renderContactDetail(id); break;
    case 'opportunities': renderOpportunities(); break;
    case 'quotes': renderQuotes(); break;
    case 'new-quote': 
      (window as any).newQuoteContactId = id || '';
      (window as any).newQuoteOpportunityId = '';
      (window as any).newQuoteLineItems = [];
      renderNewQuote(); 
      break;
    case 'invoices': renderInvoices(); break;
    case 'lead-capture': renderLeadCapture(); break;
    case 'funnels': renderFunnels(); break;
    case 'funnel-detail': if (id) renderFunnelDetail(id); break;
    case 'pages': renderPages(); break;
    case 'page-sections': if (id) renderPageSections(id); break;
    case 'builder': if (id) renderBuilder(); break;
    case 'templates': renderTemplates(); break;
    case 'components': app.innerHTML = `${renderSidebar('components')}<main class="main-content"><h2>Components Shelf</h2><div class="empty-state">Library of pre-built UI components coming soon.</div></main>`; break;
    case 'website-settings': renderWebsiteSettings(); break;
    case 'seo-pages': (window as any).renderSeoPages(); break;
    case 'website-structure': renderWebsiteStructure(); break;
    case 'reports': renderReports(); break;
    case 'quickstart': renderQuickstart(); break;
    case 'event-logs': renderEventLogs(); break;
    case 'qa-tools': renderQATools(); break;
    case 'quote-preview': if (id) renderQuotePreview(id); break;
    case 'site': 
      if (id && context) renderSitePage(id, context); 
      else if (id) {
         // This is a direct slug navigation, we need to resolve it
         const result = await resolveWebsiteRequest(window.location.hostname, id);
         if (result && result.funnel_id) {
            renderSitePage(result.funnel_id, result.website);
         } else {
            render404();
         }
      }
      break;
    case 'preview': 
      if (id && context) renderSitePage(id, context, true); 
      else if (id) {
         const result = await resolveWebsiteRequest(window.location.hostname, id);
         if (result && result.funnel_id) {
           renderSitePage(result.funnel_id, result.website, true);
         } else {
           render404('Preview target not found.');
         }
      }
      break;
    default: renderDashboard();
  }

  if (!['site', 'preview'].includes(view)) {
    document.title = 'Hansveer CRM';
    updateMetaTag('description', 'Professional CRM for Handyman Businesses');
    updateMetaTag('keywords', 'crm, handyman, pressure washing');
  }
}

(window as any).downloadSitemap = () => {
  const publishedPages = mockPages.filter(p => p.status === 'published');
  const baseUrl = 'https://hanssays.com/site'; // Hypothetical production base URL

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publishedPages.map(page => `  <url>
    <loc>${baseUrl}/${page.slug}</loc>
    <lastmod>${new Date(page.created_at).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${page.slug === 'home' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>`;

  const blob = new Blob([sitemapContent], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sitemap.xml';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  alert('Dynamic Sitemap generated and downloaded for ' + publishedPages.length + ' published pages.');
};

(window as any).selectQuoteTier = (quoteId: string, tier: 'basic' | 'standard' | 'premium') => {
  const quote = mockQuotes.find(q => q.id === quoteId);
  if (quote) {
    quote.selected_tier = tier;
    const tierItems = mockQuoteItems.filter(i => i.quote_id === quoteId && i.tier === tier);
    quote.total_amount = tierItems.reduce((sum, item) => sum + item.total, 0);

    // Update linked opportunity value
    if (quote.opportunity_id) {
      const opportunity = mockOpportunities.find(o => o.id === quote.opportunity_id);
      if (opportunity) {
        opportunity.value = quote.total_amount;
      }
    }

    renderQuotePreview(quoteId);
  }
};

function renderQuotePreview(quoteId: string) {
  const quote = mockQuotes.find(q => q.id === quoteId);
  if (!quote) return;
  const contact = mockContacts.find(c => c.id === quote.contact_id);
  const allItems = mockQuoteItems.filter(i => i.quote_id === quoteId);

  const renderTierColumn = (tier: 'basic' | 'standard' | 'premium') => {
    // items that match tier or have no tier (defaulting old items to basic)
    const tierItems = allItems.filter(i => i.tier === tier || (!i.tier && tier === 'basic'));
    const tierTotal = tierItems.reduce((sum, item) => sum + item.total, 0);
    const isSelected = quote.selected_tier === tier;

    return `
      <div style="flex: 1; min-width: 280px; border: 2px solid ${isSelected ? 'var(--primary-color)' : '#eef2f6'}; border-radius: 16px; padding: 30px; background: ${isSelected ? '#f0f7ff' : '#fff'}; display: flex; flex-direction: column; transition: all 0.2s; position: relative; ${isSelected ? 'box-shadow: 0 10px 25px -5px rgba(0, 123, 255, 0.1);' : ''}">
        ${isSelected ? '<div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: var(--primary-color); color: white; padding: 4px 16px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Recommended</div>' : ''}
        
        <h3 style="text-align: center; text-transform: capitalize; margin: 0 0 10px 0; color: #1e293b; font-size: 1.25rem;">${tier}</h3>
        
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 25px; border-bottom: 2px dashed ${isSelected ? '#d0e5ff' : '#f1f5f9'};">
          <div style="font-size: 2.25rem; font-weight: 900; color: #0f172a; margin-bottom: 20px;">$${tierTotal.toLocaleString()}</div>
          <button class="btn-primary no-print" style="width: 100%; padding: 12px; border-radius: 8px; font-weight: 700; background: ${isSelected ? '#28a745' : 'var(--primary-color)'}; color: white; border: none; cursor: pointer;" onclick="window.selectQuoteTier('${quote.id}', '${tier}')">
            ${isSelected ? '✓ Selected' : 'Choose ' + tier}
          </button>
        </div>

        <div style="flex: 1;">
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${tierItems.map(item => `
              <li style="padding: 12px 0; border-bottom: 1px solid ${isSelected ? '#d0e5ff' : '#f8fafc'};">
                <div style="font-weight: 600; font-size: 0.95rem; color: #1e293b; margin-bottom: 2px;">${item.service_name}</div>
                <div style="font-size: 0.85rem; color: #64748b; line-height: 1.4;">${item.description}</div>
                <div style="text-align: right; font-weight: 700; color: #1e293b; margin-top: 8px; font-size: 0.95rem;">$${item.total.toLocaleString()}</div>
              </li>
            `).join('')}
            ${tierItems.length === 0 ? '<li style="text-align: center; color: #94a3b8; padding: 40px 0; font-style: italic;">No items included</li>' : ''}
          </ul>
        </div>
      </div>
    `;
  };

  app.innerHTML = `
    ${renderSidebar('quotes')}
    <main class="main-content no-print-sidebar">
      <header class="view-header no-print">
        <div style="display: flex; align-items: center; gap: 15px;">
          <button onclick="window.navigateTo('quotes')" class="btn-primary" style="background: #eee; color: #333; padding: 5px 10px;">← Back</button>
          <h2>Quote Preview</h2>
        </div>
        <button class="btn-primary" onclick="window.print()">Print Selected Option</button>
      </header>

      <div class="card quote-preview" style="padding: 60px; max-width: 1100px; margin: 20px auto; background: white; border-radius: 0; min-height: 1000px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 60px; border-bottom: 3px solid #f1f5f9; padding-bottom: 30px;">
          <div>
            <h1 style="margin: 0; color: var(--primary-color); font-size: 2rem; letter-spacing: -0.5px;">Handyman Hans Pressure Washing</h1>
            <p style="margin: 8px 0 0 0; color: #64748b; font-size: 1.1rem;">Professional Exterior Cleaning Services</p>
          </div>
          <div style="text-align: right;">
            <div style="text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; font-size: 0.85rem; font-weight: 700; margin-bottom: 5px;">Quote Number</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: #1e293b;">#Q-${quote.id}</div>
          </div>
        </div>

        <div style="margin-bottom: 60px; background: #f8fafc; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="display: flex; gap: 60px;">
            <div>
              <div style="text-transform: uppercase; color: #94a3b8; font-size: 0.75rem; font-weight: 800; letter-spacing: 1px; margin-bottom: 12px;">Client Details</div>
              <div style="font-weight: 700; font-size: 1.25rem; color: #1e293b; margin-bottom: 8px;">${contact ? contact.name : 'Valued Customer'}</div>
              <div style="color: #64748b; line-height: 1.5;">
                ${contact ? contact.address : ''}<br>
                ${contact ? contact.email || '' : ''}<br>
                ${contact ? contact.phone : ''}
              </div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 40px;">
          <h2 style="font-size: 1.5rem; color: #1e293b; margin-bottom: 25px; text-align: center;">Choose Your Service Level</h2>
          <div style="display: flex; gap: 20px; overflow-x: auto; padding-bottom: 10px; align-items: stretch;">
            ${renderTierColumn('basic')}
            ${renderTierColumn('standard')}
            ${renderTierColumn('premium')}
          </div>
        </div>

        ${quote.notes ? `
          <div style="margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 40px;">
            <div style="text-transform: uppercase; color: #94a3b8; font-size: 0.75rem; font-weight: 800; letter-spacing: 1px; margin-bottom: 15px;">Additional Terms & Notes</div>
            <div style="color: #475569; line-height: 1.8; font-size: 1rem; white-space: pre-wrap;">${quote.notes}</div>
          </div>
        ` : ''}

        <div style="margin-top: 100px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 40px;">
          <div style="font-size: 1.1rem; color: #1e293b; font-weight: 600; margin-bottom: 10px;">Ready to proceed?</div>
          <p style="color: #64748b; font-size: 0.95rem;">Select your preferred option above. We look forward to working with you!</p>
        </div>
      </div>
    </main>
  `;
}

/**
 * Simulated API for CRM Activity Timeline
 * GET /api/contacts/:id/timeline
 */
async function loadTimeline(contactId: string) {
  const response = await fetch(`/api/contacts/${contactId}/timeline`);
  const result = await response.json();
  const timeline = result.data || result;
  contactTimelineState = timeline;

  // RENDER: Simple list (no heavy styling yet)
  const timelineContainer = document.getElementById('api-timeline-list');
  if (timelineContainer) {
    timelineContainer.innerHTML = contactTimelineState.map(group => `
            <div style="margin-bottom: 25px;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">${group.label}</div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    ${group.items.map((item: any) => {
      const isMissed = item.type === 'call_missed';
      const color = isMissed ? '#dc2626' : '#1e293b';
      const borderColor = isMissed ? '#fca5a5' : '#e2e8f0';

      return `
                            <div style="background: #fff; border-radius: 8px; padding: 12px 15px; border-left: 3px solid ${borderColor}; margin-bottom: 4px;">
                                <div style="font-size: 0.95rem; color: ${color}; font-weight: ${isMissed ? '600' : '500'}; margin-bottom: 4px;">${item.content}</div>
                                <div style="font-size: 0.8rem; color: #64748b;">${item.created_at}</div>
                            </div>
                        `;
    }).join('')}
                    ${group.items.length === 0 ? '<p style="color: #94a3b8; font-style: italic; padding: 10px;">No activities recorded.</p>' : ''}
                </div>
            </div>
        `).join('') || '<p style="padding: 20px; color: #94a3b8;">No timeline entries found.</p>';
  }
}

(window as any).loadTimeline = loadTimeline;

async function sendQuickSMS(contactId: string) {
  (window as any).openSmsComposer(contactId);
}

(window as any).sendQuickSMS = sendQuickSMS;

async function renderContactDetail(contactId: string) {
  app.innerHTML = `
    ${renderSidebar('clients')}
    <main class="main-content" style="padding: 24px; text-align: center; color: #64748b;">
      Loading contact details...
    </main>
  `;

  const response = await fetch(`/api/contacts/${contactId}`);
  const result = await response.json();
  const contact = result.data || result;

  if (!contact || response.status === 404) {
    (window as any).showToast('Contact not found.', 3000);
    window.navigateTo('clients');
    return;
  }

  const contactOpps = mockOpportunities.filter(opp => opp.contact_id === contactId);
  const contactQuotes = mockQuotes.filter(q => q.contact_id === contactId);
  const contactInvoices = mockInvoices.filter(i => i.contact_id === contactId);

  app.innerHTML = `
    ${renderSidebar('clients')}
    <main class="main-content" style="padding: 24px; max-width: 1100px; margin: 0 auto; background: #fff;">
      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <button onclick="window.navigateTo('clients')" style="background: #f1f5f9; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; color: #475569; font-weight: 600; display: flex; align-items: center; gap: 6px;">
            <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            Back
          </button>
          <h2 style="margin: 0; font-size: 1.6rem; font-weight: 800; color: #0f172a;">${contact.name}</h2>
          <span class="badge badge-${contact.status}" style="font-size: 0.75rem; padding: 4px 10px;">${contact.status}</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn-primary" style="background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; font-size: 0.8rem; padding: 8px 16px;" onclick="window.addNote('${contactId}')">📝 Note</button>
          <button class="btn-primary" style="font-size: 0.8rem; padding: 8px 16px;" onclick="window.createOpportunity('${contactId}')">💰 New Opportunity</button>
        </div>
      </div>

      <!-- 1. High-Density Contact Info Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 20px;">
         <div>
           <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Phone</div>
           <input type="text" value="${contact.phone}" onchange="window.updateContactField('${contactId}', 'phone', this.value)" style="background: transparent; border: none; font-weight: 700; color: #1e293b; font-size: 0.95rem; width: 100%; outline: none;" onfocus="this.style.background='#fff'; this.style.boxShadow='0 0 0 2px #e2e8f0'" onblur="this.style.background='transparent'; this.style.boxShadow='none'">
         </div>
         <div>
           <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Email</div>
           <input type="email" value="${contact.email || ''}" placeholder="Add email..." onchange="window.updateContactField('${contactId}', 'email', this.value)" style="background: transparent; border: none; font-weight: 700; color: #1e293b; font-size: 0.95rem; width: 100%; outline: none;" onfocus="this.style.background='#fff'; this.style.boxShadow='0 0 0 2px #e2e8f0'" onblur="this.style.background='transparent'; this.style.boxShadow='none'">
         </div>
         <div>
           <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Source</div>
           <div style="font-weight: 700; color: #1e293b; font-size: 0.95rem;">${contact.source}</div>
         </div>
         <div>
           <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Address</div>
           <div style="font-weight: 700; color: #1e293b; font-size: 0.95rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${contact.address}">${contact.address}</div>
         </div>
      </div>

      <!-- 2. Priority Quick Actions -->
      <div style="display: flex; gap: 12px; margin-bottom: 30px;">
        ${contact.phone ? `
          <a href="tel:${contact.phone}" class="btn-primary" style="background: #10b981; flex: 1; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: 800; height: 50px; border-radius: 10px; font-size: 1rem; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);">
            📞 Call Lead Now
          </a>
          <button class="btn-primary" onclick="window.sendQuickSMS('${contact.id}')" style="background: #6366f1; flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: 800; height: 50px; border-radius: 10px; font-size: 1rem; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);">
            💬 Send Quick Text
          </button>
        ` : '<div style="flex: 1; color: #64748b; font-style: italic; background: #f8fafc; padding: 15px; border-radius: 10px; text-align: center; border: 1px solid #e2e8f0;">No phone number provided for quick actions</div>'}
      </div>

      <!-- 3. Main Content Split -->
      <div class="detail-container" style="display: grid; grid-template-columns: 1.6fr 1fr; gap: 24px; align-items: start;">
        
        <!-- Left Column: Timeline -->
        <section>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 0.85rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Activity Timeline</h3>
            <button onclick="window.logCall('${contactId}')" style="background: transparent; border: 1px solid #e2e8f0; color: #64748b; font-size: 0.75rem; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-weight: 600;">Log Item +</button>
          </div>
          <div class="card" style="padding: 0; border: 1px solid #e2e8f0; box-shadow: none;">
            <div id="api-timeline-list" style="max-height: 600px; overflow-y: auto;">
              <div style="padding: 40px; text-align: center; color: #94a3b8;">
                 <div class="skeleton-row" style="width: 60%; margin: 10px auto;"></div>
                 <div class="skeleton-row" style="width: 40%; margin: 10px auto;"></div>
                 <p style="font-size: 0.85rem; margin-top: 15px;">Retrieving history...</p>
              </div>
            </div>
          </div>
        </section>

        <!-- Right Column: Financials & Deals -->
        <aside style="display: flex; flex-direction: column; gap: 24px;">
          
          <!-- Opportunities -->
          <div>
            <h3 style="margin: 0 0 12px 0; font-size: 0.85rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Active Opportunities</h3>
            <div class="card" style="padding: 12px; border: 1px solid #e2e8f0; box-shadow: none;">
              ${contactOpps.map(opp => `
                <div style="padding: 10px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-weight: 700; color: #1e293b; font-size: 0.9rem;">$${opp.value.toLocaleString()}</div>
                    <div style="font-size: 0.75rem; color: #64748b;">${opp.pipeline_stage}</div>
                  </div>
                  <span class="badge badge-${opp.status}" style="font-size: 0.65rem;">${opp.status}</span>
                </div>
              `).join('') || '<div style="padding: 10px; color: #94a3b8; font-size: 0.85rem; text-align: center; font-style: italic;">No active opportunities</div>'}
            </div>
          </div>

          <!-- Quotes & Invoices Summary -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="card" style="padding: 16px; border: 1px solid #e2e8f0; box-shadow: none; text-align: center;">
              <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Quotes</div>
              <div style="font-size: 1.25rem; font-weight: 800; color: #1e293b;">${contactQuotes.length}</div>

        </aside>
      </div>
    </main>
  `;

  loadTimeline(contactId);
}

(window as any).logCall = (contactId: string) => {
  const note = prompt("Enter call summary:");
  if (note) {
    mockActivities.push({
      id: 'act-' + Date.now(),
      user_id: (window as any).currentUser || 'system',
      contact_id: contactId,
      type: 'call',
      description: note,
      due_date: new Date().toISOString(),
      completed: true
    });
    renderContactDetail(contactId);
  }
};

(window as any).addNote = (contactId: string) => {
  const note = prompt("Enter your note:");
  if (note) {
    mockActivities.push({
      id: 'act-' + Date.now(),
      user_id: (window as any).currentUser || 'system',
      contact_id: contactId,
      type: 'note',
      description: note,
      due_date: new Date().toISOString(),
      completed: true
    });
    renderContactDetail(contactId);
  }
};

(window as any).completeTask = (activityId: string) => {
  const activity = mockActivities.find(a => a.id === activityId);
  if (activity) {
    activity.completed = true;
    if (selectedContactId) renderContactDetail(selectedContactId);
  }
};

(window as any).createOpportunity = (contactId: string) => {
  const valueInput = prompt("Enter Opportunity value (e.g. 500):", "0");
  const value = parseFloat(valueInput || "0");

  const newOpp = {
    id: 'o' + (mockOpportunities.length + 1) + '-' + Math.floor(Math.random() * 100),
    user_id: 'system',
    contact_id: contactId,
    pipeline_stage: 'New Lead',
    value: isNaN(value) ? 0 : value,
    assigned_to: 'Hansveer',
    status: 'open' as any,
    created_at: new Date().toISOString()
  };

  mockOpportunities.push(newOpp);

  // Trigger automation
  runAutomations('OPPORTUNITY_CREATED', newOpp);

  renderContactDetail(contactId);
};

(window as any).updateOpportunityField = (oppId: string, field: string, value: string) => {
  const opp = mockOpportunities.find(o => o.id === oppId);
  if (opp) {
    if (field === 'value') {
      opp.value = parseFloat(value) || 0;
    } else {
      (opp as any)[field] = value;
    }
    (window as any).navigateTo(currentView, selectedContactId || undefined);
  }
};

(window as any).updateContactField = (contactId: string, field: string, value: string) => {
  const contact = mockContacts.find(c => c.id === contactId);
  if (contact) {
    if (field === 'phone') {
      const phoneNorm = normalizePhone(value);
      contact.phone = phoneNorm.normalized;
      contact.invalid_phone = phoneNorm.invalid || undefined;
    } else if (field === 'email') {
      contact.email = normalizeEmail(value);
    } else if (field === 'name') {
      contact.name = normalizeName(value);
    } else {
      (contact as any)[field] = value;
    }
    (window as any).navigateTo(currentView, selectedContactId || undefined);
  }
};

(window as any).createQuote = (contactId: string) => {
  (window as any).newQuoteContactId = contactId;

  // Try to find the latest open opportunity for this contact
  const activeOpp = mockOpportunities
    .filter(o => o.contact_id === contactId && o.status === 'open')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  (window as any).newQuoteOpportunityId = activeOpp ? activeOpp.id : '';
  (window as any).newQuoteLineItems = [{ service: '', description: '', quantity: 1, price: 0, tier: 'basic' }];
  (window as any).navigateTo('new-quote');
};

(window as any).markAsPaid = (invoiceId: string) => {
  const invoice = mockInvoices.find(i => i.id === invoiceId);
  if (invoice) {
    invoice.status = 'paid';

    // Update linked opportunity
    const quote = mockQuotes.find(q => q.id === invoice.quote_id);
    if (quote && quote.opportunity_id) {
      const opportunity = mockOpportunities.find(o => o.id === quote.opportunity_id);
      if (opportunity) {
        opportunity.pipeline_stage = 'Paid';
      }
    }

    mockActivities.push({
      id: 'act-' + (mockActivities.length + 1) + '-' + Math.floor(Math.random() * 100),
      contact_id: invoice.contact_id,
      type: 'note',
      description: `Invoice ${invoice.id} marked as Paid.`,
      due_date: new Date().toISOString(),
      completed: true
    });

    if (currentView === 'invoices') renderInvoices();
    if (currentView === 'contact-detail' && selectedContactId) renderContactDetail(selectedContactId);
  }
};

(window as any).convertToInvoice = (quoteId: string) => {
  const quote = mockQuotes.find(q => q.id === quoteId);
  if (quote) {
    // Check for existing invoice
    if (mockInvoices.some(i => i.quote_id === quoteId)) {
      alert("Invoice already exists for this quote.");
      return;
    }

    const invoiceId = 'inv-' + (mockInvoices.length + 1) + '-' + Math.floor(Math.random() * 100);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    mockInvoices.push({
      id: invoiceId,
      contact_id: quote.contact_id,
      quote_id: quote.id,
      amount: quote.total_amount,
      status: 'unpaid',
      due_date: dueDate.toISOString(),
      created_at: new Date().toISOString()
    });

    mockActivities.push({
      id: 'act-' + (mockActivities.length + 1) + '-' + Math.floor(Math.random() * 100),
      contact_id: quote.contact_id,
      type: 'note',
      description: `Invoice ${invoiceId} created from Quote Q-${quote.id}`,
      due_date: new Date().toISOString(),
      completed: true
    });

    if (currentView === 'quotes') renderQuotes();
    if (currentView === 'contact-detail' && selectedContactId) renderContactDetail(selectedContactId);
  }
};

(window as any).approveQuote = (quoteId: string) => {
  const quote = mockQuotes.find(q => q.id === quoteId);
  if (quote) {
    quote.status = 'approved';
    const opportunity = mockOpportunities.find(o => o.id === quote.opportunity_id);
    if (opportunity) {
      opportunity.status = 'won';
      opportunity.pipeline_stage = 'Scheduled';
      opportunity.value = quote.total_amount; // Update value to reflect actual quote
    }

    mockActivities.push({
      id: 'act-' + (mockActivities.length + 1) + '-' + Math.floor(Math.random() * 100),
      contact_id: quote.contact_id,
      type: 'note',
      description: `Quote Q-${quote.id} approved! Opportunity marked as Won.`,
      due_date: new Date().toISOString(),
      completed: true
    });

    // Automatically create Invoice if one doesn't exist
    if (!mockInvoices.some(i => i.quote_id === quote.id)) {
      const invoiceId = 'inv-' + (mockInvoices.length + 1) + '-' + Math.floor(Math.random() * 100);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      mockInvoices.push({
        id: invoiceId,
        contact_id: quote.contact_id,
        quote_id: quote.id,
        amount: quote.total_amount,
        status: 'unpaid',
        due_date: dueDate.toISOString(),
        created_at: new Date().toISOString()
      });

      mockActivities.push({
        id: 'act-' + (mockActivities.length + 1) + '-' + Math.floor(Math.random() * 100),
        contact_id: quote.contact_id,
        type: 'note',
        description: `Invoice ${invoiceId} automatically created from Quote Q-${quote.id}`,
        due_date: new Date().toISOString(),
        completed: true
      });
    }

    if (currentView === 'quotes') renderQuotes();
    if (currentView === 'contact-detail' && selectedContactId) renderContactDetail(selectedContactId);
  }
};

(window as any).rejectQuote = (quoteId: string) => {
  const quote = mockQuotes.find(q => q.id === quoteId);
  if (quote) {
    quote.status = 'rejected';
    const opportunity = mockOpportunities.find(o => o.id === quote.opportunity_id);
    if (opportunity) {
      opportunity.status = 'lost';
    }

    mockActivities.push({
      id: 'act-' + (mockActivities.length + 1) + '-' + Math.floor(Math.random() * 100),
      contact_id: quote.contact_id,
      type: 'note',
      description: `Quote Q-${quote.id} was rejected. Opportunity marked as Lost.`,
      due_date: new Date().toISOString(),
      completed: true
    });

    if (currentView === 'quotes') renderQuotes();
    if (currentView === 'contact-detail' && selectedContactId) renderContactDetail(selectedContactId);
  }
};

(window as any).sendQuote = (quoteId: string) => {
  const quote = mockQuotes.find(q => q.id === quoteId);
  if (quote) {
    quote.status = 'sent';
    console.log(`Sending Quote Q-${quote.id} to client...`);

    // Log Activity
    mockActivities.push({
      id: 'act-' + (mockActivities.length + 1) + '-' + Math.floor(Math.random() * 100),
      contact_id: quote.contact_id,
      type: 'note',
      description: `Quote Q-${quote.id} sent to customer`,
      due_date: new Date().toISOString(),
      completed: true
    });

    // Update Opportunity stage and value
    if (quote.opportunity_id) {
      const opportunity = mockOpportunities.find(o => o.id === quote.opportunity_id);
      if (opportunity) {
        opportunity.pipeline_stage = 'Quote Sent';
        opportunity.value = quote.total_amount;
        // Trigger automated follow-up
        runAutomations('OPPORTUNITY_STAGE_UPDATED', opportunity);
      }
    }

    // Refresh view
    if (currentView === 'quotes') renderQuotes();
    if (currentView === 'contact-detail' && selectedContactId) renderContactDetail(selectedContactId);
  }
};

(window as any).createInvoice = (contactId: string) => {
  const contactQuotes = mockQuotes.filter(q => q.contact_id === contactId);
  if (contactQuotes.length === 0) {
    alert("Please create a Quote first.");
    return;
  }

  // Use the most recent quote by default for simulation
  const latestQuote = contactQuotes[contactQuotes.length - 1];

  const amountStr = prompt("Enter Invoice Amount:", latestQuote.total_amount.toString());
  const amount = parseFloat(amountStr || "0");
  if (isNaN(amount)) return;

  const invoiceId = 'i' + (mockInvoices.length + 1) + '-' + Math.floor(Math.random() * 100);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7); // Due in 7 days

  mockInvoices.push({
    id: invoiceId,
    contact_id: contactId,
    quote_id: latestQuote.id,
    amount: amount,
    status: 'unpaid',
    due_date: dueDate.toISOString(),
    created_at: new Date().toISOString()
  });

  renderContactDetail(contactId);
};

function renderEventLogs() {
  const sortedLogs = [...getEvents()].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const tableRows = sortedLogs.map(log => {
    return `
      <tr>
        <td style="font-weight: 600; color: var(--primary-color);">${log.event_name}</td>
        <td>${new Date(log.created_at).toLocaleString()}</td>
        <td><span class="badge badge-${log.status === 'processed' ? 'approved' : 'draft'}">${log.status}</span></td>
        <td>
          <div style="font-size: 0.8rem; color: #666;">
            <strong>Contact:</strong> ${log.payload.contact_id || 'N/A'}<br>
            <strong>Opp:</strong> ${log.payload.opportunity_id || 'N/A'}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  app.innerHTML = `
    ${renderSidebar('event-logs')}
    <main class="main-content">
      <header class="view-header">
        <h2>System Event Logs</h2>
      </header>

      <div class="card" style="padding: 0; overflow: hidden;">
        <table class="clients-table" style="box-shadow: none; border: none; margin-top: 0;">
          <thead>
            <tr>
              <th>Event Name</th>
              <th>Timestamp</th>
              <th>Status</th>
              <th>Key Payload Info</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="4" style="text-align: center; padding: 40px; color: #666;">No system events recorded yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </main>
  `;
}

function renderQATools() {
  app.innerHTML = `
    ${renderSidebar('qa-tools')}
    <main class="main-content">
      <header class="view-header">
        <h2>QA & Debug Tools</h2>
      </header>

      <div class="card" style="padding: 24px; margin-bottom: 24px; background: #fdf2f2; border: 1px solid #fee2e2;">
        <h3 style="margin-top: 0; color: #991b1b;">Multi-User Isolation Simulation</h3>
        <p style="color: #b91c1c; font-size: 0.9rem; margin-bottom: 16px;">Switches the UI context to simulate different logged-in users. Verify that User B cannot see User A's data.</p>
        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
          <button class="btn-${(window as any).currentUser === 'user_a' ? 'primary' : 'secondary'}" 
                  onclick="window.switchUser('user_a')">Simulate User A</button>
          <button class="btn-${(window as any).currentUser === 'user_b' ? 'primary' : 'secondary'}" 
                  onclick="window.switchUser('user_b')">Simulate User B</button>
          <button class="btn-${(window as any).currentUser === 'system' ? 'primary' : 'secondary'}" 
                  onclick="window.switchUser('system')">System Context</button>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #7f1d1d; font-weight: 600;">
          <div style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444; animation: pulse 2s infinite;"></div>
          Active ID: ${(window as any).currentUser}
        </div>
      </div>
      
      <div class="card" style="padding: 24px;">
        <h3 style="margin-top: 0;">Call Workflow Simulations</h3>
        <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 20px;">Manually trigger inbound call events to verify automated follow-ups and timeline logging.</p>
        
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          ${!pendingSimulationCallId ? `
            <button class="btn-primary" onclick="window.startSimulationCall()" style="background: #10b981; border: none;">📞 Simulate Inbound Call</button>
          ` : `
            <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; width: 100%; display: flex; align-items: center; justify-content: space-between; border: 1px solid #e2e8f0;">
              <div>
                <span style="display: block; font-size: 0.7rem; text-transform: uppercase; color: #64748b; font-weight: 800;">Pending Call ID</span>
                <span style="font-weight: 700; color: #1e293b;">${pendingSimulationCallId}</span>
              </div>
              <div style="display: flex; gap: 10px;">
                <button class="btn-primary" 
                        onclick="window.completeSimulationCall(false)" 
                        style="background: #ef4444; border: none; font-size: 0.8rem; padding: 8px 16px; ${isProcessingSimulation ? 'opacity: 0.5; pointer-events: none;' : ''}"
                        ${isProcessingSimulation ? 'disabled' : ''}>📵 Mark as Missed</button>
                <button class="btn-primary" 
                        onclick="window.completeSimulationCall(true)" 
                        style="background: #10b981; border: none; font-size: 0.8rem; padding: 8px 16px; ${isProcessingSimulation ? 'opacity: 0.5; pointer-events: none;' : ''}"
                        ${isProcessingSimulation ? 'disabled' : ''}>✅ Answered</button>
                <button class="btn-primary" 
                        onclick="window.cancelSimulationCall()" 
                        style="background: #64748b; border: none; font-size: 0.8rem; padding: 8px 16px; ${isProcessingSimulation ? 'opacity: 0.5; pointer-events: none;' : ''}"
                        ${isProcessingSimulation ? 'disabled' : ''}>Cancel</button>
              </div>
            </div>
          `}
        </div>
      </div>

      ${lastSimulationResult ? `
      <div class="card" style="margin-top: 24px; padding: 24px; border-left: 4px solid #3b82f6;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0; color: #1e293b;">Simulation Result</h3>
          <button onclick="window.clearSimulationResult()" style="background: none; border: none; color: #64748b; cursor: pointer; font-size: 0.8rem; text-decoration: underline;">Clear Results</button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
          <div style="background: white; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Contact</div>
            <div style="font-weight: 700; color: #1e293b;">${lastSimulationResult.contact?.name || 'Unknown'}</div>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">ID: ${lastSimulationResult.contact?.id || 'N/A'}</div>
            ${lastSimulationResult.contact?.id ? `
              <button onclick="window.navigateTo('contact-detail', '${lastSimulationResult.contact.id}')" style="margin-top: 10px; font-size: 0.75rem; color: #2563eb; background: none; border: none; padding: 0; cursor: pointer; font-weight: 600;">View Profile →</button>
            ` : ''}
          </div>

          <div style="background: white; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Opportunity</div>
            <div style="font-weight: 700; color: #1e293b;">${lastSimulationResult.opportunity ? 'Created Successfully' : '<span style="color: #64748b;">Not Created</span>'}</div>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">Stage: ${lastSimulationResult.opportunity?.pipeline_stage || 'N/A'}</div>
          </div>

          <div style="background: white; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Automated SMS</div>
            <div style="font-weight: 700; color: ${lastSimulationResult.sms?.status === 'sent' ? '#10b981' : '#f59e0b'};">
              ${lastSimulationResult.sms ? (lastSimulationResult.sms.status === 'sent' ? 'Sent' : 'Failed/Skipped') : 'No SMS Logged'}
            </div>
            <div style="font-size: 0.75rem; color: #475569; margin-top: 6px; font-style: italic; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              ${lastSimulationResult.sms?.content || 'No automated reply triggered.'}
            </div>
          </div>
        </div>
      </div>
      ` : ''}

      <div class="card" style="margin-top: 24px; padding: 24px; background: #f8fafc;">
        <h4 style="margin: 0; color: #475569; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px;">Testing Notes</h4>
        <ul style="margin: 10px 0 0 0; font-size: 0.85rem; color: #64748b; line-height: 1.6;">
          <li>Simulating a missed call will trigger the "call_received" then "call_missed" sequence.</li>
          <li>If the phone number matches an existing lead, it will update their timeline.</li>
          <li>If the phone number is new, it will result in a generic event log.</li>
        </ul>
      </div>
    </main>
  `;
}

(window as any).startSimulationCall = async () => {
  const phone = prompt("Enter phone number to simulate inbound call from:", "+15550109999");
  if (!phone) return;
  
  try {
    (window as any).showToast('Initiating mock inbound call...', 2000);
    const inbound = await (window as any).handleInboundCall({ phone });
    pendingSimulationCallId = inbound.callId;
    renderQATools();
    (window as any).showToast('Call active! Mark status below.', 3000);
  } catch (err: any) {
    console.error('Simulation Error:', err);
    alert('Simulation failed: ' + err.message);
  }
};

(window as any).completeSimulationCall = async (answered: boolean) => {
  if (!pendingSimulationCallId || isProcessingSimulation) return;
  
  try {
    isProcessingSimulation = true;
    renderQATools(); // Show disabled states

    const callId = pendingSimulationCallId;
    (window as any).showToast(answered ? 'Marking as Answered...' : 'Marking as Missed...', 2000);
    
    // Call endCall API (already has status guards: answered/missed)
    const result = await (window as any).endCall({ call_id: callId, answered });
    
    if (result.status === 'ignored') {
      console.warn(`[SIMULATION] ${result.message}`);
      (window as any).showToast('Call was already processed.', 3000);
    } else {
      // In a real system, we'd fetch the updated contact/timeline to show results
      // Transitioning away from direct mock peaking for security. 
      lastSimulationResult = { 
          status: 'success', 
          call_id: callId, 
          type: answered ? 'answered' : 'missed',
          message: 'Backend workflow triggered successfully.'
      };
    }

    pendingSimulationCallId = null;
    isProcessingSimulation = false;
    renderQATools();
    (window as any).showToast(`Call status updated to ${answered ? 'answered' : 'missed'}!`, 3000);
  } catch (err: any) {
    isProcessingSimulation = false;
    renderQATools();
    console.error('Simulation Error:', err);
    alert('Failed to update call: ' + err.message);
  }
};

(window as any).clearSimulationResult = () => {
  lastSimulationResult = null;
  renderQATools();
};

(window as any).cancelSimulationCall = () => {
  pendingSimulationCallId = null;
  renderQATools();
};

checkOverdueInvoices();

// 🌿 WB.6.4 INTEGRATED ROUTING RESOLVER (Step 2 & 3)
async function bootRouter() {
  const host = window.location.hostname;
  const rawPath = window.location.pathname;

  // 1. Check for Admin Hash Routes First
  if (window.location.hash) {
     const parts = window.location.hash.slice(2).split('/');
     const view = parts[0];
     const id = parts[1];
     if (view) {
       (window as any).navigateTo(view, id);
       return;
     }
  }

  // 2. Resolve Public Website Route
  // Map /site/X or /preview/X to just X for the resolver if needed, 
  // but resolver usually handles the full path.
  let targetPath = rawPath === '/' ? '/' : rawPath;
  
  // Clean up legacy paths for the resolver if they exist
  if (targetPath.startsWith('/site/')) targetPath = targetPath.replace('/site/', '/');
  if (targetPath.startsWith('/preview/')) targetPath = targetPath.replace('/preview/', '/');

  const result = await resolveWebsiteRequest(host, targetPath);

  if (result && result.funnel_id) {
    (window as any).navigateTo('site', result.funnel_id, result.website);
  } else if (rawPath === '/') {
    // If root doesn't resolve to a website, show dashboard
    renderDashboard();
  } else {
    render404();
  }
}

bootRouter();

window.addEventListener('popstate', () => {
    bootRouter();
});

// Auto-refresh Sidebar Counts & New Lead Alerts (PROMPT 8, 9, 10)
setInterval(() => {
  let changeDetected = false;

  // 🌿 1. Detect New Leads (Global Alert - WB.5.4)
  if (mockContacts.length > lastContactCount) {
    const newLeads = mockContacts.slice(lastContactCount);
    
    // Detailed toast for the most recent lead
    if (newLeads.length === 1) {
      const lead = newLeads[0];
      (window as any).showToast(`New lead: ${lead.name} (${lead.phone})`, 'info');
    } else {
      (window as any).showToast(`${newLeads.length} new leads received`, 'info');
    }

    lastContactCount = mockContacts.length;
    changeDetected = true;
  }

  // 2. Refresh UI (only in standard app views)
  const sidebar = document.querySelector('.sidebar');
  if (sidebar && !['builder', 'preview', 'site'].includes(currentView)) {
    console.log('[POLLING] Refreshing UI state...');

    // Always refresh sidebar for badge counts
    sidebar.outerHTML = renderSidebar(currentView);

    // If a new lead was detected, re-render the active view to show it immediately
    if (changeDetected) {
      if (currentView === 'clients') renderClients();
      if (currentView === 'dashboard') (window as any).renderDashboard();
    }
  }

}, 5000);

// ── WB.6.1 Onboarding Modal & Flow ──────────────────────────────────
let onboardingState = { 
    businessName: '', 
    phone: '', 
    city: '', 
    services: [] as string[] 
};

(window as any).showOnboardingModal = () => {
    // Reset state
    onboardingState = { 
        businessName: '', 
        phone: '', 
        city: '', 
        services: [] 
    };
    
    // Check if session has captured data
    const saved = window.sessionStorage.getItem('onboarding_capture');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            onboardingState = { ...onboardingState, ...parsed };
        } catch {}
    }
    
    const modal = document.createElement('div');
    modal.id = 'website-onboarding-modal';
    modal.innerHTML = `
        <div id="onboarding-backdrop"></div>
        <div class="onboarding-card">
            <h1 class="onboarding-title">Let's build your site</h1>
            <p class="onboarding-subtitle">Tell us about your business to generate your premium website.</p>
            
            <div id="onboarding-form-container">
                <div class="onboarding-form-group">
                    <label for="ob-business-name">Business Name</label>
                    <input type="text" id="ob-business-name" class="onboarding-input" placeholder="e.g. PressurePro Cleaning" value="${onboardingState.businessName}" required>
                </div>
                
                <div class="onboarding-form-group">
                    <label for="ob-city">Service City</label>
                    <input type="text" id="ob-city" class="onboarding-input" placeholder="e.g. Austin, TX" value="${onboardingState.city}" required>
                </div>
                
                <div class="onboarding-form-group">
                    <label for="ob-phone">Phone Number</label>
                    <input type="tel" id="ob-phone" class="onboarding-input" placeholder="e.g. (555) 000-0000" value="${onboardingState.phone}" required>
                </div>
                
                <div class="onboarding-form-group">
                    <label>Services Offered (Multi-select)</label>
                    <div class="services-grid">
                        <div class="service-chip ${onboardingState.services.includes('Driveway Cleaning') ? 'selected' : ''}" onclick="window.toggleOnboardingService(this, 'Driveway Cleaning')">Driveway Cleaning</div>
                        <div class="service-chip ${onboardingState.services.includes('House Washing') ? 'selected' : ''}" onclick="window.toggleOnboardingService(this, 'House Washing')">House Washing</div>
                        <div class="service-chip ${onboardingState.services.includes('Patio Cleaning') ? 'selected' : ''}" onclick="window.toggleOnboardingService(this, 'Patio Cleaning')">Patio Cleaning</div>
                        <div class="service-chip ${onboardingState.services.includes('Other') ? 'selected' : ''}" onclick="window.toggleOnboardingService(this, 'Other')">Other</div>
                    </div>
                </div>
                
                <div class="onboarding-footer">
                    <button class="btn-primary btn-onboarding" onclick="window.submitWebsiteOnboarding()">
                        Generate My Website
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
                    </button>
                    <p style="font-size: 0.8rem; color: #94a3b8; text-align: center;">By continuing, you agree to our terms of service.</p>
                </div>
            </div>
            
            <div id="onboarding-success" style="display: none; text-align: center; padding: 40px 0;">
                <div style="font-size: 4rem; margin-bottom: 12px;">🚀</div>
                <h2 class="onboarding-title" style="margin-bottom: 8px;">Your website is live!</h2>
                <p class="onboarding-subtitle" style="margin-bottom: 32px;">We've generated your full funnel structure and local SEO pages. You're ready to start receiving leads.</p>
                
                <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 24px;">
                    <button class="btn-primary" style="width: 100%; padding: 18px; font-weight: 600;" onclick="window.location.href='/'">
                        View Site
                    </button>
                    <button class="btn-secondary" style="width: 100%; padding: 18px; border: 1px solid #e2e8f0; background: white; font-weight: 600;" onclick="window.showWebsiteDashboard()">
                        Manage Website
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Accessibility: focus the first field
    setTimeout(() => document.getElementById('ob-business-name')?.focus(), 100);
};

(window as any).showWebsiteDashboard = () => {
    (window as any).navigateTo('website-structure');
};

(window as any).toggleOnboardingService = (el: HTMLElement, service: string) => {
    const index = onboardingState.services.indexOf(service);
    if (index > -1) {
        onboardingState.services.splice(index, 1);
        el.classList.remove('selected');
    } else {
        onboardingState.services.push(service);
        el.classList.add('selected');
    }
    // Update temp storage as we change chips
    window.sessionStorage.setItem('onboarding_capture', JSON.stringify(onboardingState));
};

(window as any).submitWebsiteOnboarding = () => {
    const name = (document.getElementById('ob-business-name') as HTMLInputElement).value;
    const city = (document.getElementById('ob-city') as HTMLInputElement).value;
    const phone = (document.getElementById('ob-phone') as HTMLInputElement).value;
    
    if (!name || !city || !phone) {
        (window as any).showToast('Please fill in all required fields.', 'error');
        return;
    }
    
    if (onboardingState.services.length === 0) {
        (window as any).showToast('Please select at least one service.', 'error');
        return;
    }
    
    // Update state
    onboardingState.businessName = name;
    onboardingState.city = city;
    onboardingState.phone = phone;
    
    console.log('[ONBOARDING] Data captured:', onboardingState);
    
    // Store temporarily in session/onboarding state
    window.sessionStorage.setItem('onboarding_capture', JSON.stringify(onboardingState));

    // Phase W2.2 Integration: Generate full website + funnels from inputs
    (window as any).showToast('Generating your premium website...', 'info');
    
    fetch('/api/websites/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            business_name: onboardingState.businessName,
            phone_number: onboardingState.phone,
            city: onboardingState.city,
            services: onboardingState.services
        })
    }).then(r => r.json())
    .then(result => {
        if (!result.success) throw new Error(result.error);
        
        console.log('[ONBOARDING] Website generated:', result.data);
        window.localStorage.setItem('onboarding_seen', 'true');
        
        // Show success view
        const form = document.getElementById('onboarding-form-container');
        const success = document.getElementById('onboarding-success');
        if (form && success) {
            form.style.display = 'none';
            success.style.display = 'block';
            
            // Update global settings as well for immediate feel
            (window as any).updateGlobalSettings('businessName', name);
            (window as any).updateGlobalSettings('phone', phone);
        }
    }).catch(err => {
        console.error('[ONBOARDING] Generation failed:', err);
        (window as any).showToast(err.message || 'Generation failed. Please try again.', 'error');
    });
};

(window as any).closeOnboarding = () => {
    document.getElementById('website-onboarding-modal')?.remove();
    // Redirect to website structure as a way to show "site is ready"
    window.navigateTo('website-structure');
};

// ── WB.6.4 Funnel Dashboard Checklist ────────────────────────────────
(window as any).renderFunnelsChecklist = () => {
  if (window.localStorage.getItem('funnels_checklist_dismissed')) return '';
  
  const state = JSON.parse(window.localStorage.getItem('funnels_checklist_state') || '{"copy":false,"share":false,"test":false}');
  
  return `
    <div id="funnels-checklist" class="card" style="background: #fffbeb; border: 1px solid #fde68a; padding: 20px; margin-bottom: 24px; position: relative;">
      <button onclick="window.dismissFunnelChecklist()" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: #92400e; cursor: pointer; font-size: 1.2rem;">&times;</button>
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <span style="font-size: 1.25rem;">📝</span>
        <h3 style="margin: 0; font-size: 1rem; color: #92400e;">Get Your First Lead Checklist</h3>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" id="check-copy" ${state.copy ? 'checked' : ''} onchange="window.toggleCheckItem('copy')">
          <label for="check-copy" style="font-size: 0.9rem; color: #92400e; cursor: pointer;">Copy your funnel link</label>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" id="check-share" ${state.share ? 'checked' : ''} onchange="window.toggleCheckItem('share')">
          <label for="check-share" style="font-size: 0.9rem; color: #92400e; cursor: pointer;">Share it (FB / WhatsApp)</label>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" id="check-test" ${state.test ? 'checked' : ''} onchange="window.toggleCheckItem('test')">
          <label for="check-test" style="font-size: 0.9rem; color: #92400e; cursor: pointer;">Test the form yourself</label>
        </div>
      </div>
      <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #fef3c7; display: flex; gap: 12px;">
         <a href="https://www.facebook.com/sharer/sharer.php?u=https://app.pressurepro.io" target="_blank" style="font-size: 0.8rem; color: #b45309; text-decoration: none; border: 1px solid #fcd34d; padding: 4px 10px; border-radius: 4px; background: white;">Share on Facebook</a>
         <a href="https://api.whatsapp.com/send?text=Check out my new business page: https://app.pressurepro.io" target="_blank" style="font-size: 0.8rem; color: #b45309; text-decoration: none; border: 1px solid #fcd34d; padding: 4px 10px; border-radius: 4px; background: white;">WhatsApp</a>
      </div>
    </div>
  `;
};

(window as any).toggleCheckItem = (item: string) => {
  const state = JSON.parse(window.localStorage.getItem('funnels_checklist_state') || '{"copy":false,"share":false,"test":false}');
  state[item] = !state[item];
  window.localStorage.setItem('funnels_checklist_state', JSON.stringify(state));
};

(window as any).dismissFunnelChecklist = () => {
  window.localStorage.setItem('funnels_checklist_dismissed', 'true');
  document.getElementById('funnels-checklist')?.remove();
};
// ── WB.4.1 Scroll Handler for Sticky CTA Bar ──
let lastScrollTop = 0;
window.addEventListener('scroll', () => {
  const bar = document.getElementById('site-cta-bar');
  if (!bar) return;

  const st = window.pageYOffset || document.documentElement.scrollTop;
  if (st > lastScrollTop && st > 100) {
    // Scrolling down -> hide
    bar.classList.add('cta-bar-offscreen');
  } else {
    // Scrolling up -> show
    bar.classList.remove('cta-bar-offscreen');
  }
  lastScrollTop = st <= 0 ? 0 : st;
}, false);

// ── WB.6.5 Social Sharing Helpers ────────────────────────────────────
(window as any).copyFunnelUrl = () => {
  const url = document.getElementById('funnel-public-url')?.textContent;
  if (url) {
    (window as any).copyToClipboard(url);
    // Auto-check the checklist
    (window as any).toggleCheckItem('copy');
  }
};

(window as any).shareToSocial = async (funnelId: string, platform: string) => {
  const url = `https://${(window as any).userSlug || 'app'}.pressurepro.io/${funnelId}`;
  const city = (window as any).userCity || 'your area';
  const text = `Now offering professional driveway cleaning in ${city}. Get a free quote here: ${url}`;

  if (platform === 'native' && navigator.share) {
    try {
      await navigator.share({ title: 'Professional Cleaning Quote', text, url });
      (window as any).toggleCheckItem('share');
      return;
    } catch (e) { console.warn('Native share failed', e); }
  }

  let shareUrl = '';
  if (platform === 'facebook') {
    shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
  } else if (platform === 'whatsapp') {
    shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  } else {
    // Fallback to native or copy
    return (window as any).copyFunnelUrl();
  }

  window.open(shareUrl, '_blank');
  (window as any).toggleCheckItem('share');
};

(window as any).testFunnel = (funnelId: string) => {
  // In a real app, this would be the live URL with a test flag
  // In our prototype, we show the "Public" page view with a ?test=true hint
  const url = `https://${(window as any).userSlug || 'app'}.pressurepro.io/${funnelId}?test=true`;
  console.log('[TEST MODE] Opening funnel:', url);
  window.localStorage.setItem('test_mode_active', 'true');
  
  // For the prototype, we navigate to the first page of the funnel
  fetch(`/api/funnels/${funnelId}`).then(r => r.json()).then(res => {
     if (res.success && res.data.steps.length > 0) {
       const landingPage = res.data.steps[0];
       window.open(`/?page=${landingPage.slug}&test=true`, '_blank');
     }
  });

  (window as any).toggleCheckItem('test');
};

(window as any).renderSeoPages = async () => {
    app.innerHTML = `
        ${renderSidebar('seo-pages')}
        <main class="main-content">
            <header class="view-header">
                <h2>SEO Optimization Hub</h2>
                <div style="display: flex; gap: 12px;">
                    <button class="btn-primary" onclick="window.showBulkSeoModal()" style="background: #10b981;">+ Bulk Generate Pages</button>
                </div>
            </header>

            <div class="card" style="margin-bottom: 24px; padding: 24px; background: #f0f9ff; border: 1px solid #bae6fd;">
                <div style="display: flex; gap: 20px; align-items: center;">
                    <div style="font-size: 2.5rem;">📈</div>
                    <div>
                        <h4 style="margin: 0; color: #0369a1;">Organic Reach Strategy</h4>
                        <p style="margin: 4px 0 0 0; color: #0c4a6e; font-size: 0.9rem;">
                            Generated pages target specific <strong>Service + City</strong> combinations to capture high-intent local search traffic.
                        </p>
                    </div>
                </div>
            </div>

            <div id="seo-pages-list-container">
                <div class="loading">Loading SEO pages...</div>
            </div>
        </main>
    `;

    try {
        // Fetch routes and filter for SEO pages
        const seoPages = mockWebsiteRoutes.filter(r => r.is_seo_page);
        const container = document.getElementById('seo-pages-list-container');
        if (!container) return;

        const rows = seoPages.map(page => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 16px;">
                    <div style="font-weight: 600; color: #1e293b;">${page.service}</div>
                    <div style="font-size: 0.8rem; color: #64748b;">${page.city}</div>
                </td>
                <td>
                    <code style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">/${page.slug}</code>
                </td>
                <td>
                    <span class="badge badge-published" style="font-size: 0.7rem;">Active</span>
                </td>
                <td style="text-align: right;">
                    <div style="display: flex; gap: 8px; justify-content: flex-end;">
                        <button class="btn-primary" style="background: white; color: #64748b; border: 1px solid #e2e8f0; padding: 6px 12px; font-size: 0.8rem;" onclick="window.open('/${page.slug}', '_blank')">View</button>
                        <button class="btn-primary" style="background: white; color: #dc2626; border: 1px solid #fecaca; padding: 6px 12px; font-size: 0.8rem;" onclick="window.deleteSeoPage('${page.id}')">Delete</button>
                    </div>
                </td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div class="card" style="padding: 0; overflow: hidden;">
                <table class="clients-table" style="box-shadow: none; border: none; margin-top: 0;">
                    <thead>
                        <tr>
                            <th>Service & City</th>
                            <th>Slug</th>
                            <th>Status</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="4" style="text-align: center; padding: 60px; color: #64748b;">No SEO pages generated yet.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        console.error('Failed to load SEO pages:', err);
    }
};

(window as any).showBulkSeoModal = () => {
    const modal = document.createElement('div');
    modal.id = 'bulk-seo-modal';
    modal.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.5); 
        display: flex; align-items: center; justify-content: center; z-index: 10000;
    `;
    modal.innerHTML = `
        <div class="card" style="width: 500px; padding: 30px; animation: pb-slide-in 0.3s ease-out; background: white; border-radius: 12px; border: 4px solid var(--primary-color);">
            <h3 style="margin-top: 0; margin-bottom: 8px;">Bulk Generation</h3>
            <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 24px;">Enter your target services and cities to create high-ranking landing pages instantly.</p>
            
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <div class="onboarding-form-group">
                    <label style="display: block; font-weight: 600; margin-bottom: 8px;">Target Services (comma separated)</label>
                    <textarea id="bulk-seo-services" class="onboarding-input" style="height: 80px; width: 100%; border-radius: 8px; border: 1px solid #e2e8f0; padding: 12px;" placeholder="e.g. Driveway Cleaning, House Washing, Roof Cleaning"></textarea>
                </div>
                
                <div class="onboarding-form-group">
                    <label style="display: block; font-weight: 600; margin-bottom: 8px;">Target Cities (comma separated)</label>
                    <textarea id="bulk-seo-cities" class="onboarding-input" style="height: 80px; width: 100%; border-radius: 8px; border: 1px solid #e2e8f0; padding: 12px;" placeholder="e.g. Seattle, Bellevue, Tacoma"></textarea>
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 32px;">
                <button class="btn-secondary" onclick="document.getElementById('bulk-seo-modal').remove()">Cancel</button>
                <button class="btn-primary" onclick="window.runBulkSeoGen()" style="padding: 12px 24px; font-weight: 700;">Generate Pages</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

(window as any).runBulkSeoGen = async () => {
    const servicesText = (document.getElementById('bulk-seo-services') as HTMLTextAreaElement).value;
    const citiesText = (document.getElementById('bulk-seo-cities') as HTMLTextAreaElement).value;
    
    const services = servicesText.split(',').map(s => s.trim()).filter(s => s);
    const cities = citiesText.split(',').map(c => c.trim()).filter(c => c);
    
    if (services.length === 0 || cities.length === 0) {
        alert('Please enter at least one service and one city.');
        return;
    }
    
    (window as any).showToast(`Generating ${services.length * cities.length} SEO pages...`, 'info');
    document.getElementById('bulk-seo-modal')?.remove();
    
    try {
        const res = await fetch('/api/websites/bulk-seo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ services, cities })
        }).then(r => r.json());
        
        if (res.success) {
            (window as any).showToast(`Successfully generated ${res.count} pages!`, 'success');
            (window as any).renderSeoPages();
        } else {
            alert('Failed: ' + res.error);
        }
    } catch (err: any) {
        alert('Error: ' + err.message);
    }
};

(window as any).deleteSeoPage = async (routeId: string) => {
    if (!confirm('Are you sure you want to delete this SEO page? This cannot be undone.')) return;
    
    try {
        const res = await fetch(`/api/websites/routes/${routeId}`, { method: 'DELETE' }).then(r => r.json());
        if (res.success) {
            (window as any).showToast('SEO page deleted.');
            (window as any).renderSeoPages();
        } else {
            alert('Delete failed: ' + res.error);
        }
    } catch (err: any) {
        alert('Error: ' + err.message);
    }
};
