import { mockContacts, mockOpportunities, mockPipelines, mockActivities, mockQuotes, mockQuoteItems, mockInvoices, mockPages, mockPageSections, mockComponents, mockMedia, mockWebsiteSettings, mockFunnels, mockWebsiteLayouts, mockWebsites, mockWebsiteRoutes, mockTemplates } from './db';
import { templates } from './templates';
import { Activity, WebsiteSettings } from './types';
import { resolveWebsiteRequest } from './website_resolver';
import { normalizePhone, normalizeEmail, normalizeName } from './utils/validators';

declare global {
  interface Window {
    navigateTo: (view: string, id?: string, context?: any) => Promise<void>;
    resolveWebsiteRequest: typeof resolveWebsiteRequest;
    showToast: (msg: string, type?: 'info' | 'success' | 'error' | 'warning', duration?: number) => void;
    funnelMode?: 'website' | 'marketing';
    currentUser?: string;
    userSlug?: string;
    [key: string]: any;
  }
}

/**
 * 🌐 FRONTEND API BRIDGE
 * These stubs replace direct backend function calls to prevent credential leakage.
 * These utilize regional mock data (db.ts) to maintain UI functionality without direct DB access.
 */
export const getWebsiteSettings = () => mockWebsiteSettings;
export const getWebsiteLayout = (id?: string) => mockWebsiteLayouts[0]; // Simplified for now
export const persistWebsiteSettings = async (data: any) => {
    console.log('[API STUB] Saving settings:', data);
    return { success: true }; 
};

function applyPrimaryColor(color?: string): void {
  if (!color || typeof document === 'undefined' || !document.documentElement?.style) return;
  document.documentElement.style.setProperty('--primary', color);
  document.documentElement.style.setProperty('--primary-color', color);
}
const getEvents = (user?: any) => [] as any[];
const getAllMessagesOrdered = (user?: any) => [] as any[];
const getConversation = (id: string, user?: any) => [] as any[];
const getCallsForContact = (id: string, phone?: string, user?: any) => [] as any[];
const getCall = (id: string) => null;
const mockAutomationLogs: string[] = [];

function runAutomations(type: string, data: any) {
  const settings = getWebsiteSettings();
  
  if (type === 'LEAD_CAPTURED') {
    const lead = data;
    const triggerId = `auto_sms_lead_${lead.id}`;
    
    // 🌿 WB.5.2: Idempotency check (Zero Lead Loss / No Spam)
    if (mockAutomationLogs.includes(triggerId)) return;
    mockAutomationLogs.push(triggerId);

    const msg = `Hi ${lead.name}, thanks for reaching out to ${settings.business_name}. We’ll get back to you shortly.`;
    
    console.log(`[AUTOMATION] Triggering LEAD_CAPTURED Response for ${lead.phone}`);
    sendMessageToContact(lead.id, msg, 'automation');
  }

  if (type === 'OPPORTUNITY_CREATED') {
    const opp = data;
    console.log(`[AUTOMATION] Opportunity created for contact ${opp.contact_id}`);
  }
}
const checkOverdueInvoices = () => { console.log('[API STUB] Checking overdue invoices'); };
const emitEvent = (name: string, payload: any, user_id?: string) => {
    console.log(`[FRONTEND EVENT] ${name}:`, payload);
};
const getContactTimeline = (id: string, user?: any) => [] as any[];
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
            const body = reqContext.body;
            console.log('[MOCK] Lead Submission:', body);
            
            // 🌿 WB.5.2: Deduplication (Phase W4.7)
            let contact = mockContacts.find(c => c.phone === body.phone);
            let isNew = false;

            if (contact) {
                console.log('[MOCK] Existing contact found, updating record:', contact.id);
                // Update profile info if more complete data provided
                if (body.name && contact.name === 'Anonymous') contact.name = body.name;
                if (body.email && !contact.email) contact.email = body.email;
                if (body.address && !contact.address) contact.address = body.address;
            } else {
                isNew = true;
                contact = { 
                    id: `c-${Date.now()}`, 
                    name: body.name || 'Anonymous',
                    phone: body.phone,
                    email: body.email || '',
                    address: body.address || '',
                    status: 'lead', 
                    created_at: new Date().toISOString(),
                    user_id: (window as any).currentUser || 'system',
                    source: body.is_test ? 'test_submission' : 'website_form',
                    tags: []
                } as any;
                mockContacts.push(contact as any);
            }
            
            // 🌿 WB.5.4 Trigger Automation (Phase W4.4)
            // Even if repeat, we may want to trigger automations (but runAutomations is idempotent for SMS)
            runAutomations('LEAD_CAPTURED', contact);

            if (body.is_test) {
                (window as any).showToast(isNew ? 'Test lead received! Redirecting to CRM...' : 'Repeat test lead received!', 'success');
                setTimeout(() => window.navigateTo('contact-detail', contact!.id), 2000);
            }

            return new Response(JSON.stringify({ success: true, data: contact, is_repeat: !isNew }), { 
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
                    name: name || 'Untitled Page',
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
                    response = { success: false, error: 'Page not found' };
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
                    response = { success: false, error: 'Page not found' };
                }
            }
            
            if (response) {
                return new Response(JSON.stringify(response), { status: response.success ? 200 : (response.error === 'Page not found' ? 404 : 500) });
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
            try {
                body = typeof reqContext.body === 'string'
                    ? JSON.parse(reqContext.body)
                    : (reqContext.body || {});
            } catch {}
            const sections: any[] = body.sections || [];

            const isBrowser = typeof window !== 'undefined';
            const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
            const reqUser = (window as any).currentUser || reqContext.user?.id || 'system';

            if (!hasSupabase) {
                const { SectionsRepo } = await import('./sections_repo_supabase');
                for (const s of sections) {
                    await SectionsRepo.persistSection(s, reqUser);
                }
                return new Response(JSON.stringify({
                    success: true,
                    saved: sections.length
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

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
        if (url === '/api/settings') {
            const reqUser = (window as any).currentUser || 'system';
            const { WebsitesRepo } = await import('./websites_repo_supabase');
            let userSite = await WebsitesRepo.getWebsiteByUser(reqUser);
            if (!userSite) {
                userSite = { id: 'ws-1', user_id: reqUser } as any;
            }
            const websiteId = userSite ? userSite.id : 'ws-1';

            if (method === 'GET') {
                const { getWebsiteSettings } = await import('./website_settings_repo');
                const response = await getWebsiteSettings(reqUser, websiteId);
                if (response.success && response.data) {
                    Object.assign(mockWebsiteSettings, response.data);
                    applyPrimaryColor(mockWebsiteSettings.primary_color);
                }
                return new Response(JSON.stringify(response), {
                    status: response.success ? 200 : 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            } else if (method === 'POST') {
                const { persistWebsiteSettings } = await import('./website_settings_repo');
                const response = await persistWebsiteSettings(reqUser, websiteId, reqContext.body);
                if (response.success && response.data) {
                    Object.assign(mockWebsiteSettings, response.data);
                    applyPrimaryColor(mockWebsiteSettings.primary_color);
                } else if (!response.success) {
                    Object.assign(mockWebsiteSettings, reqContext.body);
                    applyPrimaryColor(mockWebsiteSettings.primary_color);
                }
                return new Response(JSON.stringify(response), {
                    status: response.success ? 200 : 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

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
type BuilderContext = {
  pageId: string;
  sectionId?: string | null;
  path?: string;
  label?: string;
  returnTo?: string;
  funnelId?: string | null;
  updatedAt?: string;
};
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

(window as any).saveGlobalSettings = async () => {
  const s = getWebsiteSettings();
  const readInput = (selector: string): string | undefined => {
    const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
    return el ? el.value : undefined;
  };

  const formValues: Partial<WebsiteSettings> = {
    business_name: readInput('[data-settings-field="business_name"]') ?? s.business_name,
    phone: readInput('#settings-phone-input') ?? s.phone,
    sms_number: readInput('#settings-sms-number-input') ?? s.sms_number,
    email: readInput('#settings-email-input') ?? s.email,
    logo_url: readInput('#settings-logo-url-input') ?? s.logo_url,
    primary_color: readInput('#settings-primary-color-input') ?? s.primary_color,
    facebook_pixel_id: readInput('[data-settings-field="facebook_pixel_id"]') ?? s.facebook_pixel_id,
    gtm_id: readInput('[data-settings-field="gtm_id"]') ?? s.gtm_id
  };
  Object.assign(s, formValues);

  // Basic validation before save
  if (!s.business_name || s.business_name.trim() === '') {
    (window as any).showToast?.('Business name cannot be empty.', 'error');
    return;
  }
  if (s.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email)) {
    (window as any).showToast?.('Please enter a valid email address.', 'error');
    return;
  }

  const saveBtn = document.querySelector('[onclick="window.saveGlobalSettings()"]') as HTMLButtonElement | null;
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s)
    }).then(r => r.json());

    if (res.success) {
      if (res.data) Object.assign(s, res.data);
      applyPrimaryColor(s.primary_color);
      (window as any).showToast?.('Settings saved successfully!', 'success');
      renderWebsiteSettings();
    } else {
      (window as any).showToast?.(`Settings could not be saved: ${res.error || 'Unknown error'}`, 'error');
    }
  } catch (err: any) {
    (window as any).showToast?.(`Save failed: ${err.message}`, 'error');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Settings'; }
  }
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
          
          <div class="nav-group-title">Marketing & Outreach</div>
          <li onclick="window.navigateTo('lead-capture')" class="${activeView === 'lead-capture' ? 'active' : ''}">Lead Capture</li>
          <li onclick="window.navigateTo('marketing-funnels')" class="${activeView === 'marketing-funnels' || activeView === 'funnels' && (window as any).funnelMode === 'marketing' ? 'active' : ''}">Ad Landing Pages</li>
          
          <div class="nav-group-title">Websites</div>
<<<<<<< HEAD
          <li onclick="window.navigateTo('website-dashboard')" class="${activeView === 'website-dashboard' ? 'active' : ''}" style="font-weight: 700; color: var(--primary-color);">My Website</li>
          <li onclick="window.navigateTo('funnels')" class="${activeView === 'funnels' && (window as any).funnelMode !== 'marketing' ? 'active' : ''}">Site Pages</li>
=======
          <li onclick="window.navigateTo('website-dashboard')" class="${activeView === 'website-dashboard' ? 'active' : ''}">My Website</li>
          <li onclick="window.navigateTo('website-structure')" class="${activeView === 'website-structure' ? 'active' : ''}">Structure</li>
          <li onclick="window.navigateTo('pages')" class="${activeView === 'pages' || activeView === 'page-sections' ? 'active' : ''}">Pages</li>
>>>>>>> TARGETED-FIX-PROMPTS-(W6-HARDENING)
          <li onclick="window.navigateTo('website-navigation')" class="${activeView === 'website-navigation' ? 'active' : ''}">Navigation</li>
          <li onclick="window.navigateTo('seo-pages')" class="${activeView === 'seo-pages' ? 'active' : ''}">SEO Pages</li>
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

let builderMode: 'edit' | 'preview' = 'edit';

// WB.3.4 — Viewport toggle handler
(window as any).setBuilderViewport = (vp: 'mobile' | 'desktop') => {
  builderViewport = vp;
  renderBuilder();
};

(window as any).setBuilderMode = (mode: 'edit' | 'preview') => {
  builderMode = mode;
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

function hydrateBuilderSectionsFromLocalStorage(pageId: string): void {
  const isBrowser = typeof window !== 'undefined';
  const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : false;
  if (!isBrowser || hasSupabase) return;

  const userId = (window as any).currentUser || 'system';
  const storageKey = `mock_sections_${userId}:${pageId}`;
  const cached = window.localStorage.getItem(storageKey);
  if (!cached) return;

  try {
    const sections = JSON.parse(cached);
    if (!Array.isArray(sections)) throw new Error('Cached sections is not an array');
    for (const section of sections) {
      const idx = mockPageSections.findIndex((s: any) => s.id === section.id);
      if (idx >= 0) {
        mockPageSections[idx] = section;
      } else {
        mockPageSections.push(section);
      }
    }
  } catch (err) {
    console.error('[Builder] Failed to hydrate cached sections; clearing corrupted cache:', err);
    window.localStorage.removeItem(storageKey);
  }
}

function getBuilderContextStorageKey(): string {
  const userId = (window as any).currentUser || 'system';
  return `mock_builder_context_${userId}`;
}

function getPrimarySectionForPage(pageId: string): any | null {
  return mockPageSections
    .filter((section: any) => section.page_id === pageId)
    .sort((a: any, b: any) => a.order - b.order)[0] || null;
}

function getBuilderContextFromHash(): BuilderContext | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash || '';
  const hashContent = hash.startsWith('#/')
    ? hash.slice(2)
    : hash.replace(/^#/, '');
  const [view, query = ''] = hashContent.split('?');
  if (view !== 'builder' || !query) return null;

  const params = new URLSearchParams(query);
  const pageId = params.get('pageId');
  if (!pageId) return null;

  return {
    pageId,
    sectionId: params.get('sectionId'),
    path: params.get('path') || undefined,
    label: params.get('label') || undefined,
    returnTo: params.get('returnTo') || undefined,
    funnelId: params.get('funnelId')
  };
}

function getStoredBuilderContext(): BuilderContext | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(getBuilderContextStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.pageId ? parsed : null;
  } catch (err) {
    console.warn('[Builder] Failed to parse stored builder context; clearing it:', err);
    window.localStorage.removeItem(getBuilderContextStorageKey());
    return null;
  }
}

function persistBuilderContext(context: BuilderContext): void {
  if (typeof window === 'undefined' || !window.localStorage || !context.pageId) return;

  const page = mockPages.find((p: any) => p.id === context.pageId);
  const section = context.sectionId
    ? mockPageSections.find((s: any) => s.id === context.sectionId)
    : getPrimarySectionForPage(context.pageId);

  const storedContext: BuilderContext = {
    pageId: context.pageId,
    sectionId: context.sectionId ?? section?.id ?? null,
    path: context.path ?? (page?.slug ? `/${page.slug === 'home' ? '' : page.slug}` : undefined),
    label: context.label ?? page?.name ?? section?.content?.heading,
    returnTo: context.returnTo ?? builderReturnTo,
    funnelId: context.funnelId ?? builderReturnFunnelId,
    updatedAt: new Date().toISOString()
  };

  window.localStorage.setItem(getBuilderContextStorageKey(), JSON.stringify(storedContext));
}

function applyBuilderContext(context: BuilderContext | null): boolean {
  if (!context?.pageId) return false;

  builderPageId = context.pageId;
  builderReturnTo = context.returnTo || builderReturnTo;
  builderReturnFunnelId = context.funnelId || builderReturnFunnelId;

  const sectionExists = context.sectionId
    ? mockPageSections.some((section: any) => section.id === context.sectionId && section.page_id === context.pageId)
    : false;
  builderSelectedSectionId = sectionExists ? context.sectionId! : null;
  builderInsertOrder = null;

  return mockPages.some((page: any) => page.id === context.pageId);
}

function hydrateBuilderContext(): void {
  const context = getBuilderContextFromHash() || getStoredBuilderContext();
  if (context) applyBuilderContext(context);
}

function _renderBuilder() {
  hydrateBuilderContext();

  const page = mockPages.find(p => p.id === builderPageId);
  if (!page) {
    app.innerHTML = `
      <main style="width: 100vw; padding: 0; overflow: hidden; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0b0f19; color: white; font-family: 'Inter', system-ui, sans-serif;">
        <div style="text-align: center; max-width: 360px; padding: 40px;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin: 0 0 12px; color: #f8fafc;">Select a page or section to edit.</h2>
          <p style="color: #94a3b8; font-size: 0.95rem; margin: 0 0 20px; line-height: 1.5;">The previous builder context is no longer available.</p>
          <button onclick="window.builderGoBack()" style="background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.9rem;">Go Back</button>
        </div>
      </main>
    `;
    return;
  }

  hydrateBuilderSectionsFromLocalStorage(builderPageId);

  const sections = mockPageSections
    .filter(s => s.page_id === builderPageId)
    .sort((a, b) => a.order - b.order);

  app.innerHTML = `
    <main style="width: 100vw; padding: 0; overflow: hidden; height: 100vh; display: flex; flex-direction: column; background: #000; color: white; font-family: 'Inter', system-ui, sans-serif;">

      <header class="pb-topbar" style="height: 64px; background: #111; border-bottom: 1px solid #222; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; z-index: 100;">
        <div style="display: flex; align-items: center; gap: 15px;">
          <button onclick="window.builderGoBack()" style="background: transparent; border: 1px solid #333; color: #888; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Exit
          </button>
          <div style="width: 1px; height: 24px; background: #222;"></div>
          <div style="display: flex; gap: 4px; background: #000; border: 1px solid #333; padding: 4px; border-radius: 10px;">
             <button onclick="window.setBuilderMode('edit')" style="padding: 8px 16px; border-radius: 7px; border: none; font-size: 0.75rem; font-weight: 700; cursor: pointer; background: ${builderMode === 'edit' ? '#2563EB' : 'transparent'}; color: ${builderMode === 'edit' ? 'white' : '#888'};">Studio</button>
             <button onclick="window.setBuilderMode('preview')" style="padding: 8px 16px; border-radius: 7px; border: none; font-size: 0.75rem; font-weight: 700; cursor: pointer; background: ${builderMode === 'preview' ? '#2563EB' : 'transparent'}; color: ${builderMode === 'preview' ? 'white' : '#888'};">Preview</button>
          </div>
        </div>

        <div style="display: flex; background: #000; padding: 4px; border-radius: 10px; border: 1px solid #222; gap: 4px;">
          <button onclick="window.setBuilderViewport('mobile')" style="padding: 6px 16px; border-radius: 7px; border: none; cursor: pointer; font-size: 0.8rem; font-weight: 700; display: flex; align-items: center; gap: 8px; ${builderViewport === 'mobile' ? 'background: #2563EB; color: white; box-shadow: 0 4px 12px rgba(37,99,235,0.4);' : 'background: transparent; color: #555;'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
            Mobile
          </button>
          <button onclick="window.setBuilderViewport('desktop')" style="padding: 6px 16px; border-radius: 7px; border: none; cursor: pointer; font-size: 0.8rem; font-weight: 700; display: flex; align-items: center; gap: 8px; ${builderViewport === 'desktop' ? 'background: #2563EB; color: white; box-shadow: 0 4px 12px rgba(37,99,235,0.4);' : 'background: transparent; color: #555;'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="14" rx="2"/><polyline points="8 22 12 18 16 22"/></svg>
            Desktop
          </button>
        </div>

        <div style="display: flex; align-items: center; gap: 15px;">
           <span id="pb-autosave-indicator" style="font-size: 0.75rem; color: #666; font-weight: 600; display: flex; align-items: center; gap: 8px;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: ${isAutoSaving ? '#fbbf24' : '#10b981'}; box-shadow: 0 0 8px ${isAutoSaving ? '#fbbf24' : '#10b981'};"></span>
            ${isAutoSaving ? 'Auto-saving...' : 'Cloud Saved'}
          </span>
          <button onclick="window.navigateTo('preview', '${page.slug}')" style="background: #1e1e1e; border: 1px solid #333; color: white; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 0.85rem;">Live Preview</button>
        </div>
      </header>

      <div class="pb-layout" style="flex: 1; display: flex; overflow: hidden;">
        <!-- Left Panel: Structured Sections -->
        ${builderMode === 'edit' ? `
        <aside class="pb-left-panel" style="width: 260px; border-right: 1px solid #222; background: #111; display: flex; flex-direction: column;">
          <div class="pb-panel-header" style="padding: 24px 20px; border-bottom: 1px solid #222;">
            <h3 style="font-size: 0.7rem; color: #555; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; margin: 0;">Add Components</h3>
          </div>

          <div class="pb-component-list" style="flex: 1; overflow-y: auto; padding: 20px;">
            ${[
        { id: 'comp-hero', icon: '🦸', label: 'Hero' },
        { id: 'comp-proof', icon: '🏆', label: 'Proof' },
        { id: 'comp-offer', icon: '💰', label: 'Offer' },
        { id: 'comp-gallery', icon: '🖼️', label: 'Gallery' },
        { id: 'comp-form', icon: '📋', label: 'Form' },
        { id: 'comp-faq', icon: '❓', label: 'FAQ' }
      ].map(item => `
              <div class="pb-component-item" onclick="window.addStructuredSection('${item.id}')" style="display: flex; align-items: center; gap: 15px; padding: 15px; background: #1a1a1a; border-radius: 12px; border: 1px solid #222; cursor: pointer; margin-bottom: 12px; transition: all 200ms ease;">
                <div style="font-size: 1.5rem;">${item.icon}</div>
                <div style="font-weight: 700; font-size: 0.9rem; color: #eee;">${item.label}</div>
              </div>
            `).join('')}
          </div>

          <div style="padding: 20px; border-top: 1px solid #222; background: #0a0a0a;">
             <div style="font-size: 0.6rem; color: #444; text-transform: uppercase; font-weight: 800; margin-bottom: 10px; letter-spacing: 0.05em;">Switch Page</div>
             <select onchange="window.switchBuilderPage(this.value)" style="width: 100%; padding: 12px; border-radius: 8px; background: #111; border: 1px solid #333; color: #eee; font-size: 0.85rem; font-weight: 700; cursor: pointer;">
                ${mockPages.map(p => `<option value="${p.id}" ${p.id === builderPageId ? 'selected' : ''}>${p.name}</option>`).join('')}
             </select>
          </div>
        </aside>
        ` : ''}

        <!-- Center Panel: Live Canvas -->
        <section class="pb-canvas-area" style="flex: 1; overflow-y: auto; height: 100%; padding: 40px 20px; background: #000; display: flex; flex-direction: column; align-items: center; position: relative;">
          
          ${(() => {
            if (builderMode === 'preview') return '';
            const hasCTA = sections.some(s => ['hero', 'offer', 'form'].includes(s.type));
            if (!hasCTA && sections.length > 0) {
              return `
                <div class="pb-conversion-warning">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 1.5rem;">⚠️</span>
                    <strong style="color: #991B1B; font-size: 0.9rem; font-weight: 800;">Conversion Risk</strong>
                  </div>
                  <p style="font-size: 0.8rem; color: #7F1D1D; line-height: 1.5; margin: 0;">This page has no Call-to-Action. Add a <b>Hero</b>, <b>Offer</b>, or <b>Form</b> to capture leads.</p>
                  <button onclick="window.addStructuredSection('comp-hero')" style="background: #991B1B; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 900; font-size: 0.7rem; cursor: pointer; text-transform: uppercase; letter-spacing: 0.05em;">Fix Now: Add Hero</button>
                </div>
              `;
            }
            return '';
          })()}

          <div class="pb-canvas-inner pb-canvas-${builderViewport}" style="border-radius: ${builderViewport === 'mobile' ? '40px' : '12px'}; overflow: visible; position: relative;">
            
            ${(() => {
                if (localStorage.getItem('pb_onboarding_hints_seen') || builderMode === 'preview') return '';
                // Only show hints if we have at least one hero/offer section
                const hasHero = sections.find(s => s.type === 'hero');
                if (!hasHero) return '';

                return `
                    <div class="pb-onboarding-hint" style="top: 140px; left: 10%;">
                        <div class="pb-onboarding-hint-content">Edit your headline here ✍️</div>
                    </div>
                `;
            })()}

            ${builderViewport === 'mobile' ? `
              <div class="pb-sticky-cta">
                 <button class="btn-primary" style="width: 100%; box-shadow: 0 10px 25px rgba(37,99,235,0.4);">Ready to Start?</button>
              </div>
            ` : ''}

            ${['Add Initial', ...sections].map((item) => {
        const isInitial = item === 'Add Initial';
        const section = isInitial ? null : (item as any);
        const order = isInitial ? 0 : section.order + 0.5;

        return `
                ${builderMode === 'edit' ? `
                <div class="pb-add-between" onclick="window.addStructuredSectionAt('${order}')" style="height: 12px; opacity: 0; transition: opacity 200ms; cursor: cell;">
                   <div style="width: 100%; height: 2px; background: #2563EB;"></div>
                </div>
                ` : ''}
                ${!isInitial ? `
                  <div class="pb-section-preview ${builderSelectedSectionId === section.id ? 'active' : ''} ${section.styles?.visible === false ? 'pb-section--hidden' : ''}" 
                       onclick="${builderMode === 'edit' ? `window.selectSectionForBuilder('${section.id}')` : ''}"
                       style="position: relative; border: 2px solid transparent; transition: border-color 0.2s; background: white; cursor: ${builderMode === 'edit' ? 'pointer' : 'default'};">
                      
                      ${builderMode === 'edit' ? `
                        <div style="position: absolute; top: 12px; left: 12px; background: #111; color: #555; padding: 4px 10px; border-radius: 6px; font-size: 0.6rem; font-weight: 800; z-index: 40; text-transform: uppercase; letter-spacing: 0.1em; border: 1px solid #222; pointer-events: none; opacity: 0.8;">
                          ${(() => {
                            switch(section.type) {
                              case 'hero': return 'Hero Section';
                              case 'proof': return 'Testimonials';
                              case 'offer': return 'Deal / Offer';
                              case 'form': return 'Lead Capture';
                              case 'gallery': return 'Gallery';
                              case 'faq': return 'FAQ';
                              default: return section.type;
                            }
                          })()}
                        </div>
                      ` : ''}

                      ${builderMode === 'edit' && section.styles?.visible === false ? `
                        <div style="position: absolute; top: 12px; right: 12px; background: #ef4444; color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.6rem; font-weight: 900; z-index: 40; pointer-events: none;">HIDDEN</div>
                      ` : ''}

                      <div style="padding: ${section.styles.padding || '80px 40px'}; 
                                  text-align: ${section.styles.text_alignment || section.styles.alignment || section.styles.textAlign || 'left'}; 
                                  background-image: ${section.content.background_image ? `url('${section.content.background_image}')` : 'none'};
                                  background-size: cover;
                                  background-position: center;
                                  background-color: ${section.styles.background || section.styles.backgroundColor || 'white'}; 
                                  color: ${section.styles.color || (section.content.background_image ? 'white' : 'inherit')}; 
                                  width: 100%;
                                  min-height: ${section.type === 'hero' ? '600px' : 'auto'};
                                  display: flex;
                                  flex-direction: column;
                                  justify-content: ${section.type === 'hero' ? 'center' : 'flex-start'};
                                  position: relative;
                                  overflow: hidden;
                                  opacity: ${section.styles?.visible === false ? '0.4' : '1'};
                                  filter: ${section.styles?.visible === false ? 'grayscale(0.8)' : 'none'};">
                        ${section.content.background_image ? `<div style="position: absolute; inset: 0; background: rgba(0,0,0,0.45);"></div>` : ''}
                        <div style="position: relative; z-index: 10; width: 100%; max-width: 1000px; margin: 0 auto;">
                          ${renderSectionPreviewContent(section)}
                        </div>
                      </div>

                      <div class="pb-section-controls" style="position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: none; gap: 4px; background: #111; border: 1px solid #333; padding: 4px; border-radius: 10px; z-index: 50; box-shadow: 0 10px 30px rgba(0,0,0,0.5); align-items: center;">
                        <span style="font-size: 0.6rem; color: #555; text-transform: uppercase; font-weight: 800; letter-spacing: 0.1em; margin: 0 10px;">${section.type}</span>
                        <div style="width: 1px; height: 16px; background: #222;"></div>
                        <button title="Switch Layout" onclick="event.stopPropagation(); window.switchSectionVariant('${section.id}')" style="background: transparent; border: none; color: #2563EB; cursor: pointer; padding: 8px 16px; font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; gap: 6px;">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                          Switch Layout
                        </button>
                        <div style="width: 1px; height: 16px; background: #222;"></div>
                        <button title="Move Up" onclick="event.stopPropagation(); window.moveSection('${section.id}', -1)" style="background: transparent; border: none; color: #eee; cursor: pointer; padding: 8px 12px; font-size: 0.9rem;">↑</button>
                        <button title="Move Down" onclick="event.stopPropagation(); window.moveSection('${section.id}', 1)" style="background: transparent; border: none; color: #eee; cursor: pointer; padding: 8px 12px; font-size: 0.9rem;">↓</button>
                        <button title="Toggle Visibility" onclick="event.stopPropagation(); window.toggleSectionVisibility('${section.id}')" style="background: transparent; border: none; color: ${section.styles?.visible === false ? '#10b981' : '#ff4d4d'}; cursor: pointer; padding: 8px 12px; font-size: 0.75rem; font-weight: 800;">${section.styles?.visible === false ? 'Show' : 'Hide'}</button>
                        <div style="width: 1px; height: 16px; background: #222;"></div>
                        <button title="Delete" onclick="event.stopPropagation(); window.removeSection('${section.id}')" style="background: transparent; border: none; color: #666; cursor: pointer; padding: 8px 12px; font-size: 0.8rem;">🗑</button>
                      </div>
                  </div>
                ` : ''}
              `;
      }).join('') || `
              <div style="padding: 120px 40px; text-align: center; color: #555; border: 2px dashed #222; margin: 60px; border-radius: 20px;">
                <h3 style="margin-bottom: 20px; font-size: 1.5rem; font-weight: 800; color: #eee;">Canvas Ready</h3>
                <p style="font-size: 0.9rem;">Click components on the left to start building.</p>
              </div>
            `}
          </div>
        </section>
      </div>
    </main>
  `;
}




function setNestedValue(obj: any, path: string, value: any) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key]) current[key] = isNaN(Number(keys[i + 1])) ? {} : [];
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

(window as any).saveInlineEdit = (sectionId: string, field: string, el: HTMLElement) => {
  const section = mockPageSections.find((s: any) => s.id === sectionId);
  if (!section) return;
  const newValue = el.innerText;
  setNestedValue(section.content, field, newValue);
  
  // Dismiss onboarding hints on first interaction
  if (!localStorage.getItem('pb_onboarding_hints_seen')) {
    localStorage.setItem('pb_onboarding_hints_seen', 'true');
  }
  (window as any).triggerAutoSave();
};

/**
 * WB.3.1 — Inline editable text span helper.
 */
function inlineText(sectionId: string, field: string, value: string, extraStyle: string = ''): string {
  const safe = (value || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const canEdit = builderMode === 'edit';
  return `<span
    class="pb-inline-text"
    ${canEdit ? 'contenteditable="true"' : ''}
    data-section-id="${sectionId}"
    data-field="${field}"
    style="${extraStyle} ${canEdit ? '' : 'pointer-events: none;'}"
    onclick="event.stopPropagation()"
    oninput="window.saveInlineEdit('${sectionId}', '${field}', this)"
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
      const textAlign = section.styles?.text_alignment === 'center' ? 'center' : 'left';
      const marginSide = textAlign === 'center' ? 'auto' : '0';

      if (section.variant === 'split') {
        return `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 40px; align-items: center; text-align: left;">
            <div>
              <h1 style="font-size: clamp(2.2rem, 8vw, 3rem); margin-bottom: 1.5rem; font-weight: 900; line-height: 1.1; letter-spacing: -0.02em; color: inherit;">
                ${inlineText(id, headingField, content[headingField] || 'Hero Heading', 'display:block;width:100%;')}
              </h1>
              <p style="font-size: clamp(1rem, 3vw, 1.25rem); opacity: 0.85; margin-bottom: 2.5rem; line-height: 1.5; color: inherit;">
                ${inlineText(id, subField, content[subField] || 'Hero Subheading', 'display:block;width:100%;')}
              </p>
              <button class="btn-primary" style="padding: 16px 36px; font-size: 1.15rem; border-radius: 50px; pointer-events: none; border: none; background: #2563EB; color: white; width: fit-content;">
                ${inlineText(id, btnField, content[btnField] || 'Action')}
              </button>
            </div>
            <div style="border-radius: 24px; overflow: hidden; aspect-ratio: 4/3; box-shadow: 0 20px 40px rgba(0,0,0,0.2); position: relative; border: 4px solid white; background: #eee;">
              <img src="${content.background_image || 'https://images.unsplash.com/photo-1541604193435-22077a288934'}" style="width: 100%; height: 100%; object-fit: cover;">
              <div style="position: absolute; inset: 0; cursor: crosshair; background: rgba(37,99,235,0); transition: background 0.2s; display: flex; align-items: center; justify-content: center;"
                   onmouseover="this.style.background='rgba(37,99,235,0.1)'" 
                   onmouseout="this.style.background='rgba(37,99,235,0)'"
                   onclick="window.openImagePicker('${id}', 'background_image')">
                 <span style="background: white; color: #2563EB; padding: 8px 16px; border-radius: 50px; font-weight: 800; font-size: 0.75rem; box-shadow: 0 4px 12px rgba(0,0,0,0.1); opacity: 0; transition: opacity 0.2s;" class="pb-img-edit-hint">Change Photo</span>
              </div>
              <style>.pb-canvas-inner:hover .pb-img-edit-hint { opacity: 1 !important; }</style>
            </div>
          </div>
        `;
      }
      if (section.variant === 'minimal') {
        return `
          <div style="text-align: center; max-width: 700px; margin: 0 auto; color: #1e293b; padding: 40px 0;">
            <h1 style="font-size: 2.5rem; font-weight: 900; margin-bottom: 1.2rem; color: #0f172a; line-height: 1.2;">
              ${inlineText(id, headingField, content[headingField] || 'Hero Heading')}
            </h1>
            <p style="font-size: 1.15rem; color: #64748b; margin-bottom: 2rem; line-height: 1.6;">
              ${inlineText(id, subField, content[subField] || 'Hero Subheading')}
            </p>
            <button class="btn-primary" style="padding: 14px 32px; font-size: 1rem; border-radius: 12px; pointer-events: none; border: none; background: #2563EB; color: white;">
              ${inlineText(id, btnField, content[btnField] || 'Action')}
            </button>
          </div>
        `;
      }
      // Standard Centered
      return `
        <div style="text-align: ${textAlign};">
          <h1 style="font-size: clamp(2.2rem, 8vw, 3.5rem); margin-bottom: 1.5rem; font-weight: 900; line-height: 1.1; letter-spacing: -0.02em; color: inherit;">
            ${inlineText(id, headingField, content[headingField] || 'Hero Heading', 'display:block;width:100%;')}
          </h1>
          <p style="font-size: clamp(1.1rem, 3vw, 1.4rem); opacity: 0.85; margin-bottom: 2.5rem; max-width: 650px; margin-left: ${marginSide}; margin-right: ${marginSide}; line-height: 1.5; color: inherit;">
            ${inlineText(id, subField, content[subField] || 'Hero Subheading', 'display:block;width:100%;')}
          </p>
              <button class="btn-primary" onclick="event.stopPropagation()">
                ${inlineText(id, btnField, content[btnField] || 'Action')}
              </button>
        </div>
      `;
    }
    case 'proof': {
      const tests: any[] = content.testimonials || [];
      if (section.variant === 'list') {
        return `
          <div style="max-width: 700px; margin: 0 auto;">
            <h2 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 40px; text-align: center; color: inherit;">
               ${inlineText(id, 'title', content.title || 'What People Say', 'display:block;width:100%;')}
            </h2>
            <div style="display: flex; flex-direction: column; gap: 24px;">
              ${tests.map((t: any, idx: number) => `
                <div style="padding: 24px; border-left: 4px solid #2563EB; background: #f8fafc; border-radius: 0 16px 16px 0;">
                  <p style="font-size: 1.1rem; line-height: 1.6; font-style: italic; margin-bottom: 12px; color: #1e293b;">
                    &ldquo;${inlineText(id, `testimonials.${idx}.quote`, t.quote || 'Great service!')}&rdquo;
                  </p>
                  <div style="font-weight: 800; color: #64748b; font-size: 0.9rem;">
                    &mdash; ${inlineText(id, `testimonials.${idx}.name`, t.name || 'Customer')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
      return `
        <div style="text-align: center;">
          <h2 style="font-size: clamp(1.6rem, 5vw, 2.22rem); font-weight: 800; margin-bottom: 40px; color: inherit;">
            ${inlineText(id, 'title', content.title || 'Don’t Just Take Our Word For It', 'display:block;width:100%;')}
          </h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 24px;">
            ${tests.map((t: any, idx: number) => `
              <div style="background: #fff; padding: 24px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); border: 1px solid #eee; text-align: left;">
                <div style="color: #fbbf24; font-size: 1rem; margin-bottom: 12px;">
                  ${'★'.repeat(t.stars || 5)}${'☆'.repeat(5 - (t.stars || 5))}
                </div>
                <p style="font-size: 0.95rem; line-height: 1.6; font-style: italic; margin-bottom: 16px; color: #475569;">
                  &ldquo;${inlineText(id, `testimonials.${idx}.quote`, t.quote || 'Great service!')}&rdquo;
                </p>
                <div style="font-weight: 800; color: #1e293b; font-size: 0.85rem;">
                  &mdash; ${inlineText(id, `testimonials.${idx}.name`, t.name || 'Customer')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>`;
    }
    case 'offer': {
      if (section.variant === 'card') {
        return `
          <div style="max-width: 600px; margin: 0 auto; padding: 40px; text-align: center; background: white; color: #1e293b; border-radius: 32px; border: 2px solid #e2e8f0; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.1);">
            <div style="display: inline-block; background: #EEF2FF; color: #4338CA; padding: 6px 16px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; margin-bottom: 24px;">Limited Offer</div>
            <h2 style="font-size: 2.5rem; font-weight: 900; margin-bottom: 12px; color: #0f172a;">
               ${inlineText(id, 'headline', content.headline || 'Special Package Deal')}
            </h2>
            <p style="font-size: 1.1rem; color: #64748b; margin-bottom: 32px; line-height: 1.6;">
               ${inlineText(id, 'description', content.description || 'Get our most popular service at a special rate.')}
            </p>
            <button class="btn-primary" style="background: #2563EB; color: white; padding: 18px 40px; font-size: 1.15rem; font-weight: 800; border-radius: 12px; border: none; pointer-events: none; width: 100%;">
               ${inlineText(id, 'button_text', content.button_text || 'Claim Offer')}
            </button>
            <div style="margin-top: 20px; font-size: 0.85rem; color: #94a3b8; font-weight: 600;">
               ${inlineText(id, 'expiry', content.expiry || 'Hurry, ends soon!')}
            </div>
          </div>
        `;
      }
      return `
        <div style="padding: clamp(40px, 10vw, 60px) clamp(20px, 5vw, 40px); text-align: center; background: #4f46e5; color: white; border-radius: 24px; box-shadow: 0 20px 50px rgba(79,70,229,0.3);">
          <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 6px 16px; border-radius: 20px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; margin-bottom: 20px; letter-spacing: 0.1em; backdrop-filter: blur(4px);">Limited Offer</div>
          <h2 style="font-size: clamp(2rem, 7vw, 3rem); font-weight: 900; margin-bottom: 12px;">
            ${inlineText(id, 'headline', content.headline || 'Special Package Deal', 'display:block;width:100%;')}
          </h2>
          <p style="font-size: clamp(1rem, 3vw, 1.25rem); opacity: 0.9; margin-bottom: 24px; max-width: 600px; margin-left: auto; margin-right: auto; line-height: 1.6;">
            ${inlineText(id, 'description', content.description || 'Get our most popular service at a special rate.', 'display:block;width:100%;')}
          </p>
          <button class="btn-primary" onclick="event.stopPropagation()">
            ${inlineText(id, 'button_text', content.button_text || 'Claim Offer')}
          </button>
          <div style="margin-top: 20px; font-size: 0.9rem; opacity: 0.8; font-weight: 700;">
            ${inlineText(id, 'expiry', content.expiry || 'Hurry, ends soon!')}
          </div>
        </div>`;
    }
    case 'gallery': {
      const items: any[] = content.items || [];
      if (section.variant === 'grid') {
        return `
          <div>
            <h2 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 40px; text-align: center; color: inherit;">
               ${inlineText(id, 'title', content.title || 'Work Gallery')}
            </h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px;">
               ${items.map((item: any, idx: number) => `
                 <div style="aspect-ratio: 1; border-radius: 12px; overflow: hidden; position: relative; background: #eee; cursor: crosshair;" onclick="window.openImagePicker('${id}', 'items.${idx}.after')">
                    <img src="${item.after}" style="width: 100%; height: 100%; object-fit: cover;">
                 </div>
               `).join('')}
            </div>
          </div>
        `;
      }
      return `
        <div>
          <h2 style="font-size: clamp(1.6rem, 5vw, 2.2rem); font-weight: 800; margin-bottom: 40px; text-align: center; color: inherit;">
            ${inlineText(id, 'title', content.title || 'Our Recent Transformations', 'display:block;width:100%;')}
          </h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 24px;">
            ${items.map((item: any, idx: number) => `
              <div style="background: #fff; border-radius: 20px; overflow: hidden; border: 1px solid #eee; display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
                <div style="display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #eee; position: relative;">
                   <div style="position: relative; overflow: hidden; cursor: crosshair;" onclick="window.openImagePicker('${id}', 'items.${idx}.before')">
                    <img src="${item.before}" style="width: 100%; aspect-ratio: 1; object-fit: cover;">
                    <span style="position: absolute; bottom: 8px; left: 8px; background: rgba(0,0,0,0.8); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.6rem; font-weight: 900; letter-spacing: 0.1em; backdrop-filter: blur(4px);">BEFORE</span>
                  </div>
                  <div style="position: relative; overflow: hidden; cursor: crosshair;" onclick="window.openImagePicker('${id}', 'items.${idx}.after')">
                    <img src="${item.after}" style="width: 100%; aspect-ratio: 1; object-fit: cover;">
                    <span style="position: absolute; bottom: 8px; right: 8px; background: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.6rem; font-weight: 900; letter-spacing: 0.1em; box-shadow: 0 4px 10px rgba(16,185,129,0.3);">AFTER</span>
                  </div>
                </div>
                <div style="padding: 15px; text-align: center; font-size: 0.75rem; color: #999; font-weight: 700; background: #fafafa; text-transform: uppercase;">
                   Tap to swap photos
                </div>
              </div>
            `).join('')}
          </div>
          <div style="text-align: center; margin-top: 40px;">
             <button onclick="event.stopPropagation(); window.duplicateGalleryItem('${id}')" style="background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569; padding: 12px 24px; border-radius: 12px; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;">+ Add Another Transformation</button>
          </div>
        </div>`;
    }
    case 'form': {
      return renderStandardForm(id, content, false);
    }
    case 'faq': {
      const faqs: any[] = content.items || [];
      if (section.variant === 'split') {
        return `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 40px; text-align: left;">
            <div style="max-width: 400px;">
              <h2 style="font-size: clamp(1.8rem, 5vw, 2.5rem); font-weight: 900; margin-bottom: 20px; line-height: 1.1; color: #0f172a;">
                ${inlineText(id, 'heading', content.heading || 'Got Questions?', 'display:block;width:100%;')}
              </h2>
              <p style="font-size: 1.1rem; color: #64748b; line-height: 1.6; opacity: 0.8;">
                We have answers. If you can't find what you're looking for, feel free to contact our team.
              </p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 32px;">
              ${faqs.map((faq: any, idx: number) => `
                <div style="padding-bottom: 32px; border-bottom: 1px solid #f1f5f9;">
                  <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 12px; color: #1e293b; letter-spacing: -0.01em;">
                    ${inlineText(id, `items.${idx}.question`, faq.question || 'New Question')}
                  </h3>
                  <div style="color: #475569; line-height: 1.7; font-size: 1rem;">
                    ${inlineText(id, `items.${idx}.answer`, faq.answer || 'Answer goes here...', 'display:block;width:100%;')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>`;
      }
      return `
        <div style="max-width: 800px; margin: 0 auto;">
          <h2 style="font-size: 2.2rem; font-weight: 800; margin-bottom: 48px; text-align: center; color: inherit;">
            ${inlineText(id, 'heading', content.heading || 'Frequently Asked Questions', 'display:block;width:100%;')}
          </h2>
          <div style="display: flex; flex-direction: column; gap: 16px;">
            ${faqs.map((faq: any, idx: number) => `
              <div class="pb-faq-item" style="border: 1px solid #eee; border-radius: 16px; overflow: hidden; background: #fff; transition: all 0.3s ease;">
                <button class="pb-faq-toggle" onclick="this.closest('.pb-faq-item').classList.toggle('open'); event.stopPropagation();"
                        style="width: 100%; text-align: left; padding: 24px; background: transparent; border: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 1.1rem; font-weight: 800; color: #1e293b;">
                  <span>${inlineText(id, `items.${idx}.question`, faq.question || 'New Question')}</span>
                  <span class="pb-faq-chevron" style="font-size: 0.8rem; color: #cbd5e1; transition: transform 0.3s;">▼</span>
                </button>
                <div class="pb-faq-answer" style="padding: 0 24px; max-height: 0; overflow: hidden; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);">
                  <div style="padding-bottom: 24px; color: #64748b; line-height: 1.7; font-size: 1rem;">
                    ${inlineText(id, `items.${idx}.answer`, faq.answer || 'Answer goes here...', 'display:block;width:100%;')}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          <style>
            .pb-faq-item.open { border-color: #2563EB; box-shadow: 0 20px 40px -10px rgba(37,99,235,0.1); }
            .pb-faq-item.open .pb-faq-chevron { transform: rotate(180deg); color: #2563EB; }
            .pb-faq-item.open .pb-faq-answer { max-height: 1000px; }
          </style>
        </div>`;
    }
    default:
      return `<div style="padding: 60px; background: #fff; border-radius: 20px; border: 2px dashed #eee; text-align: center; color: #999;">
                <strong style="color: #666; font-size: 1.1rem;">LEGACY SECTION: ${section.type.toUpperCase()}</strong><br>
                <p style="margin-top: 10px; font-size: 0.9rem;">This section will not appear on the live site.</p>
              </div>`;
  }
}


// ── WB.3.2 Image Picker ─────────────────────────────────────────────────────
/**
 * Opens a hidden file-input, reads the selected image as a data URL,
 * updates the canvas img element in-place (no re-render flicker),
 * persists to the in-memory store, and fires auto-save.
 */
(window as any).openImagePicker = (sectionId: string, field: string) => {
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

    const progress = document.getElementById(`pb-img-progress-${sectionId}`);
    const wrapper  = document.getElementById(`imgwrap-${sectionId}`);
    if (progress) progress.style.display = 'flex';
    if (wrapper)  wrapper.style.pointerEvents = 'none';

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const imgEl = document.getElementById(`pb-img-${sectionId}`) as HTMLImageElement | null;
      if (imgEl) imgEl.src = dataUrl;

      const section = mockPageSections.find((s: any) => s.id === sectionId);
      if (section) {
        setNestedValue(section.content, field, dataUrl);
        (window as any).triggerAutoSave();
      }

      if (progress) progress.style.display = 'none';
      if (wrapper)  wrapper.style.pointerEvents = '';
      (window as any).showToast('Image updated ✓');
      input.remove();
    };
    reader.onerror = () => {
      if (progress) progress.style.display = 'none';
      (window as any).showToast('Could not read image file.');
      input.remove();
    };
    reader.readAsDataURL(file);
  });
  input.click();
};

// ── WB.3.6 — Builder Navigation Handlers ────────────────────────────────────
(window as any).builderGoBack = () => {
  const target = builderReturnTo === 'funnels' ? 'funnel-detail' : 'pages';
  const param = builderReturnTo === 'funnels' ? builderReturnFunnelId : undefined;
  (window as any).navigateTo(target, param);
};

(window as any).openBuilderFromFunnel = (pageId: string, funnelId: string) => {
  builderPageId = pageId;
  builderReturnTo = 'funnels';
  builderReturnFunnelId = funnelId;
  const primarySection = getPrimarySectionForPage(pageId);
  const page = mockPages.find((p: any) => p.id === pageId);
  const context: BuilderContext = {
    pageId,
    sectionId: primarySection?.id || null,
    path: page?.slug ? `/${page.slug === 'home' ? '' : page.slug}` : undefined,
    label: page?.name || primarySection?.content?.heading,
    returnTo: 'funnels',
    funnelId
  };
  persistBuilderContext(context);
  (window as any).navigateTo('builder', undefined, { builderContext: context });
};

(window as any).switchBuilderPage = (id: string, source: 'pages' | 'footer' = 'pages') => {
  builderPageId = id;
  builderSelectedSectionId = null;
  builderInsertOrder = null;
  if (source === 'pages') {
    builderReturnTo = 'pages';
    builderReturnFunnelId = null;
  }
  const context: BuilderContext = {
    pageId: id,
    sectionId: getPrimarySectionForPage(id)?.id || null,
    returnTo: builderReturnTo,
    funnelId: builderReturnFunnelId
  };
  persistBuilderContext(context);
  renderBuilder();
};

(window as any).selectSectionForBuilder = (id: string) => {
  builderSelectedSectionId = id;
  builderInsertOrder = null;
  persistBuilderContext({
    pageId: builderPageId,
    sectionId: id,
    returnTo: builderReturnTo,
    funnelId: builderReturnFunnelId
  });
  renderBuilder();
};

(window as any).showComponentPickerAt = (order: string) => {
  builderInsertOrder = parseFloat(order);
  (window as any).navigateTo('components');
};
(window as any).toggleSectionVisibility = (id: string) => {
  const section = mockPageSections.find(s => s.id === id);
  if (section) {
    if (!section.styles) section.styles = {};
    section.styles.visible = section.styles.visible === false ? true : false;
    renderBuilder();
    (window as any).triggerAutoSave();
  }
};

(window as any).duplicateGalleryItem = (id: string) => {
  const section = mockPageSections.find(s => s.id === id);
  if (section && section.type === 'gallery') {
    const items = section.content.items || [];
    items.push({ 
        before: 'https://images.unsplash.com/photo-1541604193435-22077a288934?auto=format&fit=crop&q=80&w=600', 
        after: 'https://images.unsplash.com/photo-1527335932348-4dbe058525cc?auto=format&fit=crop&q=80&w=600' 
    });
    renderBuilder();
    (window as any).triggerAutoSave();
  }
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

(window as any).addStructuredSectionAt = (order: string) => {
  builderInsertOrder = parseFloat(order);
  (window as any).showToast('Select a component to insert', 'info');
  // Just show the toast, the user then clicks a component on the left
};

(window as any).duplicateGalleryItem = (id: string) => {
  const section = mockPageSections.find(s => s.id === id);
  if (section && section.type === 'gallery') {
    const items = section.content.items || [];
    items.push({ 
        before: 'https://images.unsplash.com/photo-1541604193435-22077a288934?auto=format&fit=crop&q=80&w=600', 
        after: 'https://images.unsplash.com/photo-1527335932348-4dbe058525cc?auto=format&fit=crop&q=80&w=600' 
    });
    renderBuilder();
    (window as any).triggerAutoSave();
  }
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

(window as any).switchSectionVariant = (id: string) => {
  const section = mockPageSections.find(s => s.id === id);
  if (!section) return;

  const variantsByType: Record<string, string[]> = {
    hero: ['standard', 'split', 'minimal'],
    proof: ['grid', 'list'],
    offer: ['banner', 'card'],
    gallery: ['comparison', 'grid'],
    form: ['embedded', 'compact'],
    faq: ['accordion', 'split']
  };

  const currentVariant = section.variant || variantsByType[section.type]?.[0] || 'standard';
  const available = variantsByType[section.type] || ['standard'];
  const currentIndex = available.indexOf(currentVariant);
  const nextIndex = (currentIndex + 1) % available.length;
  
  section.variant = available[nextIndex];
  
  renderBuilder();
  (window as any).triggerAutoSave();
  (window as any).showToast(`Switched to ${available[nextIndex]} layout`, 'success');
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

function renderStandardForm(id: string, content: any, isPublic: boolean) {
  const prefix = isPublic ? 'site-f-' : 'pf-';
  const title = content.title || 'Get Your Free Quote';
  
  // 🌿 Context-Aware CTA (Phase W4.8)
  let submitLabel = content.submit_label || 'Get My Free Quote ✨';
  if (isPublic) {
    if (activeWebsiteContext?.service) {
      submitLabel = `Get ${activeWebsiteContext.service} Quote`;
    } else {
      submitLabel = 'Get Free Quote';
    }
  }
  
  // 🌿 WB.5.2: Input Memory (Repeat Visit Support - Phase W4.6)
  const savedName = window.localStorage.getItem('crm_lead_name') || '';
  const savedPhone = window.localStorage.getItem('crm_lead_phone') || '';
  
  return `
    <div id="form-wrapper-${id}" class="site-form-section" style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.1); color: #1e293b; text-align: left; border: 1px solid #f1f5f9;">
      <h3 style="margin-bottom: 30px; font-size: 1.85rem; text-align: center; font-weight: 800; letter-spacing: -0.5px; color: #0f172a;">${title}</h3>
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div class="form-group">
          <label style="display: block; font-weight: 700; margin-bottom: 6px; font-size: 0.85rem; color: #64748b;">Full Name <span style="color: #ef4444;">*</span></label>
          <input type="text" id="${prefix}name-${id}" 
                 value="${savedName}"
                 placeholder="e.g. John Doe" required 
                 autocomplete="name"
                 oninput="window.localStorage.setItem('crm_lead_name', this.value)"
                 style="padding: 14px 18px; border: 2px solid #f1f5f9; background: #f8fafc; border-radius: 14px; width: 100%; font-family: inherit; font-size: 1rem; transition: all 0.2s;" onfocus="this.style.borderColor='var(--primary-color)'; this.style.background='white'; this.style.boxShadow='0 0 0 4px rgba(37, 99, 235, 0.1)';" onblur="this.style.borderColor='#f1f5f9'; this.style.background='#f8fafc'; this.style.boxShadow='none'">
        </div>
        <div class="form-group">
          <label style="display: block; font-weight: 700; margin-bottom: 6px; font-size: 0.85rem; color: #64748b;">Phone Number <span style="color: #ef4444;">*</span></label>
          <input type="tel" id="${prefix}phone-${id}" 
                 value="${savedPhone}"
                 placeholder="e.g. (555) 000-0000" required 
                 autocomplete="tel"
                 oninput="window.localStorage.setItem('crm_lead_phone', this.value)"
                 style="padding: 14px 18px; border: 2px solid #f1f5f9; background: #f8fafc; border-radius: 14px; width: 100%; font-family: inherit; font-size: 1rem; transition: all 0.2s;" onfocus="this.style.borderColor='var(--primary-color)'; this.style.background='white'; this.style.boxShadow='0 0 0 4px rgba(37, 99, 235, 0.1)';" onblur="this.style.borderColor='#f1f5f9'; this.style.background='#f8fafc'; this.style.boxShadow='none'">
        </div>
        
        <div class="form-group">
          <label style="display: block; font-weight: 700; margin-bottom: 6px; font-size: 0.85rem; color: #64748b;">Service Needed</label>
          <select id="${prefix}service-${id}" 
                  autocomplete="off"
                  style="padding: 14px 18px; border: 2px solid #f1f5f9; background: #f8fafc; border-radius: 14px; width: 100%; font-family: inherit; font-size: 1rem; appearance: none; background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C/polyline%3E%3C/svg%3E'); background-repeat: no-repeat; background-position: right 15px center; background-size: 18px;">
            <option value="General Inquiry">Select a service...</option>
            <option value="Driveway Cleaning">Driveway Cleaning</option>
            <option value="House Washing">House Washing</option>
            <option value="Roof Cleaning">Roof Cleaning</option>
            <option value="Gutter Cleaning">Gutter Cleaning</option>
            <option value="Commercial Cleaning">Commercial Cleaning</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div class="form-group">
          <label style="display: block; font-weight: 700; margin-bottom: 6px; font-size: 0.85rem; color: #64748b;">Message (Optional)</label>
          <textarea id="${prefix}message-${id}" 
                    autocomplete="off"
                    placeholder="Tell us more about your project..." 
                    style="padding: 14px 18px; border: 2px solid #f1f5f9; background: #f8fafc; border-radius: 14px; width: 100%; font-family: inherit; font-size: 1rem; min-height: 100px; resize: vertical; transition: all 0.2s;" onfocus="this.style.borderColor='var(--primary-color)'; this.style.background='white'; this.style.boxShadow='0 0 0 4px rgba(37, 99, 235, 0.1)';" onblur="this.style.borderColor='#f1f5f9'; this.style.background='#f8fafc'; this.style.boxShadow='none'"></textarea>
        </div>

        <button class="btn-primary" 
          style="width: 100%; margin-top: 10px; font-size: 1.3rem; height: 64px;"
          onclick="window.submitBuilderForm('${id}', ${isPublic})">
          ${submitLabel}
        </button>
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 15px; color: #94a3b8; font-size: 0.85rem; font-weight: 600;">
          <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          Secure & Private Inquiry
        </div>
      </div>
    </div>
  `;
}

(window as any).submitBuilderForm = async (sectionId: string, isPublic: boolean = false) => {
  const section = mockPageSections.find(s => s.id === sectionId);
  if (!section) return;

  const prefix = isPublic ? 'site-f-' : 'pf-';

  const nameInput = document.getElementById(`${prefix}name-${sectionId}`) as HTMLInputElement;
  const phoneInput = document.getElementById(`${prefix}phone-${sectionId}`) as HTMLInputElement;
  const emailInput = document.getElementById(`${prefix}email-${sectionId}`) as HTMLInputElement;
  const addressInput = document.getElementById(`${prefix}address-${sectionId}`) as HTMLInputElement;
  const serviceInput = (document.getElementById(`${prefix}service-${sectionId}`) || document.getElementById(`${prefix}service_type-${sectionId}`)) as HTMLSelectElement;
  const messageInput = document.getElementById(`${prefix}message-${sectionId}`) as HTMLTextAreaElement;

  if (!nameInput?.value || !phoneInput?.value) {
    alert('Please fill in your name and phone number.');
    return;
  }

  const sectionWrapper = document.getElementById(`form-wrapper-${sectionId}`);
  const submitBtn = document.querySelector(`#form-wrapper-${sectionId} .btn-primary`) as HTMLButtonElement;
  
  if (!submitBtn || submitBtn.disabled) return; // Zero loss: prevent double submit

  const originalBtnText = submitBtn.innerHTML;
  const settings = getWebsiteSettings();

  try {
    // 1. Disable immediately & Loading State
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span style="display:inline-flex; align-items:center; gap:8px;"><svg class="animate-spin" style="width:18px; height:18px;" viewBox="0 0 24 24"><circle style="opacity:0.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path style="opacity:0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Sending Request…</span>';

    // 🌿 WB.5.1: Attach Funnel Attribution + SEO Metadata (W3.8)
    const page = mockPages.find(p => p.id === section.page_id);
    const leadData = {
      name: nameInput?.value || '',
      phone: phoneInput?.value,
      email: emailInput?.value || '',
      address: addressInput?.value || '',
      service_type: serviceInput?.value || 'General Inquiry',
      message: messageInput?.value || '',
      source: 'funnel',
      funnel_id: page?.funnel_id,
      page_id: section.page_id,
      page_slug: activeWebsiteContext?.slug || page?.slug || '',
      city: activeWebsiteContext?.city || '',
      service: activeWebsiteContext?.service || ''
    };

    // Timeout & Retry Logic (W4.2)
    const MAX_TIMEOUT = 10000;
    const withTimeout = (promise: Promise<any>, ms: number) => 
      Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))
      ]);

    const performSubmission = async (canRetry: boolean = true): Promise<any> => {
      try {
        return await withTimeout(createLead(leadData), MAX_TIMEOUT);
      } catch (err: any) {
        if (canRetry) {
          console.warn('[CRM: FORM] Submission failed/timed out. Retrying once...', err);
          return await withTimeout(createLead(leadData), MAX_TIMEOUT);
        }
        throw err;
      }
    };

    const res = await performSubmission(true); // Initial try + 1 retry

    console.log("[CRM: FORM] Success:", res);
    
    // Success State (W4.3)
    if (sectionWrapper) {
      sectionWrapper.innerHTML = `
        <div id="form-success-confirmation" style="text-align: center; padding: 60px 20px; animation: fadeIn 0.5s ease-out; background: #f0fff4; border-radius: 24px; border: 2px solid #c6f6d5;">
          <div style="font-size: 4.5rem; margin-bottom: 24px; display: inline-block; animation: bounce 1s cubic-bezier(0.175, 0.885, 0.32, 1.275);">🚀</div>
          <h3 style="font-size: 2.25rem; font-weight: 800; margin-bottom: 16px; color: #22543d; letter-spacing: -0.5px;">Thanks! We'll contact you shortly.</h3>
          <p style="font-size: 1.2rem; color: #2f855a; line-height: 1.6; max-width: 400px; margin: 0 auto 30px; font-weight: 500;">
            We've received your request. In the meantime, you can reach us directly at:
          </p>
          <a href="tel:${settings.phone}" style="display: inline-block; font-size: 1.75rem; font-weight: 900; color: #22543d; text-decoration: none; border-bottom: 3px solid #68d391; padding-bottom: 4px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            ${settings.phone}
          </a>
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #c6f6d5;">
             <p style="font-weight: 700; color: #38a169; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1.5px;">Request Confirmed</p>
          </div>
        </div>
      `;
      // Auto-scroll to confirmation
      setTimeout(() => {
        sectionWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }

  } catch (error: any) {
    console.error("[CRM: FORM] Persistent failure after retry:", error);
    
    // Persistent Failure Fallback UI (W4.10 Zero Loss)
    if (sectionWrapper) {
      sectionWrapper.innerHTML = `
        <div style="text-align: center; padding: 50px 20px; animation: fadeIn 0.5s ease-out; background: #fffaf0; border-radius: 24px; border: 2px dashed #f6ad55; box-shadow: 0 10px 25px rgba(192, 86, 33, 0.05);">
          <div style="font-size: 4.5rem; margin-bottom: 24px;">🆘</div>
          <h3 style="font-size: 1.85rem; font-weight: 900; margin-bottom: 12px; color: #c05621; letter-spacing: -0.5px;">Submission Interrupted</h3>
          <p style="font-size: 1.1rem; color: #7b341e; margin-bottom: 30px; line-height: 1.6; max-width: 320px; margin-left: auto; margin-right: auto;">
            Our server is having trouble connecting. To ensure we save your spot, please <b>call or text</b> us directly:
          </p>
          
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <a href="tel:${settings.phone}" 
               style="display: flex; align-items: center; justify-content: center; gap: 10px; padding: 18px; background: #c05621; color: white; text-decoration: none; border-radius: 16px; font-weight: 800; font-size: 1.15rem; box-shadow: 0 6px 15px rgba(192, 86, 33, 0.3); transition: transform 0.2s;">
               <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
               Call ${settings.phone}
            </a>
            
            <a href="sms:${settings.phone}?body=Hi, I tried to submit your website form but it failed. Please contact me about a cleaning quote." 
               style="display: flex; align-items: center; justify-content: center; gap: 10px; padding: 18px; background: white; color: #c05621; text-decoration: none; border-radius: 16px; font-weight: 800; font-size: 1.15rem; border: 2px solid #ed8936; transition: transform 0.2s;">
               <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
               Text ${settings.phone}
            </a>
          </div>
          
          <p style="margin-top: 25px; font-size: 0.85rem; color: #a0522d; font-weight: 600;">Hans personally monitors this line 24/7</p>
        </div>
      `;
    } else {
      alert(`Something went wrong. Please call us directly at ${settings.phone}`);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    }
  }
};

function renderPublicHeader(config: any, settings: any) {
  const displayName = settings.business_name || config.logo_text || 'Our Business';
  if (settings.primary_color && typeof document !== 'undefined' && document.documentElement?.style) {
    document.documentElement.style.setProperty('--primary', settings.primary_color);
    document.documentElement.style.setProperty('--primary-color', settings.primary_color);
  }
  return `
    <header style="padding: 20px 40px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: rgba(255,255,255,0.9); backdrop-filter: blur(8px); z-index: 100; transition: top 0.3s ease;">
      <div style="display: flex; align-items: center; gap: 15px;">
         ${config.logo_url || settings.logo_url ? `<img src="${config.logo_url || settings.logo_url}" style="height: 40px; width: 40px; border-radius: 8px; object-fit: cover;">` : ''}
         <span style="font-weight: 800; font-size: 1.25rem; color: #1e293b;">${displayName}</span>
      </div>
      <nav style="display: flex; gap: 24px; align-items: center;">
         ${(config.nav_items || []).map((item: any) => `
           <a href="/site${item.path.startsWith('/') ? item.path : '/' + item.path}"
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
           <a href="tel:${settings.phone}" style="color: var(--primary-color); font-weight: 700; text-decoration: none;">Call ${settings.phone}</a>
         `}
      </nav>
    </header>
  `;
}

function renderPublicFooter(config: any, settings: any) {
  const businessName = settings.business_name || config.business_name || 'Our Business';
  const phone = settings.phone || config.phone_number || '';
  const smsPhone = settings.sms_number || phone;
  const email = settings.email || config.email || '';
  const serviceArea = config.service_area || 'Your Local Area';
  const cta = config.cta_text || 'Get My Free Quote';
  const links = config.links || [];
  const copyright = `(c) ${new Date().getFullYear()} ${businessName}. All rights reserved.`;

  return `
    <footer style="padding: 60px 20px; background: #0f172a; color: #f8fafc; margin-top: 80px; border-top: 4px solid var(--primary-color);">
      <div style="max-width: 1200px; margin: 0 auto;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 40px; margin-bottom: 40px;">
          <div>
            <h3 style="color: white; font-size: 1.5rem; font-weight: 800; margin-bottom: 16px; letter-spacing: -0.5px;">${businessName}</h3>
            <p style="color: #94a3b8; line-height: 1.6; font-size: 0.95rem; margin-bottom: 24px;">
              Providing professional exterior cleaning and restoration services with a focus on quality, reliability, and customer satisfaction.
            </p>
            <div style="display: flex; align-items: center; gap: 10px; color: #3b82f6; font-weight: 600;">
              <span>Serving ${serviceArea}</span>
            </div>
          </div>
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
          <div>
            <h4 style="color: white; font-size: 1.1rem; font-weight: 700; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px;">Contact Us</h4>
            <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 20px;">Questions? Call or text us directly for immediate assistance.</p>
            <a href="tel:${phone}" style="display: flex; align-items: center; gap: 12px; color: white; text-decoration: none; font-size: 1.4rem; font-weight: 800; margin-bottom: 20px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
               <span style="background: var(--primary-color); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 1.1rem;">Call</span>
               <span>${phone}</span>
            </a>
            ${smsPhone ? `
              <a href="sms:${smsPhone}?body=Hi, I'd like a quote for pressure washing." style="display: flex; align-items: center; gap: 12px; color: #94a3b8; text-decoration: none; font-size: 0.95rem; margin-bottom: 20px; font-weight: 500;">
                 <span style="background: #1e293b; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 0.8rem;">SMS</span>
                 <span>Text us</span>
              </a>
            ` : ''}
            ${email ? `
              <a href="mailto:${email}" style="display: flex; align-items: center; gap: 12px; color: #94a3b8; text-decoration: none; font-size: 0.95rem; margin-bottom: 20px; font-weight: 500;">
                 <span style="background: #1e293b; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 0.8rem;">Email</span>
                 <span>${email}</span>
              </a>
            ` : ''}
            <button class="btn-primary" style="width: 100%; padding: 14px; border-radius: 8px; font-weight: 700; font-size: 1rem; box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4); border: none; cursor: pointer;" onclick="document.querySelector('.site-form-section')?.scrollIntoView({behavior: 'smooth'})">
              ${cta}
            </button>
          </div>
        </div>
        <div style="padding-top: 30px; border-top: 1px solid #1e293b; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 20px; color: #64748b; font-size: 0.85rem;">
          <div>${copyright}</div>
          <div style="display: flex; gap: 20px; flex-wrap: wrap;">
             <span style="display: flex; align-items: center; gap: 6px;"><span style="color: #22c55e;">-</span> Fully Insured</span>
             <span style="display: flex; align-items: center; gap: 6px;"><span style="color: #22c55e;">-</span> Licensed Professionals</span>
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

let activeWebsiteContext: any = null;

function normalizePreviewPath(path: string = '/'): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return cleanPath === '/home' ? '/' : cleanPath;
}

function resolvePageForPreviewPath(path: string = '/', funnelId?: string): any | null {
  const normalizedPath = normalizePreviewPath(path);
  if (normalizedPath === '/') {
    return mockPages.find((p: any) => p.slug === 'home' || p.name?.toLowerCase() === 'home') || null;
  }

  const slug = normalizedPath.replace(/^\//, '');
  const route = mockWebsiteRoutes.find((r: any) => normalizePreviewPath(r.path || '/') === normalizedPath);
  return mockPages.find((p: any) => p.slug === slug)
    || mockPages.find((p: any) => route?.funnel_id && p.funnel_id === route.funnel_id && p.slug === slug)
    || mockPages.find((p: any) => funnelId && p.funnel_id === funnelId && p.slug === slug)
    || null;
}

function hydratePreviewSectionsForPage(pageId: string): void {
  hydrateBuilderSectionsFromLocalStorage(pageId);
}

function resolveWebsitePathFromBrowserPath(rawPath: string): string | null {
  if (rawPath === '/site' || rawPath === '/preview') return '/';
  if (rawPath.startsWith('/site/')) return rawPath.replace('/site/', '/');
  if (rawPath.startsWith('/preview/')) return rawPath.replace('/preview/', '/');

  const normalizedPath = normalizePreviewPath(rawPath);
  if (normalizedPath === '/') return null;
  const isKnownWebsiteRoute = mockWebsiteRoutes.some((route: any) =>
    normalizePreviewPath(route.path || '/') === normalizedPath
  );
  return isKnownWebsiteRoute ? normalizedPath : null;
}

async function renderSitePage(funnel_id: string, websiteOrContext: any, isPreview: boolean = false) {
  // Store context for lead submission (Phase W3.8)
  activeWebsiteContext = websiteOrContext;
  const website = websiteOrContext.website_id ? websiteOrContext : websiteOrContext; // Handle both Website and WebsiteRoute
  
  // 1. Resolve Data
  // In the resolver, it correctly identifies the funnel_id.
  
  // 2. Identify primary page/step in that funnel
  const resolvedPath = websiteOrContext?.route?.path || websiteOrContext?.path || '/';
  const page = resolvePageForPreviewPath(resolvedPath, funnel_id)
    || mockPages.find(p => p.funnel_id === funnel_id);
  
  if (!page || (!isPreview && page.status !== 'published')) {
    render404(!page ? 'No content mapped to this page.' : 'This page is currently a draft.');
    return;
  }

  const settings = getWebsiteSettings();
  const layout = mockWebsiteLayouts.find(l => l.website_id === website.id) || getWebsiteLayout(); 
  
  // W6.5: Robust Internal Linking System
  const contactRoute = mockWebsiteRoutes.find(r => r.website_id === website.id && (r.path === '/contact' || r.path === '/quote'));
  const contactLink = contactRoute ? `/site${contactRoute.path}` : '/site/contact';
  const homeLink = '/site/';
  
  // Identify all service routes for cross-linking
  const serviceRoutes = mockWebsiteRoutes
    .filter(r => r.website_id === website.id && r.path !== '/' && r.path !== '/contact' && r.path !== '/quote')
    .map(r => ({ 
      ...r, 
      funnel_name: mockFunnels.find(f => f.id === r.funnel_id)?.name || 'Service' 
    }));

  if (page?.id) {
    hydratePreviewSectionsForPage(page.id);
  }

  const sections = mockPageSections
    .filter(s => s.page_id === page.id && s.styles?.visible !== false)
    .sort((a, b) => a.order - b.order)
    .map(section => {
      // Create a copy of content to avoid mutating the mock database directly every render
      const content = { ...section.content, business_name: settings.business_name, phone: settings.phone };
      
      // Smart Link CTAs based on page context
      if (['hero', 'offer', 'cta'].includes(section.type) && !content.button_link) {
        if (page.name.toLowerCase().includes('contact')) {
          content.button_link = homeLink; // Contact pages link back home
          if (!content.button_text) content.button_text = 'Back to Homepage';
        } else {
          content.button_link = contactLink; // Service pages link to contact
          if (!content.button_text) content.button_text = 'Get Free Estimate';
        }
      }

      // Populate service lists automatically
      if (section.type === 'services') {
        content.service_routes = serviceRoutes;
      }
      
      return { ...section, content };
    });

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
          <a href="sms:${settings.sms_number || settings.phone}?body=Hi, I'd like a quote for pressure washing." class="cta-bar-btn" style="background: #0ea5e9; color: white; display: flex; align-items: center; gap: 8px; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 0.9rem;">
            <span>Text Photos</span>
          </a>
          <button class="cta-bar-btn cta-bar-btn--quote" onclick="document.querySelector('.site-form-section')?.scrollIntoView({behavior: 'smooth'})">
            <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            <span>Get Free Quote</span>
          </button>
        </div>
      ` : ''}

      ${renderPublicHeader(layout.header_config, settings)}

      ${sections.map(section => {
        // 🌿 Fix.7: Inject global variables into section content with auto-replacement (Phase Fix.7)
        let contentJson = JSON.stringify(section.content);
        const smsCta = settings.sms_number || settings.phone;
        contentJson = contentJson
          .replace(/{{business_name}}/g, settings.business_name)
          .replace(/{{phone}}/g, settings.phone)
          .replace(/{{sms_number}}/g, smsCta)
          .replace(/{{email}}/g, settings.email || '');
          
        const content = { ...JSON.parse(contentJson), business_name: settings.business_name, phone: settings.phone, sms_number: smsCta, email: settings.email };
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
        <h1 style="font-size: clamp(2.8rem, 8vw, 4.5rem); margin-bottom: 1.5rem; font-weight: 900; line-height: 1.05; letter-spacing: -0.02em;">${content.heading || 'Hero Heading'}</h1>
        <p style="font-size: clamp(1.1rem, 3vw, 1.4rem); opacity: 0.9; margin-bottom: 3rem; max-width: 700px; margin-left: ${styles.text_alignment === 'center' ? 'auto' : '0'}; margin-right: ${styles.text_alignment === 'center' ? 'auto' : '0'}; line-height: 1.6;">${content.subheading || 'Hero Subheading'}</p>
        <${content.button_link ? 'a href="' + content.button_link + '"' : 'button'} class="btn-primary" style="display: ${styles.text_alignment === 'center' ? 'inline-block' : 'inline-flex'}; text-decoration: none; padding: 20px 48px; font-size: 1.25rem; border-radius: 60px; font-weight: 800; cursor: pointer; border: none; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.2);"
                ${!content.button_link ? 'onclick="document.querySelector(\'.site-form-section\')?.scrollIntoView({behavior: \'smooth\'})"' : ''}>
          ${content.button_text || 'Get Started'}
        </${content.button_link ? 'a' : 'button'}>
      `;
    case 'proof': {
      const tests: any[] = content.testimonials || [];
      return `
        <div style="text-align: center;">
          <h2 style="font-size: clamp(2rem, 5vw, 3rem); font-weight: 900; margin-bottom: 50px;">${content.title || 'Trusted By Local Homeowners'}</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px;">
            ${tests.map((t: any) => `
              <div style="background: white; padding: 40px; border-radius: 20px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; text-align: left;">
                <div style="color: #fbbf24; font-size: 1.2rem; margin-bottom: 16px;">
                  ${'★'.repeat(t.stars || 5)}${'☆'.repeat(5 - (t.stars || 5))}
                </div>
                <p style="font-size: 1rem; line-height: 1.7; font-style: italic; margin-bottom: 24px; color: #475569;">&ldquo;${t.quote}&rdquo;</p>
                <div style="font-weight: 800; color: #1e293b; font-size: 0.95rem;">&mdash; ${t.name}</div>
              </div>
            `).join('')}
          </div>
        </div>`;
    }
    case 'offer':
      return `
        <div style="background: #4f46e5; color: white; padding: 80px 40px; border-radius: 30px; text-align: center; box-shadow: 0 30px 60px -12px rgba(79, 70, 229, 0.25);">
          <div style="display: inline-block; background: rgba(255,255,255,1); color: #4f46e5; padding: 6px 18px; border-radius: 30px; font-size: 0.75rem; font-weight: 900; text-transform: uppercase; margin-bottom: 24px; letter-spacing: 0.1em;">Special Deal</div>
          <h2 style="font-size: clamp(2.5rem, 6vw, 3.5rem); margin-bottom: 1.5rem; font-weight: 900; line-height: 1.1;">${content.headline || 'Ready to Start?'}</h2>
          <p style="font-size: 1.3rem; opacity: 0.9; margin-bottom: 3.5rem; max-width: 650px; margin-left: auto; margin-right: auto; line-height: 1.6;">${content.description || 'Join hundreds of happy customers today.'}</p>
          <${content.button_link ? 'a href="' + content.button_link + '"' : 'button'} class="btn-primary" 
                  style="display: inline-block; text-decoration: none; background: white; color: #4f46e5; border: none; padding: 22px 55px; font-size: 1.35rem; border-radius: 60px; font-weight: 900; cursor: pointer; transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.2);"
                  onmouseover="this.style.transform='translateY(-4px) scale(1.05)'; this.style.boxShadow='0 30px 60px -15px rgba(0,0,0,0.3)'"
                  onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 20px 40px -10px rgba(0,0,0,0.2)'"
                  ${!content.button_link ? 'onclick="document.querySelector(\'.site-form-section\')?.scrollIntoView({behavior: \'smooth\'})"' : ''}>
            ${content.button_text || 'Claim My Offer'}
          </${content.button_link ? 'a' : 'button'}>
          <div style="margin-top: 30px; font-size: 1rem; opacity: 0.8; font-weight: 700; letter-spacing: 0.02em;">${content.expiry || 'Limited time remaining.'}</div>
        </div>`;
    case 'gallery': {
      const items: any[] = content.items || [];
      return `
        <div style="text-align: center;">
          <h2 style="font-size: clamp(2rem, 5vw, 3rem); font-weight: 900; margin-bottom: 50px;">${content.title || 'Before & After Results'}</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 40px;">
            ${items.map((item: any) => `
              <div style="background: white; border-radius: 24px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05);">
                <div style="display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #e2e8f0; position: relative;">
                  <div style="position: relative;">
                    <img src="${item.before}" style="width: 100%; aspect-ratio: 1.2; object-fit: cover;">
                    <span style="position: absolute; bottom: 15px; left: 15px; background: rgba(0,0,0,0.8); color: white; padding: 4px 14px; border-radius: 6px; font-size: 0.7rem; font-weight: 900; letter-spacing: 0.1em;">BEFORE</span>
                  </div>
                  <div style="position: relative;">
                    <img src="${item.after}" style="width: 100%; aspect-ratio: 1.2; object-fit: cover;">
                    <span style="position: absolute; bottom: 15px; right: 15px; background: #10b981; color: white; padding: 4px 14px; border-radius: 6px; font-size: 0.7rem; font-weight: 900; letter-spacing: 0.1em;">AFTER</span>
                  </div>
                </div>
                <div style="padding: 24px; font-size: 0.95rem; color: #64748b; font-weight: 700; background: #f8fafc; letter-spacing: 0.01em;">
                  Property Restoration Complete.
                </div>
              </div>
            `).join('')}
          </div>
        </div>`;
    }
    case 'form':
      return `
        <div class="site-form-section" style="max-width: 600px; margin: 0 auto; background: white; padding: 50px; border-radius: 30px; box-shadow: 0 40px 60px -15px rgba(0,0,0,0.1); border: 1px solid #f1f5f9;">
          <h2 style="font-size: 2.2rem; font-weight: 900; margin-bottom: 15px; text-align: center;">${content.title || 'Get My Free Quote'}</h2>
          <p style="text-align: center; color: #64748b; margin-bottom: 40px; font-weight: 600;">Fill out the form below and we'll be in touch within 15 minutes.</p>
          ${renderStandardForm(id, content, true)}
        </div>`;
    case 'services': {
      const routes: any[] = content.service_routes || [];
      return `
        <div style="text-align: center;">
          <h2 style="font-size: clamp(2.2rem, 5vw, 3.2rem); font-weight: 900; margin-bottom: 15px;">${content.title || 'Our Services'}</h2>
          <p style="color: #64748b; font-size: 1.15rem; margin-bottom: 50px; max-width: 600px; margin-left: auto; margin-right: auto; line-height: 1.6;">${content.subtitle || 'Professional cleaning solutions for every part of your property.'}</p>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 30px;">
            ${routes.map((r: any) => `
              <div class="service-card" style="background: white; padding: 40px; border-radius: 24px; border: 1px solid #e2e8f0; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); transition: all 0.3s;" onmouseover="this.style.transform='translateY(-8px)'; this.style.borderColor='var(--primary-color)'" onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='#e2e8f0'">
                <div style="background: #f0f7ff; width: 64px; height: 64px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto 24px;">✨</div>
                <h3 style="font-size: 1.4rem; font-weight: 800; margin-bottom: 12px; color: #1e293b;">${r.funnel_name}</h3>
                <p style="color: #64748b; font-size: 0.95rem; line-height: 1.6; margin-bottom: 24px;">Professional restoration for your ${r.funnel_name.toLowerCase()}.</p>
                <a href="#/site${r.path}" style="color: var(--primary-color); font-weight: 700; text-decoration: none; font-size: 1rem; display: inline-flex; align-items: center; gap: 8px;">Learn More <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg></a>
              </div>
            `).join('')}
          </div>
        </div>`;
    }
    case 'faq': {
      const faqs: any[] = content.items || [];
      return `
        <div style="max-width: 800px; margin: 0 auto;">
          <h2 style="font-size: clamp(2rem, 5vw, 3rem); font-weight: 900; margin-bottom: 50px; text-align: center;">${content.heading || 'Frequently Asked Questions'}</h2>
          <div style="display: flex; flex-direction: column; gap: 16px;">
            ${faqs.map((faq: any, idx: number) => `
              <div class="site-faq-item" style="border: 2px solid #f1f5f9; border-radius: 20px; overflow: hidden; background: white; transition: all 0.3s ease;">
                <button onclick="this.closest('.site-faq-item').classList.toggle('open')"
                        style="width: 100%; text-align: left; padding: 28px 32px; background: transparent; border: none; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 1.2rem; font-weight: 800; color: #1e293b; outline: none;">
                  <span>${faq.question || 'Question ' + (idx + 1)}</span>
                  <span class="faq-chevron" style="font-size: 0.9rem; color: #94a3b8; transition: transform 0.3s ease;">▼</span>
                </button>
                <div class="faq-answer-wrap" style="padding: 0 32px; max-height: 0; overflow: hidden; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);">
                  <p style="padding-bottom: 32px; color: #475569; line-height: 1.8; font-size: 1.1rem; font-weight: 500;">${faq.answer || 'Answer goes here...'}</p>
                </div>
              </div>
            `).join('')}
          </div>
          <style>
            .site-faq-item.open { border-color: #4f46e5 !important; box-shadow: 0 20px 25px -5px rgba(79, 70, 229, 0.1); transform: translateY(-2px); }
            .site-faq-item.open .faq-chevron { transform: rotate(180deg); color: #4f46e5 !important; }
            .site-faq-item.open .faq-answer-wrap { max-height: 500px !important; }
          </style>
        </div>`;
    }
    default:
      return `<div style="padding: 40px; text-align: center; color: #999; border: 2px dashed #eee; border-radius: 12px; margin: 40px;">Legacy Section Type: ${type}</div>`;
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

<<<<<<< HEAD
(window as any).showAttachToWebsiteModal = (funnelId: string) => {
    const userId = (window as any).currentUser || 'system';
    const website = mockWebsites.find(w => w.user_id === userId) || mockWebsites[0];
    const existingRoutes = mockWebsiteRoutes.filter(r => r.website_id === website.id);
    
    const modal = document.createElement('div');
    modal.id = 'attach-modal';
    modal.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center;">
            <div class="card" style="width: 100%; max-width: 500px; padding: 35px; box-shadow: var(--shadow-lg);">
                <h3 style="margin-top: 0; margin-bottom: 24px;">Connect Page to Web Address</h3>
                
                <div class="form-group" style="margin-bottom: 24px;">
                    <label style="font-weight: 700; font-size: 0.9rem; margin-bottom: 10px; display: block;">Option 1: Use an Existing Web Address</label>
                    <select id="existing-route-select" style="width: 100%; padding: 14px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc;">
                        <option value="">-- Or Create New Address Below --</option>
                        ${existingRoutes.map(r => {
                          const fName = mockFunnels.find(f => f.id === r.funnel_id)?.name || 'Untitled';
                          return `<option value="${r.id}">${r.path} (Currently shows: ${fName})</option>`;
                        }).join('')}
                    </select>
                </div>

                <div style="text-align: center; margin: 24px 0; position: relative;">
                    <hr style="border: 0; border-top: 1px solid #e2e8f0;">
                    <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 0 15px; color: #94a3b8; font-weight: 800; font-size: 0.7rem;">OR</span>
                </div>

                <div class="form-group" style="margin-bottom: 30px;">
                    <label style="font-weight: 700; font-size: 0.9rem; margin-bottom: 10px; display: block;">Option 2: Create a NEW Web Address</label>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.2rem; font-weight: 800; color: #64748b;">/</span>
                        <input type="text" id="new-route-path-inp" placeholder="e.g. spring-special-2026" style="flex: 1; padding: 14px; border: 1px solid #e2e8f0; border-radius: 10px;">
                    </div>
                </div>

                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn-outline" style="padding: 12px 24px; border-radius: 8px;" onclick="document.getElementById('attach-modal').remove()">Cancel</button>
                    <button class="btn-primary" style="padding: 12px 24px; border-radius: 8px; font-weight: 700;" onclick="window.saveWebsiteAttachment('${funnelId}', '${website.id}')">Confirm Connection</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

(window as any).saveWebsiteAttachment = (funnelId: string, websiteId: string) => {
    const existingId = (document.getElementById('existing-route-select') as HTMLSelectElement).value;
    const newPath = (document.getElementById('new-route-path-inp') as HTMLInputElement).value.trim();
    
    if (existingId) {
        const route = mockWebsiteRoutes.find(r => r.id === existingId);
        if (route) {
            route.funnel_id = funnelId;
            (window as any).showToast(`Path ${route.path} updated successfully!`, 2000);
        }
    } else if (newPath) {
        const normalized = '/' + newPath.replace(/^\/+/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (mockWebsiteRoutes.some(r => r.website_id === websiteId && r.path === normalized)) {
            alert('This URL path is already assigned to another page.');
            return;
        }
        mockWebsiteRoutes.push({
            id: `r-${Date.now()}`,
            website_id: websiteId,
            path: normalized,
            funnel_id: funnelId,
            created_at: new Date().toISOString()
        } as any);
        (window as any).showToast(`Assigned to new path: ${normalized}`, 2000);
    } else {
        alert('Please select an existing path or define a new one.');
        return;
    }
    
    document.getElementById('attach-modal')?.remove();
    renderFunnelDetail(funnelId);
};

(window as any).openNewPageModal = (type: string) => {
  if (type === 'template') {
    (window as any).navigateTo('templates');
    return;
  }
  const titles: Record<string, string> = {
    'blank': 'Create Blank Page',
    'ai': 'Generate Page with AI'
  };

=======
(window as any).openNewPageModal = (sourceType: string = 'blank') => {
  // Step 1: Select Template
>>>>>>> TARGETED-FIX-PROMPTS-(W6-HARDENING)
  const modal = document.createElement('div');
  modal.id = 'page-creation-modal';
  modal.innerHTML = `
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;">
      <div id="modal-content" style="background: white; border-radius: 20px; width: 100%; max-width: 900px; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); display: flex; flex-direction: column;">
        
        <div style="padding: 30px; border-bottom: 1px solid #eef2f6; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-radius: 20px 20px 0 0;">
          <div>
            <h2 style="margin: 0; font-size: 1.5rem; color: #1e293b;">Step 1: Select a Template</h2>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 0.9rem;">Choose a starting point for your new page.</p>
          </div>
          <button onclick="document.getElementById('page-creation-modal').remove()" style="background: none; border: none; font-size: 1.5rem; color: #94a3b8; cursor: pointer;">&times;</button>
        </div>

        <div style="padding: 30px; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 24px;">
           <div class="template-card" onclick="window.confirmPageTemplate('blank')" style="border: 2px dashed #cbd5e1; border-radius: 16px; padding: 40px 20px; text-align: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary-color)'; this.style.background='#f0f7ff'" onmouseout="this.style.borderColor='#cbd5e1'; this.style.background='white'">
             <div style="font-size: 3rem; margin-bottom: 16px;">📄</div>
             <h3 style="margin: 0; color: #1e293b;">Blank Canvas</h3>
             <p style="color: #64748b; font-size: 0.85rem; margin-top: 8px;">Start from scratch and build it your way.</p>
           </div>
           ${mockTemplates.map(tpl => `
             <div class="template-card" onclick="window.confirmPageTemplate('${tpl.id}')" style="border: 2px solid #e2e8f0; border-radius: 16px; overflow: hidden; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.borderColor='var(--primary-color)'; this.style.transform='translateY(-4px)'" onmouseout="this.style.borderColor='#e2e8f0'; this.style.transform='translateY(0)'">
               <div style="height: 140px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 2.5rem;">🎨</div>
               <div style="padding: 16px;">
                 <h3 style="margin: 0; color: #1e293b; font-size: 1.1rem;">${tpl.name}</h3>
                 <p style="color: #64748b; font-size: 0.8rem; margin-top: 4px;">${tpl.category}</p>
               </div>
             </div>
           `).join('')}
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(modal);
};

(window as any).confirmPageTemplate = (templateId: string) => {
    const modalContent = document.getElementById('modal-content');
    if (!modalContent) return;

    const tpl = templateId === 'blank' ? null : mockTemplates.find(t => t.id === templateId);

    modalContent.innerHTML = `
        <div style="padding: 30px; border-bottom: 1px solid #eef2f6; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-radius: 20px 20px 0 0;">
          <div>
            <h2 style="margin: 0; font-size: 1.5rem; color: #1e293b;">Step 2: Name Your Page</h2>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 0.9rem;">Give it a name that makes sense for your site.</p>
          </div>
          <button onclick="document.getElementById('page-creation-modal').remove()" style="background: none; border: none; font-size: 1.5rem; color: #94a3b8; cursor: pointer;">&times;</button>
        </div>

        <div style="padding: 40px; max-width: 500px; margin: 0 auto;">
           <div class="form-group" style="margin-bottom: 24px;">
              <label style="display: block; font-weight: 700; font-size: 0.9rem; color: #475569; margin-bottom: 10px;">Page Name</label>
              <input type="text" id="finalize_page_name" placeholder="e.g. Roof Cleaning Special" style="width: 100%; padding: 14px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 1.1rem; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--primary-color)'" onblur="this.style.borderColor='#e2e8f0'" onkeydown="if(event.key === 'Enter') window.finalizePageCreation('${templateId}')">
              <small style="color: #94a3b8; display: block; margin-top: 8px;">This will automatically create a web address at /${tpl?.name?.toLowerCase().replace(/\\s+/g, '-') || 'new-page'}</small>
           </div>
           
           <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 32px;">
              <button onclick="window.openNewPageModal()" style="padding: 12px 24px; border: none; background: #f1f5f9; color: #475569; font-weight: 700; border-radius: 12px; cursor: pointer;">Back</button>
              <button onclick="window.finalizePageCreation('${templateId}')" class="btn-primary" style="padding: 12px 32px; font-weight: 800; border-radius: 12px;">Create & Build</button>
           </div>
        </div>
    `;
    setTimeout(() => document.getElementById('finalize_page_name')?.focus(), 100);
};

(window as any).finalizePageCreation = (templateId: string) => {
    const input = document.getElementById('finalize_page_name') as HTMLInputElement;
    const name = input?.value.trim();
    if (!name) { alert('Please enter a name for your page.'); return; }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const funnelId = `fnl-${Date.now()}`;
    const pageId = `p-${Date.now()}`;
    const websiteId = mockWebsites[0].id; // Default site

    // 1. Create Funnel
    mockFunnels.push({
        id: funnelId,
        user_id: (window as any).currentUser || 'system',
        name: name,
        status: 'published',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });

    // 2. Create Page
    const newPage = {
        id: pageId,
        user_id: (window as any).currentUser || 'system',
        funnel_id: funnelId,
        name: name,
        slug: slug,
        status: 'published',
        seo_title: `${name} | ${mockWebsites[0].name}`,
        seo_description: '',
        seo_keywords: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    mockPages.push(newPage as any);

    // 3. Create Route
    mockWebsiteRoutes.push({
        id: `r-${Date.now()}`,
        website_id: websiteId,
        path: `/${slug}`,
        funnel_id: funnelId,
        created_at: new Date().toISOString()
    } as any);

    // 4. Apply Template Sections
    if (templateId !== 'blank') {
        const tpl = mockTemplates.find(t => t.id === templateId);
        if (tpl) {
            tpl.sections.forEach((sec: any, idx: number) => {
                mockPageSections.push({
                    id: `ps-${Date.now()}-${idx}`,
                    page_id: pageId,
                    type: sec.type,
                    content: { ...sec.content },
                    order: sec.order,
                    styles: { ...sec.styles }
                });
            });
        }
    }

    // 5. Success & Transition
    document.getElementById('page-creation-modal')?.remove();
    (window as any).showToast('Page created! Opening builder...', 2000);
    
    // Switch to builder for the new page
    (window as any).switchBuilderPage(pageId);
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
        <div style="display: flex; gap: 5px; flex-wrap: wrap; max-width: 420px;">
          <button class="btn-primary" style="padding: 5px 12px; font-size: 0.8rem;" onclick="event.stopPropagation(); window.switchBuilderPage('${page.id}'); window.navigateTo('builder');">Edit Page</button>
          <button class="btn-outline" style="padding: 5px 12px; font-size: 0.8rem; border-color: #e2e8f0; color: #475569;" onclick="event.stopPropagation(); window.open('/site/${page.slug}', '_blank')">View Live</button>
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #6c757d;" onclick="event.stopPropagation(); window.duplicatePage('${page.id}')">Duplicate</button>
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: ${page.status === 'published' ? '#ea580c' : '#28a745'};" onclick="event.stopPropagation(); window.togglePublish('${page.id}')">${page.status === 'published' ? 'Unpublish' : 'Publish'}</button>
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #8a2be2;" onclick="event.stopPropagation(); window.generatePageWithAI('${page.id}')">✨ AI Gen</button>
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
          <h2>All Website Sections</h2>
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
  // All components are now top-tier structured sections, no categories needed.

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
  applyPrimaryColor(settings.primary_color);
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
              <input type="text" data-settings-field="business_name" value="${settings.business_name}" onchange="window.updateSettingsField('business_name', this.value)" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
               <div class="form-group">
                 <label>Public Phone</label>
                 <input type="text" id="settings-phone-input" value="${settings.phone}" onchange="window.updateSettingsField('phone', this.value)" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
               </div>
               <div class="form-group">
                 <label>Text/SMS Number</label>
                 <input type="text" id="settings-sms-number-input" value="${settings.sms_number || ''}" onchange="window.updateSettingsField('sms_number', this.value)" placeholder="${settings.phone}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                 <small style="color: #94a3b8; font-size: 0.75rem;">Used for text-message CTAs. Leave blank to use your public phone number.</small>
               </div>
               <div class="form-group">
                 <label>Public Email</label>
                 <input type="email" id="settings-email-input" value="${settings.email}" onchange="window.updateSettingsField('email', this.value)" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
               </div>
            </div>
            <div style="display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: center;">
               <div class="form-group" style="margin: 0;">
                 <label>Brand Color</label>
                 <div style="display: flex; align-items: center; gap: 12px; margin-top: 6px;">
                   <input type="color" id="settings-primary-color-input" value="${settings.primary_color || '#4f46e5'}" onchange="window.updateSettingsField('primary_color', this.value)" oninput="window.updateSettingsField('primary_color', this.value)" style="width: 48px; height: 40px; border: 1px solid #ddd; border-radius: 6px; padding: 2px; cursor: pointer;">
                   <code style="font-size: 0.85rem; color: #475569; font-weight: 600;" id="settings-primary-color-display">${settings.primary_color || '#4f46e5'}</code>
                 </div>
               </div>
               <div style="padding: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 0.85rem; color: #64748b; margin-top: 20px;">
                 Changes button and accent colors across your public website and CRM dashboard.
               </div>
            </div>
            <div class="form-group">
              <label>Logo URL</label>
              <div style="display: flex; gap: 10px;">
                 <input type="text" id="settings-logo-url-input" value="${settings.logo_url || ''}" onchange="window.updateSettingsField('logo_url', this.value)" style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                 ${settings.logo_url ? `<img id="settings-logo-img" src="${settings.logo_url}" style="height: 42px; width: 42px; border-radius: 4px; object-fit: cover; border: 1px solid #ddd;">` : ''}
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
              <input type="text" data-settings-field="facebook_pixel_id" placeholder="e.g. 1234567890" value="${settings.facebook_pixel_id || ''}" onchange="window.updateSettingsField('facebook_pixel_id', this.value)" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div class="form-group">
              <label>GTM Container ID</label>
              <input type="text" data-settings-field="gtm_id" placeholder="e.g. GTM-XXXXXX" value="${settings.gtm_id || ''}" onchange="window.updateSettingsField('gtm_id', this.value)" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
          </div>
        </div>
      </div>
    </main>
  `;
}

<<<<<<< HEAD
=======

>>>>>>> TARGETED-FIX-PROMPTS-(W6-HARDENING)
function renderWebsiteNavigation() {
  const userId = (window as any).currentUser || 'system';
  const website = mockWebsites.find(w => w.user_id === userId) || mockWebsites[0];
  const layout = mockWebsiteLayouts.find(l => l.website_id === website.id) || mockWebsiteLayouts[0];
  
  if (!layout.header_config.nav_items) layout.header_config.nav_items = [];
  const navItems = layout.header_config.nav_items;

<<<<<<< HEAD
  const itemsHtml = navItems.map((item: any, index: number) => `
    <div class="card" style="display: flex; align-items: center; gap: 15px; margin-bottom: 12px; padding: 15px; border: 1px solid #eef2f6;">
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <button class="btn-outline" style="padding: 2px 10px; font-size: 0.7rem; background: white;" onclick="window.reorderNavItem(${index}, -1)" ${index === 0 ? 'disabled' : ''}>▲</button>
        <button class="btn-outline" style="padding: 2px 10px; font-size: 0.7rem; background: white;" onclick="window.reorderNavItem(${index}, 1)" ${index === navItems.length - 1 ? 'disabled' : ''}>▼</button>
      </div>
      
      <div style="flex: 2;">
        <label style="font-size: 0.75rem; color: #64748b; font-weight: 600; text-transform: uppercase; display: block; margin-bottom: 4px;">Label</label>
        <input type="text" value="${item.label}" onchange="window.updateNavItem(${index}, 'label', this.value)" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px;">
      </div>

      <div style="flex: 2;">
        <label style="font-size: 0.75rem; color: #64748b; font-weight: 600; text-transform: uppercase; display: block; margin-bottom: 4px;">URL Path</label>
        <input type="text" value="${item.path}" onchange="window.updateNavItem(${index}, 'path', this.value)" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px;">
      </div>

      <div style="flex: 0.5; text-align: center;">
        <label style="font-size: 0.75rem; color: #64748b; font-weight: 600; text-transform: uppercase; display: block; margin-bottom: 4px;">Show</label>
        <input type="checkbox" ${item.visible !== false ? 'checked' : ''} onchange="window.updateNavItem(${index}, 'visible', this.checked)" style="width: 20px; height: 20px; cursor: pointer;">
      </div>

      <button class="btn-outline" style="background: #fff; color: #ef4444; border-color: #fee2e2; padding: 8px 12px;" onclick="window.deleteNavItem(${index})">
        <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
=======
  // 🌿 Fix.2: Get available pages for the dropdown
  const siteRoutes = mockWebsiteRoutes.filter(r => r.website_id === website.id);

  const itemsHtml = navItems.map((item: any, index: number) => `
    <div class="card" style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px; padding: 20px; border: 1px solid #eef2f6; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <button class="btn-outline" style="padding: 4px 10px; font-size: 0.8rem; background: white;" onclick="window.reorderNavItem(${index}, -1)" ${index === 0 ? 'disabled' : ''}>▲</button>
        <button class="btn-outline" style="padding: 4px 10px; font-size: 0.8rem; background: white;" onclick="window.reorderNavItem(${index}, 1)" ${index === navItems.length - 1 ? 'disabled' : ''}>▼</button>
      </div>
      
      <div style="flex: 2;">
        <label style="font-size: 0.7rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 8px;">Menu Label</label>
        <input type="text" value="${item.label}" onchange="window.updateNavItem(${index}, 'label', this.value)" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 0.95rem;">
      </div>

      <div style="flex: 2;">
        <label style="font-size: 0.7rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 8px;">Linked Page</label>
        <select onchange="window.updateNavItem(${index}, 'path', this.value)" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 10px; background: white; font-size: 0.95rem; cursor: pointer;">
          <option value="" ${!item.path ? 'selected' : ''}>-- Select a Page --</option>
          ${siteRoutes.map(route => {
             const funnel = mockFunnels.find(f => f.id === route.funnel_id);
             return `<option value="${route.path}" ${item.path === route.path ? 'selected' : ''}>${funnel?.name || 'Page'} (${route.path})</option>`;
          }).join('')}
        </select>
        <small style="color: #94a3b8; margin-top: 6px; display: block;">Link points to: ${item.path || 'None'}</small>
      </div>

      <div style="flex: 0.5; text-align: center;">
        <label style="font-size: 0.7rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 8px;">Visible</label>
        <input type="checkbox" ${item.visible !== false ? 'checked' : ''} onchange="window.updateNavItem(${index}, 'visible', this.checked)" style="width: 24px; height: 24px; cursor: pointer; accent-color: var(--primary-color);">
      </div>

      <button class="btn-outline" style="background: #fff5f5; color: #ef4444; border-color: #fee2e2; padding: 10px; border-radius: 10px;" onclick="window.deleteNavItem(${index})">
        <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
>>>>>>> TARGETED-FIX-PROMPTS-(W6-HARDENING)
      </button>
    </div>
  `).join('');

  app.innerHTML = `
    ${renderSidebar('website-navigation')}
    <main class="main-content">
      <header class="view-header">
        <div>
<<<<<<< HEAD
          <h2>Website Navigation</h2>
          <p style="color: #64748b; margin-top: 4px;">Control the links in your site's top navigation bar.</p>
        </div>
        <div style="display: flex; gap: 10px;">
           <button class="btn-primary" style="background: #8a2be2;" onclick="window.addNavItem()">+ Add Item</button>
           <button class="btn-primary" onclick="window.saveWebsiteLayout()">Save Changes</button>
        </div>
      </header>

      <div style="max-width: 900px; padding: 10px;">
        ${itemsHtml || '<div class="empty-state" style="padding: 60px; text-align: center; background: white; border-radius: 12px; border: 2px dashed #e2e8f0; color: #64748b;"><div style="font-size: 2rem; margin-bottom: 10px;">🗺️</div><h3>No menu items found</h3><p>Click "Add Item" to build your site menu.</p></div>'}
=======
          <h2 style="margin: 0; font-size: 1.75rem;">Website Navigation</h2>
          <p style="color: #64748b; margin-top: 6px;">Manage your site's header menu. Links are restricted to your published pages to prevent dead ends.</p>
        </div>
        <div style="display: flex; gap: 12px;">
           <button class="btn-primary" style="background: #8a2be2; border: none; padding: 12px 24px;" onclick="window.addNavItem()">+ Add Menu Item</button>
           <button class="btn-primary" style="padding: 12px 24px;" onclick="window.saveWebsiteLayout()">Save Configuration</button>
        </div>
      </header>

      <div style="max-width: 1000px; padding: 10px;">
        ${itemsHtml || '<div class="empty-state" style="padding: 80px; text-align: center; background: white; border-radius: 20px; border: 2px dashed #e2e8f0; color: #64748b;"><div style="font-size: 3rem; margin-bottom: 16px;">📂</div><h3>No menu items here</h3><p>Start building your navigation menu by adding your first link.</p><button class="btn-primary" style="margin-top: 20px;" onclick="window.addNavItem()">Add Item</button></div>'}
>>>>>>> TARGETED-FIX-PROMPTS-(W6-HARDENING)
      </div>
    </main>
  `;
}

(window as any).addNavItem = () => {
    const userId = (window as any).currentUser || 'system';
    const website = mockWebsites.find(w => w.user_id === userId) || mockWebsites[0];
    const layout = mockWebsiteLayouts.find(l => l.website_id === website.id) || mockWebsiteLayouts[0];
    
<<<<<<< HEAD
=======
    if (!layout.header_config.nav_items) layout.header_config.nav_items = [];
>>>>>>> TARGETED-FIX-PROMPTS-(W6-HARDENING)
    layout.header_config.nav_items.push({ label: 'New Link', path: '/', visible: true });
    renderWebsiteNavigation();
};

(window as any).updateNavItem = (index: number, field: string, value: any) => {
    const userId = (window as any).currentUser || 'system';
    const website = mockWebsites.find(w => w.user_id === userId) || mockWebsites[0];
    const layout = mockWebsiteLayouts.find(l => l.website_id === website.id) || mockWebsiteLayouts[0];
    
    (layout.header_config.nav_items[index] as any)[field] = value;
<<<<<<< HEAD
    // Don't re-render for input changes to keep focus, but re-render for visibility toggle
    if (field === 'visible') renderWebsiteNavigation();
=======
    renderWebsiteNavigation();
>>>>>>> TARGETED-FIX-PROMPTS-(W6-HARDENING)
};

(window as any).reorderNavItem = (index: number, direction: number) => {
    const userId = (window as any).currentUser || 'system';
    const website = mockWebsites.find(w => w.user_id === userId) || mockWebsites[0];
    const layout = mockWebsiteLayouts.find(l => l.website_id === website.id) || mockWebsiteLayouts[0];
    
    const items = layout.header_config.nav_items;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    
    const temp = items[index];
    items[index] = items[newIndex];
    items[newIndex] = temp;
    
    renderWebsiteNavigation();
};

(window as any).deleteNavItem = (index: number) => {
    const userId = (window as any).currentUser || 'system';
    const website = mockWebsites.find(w => w.user_id === userId) || mockWebsites[0];
    const layout = mockWebsiteLayouts.find(l => l.website_id === website.id) || mockWebsiteLayouts[0];
    
    layout.header_config.nav_items.splice(index, 1);
    renderWebsiteNavigation();
};

(window as any).saveWebsiteLayout = async () => {
<<<<<<< HEAD
    (window as any).showToast('Saving navigation...', 2000);
    // In a real app, this would be a POST to /api/websites/layout
    setTimeout(() => {
        (window as any).showToast('Navigation saved successfully!', 2000);
    }, 500);
};

=======
    (window as any).showToast('Saving navigation layout...', 2000);
    setTimeout(() => {
        (window as any).showToast('Navigation updated successfully!', 2000);
    }, 600);
};


function renderWebsiteDashboard() {
  const userId = (window as any).currentUser || 'system';
  const website = mockWebsites.find(w => w.user_id === userId) || mockWebsites[0];
  const domain = website.domain || `${website.subdomain}.hanssays.com`;
  const previewUrl = `${window.location.protocol}//${window.location.host}/?subdomain=${website.subdomain}`;

  const homeRoute = mockWebsiteRoutes.find(r => r.website_id === website.id && r.path === '/');
  const homePage = mockPages.find(p => p.funnel_id === homeRoute?.funnel_id);

  app.innerHTML = `
    ${renderSidebar('website-dashboard')}
    <main class="main-content">
      <header class="view-header">
        <div>
          <h2 style="margin: 0; font-size: 1.75rem;">My Website</h2>
          <p style="color: #64748b; margin-top: 6px;">Manage your online presence and tracks its performance.</p>
        </div>
        <div style="display: flex; gap: 12px;">
           <button class="btn-primary" style="background: white; color: var(--primary-color); border: 2px solid var(--primary-color);" onclick="window.open('${previewUrl}', '_blank')">View Live Site</button>
           <button class="btn-primary" onclick="window.openNewPageModal()">+ Add Page</button>
        </div>
      </header>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin-bottom: 40px;">
        <div class="card" style="padding: 24px; display: flex; align-items: center; gap: 24px;">
           <div style="font-size: 2.5rem; background: #f0f7ff; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; border-radius: 20px;">🌐</div>
           <div>
              <label style="font-size: 0.75rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">Domain Mode</label>
              <h3 style="margin: 4px 0; font-size: 1.25rem;">${domain}</h3>
              <p style="margin: 0; font-size: 0.85rem; color: #10b981; font-weight: 600;">● Live & Secured</p>
           </div>
        </div>

        <div class="card" style="padding: 24px; display: flex; align-items: center; gap: 24px;">
           <div style="font-size: 2.5rem; background: #fff7ed; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; border-radius: 20px;">⚡</div>
           <div>
              <label style="font-size: 0.75rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">Site Health</label>
              <h3 style="margin: 4px 0; font-size: 1.25rem;">98 / 100</h3>
              <p style="margin: 0; font-size: 0.85rem; color: #64748b;">Optimized for Speed</p>
           </div>
        </div>
      </div>

      <div class="card" style="padding: 30px; margin-bottom: 40px;">
         <h3 style="margin-top: 0; margin-bottom: 24px;">Quick Actions</h3>
         <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px;">
            <div class="card" style="border: 1px solid #eef2f6; text-align: center; padding: 30px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary-color)'" onmouseout="this.style.borderColor='#eef2f6'" onclick="${homePage ? `window.switchBuilderPage('${homePage.id}'); window.navigateTo('builder')` : 'alert(\'No Home Page found\')'}">
               <div style="font-size: 2rem; margin-bottom: 15px;">🏠</div>
               <h4 style="margin: 0; color: #1e293b;">Edit Home Page</h4>
               <p style="color: #64748b; font-size: 0.85rem; margin-top: 8px;">Modify your hero, services, and branding visually.</p>
            </div>
            
            <div class="card" style="border: 1px solid #eef2f6; text-align: center; padding: 30px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary-color)'" onmouseout="this.style.borderColor='#eef2f6'" onclick="window.navigateTo('website-navigation')">
               <div style="font-size: 2rem; margin-bottom: 15px;">🗺️</div>
               <h4 style="margin: 0; color: #1e293b;">Site Navigation</h4>
               <p style="color: #64748b; font-size: 0.85rem; margin-top: 8px;">Control the menu links in your site header.</p>
            </div>

            <div class="card" style="border: 1px solid #eef2f6; text-align: center; padding: 30px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary-color)'" onmouseout="this.style.borderColor='#eef2f6'" onclick="window.navigateTo('seo-pages')">
               <div style="font-size: 2rem; margin-bottom: 15px;">🚀</div>
               <h4 style="margin: 0; color: #1e293b;">SEO Boost</h4>
               <p style="color: #64748b; font-size: 0.85rem; margin-top: 8px;">Generate local landing pages to rank higher.</p>
            </div>
         </div>
      </div>

      <div class="card" style="padding: 0; overflow: hidden; border-radius: 16px;">
        <div style="padding: 20px 30px; border-bottom: 1px solid #f1f5f9; background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 1.1rem; color: #1e293b;">Active Site Structure</h3>
            <button class="btn-primary" style="padding: 6px 16px; font-size: 0.85rem;" onclick="window.navigateTo('website-structure')">Manage Routes</button>
        </div>
        <table class="clients-table" style="box-shadow: none; border: none; margin: 0;">
           <thead>
              <tr>
                 <th>Path</th>
                 <th>Resource</th>
                 <th style="text-align: right;">Activity</th>
              </tr>
           </thead>
           <tbody>
              ${mockWebsiteRoutes.filter(r => r.website_id === website.id).slice(0, 5).map(route => {
                  const funnel = mockFunnels.find(f => f.id === route.funnel_id);
                  return `
                    <tr>
                       <td style="font-weight: 700;">${route.path}</td>
                       <td><span class="badge" style="background: #eef2f6; color: #64748b;">${funnel?.name || 'Unknown'}</span></td>
                       <td style="text-align: right;"><span style="color: #10b981; font-weight: 600;">Active</span></td>
                    </tr>
                  `;
              }).join('')}
           </tbody>
        </table>
      </div>
    </main>
  `;
}

>>>>>>> TARGETED-FIX-PROMPTS-(W6-HARDENING)
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
          <h2>Website Configuration</h2>
          <p style="color: #64748b; margin-top: 4px;">Map your custom URLs to website pages.</p>
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
              <th>Destination Page</th>
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
                    <div style="font-weight: 500; color: #1e293b;">${funnel ? funnel.name : 'Unknown Page'}</div>
                    <!-- Internal ID hidden -->
                  </td>
                  <td><span class="badge badge-published">Live</span></td>
                  <td style="text-align: right; padding-right: 20px;">
<<<<<<< HEAD
                    <button class="btn-outline" style="color: #64748b; border-color: #e2e8f0; padding: 4px 10px; font-size: 0.8rem;" onclick="window.navigateTo('funnel-detail', '${route.funnel_id}')">Edit Page</button>
=======
                    <button class="btn-primary" style="padding: 4px 12px; font-size: 0.8rem;" onclick="event.stopPropagation(); const p = mockPages.find(pg => pg.funnel_id === '${route.funnel_id}'); if(p) { window.switchBuilderPage(p.id); window.navigateTo('builder'); } else { window.navigateTo('funnel-detail', '${route.funnel_id}'); }">Edit Page</button>
                    <button class="btn-outline" style="color: #64748b; border-color: #e2e8f0; padding: 4px 10px; font-size: 0.8rem; margin-left: 5px;" onclick="event.stopPropagation(); window.open('/site${route.path}', '_blank')">View Live</button>
>>>>>>> TARGETED-FIX-PROMPTS-(W6-HARDENING)
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
          <label>Destination Page</label>
          <select id="route-funnel-id" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
            ${mockFunnels.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
          </select>
          <small style="color: #64748b; margin-top: 4px; display: block;">Which page should load at this path?</small>
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
  if (!confirm('Are you sure you want to delete this route? This path will no longer load its page.')) return;
  
  const index = mockWebsiteRoutes.findIndex(r => r.id === id);
  if (index !== -1) {
    mockWebsiteRoutes.splice(index, 1);
    renderWebsiteStructure();
  }
};

(window as any).updateSettingsField = (field: string, value: string) => {
    const s = getWebsiteSettings();
    (s as any)[field] = value;

    if (field === 'primary_color') {
        applyPrimaryColor(value);
        const colorDisplay = document.getElementById('settings-primary-color-display');
        if (colorDisplay) colorDisplay.textContent = value;
    }
    if (field === 'logo_url') {
        const logoImg = document.getElementById('settings-logo-img') as HTMLImageElement | null;
        if (logoImg) logoImg.src = value;
    }

    const promise = fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s)
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            console.log('[SETTINGS] Field persisted:', field, value);
        } else {
            console.warn('[SETTINGS] Persistence response was failure:', res.error);
        }
        return res;
    })
    .catch(err => {
        console.error('[SETTINGS] Network error on field save:', err);
        throw err;
    });

    console.log('Settings updated:', field, value);
    return promise;
};

(window as any).handleLogoUpload = async (file: File) => {
    if (!file) return;
    const btn = document.getElementById('logo-upload-btn') as HTMLButtonElement | null;
    const status = document.getElementById('logo-upload-status') as HTMLDivElement | null;
    const preview = document.getElementById('logo-preview-container') as HTMLDivElement | null;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>Uploading...</span>';
        btn.style.opacity = '0.7';
    }
    if (status) {
        status.style.color = '#3b82f6';
        status.textContent = 'Uploading to secure storage...';
    }

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', 'logo');

        const res = await fetch('/api/media/upload', {
            method: 'POST',
            body: formData
        });

        const json = await res.json();

        if (json.success && json.public_url) {
            if (status) {
                status.style.color = '#10b981';
                status.textContent = 'Upload completed! Saving settings...';
            }
            if (preview) {
                preview.innerHTML = `<img id="settings-logo-img" src="${json.public_url}" style="width: 100%; height: 100%; object-fit: cover;">`;
            }
            const input = document.getElementById('settings-logo-url-input') as HTMLInputElement | null;
            if (input) {
                input.value = json.public_url;
            }

            await window.updateSettingsField('logo_url', json.public_url);

            setTimeout(() => {
                if (status) status.textContent = 'Upload completed!';
            }, 1000);
        } else {
            throw new Error(json.error || 'UPLOAD_FAILED');
        }
    } catch (err: any) {
        console.error('[LOGO UPLOAD ERROR]:', err);
        if (status) {
            status.style.color = '#ef4444';
            const errorMsg = err.message === 'FILE_TOO_LARGE'
                ? 'File too large (max 5MB)'
                : err.message === 'INVALID_FILE_TYPE'
                    ? 'Invalid image type (only PNG/JPG/WEBP allowed)'
                    : 'Server error';
            status.textContent = `Upload failed: ${errorMsg}`;
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span>Upload Logo File</span>';
            btn.style.opacity = '1';
        }
    }
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

async function renderWebsiteDashboard() {
  const userId = (window as any).currentUser || 'system';
  const website = mockWebsites.find(w => w.user_id === userId) || mockWebsites[0];
  const routes = mockWebsiteRoutes.filter(r => r.website_id === website.id);
  const homePage = mockFunnels.find(f => f.name.toLowerCase().includes('home')) || mockFunnels[0];
  
  const siteUrl = website.domain ? `https://${website.domain}` : `https://${website.subdomain}.pressurepro.io`;

  app.innerHTML = `
    ${renderSidebar('website-dashboard')}
    <main class="main-content">
      <header class="view-header">
        <div>
          <h2>My Website Dashboard</h2>
          <p style="color: #64748b; margin-top: 4px;">Overview of your online presence.</p>
        </div>
      </header>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 30px; align-items: start;">
        <div style="display: flex; flex-direction: column; gap: 30px;">
          <!-- Site Preview Card -->
          <div class="card" style="padding: 30px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-left: 6px solid #0ea5e9;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span class="badge" style="background: #0ea5e9; color: white; margin-bottom: 12px;">Live & Published</span>
                <h3 style="margin: 0; font-size: 1.5rem; color: #1e3a8a;">${website.name || 'Your Website'}</h3>
                <div style="font-size: 1.1rem; color: #0369a1; margin-top: 8px; font-weight: 600;">${siteUrl}</div>
              </div>
              <a href="${siteUrl}" target="_blank" class="btn-primary" style="background: #0ea5e9; border: none; padding: 14px 28px; font-weight: 800; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(14, 165, 233, 0.4);">View Live Site ↗</a>
            </div>
          </div>

          <!-- Pages List -->
          <div class="card" style="padding: 0; overflow: hidden;">
            <div style="padding: 20px; border-bottom: 1px solid #eef2f6; display: flex; justify-content: space-between; align-items: center;">
              <h3 style="margin: 0;">Active Pages (${routes.length})</h3>
              <button class="btn-outline" style="font-size: 0.85rem;" onclick="window.navigateTo('funnels')">Manage All</button>
            </div>
            <table class="data-table">
              <tbody>
                ${routes.map(r => {
                  const funnel = mockFunnels.find(f => f.id === r.funnel_id);
                  return `
                    <tr>
                      <td style="padding-left: 20px;">
                        <div style="font-weight: 700;">${funnel?.name}</div>
                        <code style="color: var(--primary-color); font-size: 0.8rem;">${r.path}</code>
                      </td>
                      <td style="text-align: right; padding-right: 20px;">
                        <button class="btn-outline" style="padding: 4px 12px; border-radius: 6px; font-size: 0.8rem;" onclick="window.navigateTo('funnel-detail', '${r.funnel_id}')">Edit Sections</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 30px;">
          <!-- Quick Actions -->
          <div class="card" style="padding: 24px;">
            <h3 style="margin-top: 0; margin-bottom: 20px;">Quick Actions</h3>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <button class="btn-primary" style="width: 100%; text-align: left; padding: 16px; border-radius: 12px; display: flex; align-items: center; gap: 12px;" onclick="window.navigateTo('funnel-detail', '${homePage?.id}')">
                <span style="font-size: 1.5rem;">🏠</span>
                <div>
                  <div style="font-weight: 800;">Edit Home Page</div>
                  <div style="font-size: 0.75rem; opacity: 0.8;">Modify your primary landing page structure.</div>
                </div>
              </button>
              <button class="btn-primary" style="width: 100%; text-align: left; padding: 16px; border-radius: 12px; background: #8a2be2; display: flex; align-items: center; gap: 12px;" onclick="window.showAddPageModal('${website.id}')">
                <span style="font-size: 1.5rem;">📄</span>
                <div>
                  <div style="font-weight: 800;">Add Service Page</div>
                  <div style="font-size: 0.75rem; opacity: 0.8;">Expand your site with an automated page.</div>
                </div>
              </button>
              <button class="btn-outline" style="width: 100%; text-align: left; padding: 16px; border-radius: 12px; display: flex; align-items: center; gap: 12px;" onclick="window.navigateTo('website-settings')">
                <span style="font-size: 1.5rem;">⚙️</span>
                <div>
                  <div style="font-weight: 700;">Branding & SEO</div>
                  <div style="font-size: 0.75rem; color: #64748b;">Configure logos and site-wide tracking.</div>
                </div>
              </button>
            </div>
          </div>

          <!-- Stats Summary -->
          <div class="card" style="padding: 24px; background: #fafafa;">
             <h4 style="margin: 0; font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Site Health</h4>
             <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
                <div style="text-align: center; padding: 15px; background: white; border-radius: 12px; border: 1px solid #eef2f6;">
                   <div style="font-size: 1.5rem; font-weight: 800; color: #10b981;">A+</div>
                   <div style="font-size: 0.65rem; color: #64748b; margin-top: 4px;">CORE VITALS</div>
                </div>
                <div style="text-align: center; padding: 15px; background: white; border-radius: 12px; border: 1px solid #eef2f6;">
                   <div style="font-size: 1.5rem; font-weight: 800; color: #0ea5e9;">100%</div>
                   <div style="font-size: 0.65rem; color: #64748b; margin-top: 4px;">RESPONSIVE</div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </main>
  `;
}

function renderFunnels(mode: 'website' | 'marketing' = 'website') {
  currentView = 'funnels';
  (window as any).funnelMode = mode;
  const userId = (window as any).currentUser || 'system';
  const website = mockWebsites.find(w => w.user_id === userId) || mockWebsites[0];
  
  const siteRoutes = mockWebsiteRoutes.filter(r => r.website_id === website.id);
  const routedFunnelIds = new Set(siteRoutes.map(r => r.funnel_id));
  
  const allFunnels = mockFunnels.filter(f => f.user_id === userId);
  
  const displayFunnels = mode === 'website'
    ? allFunnels.filter(f => routedFunnelIds.has(f.id))
    : allFunnels.filter(f => !routedFunnelIds.has(f.id));

  const viewTitle = mode === 'website' ? 'Site Pages' : 'Marketing Pages';
  const viewDesc = mode === 'website' 
    ? 'Manage the core pages that make up your business website.' 
    : 'Standalone lead-capture pages for ads and seasonal marketing.';

  const rowsHtml = displayFunnels.map(funnel => {
    const route = siteRoutes.find(r => r.funnel_id === funnel.id);
    return `
      <tr class="clickable-row" onclick="window.navigateTo('funnel-detail', '${funnel.id}')">
        <td style="font-weight: 600; color: var(--primary-color); padding-left: 20px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.2rem;">${mode === 'website' ? '📄' : '🎯'}</span>
            ${funnel.name || 'Untitled Page'}
          </div>
        </td>
        <td><code>${route ? route.path : '(Standalone)'}</code></td>
        <td><span class="badge badge-${funnel.status}">${funnel.status}</span></td>
        <td style="text-align: right; padding-right: 20px;">
           <button class="btn-primary" style="padding: 6px 14px; font-size: 0.85rem;" onclick="event.stopPropagation(); window.navigateTo('funnel-detail', '${funnel.id}')">Manage</button>
           ${route && route.path !== '/' ? `<button class="btn-primary" style="padding: 6px 14px; font-size: 0.85rem; background: #ef4444; border: none; margin-left: 5px;" onclick="event.stopPropagation(); window.deletePage('${route.id}', '${funnel.id}')">Delete</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  app.innerHTML = `
    ${renderSidebar('funnels')}
    <main class="main-content">
      <header class="view-header">
        <div>
          <h2 style="margin: 0;">${viewTitle}</h2>
          <p style="color: #64748b; margin-top: 4px; font-size: 0.9rem;">${viewDesc}</p>
        </div>
        <div style="display: flex; gap: 12px;">
          ${mode === 'website' 
            ? `<button class="btn-primary" onclick="window.showAddPageModal('${website.id}')">+ New Website Page</button>`
            : `<button class="btn-primary" style="background: #4f46e5; border: none;" onclick="window.openNewPageModal('template')">+ New Marketing Page</button>`
          }
        </div>
      </header>
      
      <div id="pages-list-container" style="padding: 20px;">
        <div class="card" style="padding: 0; overflow: hidden;">
          <table class="clients-table" style="box-shadow: none; margin-top: 0;">
            <thead>
              <tr>
                <th style="padding-left: 20px;">${mode === 'website' ? 'Page Name' : 'Page Name'}</th>
                <th>Web Address</th>
                <th>Status</th>
                <th style="text-align: right; padding-right: 20px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="4" style="text-align: center; padding: 60px; color: #94a3b8;">No ${mode === 'website' ? 'pages' : 'funnels'} found.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  `;
<<<<<<< HEAD
=======

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
           style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; transition: transform 0.2s; border: 1px solid #eef2f6;" 
           onmouseover="this.style.boxShadow='0 10px 25px rgba(0,0,0,0.05)'; this.style.borderColor='var(--primary-color)';"
           onmouseout="this.style.boxShadow='none'; this.style.borderColor='#eef2f6';">
        <div style="display: flex; align-items: center; gap: 20px;" onclick="window.navigateTo('funnel-detail', '${f.id}')" style="cursor: pointer;">
          <div style="background: #f0f7ff; width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">🎯</div>
          <div>
            <h4 style="margin: 0; color: #1e293b; font-size: 1.1rem;">${f.name}</h4>
            <div style="font-size: 0.85rem; color: #64748b; margin-top: 4px;">Created ${new Date(f.created_at).toLocaleDateString()}</div>
          </div>
        </div>
        <div style="text-align: right; display: flex; align-items: center; gap: 25px;">
          <div style="text-align: center; min-width: 60px;">
            <div style="font-weight: 700; color: #1e293b; font-size: 1.1rem;">${totalLeads}</div>
            <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Total Leads</div>
          </div>
          <div style="text-align: center; min-width: 80px; padding: 0 15px; border-left: 1px solid #eef2f6; border-right: 1px solid #eef2f6;">
            <div style="font-weight: 700; color: var(--primary-color); font-size: 1.1rem;">${leadsToday}</div>
            <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Leads Today</div>
          </div>
          <div style="display: flex; gap: 8px;">
             <button class="btn-primary" style="padding: 8px 16px; font-size: 0.85rem;" onclick="event.stopPropagation(); const p = mockPages.find(pg => pg.funnel_id === '${f.id}'); if(p) { window.switchBuilderPage(p.id); window.navigateTo('builder'); } else { window.navigateTo('funnel-detail', '${f.id}'); }">Edit Page</button>
             <button class="btn-outline" style="padding: 8px 16px; font-size: 0.85rem; border-color: #e2e8f0; color: #475569;" onclick="event.stopPropagation(); const r = mockWebsiteRoutes.find(rt => rt.funnel_id === '${f.id}'); window.open(r ? '/site' + r.path : '/preview/${f.id}', '_blank')">View Live</button>
          </div>
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
>>>>>>> TARGETED-FIX-PROMPTS-(W6-HARDENING)
}




async function renderFunnelDetail(funnelId: string) {
  app.innerHTML = `
    ${renderSidebar('funnels')}
    <main class="main-content">
      <div id="funnel-detail-container" style="padding: 20px;">
        <div class="loading">Loading page details...</div>
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
            <div style="font-size: 0.85rem; color: #64748b; margin-top: 4px;">Path: <span style="font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">/${step.slug}</span></div>
          </div>
          <button class="btn-primary" style="background: white; color: var(--primary-color); border: 1px solid var(--primary-color); padding: 8px 16px; font-weight: 600;" onclick="window.openBuilderFromFunnel('${step.id}', '${funnelId}')">Edit Section</button>
        </div>
      </div>
      ${index < steps.length - 1 ? `<div style="width: 2px; height: 30px; background: #e2e8f0; margin-left: 19px; margin-top: -24px; margin-bottom: 4px;"></div>` : ''}
    `).join('');

    const website = mockWebsites[0]; // Assuming user has one website
    const routes = mockWebsiteRoutes.filter(r => r.funnel_id === funnelId);
    const siteUrlBase = website.domain ? `https://${website.domain}` : `https://${website.subdomain}.pressurepro.io`;

    container.innerHTML = `
      <!-- Website Attachment Card (W6.7) -->
      <div id="website-attachment-card" class="card" style="background: ${routes.length > 0 ? '#f0fdf4' : '#fffbeb'}; border: 1px solid ${routes.length > 0 ? '#bbf7d0' : '#fde68a'}; padding: 25px; margin-bottom: 32px; border-left: 6px solid ${routes.length > 0 ? '#10b981' : '#f59e0b'};">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: ${routes.length > 0 ? '0' : '20px'};">
          <div style="display: flex; align-items: center; gap: 15px;">
            <span style="font-size: 2rem;">${routes.length > 0 ? '🌐' : '🔗'}</span>
            <div>
              <div style="font-size: 0.75rem; color: ${routes.length > 0 ? '#166534' : '#92400e'}; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
                ${routes.length > 0 ? 'Connected to Website' : 'Not Connected to Website'}
              </div>
              <h3 style="margin: 0; font-size: 1.25rem; color: #1e293b; font-family: 'Inter', sans-serif;">
                ${routes.length > 0 
                  ? routes.map(r => `<a href="${siteUrlBase}${r.path}" target="_blank" style="color: inherit; text-decoration: none; border-bottom: 2px dashed #bbf7d0;">${siteUrlBase}${r.path} ↗</a>`).join(', ') 
                  : 'Standalone Funnel (Not on Website)'}
              </h3>
            </div>
          </div>
          <button class="btn-primary" style="background: #1e293b; color: white; border: none; padding: 12px 24px; font-weight: 700; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);" onclick="window.showAttachToWebsiteModal('${funnelId}')">
            ${routes.length > 0 ? 'Manage Connection' : 'Attach to Website Page'}
          </button>
        </div>
        
        ${routes.length === 0 ? `
           <div style="font-size: 0.9rem; color: #92400e; font-weight: 600; background: rgba(255,255,255,0.4); padding: 14px; border-radius: 10px; margin-top: 15px; border: 1px dashed #fde68a;">
              💡 This page is currently a standalone project. Connecting it to your website allows it to appear in your site navigation and use your custom domain URL.
           </div>
        ` : ''}
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
            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 0.9rem;">Configure your sections and layout</p>
          </div>
        </div>
      </header>

      <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 32px; max-width: 1200px;">
        <div id="steps-section">
          <h3 style="margin-bottom: 24px; color: #1e293b; font-size: 1.25rem;">Page Sections</h3>
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
        activityList.innerHTML = '<div style="color: #64748b; font-size: 0.9rem; text-align: center; padding: 20px;">No activity yet. Share your page to start seeing leads!</div>';
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
    console.error('Failed to load page detail:', err);
    const container = document.getElementById('funnel-detail-container');
    if (container) container.innerHTML = `<div class="error">Failed to load page: ${err.message}</div>`;
  }
}

(window as any).showAddPageModal = (websiteId: string) => {
    const modal = document.createElement('div');
    modal.id = 'page-modal';
    modal.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center;">
            <div class="card" style="width: 100%; max-width: 480px; padding: 30px; box-shadow: var(--shadow-lg);">
                <h3 style="margin-top: 0; margin-bottom: 24px; font-size: 1.5rem;">Add New Website Page</h3>
                
                <div class="form-group" style="margin-bottom: 24px;">
                    <label style="font-weight: 600; font-size: 0.9rem; margin-bottom: 8px; display: block;">Page Name</label>
                    <input type="text" id="new-page-name" placeholder="e.g. Roof Cleaning" style="width: 100%; padding: 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 1rem;">
                </div>

                <div class="form-group" style="margin-bottom: 30px;">
                    <label style="font-weight: 600; font-size: 0.9rem; margin-bottom: 12px; display: block;">Page Type</label>
                    <div style="display: grid; grid-template-columns: 1fr; gap: 10px;">
                        <label class="type-option" style="display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary-color)'" onmouseout="this.style.borderColor='#e2e8f0'">
                            <input type="radio" name="page-type" value="service" checked style="width: 18px; height: 18px;">
                            <div>
                                <div style="font-weight: 700; color: #1e293b;">Service Page</div>
                                <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">Pre-built sections for showcasing specific services.</div>
                            </div>
                        </label>
                        <label class="type-option" style="display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary-color)'" onmouseout="this.style.borderColor='#e2e8f0'">
                            <input type="radio" name="page-type" value="contact" style="width: 18px; height: 18px;">
                            <div>
                                <div style="font-weight: 700; color: #1e293b;">Contact & Quote Page</div>
                                <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">Optimized for lead capture and quote requests.</div>
                            </div>
                        </label>
                        <label class="type-option" style="display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid #e2e8f0; border-radius: 10px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary-color)'" onmouseout="this.style.borderColor='#e2e8f0'">
                            <input type="radio" name="page-type" value="custom" style="width: 18px; height: 18px;">
                            <div>
                                <div style="font-weight: 700; color: #1e293b;">Custom Page</div>
                                <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">Start with a blank canvas for complete control.</div>
                            </div>
                        </label>
                    </div>
                </div>

                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn-outline" style="padding: 12px 24px; border-radius: 8px;" onclick="document.getElementById('page-modal').remove()">Cancel</button>
                    <button class="btn-primary" style="padding: 12px 24px; border-radius: 8px; font-weight: 700;" onclick="window.saveNewPage('${websiteId}')">Create & Publish</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

(window as any).saveNewPage = async (websiteId: string) => {
    const nameInput = document.getElementById('new-page-name') as HTMLInputElement;
    const typeInput = document.querySelector('input[name="page-type"]:checked') as HTMLInputElement;
    
    if (!nameInput?.value) {
        alert('Please enter a page name.');
        return;
    }

    const name = nameInput.value.trim();
    const type = typeInput?.value || 'service';
    
    // Auto-generate slug and path
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const path = '/' + slug;

    try {
        (window as any).showToast('Auto-generating page structure...', 3000);
        
        // 1. Create Page (Funnel) via API
        const res = await fetch('/api/funnels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        }).then(r => r.json());

        if (res.success) {
            const funnelId = res.data.id;

            // 2. Create Route in mock data
            if (!mockWebsiteRoutes.some(r => r.website_id === websiteId && r.path === path)) {
              const newRoute = {
                  id: `r-${Date.now()}`,
                  website_id: websiteId,
                  path: path,
                  funnel_id: funnelId,
                  created_at: new Date().toISOString()
              };
              mockWebsiteRoutes.push(newRoute as any);
            }
            
            // 3. Add to Website Navigation automatically
            const layout = mockWebsiteLayouts.find(l => l.website_id === websiteId) || mockWebsiteLayouts[0];
            if (layout && layout.header_config) {
                if (!layout.header_config.nav_items) layout.header_config.nav_items = [];
                // Check if already in nav
                if (!layout.header_config.nav_items.some(item => item.path === path)) {
                    layout.header_config.nav_items.push({ label: name, path: path, visible: true });
                }
            }

            (window as any).showToast('Page Created & Added to Menu!', 2000);
            document.getElementById('page-modal')?.remove();
            
            // Jump to the detail view immediately for customization
            window.navigateTo('funnel-detail', funnelId);
        } else {
            alert('Error: ' + res.error);
        }
    } catch (err: any) {
        alert('Failed to automate page creation: ' + err.message);
    }
};

(window as any).deletePage = (routeId: string, funnelId: string) => {
    if (!confirm('Are you sure? This will delete the page and its URL path.')) return;

    // 1. Remove Route
    const rIdx = mockWebsiteRoutes.findIndex(r => r.id === routeId);
    if (rIdx !== -1) mockWebsiteRoutes.splice(rIdx, 1);

    // 2. Remove Funnel
    const fIdx = mockFunnels.findIndex(f => f.id === funnelId);
    if (fIdx !== -1) mockFunnels.splice(fIdx, 1);

    (window as any).showToast('Page deleted', 2000);
    renderFunnels();
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

  // Update URL for standard CRM navigation (Hash based)
  if (!['site', 'preview'].includes(view)) {
    let newHash = id ? `#/${view}/${id}` : `#/${view}`;
    if (view === 'builder' && context?.builderContext?.pageId) {
      const builderContext = context.builderContext as BuilderContext;
      const params = new URLSearchParams();
      params.set('pageId', builderContext.pageId);
      if (builderContext.sectionId) params.set('sectionId', builderContext.sectionId);
      if (builderContext.path) params.set('path', builderContext.path);
      if (builderContext.label) params.set('label', builderContext.label);
      if (builderContext.returnTo) params.set('returnTo', builderContext.returnTo);
      if (builderContext.funnelId) params.set('funnelId', builderContext.funnelId);
      newHash = `#/builder?${params.toString()}`;
    }
    if (window.location.hash !== newHash) {
       window.history.pushState({}, "", newHash);
    }
  } else {
    // Phase W6.9: Real URLs for Public Site (No Hashes)
    let newPath = '';
    if (view === 'site') {
      newPath = id ? `/site${id.startsWith('/') ? id : '/' + id}` : '/site/';
    } else if (view === 'preview') {
      newPath = id ? `/preview/${id}` : '/preview/';
    }
    
    if (newPath && window.location.pathname !== newPath) {
      window.history.pushState({}, "", newPath);
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
    case 'funnels': renderFunnels('website'); break;
    case 'marketing-funnels': renderFunnels('marketing'); break;
    case 'website-dashboard': renderWebsiteDashboard(); break;
    case 'funnel-detail': if (id) renderFunnelDetail(id); break;
    case 'pages': renderPages(); break;
    case 'page-sections': if (id) renderPageSections(id); break;
    case 'builder': renderBuilder(); break;
    case 'templates': renderTemplates(); break;
    case 'pages-seo': renderPagesSeoLanding(); break;
    case 'components': app.innerHTML = `${renderSidebar('components')}<main class="main-content"><h2>Components Shelf</h2><div class="empty-state">Library of pre-built UI components coming soon.</div></main>`; break;
    case 'website-settings':
      try {
        const settingsRes = await fetch('/api/settings').then(r => r.json());
        if (settingsRes.success && settingsRes.data) {
          Object.assign(mockWebsiteSettings, settingsRes.data);
        }
      } catch (err) {
        console.warn('Failed to load settings on navigation:', err);
      }
      renderWebsiteSettings();
      break;
    case 'website-navigation': renderWebsiteNavigation(); break;
<<<<<<< HEAD
=======
    case 'website-dashboard': renderWebsiteDashboard(); break;
>>>>>>> TARGETED-FIX-PROMPTS-(W6-HARDENING)
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

  // Load website settings on boot to ensure persistence
  try {
    const settingsRes = await fetch('/api/settings').then(r => r.json());
    if (settingsRes.success && settingsRes.data) {
      Object.assign(mockWebsiteSettings, settingsRes.data);
    }
  } catch (err) {
    console.warn('Failed to load settings at boot:', err);
  }

  // 1. Phase W6.9: Resolve Public Website Route first (Real URLs)
  const targetPath = resolveWebsitePathFromBrowserPath(rawPath);
  if (targetPath) {
    const result = await resolveWebsiteRequest(host, targetPath);
    if (result && result.funnel_id) {
       const isPreview = rawPath === '/preview' || rawPath.startsWith('/preview/');
       const mergedContext = result.website ? {
         ...result.website,
         route: result.route,
         route_id: result.route?.id,
         path: result.route?.path || targetPath,
         slug: result.route?.slug || targetPath.replace(/^\//, ''),
         is_seo_page: result.route?.is_seo_page || targetPath !== '/',
         city: result.route?.city || '',
         service: result.route?.service || '',
         route_type: (result.route as any)?.route_type || (targetPath === '/' ? 'homepage' : 'service'),
         funnel_id: result.funnel_id || result.route?.funnel_id || '',
         page_id: result.route?.id || ''
       } : null;
       await renderSitePage(result.funnel_id, mergedContext, isPreview);
       return;
    }
  }

  // 2. Check for Admin Hash Routes (Standard CRM)
  if (window.location.hash) {
     const hashContent = window.location.hash.slice(2);
     if (hashContent) {
       const [routePart, query = ''] = hashContent.split('?');
       const parts = routePart.split('/');
       const routeContext = parts[0] === 'builder' && query
         ? { builderContext: getBuilderContextFromHash() }
         : undefined;
       (window as any).navigateTo(parts[0], parts[1], routeContext);
       return;
     }
  }

  // 3. Fallback Logic
  if (rawPath === '/' || rawPath === '/index.html' || rawPath === '') {
    // On localhost, ROOT always defaults to Dashboard to allow admin access
    if (host === 'localhost' || host === '127.0.0.1') {
       (window as any).navigateTo('dashboard');
    } else {
       // On real domains, ROOT defaults to the website homepage
       const homeResult = await resolveWebsiteRequest(host, '/');
       if (homeResult && homeResult.funnel_id) {
          await renderSitePage(homeResult.funnel_id, homeResult.website);
       } else {
          (window as any).navigateTo('dashboard');
       }
    }
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
          <label for="check-copy" style="font-size: 0.9rem; color: #92400e; cursor: pointer;">Copy your page link</label>
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

let seoWizardState = {
    mode: 'list' as 'list' | 'wizard',
    step: 1,
    services: [] as string[],
    cities: [] as string[]
};

(window as any).renderSeoPages = async () => {
    const seoPages = mockWebsiteRoutes.filter(r => r.is_seo_page);
    
    // Auto-switch to wizard if empty
    if (seoPages.length === 0 && seoWizardState.mode !== 'wizard') {
        seoWizardState.mode = 'wizard';
        seoWizardState.step = 1;
    }

    if (seoWizardState.mode === 'wizard') {
        renderSeoWizard();
        return;
    }

    app.innerHTML = `
        ${renderSidebar('seo-pages')}
        <main class="main-content">
            <header class="view-header">
                <div>
                    <h2 style="margin: 0; font-size: 1.75rem;">Local SEO Hub</h2>
                    <p style="color: #64748b; margin-top: 6px;">Target specific neighborhoods and service types to dominate local search results.</p>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button class="btn-primary" onclick="window.startSeoWizard()" style="background: #10b981; border: none; padding: 12px 24px;">+ Batch Generate Pages</button>
                </div>
            </header>

            <div class="card" style="margin-bottom: 30px; padding: 24px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #bae6fd; border-radius: 16px;">
                <div style="display: flex; gap: 24px; align-items: center;">
                    <div style="font-size: 3rem; background: white; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; border-radius: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">📈</div>
                    <div>
                        <h4 style="margin: 0; color: #0369a1; font-size: 1.25rem;">Organic Search Strategy</h4>
                        <p style="margin: 6px 0 0 0; color: #0c4a6e; font-size: 1rem; line-height: 1.5;">
                            Generated pages target <strong>Service + City</strong> combinations to capture high-intent local traffic.
                        </p>
                    </div>
                </div>
            </div>

            <div class="card" style="padding: 0; overflow: hidden; border-radius: 16px;">
                <table class="clients-table" style="box-shadow: none; border: none; margin-top: 0;">
                    <thead style="background: #f8fafc;">
                        <tr>
                            <th style="padding: 16px 24px;">Service & Region</th>
                            <th>Calculated URL Slug</th>
                            <th>Live Status</th>
                            <th style="text-align: right; padding: 16px 24px;">Management</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${seoPages.map(page => `
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 16px 24px;">
                                    <div style="font-weight: 700; color: #1e293b; font-size: 1rem;">${page.service}</div>
                                    <div style="font-size: 0.85rem; color: #64748b; font-weight: 500;">${page.city}</div>
                                </td>
                                <td>
                                    <code style="background: #f1f5f9; padding: 6px 10px; border-radius: 8px; font-size: 0.9rem; color: #475569; border: 1px solid #e2e8f0;">/${page.slug}</code>
                                </td>
                                <td>
                                    <span class="badge" style="background: #ecfdf5; color: #059669; border: 1px solid #d1fae5; padding: 4px 10px; font-size: 0.75rem; font-weight: 700;">ACTIVE</span>
                                </td>
                                <td style="text-align: right; padding: 16px 24px;">
                                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                                        <button class="btn-primary" style="background: white; color: #64748b; border: 1px solid #e2e8f0; padding: 8px 16px; font-size: 0.85rem; font-weight: 600;" onclick="window.open('/${page.slug}', '_blank')">View Live</button>
                                        <button class="btn-primary" style="background: #fff5f5; color: #ef4444; border: 1px solid #fee2e2; padding: 8px 12px;" onclick="window.deleteSeoPage('${page.id}')">
                                            <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('') || '<tr><td colspan="4" style="text-align: center; padding: 80px; color: #94a3b8;">No SEO pages found. Use the Batched Generator to get started.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </main>
    `;
};

(window as any).startSeoWizard = () => {
    seoWizardState.mode = 'wizard';
    seoWizardState.step = 1;
    (window as any).renderSeoPages();
};

function renderSeoWizard() {
    let content = '';
    const progress = (seoWizardState.step / 3) * 100;

    if (seoWizardState.step === 1) {
        content = `
            <div style="max-width: 600px; margin: 40px auto;">
                <h3 style="font-size: 1.5rem; margin-bottom: 8px;">Step 1: What services do you offer?</h3>
                <p style="color: #64748b; margin-bottom: 24px;">Enter the services you want to rank for locally. Use commas to separate them.</p>
                <textarea id="wizard-services" placeholder="e.g. Driveway Cleaning, Roof Cleaning, House Washing" style="width: 100%; height: 120px; padding: 15px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 1.1rem; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--primary-color)'">${seoWizardState.services.join(', ')}</textarea>
                <div style="margin-top: 30px; display: flex; justify-content: flex-end;">
                    <button class="btn-primary" style="padding: 12px 32px; border-radius: 12px; font-weight: 800;" onclick="window.nextSeoStep(2)">Next: Location Selection →</button>
                </div>
            </div>
        `;
    } else if (seoWizardState.step === 2) {
        content = `
            <div style="max-width: 600px; margin: 40px auto;">
                <h3 style="font-size: 1.5rem; margin-bottom: 8px;">Step 2: Where do you offer them?</h3>
                <p style="color: #64748b; margin-bottom: 24px;">Enter the cities or neighborhoods you target. Use commas to separate them.</p>
                <textarea id="wizard-cities" placeholder="e.g. Seattle, Bellevue, Kirkland, Redmond" style="width: 100%; height: 120px; padding: 15px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 1.1rem; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='var(--primary-color)'">${seoWizardState.cities.join(', ')}</textarea>
                <div style="margin-top: 30px; display: flex; justify-content: space-between;">
                    <button class="btn-outline" style="padding: 12px 24px; border-radius: 12px; font-weight: 700;" onclick="window.nextSeoStep(1)">← Back</button>
                    <button class="btn-primary" style="padding: 12px 32px; border-radius: 12px; font-weight: 800;" onclick="window.nextSeoStep(3)">Next: Preview Generation →</button>
                </div>
            </div>
        `;
    } else if (seoWizardState.step === 3) {
        const previews: string[] = [];
        seoWizardState.services.forEach(s => {
            seoWizardState.cities.forEach(c => {
                const slug = (s + '-' + c).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                previews.push(`/${slug}`);
            });
        });

        content = `
            <div style="max-width: 800px; margin: 40px auto;">
                <header style="text-align: center; margin-bottom: 40px;">
                    <h3 style="font-size: 1.75rem; margin-bottom: 12px;">Step 3: Preview Local Strategy</h3>
                    <p style="color: #64748b; font-size: 1.1rem;">We are about to generate <strong>${previews.length}</strong> targeted landing pages.</p>
                </header>

                <div class="card" style="background: #f8fafc; border: 2px dashed #e2e8f0; padding: 30px; margin-bottom: 40px;">
                    <h4 style="margin-top: 0; color: #475569; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px; margin-bottom: 15px;">URL Structure Previews</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        ${previews.slice(0, 10).map(p => `<div style="color: var(--primary-color); font-weight: 600; font-family: monospace;">${p}</div>`).join('')}
                        ${previews.length > 10 ? `<div style="color: #94a3b8; font-style: italic;">...and ${previews.length - 10} more pages</div>` : ''}
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 15px; background: #fffbeb; border: 1px solid #fde68a; padding: 20px; border-radius: 12px; margin-bottom: 40px;">
                   <div style="display: flex; gap: 12px; align-items: flex-start;">
                      <span style="font-size: 1.25rem;">💡</span>
                      <p style="margin: 0; color: #92400e; font-size: 0.95rem;"><strong>Pro Tip:</strong> These pages will automatically be added to your Sitemap and linked within your website to boost search ranking.</p>
                   </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <button class="btn-outline" style="padding: 12px 24px; border-radius: 12px; font-weight: 700;" onclick="window.nextSeoStep(2)">← Change Inputs</button>
                    <button class="btn-primary" style="padding: 15px 40px; border-radius: 12px; font-weight: 800; font-size: 1.1rem; background: #10b981; border: none; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.4);" onclick="window.finalizeSeoGen()">🚀 Generate & Go Live</button>
                </div>
            </div>
        `;
    }

    app.innerHTML = `
        ${renderSidebar('seo-pages')}
        <main class="main-content">
            <header class="view-header">
                <div>
                    <h2 style="margin: 0; font-size: 1.75rem;">Build Your Local Presence</h2>
                    <p style="color: #64748b; margin-top: 6px;">Step ${seoWizardState.step} of 3</p>
                </div>
                <div style="width: 200px; height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden; position: relative;">
                    <div style="width: ${progress}%; height: 100%; background: var(--primary-color); transition: width 0.4s ease-out;"></div>
                </div>
            </header>
            ${content}
        </main>
    `;
}

(window as any).nextSeoStep = (step: number) => {
    if (seoWizardState.step === 1 && step === 2) {
        const text = (document.getElementById('wizard-services') as HTMLTextAreaElement).value;
        seoWizardState.services = text.split(',').map(s => s.trim()).filter(s => s);
        if (seoWizardState.services.length === 0) { alert('Please enter at least one service.'); return; }
    } else if (seoWizardState.step === 2 && step === 3) {
        const text = (document.getElementById('wizard-cities') as HTMLTextAreaElement).value;
        seoWizardState.cities = text.split(',').map(c => c.trim()).filter(c => c);
        if (seoWizardState.cities.length === 0) { alert('Please enter at least one city.'); return; }
    }
    
    seoWizardState.step = step;
    (window as any).renderSeoPages();
};

(window as any).finalizeSeoGen = async () => {
    (window as any).showToast(`Broadcasting Local Authority...`, 'info');
    
    try {
        const res = await fetch('/api/websites/bulk-seo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ services: seoWizardState.services, cities: seoWizardState.cities })
        }).then(r => r.json());
        
        if (res.success) {
            (window as any).showToast(`Mission Accomplished: ${res.count} SEO pages are now live!`, 'success');
            seoWizardState.mode = 'list';
            seoWizardState.services = [];
            seoWizardState.cities = [];
            (window as any).renderSeoPages();
        } else {
            alert('Generation error: ' + res.error);
        }
    } catch (err: any) {
        alert('Exception: ' + err.message);
    }
};

function renderPagesSeoLanding() {
  app.innerHTML = `
    ${renderSidebar('pages-seo')}
    <main class="main-content">
      <header class="view-header">
        <div>
          <h2>Pages & SEO</h2>
          <p style="color: #64748b; margin-top: 4px;">Organize your site architecture, menus, and search engine optimization.</p>
        </div>
      </header>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-top: 10px;">
        <!-- Card 1: Site Pages -->
        <div class="card"
             style="padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 12px;"
             onclick="window.navigateTo('funnels')"
             onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 15px -3px rgb(0 0 0 / 0.1)'; this.style.borderColor='var(--primary-color)'"
             onmouseout="this.style.transform='none'; this.style.boxShadow='none'; this.style.borderColor='#e2e8f0'">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: #eff6ff; color: #3b82f6; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">📄</div>
            <h3 style="margin: 0; font-size: 1.15rem; color: #1e293b;">Site Pages</h3>
          </div>
          <p style="margin: 0; color: #64748b; font-size: 0.9rem; line-height: 1.5;">
            Manage your main website pages and landing pages.
          </p>
          <div style="margin-top: auto; color: var(--primary-color); font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 4px;">
            Manage Pages ➔
          </div>
        </div>

        <!-- Card 2: Local Service Pages -->
        <div class="card"
             style="padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 12px;"
             onclick="window.navigateTo('seo-pages')"
             onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 15px -3px rgb(0 0 0 / 0.1)'; this.style.borderColor='var(--primary-color)'"
             onmouseout="this.style.transform='none'; this.style.boxShadow='none'; this.style.borderColor='#e2e8f0'">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: #f0fdf4; color: #22c55e; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">🔍</div>
            <h3 style="margin: 0; font-size: 1.15rem; color: #1e293b;">Local Service Pages</h3>
          </div>
          <p style="margin: 0; color: #64748b; font-size: 0.9rem; line-height: 1.5;">
            Create specialized pages to help your business rank higher on Google in the cities and services you cover.
          </p>
          <div style="margin-top: auto; color: var(--primary-color); font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 4px;">
            Manage Local Service Pages ➔
          </div>
        </div>

        <!-- Card 3: Site Structure -->
        <div class="card"
             style="padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 12px;"
             onclick="window.navigateTo('website-structure')"
             onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 15px -3px rgb(0 0 0 / 0.1)'; this.style.borderColor='var(--primary-color)'"
             onmouseout="this.style.transform='none'; this.style.boxShadow='none'; this.style.borderColor='#e2e8f0'">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: #faf5ff; color: #a855f7; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">🌐</div>
            <h3 style="margin: 0; font-size: 1.15rem; color: #1e293b;">Site Structure</h3>
          </div>
          <p style="margin: 0; color: #64748b; font-size: 0.9rem; line-height: 1.5;">
            Review how your website pages and routes are organized.
          </p>
          <div style="margin-top: auto; color: var(--primary-color); font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 4px;">
            Manage Structure ➔
          </div>
        </div>

        <!-- Card 4: Navigation -->
        <div class="card"
             style="padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 12px;"
             onclick="window.navigateTo('website-navigation')"
             onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 15px -3px rgb(0 0 0 / 0.1)'; this.style.borderColor='var(--primary-color)'"
             onmouseout="this.style.transform='none'; this.style.boxShadow='none'; this.style.borderColor='#e2e8f0'">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: #fff7ed; color: #f97316; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">🗺️</div>
            <h3 style="margin: 0; font-size: 1.15rem; color: #1e293b;">Navigation</h3>
          </div>
          <p style="margin: 0; color: #64748b; font-size: 0.9rem; line-height: 1.5;">
            Manage website menus and visitor navigation.
          </p>
          <div style="margin-top: auto; color: var(--primary-color); font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 4px;">
            Manage Navigation ➔
          </div>
        </div>
      </div>
    </main>
  `;
}

(window as any).deleteSeoPage = async (routeId: string) => {
    if (!confirm('Are you sure you want to delete this SEO page? It will be removed from your public website instantly.')) return;
    
    try {
        const res = await fetch(`/api/websites/routes/${routeId}`, { method: 'DELETE' }).then(r => r.json());
        if (res.success) {
            (window as any).showToast('SEO page removed successfully.');
            (window as any).renderSeoPages();
        } else {
            alert('Removal failed: ' + res.error);
        }
    } catch (err: any) {
        alert('Error: ' + err.message);
    }
};

