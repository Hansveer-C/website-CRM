import { mockContacts, mockOpportunities, mockPipelines, mockActivities, mockQuotes, mockQuoteItems, mockInvoices, mockPages, mockPageSections, mockComponents, mockMedia, mockWebsiteSettings } from './db';
import { templates } from './templates';
import { Activity } from './types';
import { normalizePhone, normalizeEmail, normalizeName } from './utils/validators';

/**
 * 🌐 FRONTEND API BRIDGE
 * These stubs replace direct backend function calls to prevent credential leakage.
 * These utilize regional mock data (db.ts) to maintain UI functionality without direct DB access.
 */
const getWebsiteSettings = () => mockWebsiteSettings;
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
            const { createLeadApi } = await import('./crm_api');
            const response: any = await createLeadApi(reqContext);
            const responseData = response.data || response;
            return new Response(JSON.stringify(responseData), { 
                status: response.status || 201,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url === '/api/contacts' && method === 'GET') {
            const { getContacts } = await import('./contacts_api');
            const response: any = await getContacts(reqContext);
            const responseData = response.data || response;
            return new Response(JSON.stringify(responseData), { 
                status: response.status || 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.startsWith('/api/contacts/') && url.endsWith('/timeline') && method === 'GET') {
            const { getContactTimelineApi } = await import('./crm_api');
            const id = url.split('/')[3];
            const response: any = await getContactTimelineApi(reqContext, id);
            const responseData = response.data || response;
            return new Response(JSON.stringify(responseData), { 
                status: response.status || 200, 
                headers: { 'Content-Type': 'application/json' } 
            });
        }

        if (url.startsWith('/api/contacts/') && method === 'GET') {
            const { getContactApi } = await import('./crm_api');
            const id = url.split('/')[3];
            const response: any = await getContactApi(reqContext, id);
            const responseData = response.data || response;
            return new Response(JSON.stringify(responseData), { 
                status: response.status || 200, 
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
          
          <div class="nav-group-title">Websites</div>
          <li onclick="window.navigateTo('pages')" class="${activeView === 'pages' || activeView === 'page-sections' ? 'active' : ''}">Pages</li>
          <li onclick="window.navigateTo('templates')" class="${activeView === 'templates' ? 'active' : ''}">Templates</li>
          <li onclick="window.navigateTo('components')" class="${activeView === 'components' ? 'active' : ''}">Components</li>
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

(window as any).triggerAutoSave = () => {
  isAutoSaving = true;
  const indicator = document.getElementById('pb-autosave-indicator');
  if (indicator) {
    indicator.innerHTML = `<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #ffc107; box-shadow: 0 0 5px #ffc107;"></span> Saving...`;
  }
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    isAutoSaving = false;
    const page = mockPages.find(p => p.id === builderPageId);
    if (page) (page as any).updated_at = new Date().toISOString();
    const ind = document.getElementById('pb-autosave-indicator');
    if (ind) {
      ind.innerHTML = `<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #28a745;"></span> Saved`;
    }
  }, 1000);
};

// Builder Rendering Logic
let builderRightPanelTab: 'content' | 'styles' = 'content';
(window as any).setBuilderTab = (tab: 'content' | 'styles') => {
  builderRightPanelTab = tab;
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
      <header style="background: #111; border-bottom: 1px solid #333; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 100; flex-shrink: 0; height: 60px; box-sizing: border-box;">
        <div style="display: flex; align-items: center; gap: 15px;">
          <button class="btn-primary" style="background: transparent; border: 1px solid #333; color: #888; padding: 6px 12px; font-size: 0.8rem;" onclick="window.navigateTo('pages')">← Back to List</button>
          <input type="text" value="${page.name}" onchange="window.updatePageName('${page.id}', this.value)" style="background: transparent; border: 1px solid transparent; color: white; font-size: 1.1rem; font-weight: 600; padding: 4px 8px; border-radius: 4px; transition: border-color 0.2s; outline: none; width: 300px;" onfocus="this.style.borderColor='#333'; this.style.background='#000'" onblur="this.style.borderColor='transparent'; this.style.background='transparent'" title="Edit Page Name">
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span id="pb-autosave-indicator" style="color: #888; font-size: 0.8rem; margin-right: 15px; display: flex; align-items: center; gap: 6px; font-weight: 600;">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${isAutoSaving ? '#ffc107' : '#28a745'}; box-shadow: ${isAutoSaving ? '0 0 5px #ffc107' : 'none'};"></span> ${isAutoSaving ? 'Saving...' : 'Saved'}
          </span>
          <button class="btn-primary" style="background: #28a745; border: none; padding: 6px 15px; font-size: 0.85rem;" onclick="window.savePageSections()">Save</button>
          <button class="btn-primary" style="background: #222; border: 1px solid #444; padding: 6px 15px; font-size: 0.85rem;" onclick="window.navigateTo('preview', '${page.slug}')">Preview</button>
          <div style="width: 1px; height: 20px; background: #333; margin: 0 5px;"></div>
          <button class="btn-primary" style="background: ${page.status === 'published' ? '#ea580c' : 'var(--primary-color)'}; padding: 6px 15px; font-size: 0.85rem;" onclick="window.togglePublishFromBuilder('${page.id}')">${page.status === 'published' ? 'Unpublish' : 'Publish'}</button>
        </div>
      </header>
      <div class="pb-layout" style="flex: 1;">
        <!-- Left Panel: Navigator & Components -->
        <aside class="pb-left-panel">
          <div class="pb-panel-header">
            <h3>Library</h3>
            <span style="font-size: 0.7rem; background: #333; padding: 2px 6px; border-radius: 4px; color: #888;">${mockComponents.length} Assets</span>
          </div>
          
          <div class="pb-component-list">
            ${[
      { title: 'Basic', types: ['text', 'button', 'image'], icon: '📄' },
      { title: 'Layout', types: ['hero', 'section'], icon: '🖼️' },
      { title: 'Forms', types: ['form'], icon: '📝' },
      { title: 'Advanced', types: ['cta', 'pricing', 'testimonial'], icon: '⚡' }
    ].map(cat => `
              <div style="font-size: 0.7rem; color: #888; margin: ${cat.title === 'Basic' ? '0 0 12px 0' : '24px 0 12px 0'}; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">${cat.title}</div>
              ${mockComponents.filter(c => cat.types.includes(c.type)).map(comp => `
                <div class="pb-component-item" onclick="window.addSectionToPage('${comp.id}')">
                  <div class="pb-component-icon">${cat.icon}</div>
                  <div>
                    <div style="font-weight: 600; font-size: 0.8rem; color: white;">${comp.name}</div>
                  </div>
                </div>
              `).join('')}
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
          
          <div class="pb-canvas-inner" style="padding-top: 25px;">
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
                        <button title="Add section below" onclick="event.stopPropagation(); window.showComponentPickerAt('${order}')" style="background: #28a745; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-weight: 600;">+ Add</button>
                        <button title="Duplicate section" onclick="event.stopPropagation(); window.duplicateBuilderSection('${section.id}')" style="background: #ffc107; color: #000; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-weight: 600;">Copy</button>
                        <button title="Move Up" onclick="event.stopPropagation(); window.moveSection('${section.id}', -1)" style="background: #333; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-weight: 600;">↑</button>
                        <button title="Move Down" onclick="event.stopPropagation(); window.moveSection('${section.id}', 1)" style="background: #333; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-weight: 600;">↓</button>
                        <button title="Delete section" onclick="event.stopPropagation(); window.removeSection('${section.id}')" style="background: #dc3545; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-weight: 600;">Delete</button>
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

function renderSectionPreviewContent(section: any) {
  const content = section.content;
  switch (section.type) {
    case 'hero':
      return `
        <h1 style="font-size: 3rem; margin-bottom: 1.5rem; font-weight: 800;">${content.heading || content.title || 'Hero Heading'}</h1>
        <p style="font-size: 1.5rem; opacity: 0.9; margin-bottom: 2.5rem; max-width: 600px; margin-left: ${section.styles.text_alignment === 'center' ? 'auto' : '0'}; margin-right: ${section.styles.text_alignment === 'center' ? 'auto' : '0'};">${content.subheading || content.subtitle || 'Hero Subheading'}</p>
        <button class="btn-primary" style="padding: 15px 30px; font-size: 1.1rem; border-radius: 50px;">${content.button_text || content.buttonText || 'Action'}</button>
      `;
    case 'text':
      return `<div style="line-height: 1.6; font-size: ${section.styles.font_size || 'inherit'}">${content.text || 'Text content goes here...'}</div>`;
    case 'image':
      return `<img src="${content.image_url || content.url}" alt="Image" style="width: 100%; height: auto; border-radius: inherit;">`;
    case 'form':
      return `
        <h3 style="margin-bottom: 20px; color: var(--primary-color);">${content.title || 'Contact Form'}</h3>
        <div style="display: flex; flex-direction: column; gap: 15px;">
          ${(content.fields || []).map((f: string) => `
            <div class="form-group" style="margin-bottom: 0;">
              <input type="${f === 'email' ? 'email' : 'text'}" 
                     id="pf-${f}-${section.id}" 
                     placeholder="Your ${f.charAt(0).toUpperCase() + f.slice(1)}" 
                     style="padding: 12px; border: 1px solid #cbd5e0; border-radius: 6px; width: 100%; focus: border-color: var(--primary-color);">
            </div>
          `).join('')}
          <button class="btn-primary" 
                  style="padding: 14px; font-weight: 700; margin-top: 10px;" 
                  onclick="window.submitBuilderForm('${section.id}')">
            Submit Request
          </button>
        </div>
      `;
    case 'button':
      const sizeMap: any = { small: '8px 16px', medium: '12px 24px', large: '16px 32px' };
      return `<button class="btn-primary" style="background: ${section.styles.color || 'var(--primary-color)'}; padding: ${sizeMap[section.styles.size] || '12px 24px'}" onclick="alert('Link: ${content.link}')">${content.label || content.text || 'Click Here'}</button>`;
    default:
      return `<pre>${JSON.stringify(content, null, 2)}</pre>`;
  }
}

// Global functions for Builder interaction
(window as any).switchBuilderPage = (id: string, noSkeleton = false) => {
  builderPageId = id;
  builderSelectedSectionId = null;
  builderInsertOrder = null;

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

(window as any).addSectionToPage = (componentId: string) => {
  const component = mockComponents.find(c => c.id === componentId);
  if (!component) return;

  const currentSections = mockPageSections.filter(s => s.page_id === builderPageId);
  let orderToInsertAt = 0;

  if (builderInsertOrder !== null) {
    orderToInsertAt = builderInsertOrder;
    builderInsertOrder = null; // reset
  } else {
    orderToInsertAt = Math.max(...currentSections.map(s => s.order), 0) + 1;
  }

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
  (window as any).navigateTo('builder');
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

(window as any).showToast = (message: string) => {
  const toast = document.createElement('div');
  toast.innerText = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #111;
    color: #fff;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    z-index: 10000;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    border: 1px solid #333;
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

(window as any).savePageSections = () => {
  (window as any).showToast('Page saved');
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

  try {
    const res = await createLead({
      name: nameInput?.value || '',
      phone: phoneInput?.value,
      email: emailInput?.value,
      address: addressInput?.value,
      service_type: serviceInput?.value,
      message: messageInput?.value,
      source: 'website'
    });

    console.log("Lead created:", res);
    alert('Thanks! We’ve received your request.');

    // Clear form
    [nameInput, phoneInput, emailInput, addressInput, serviceInput, messageInput].forEach(el => {
      if (el) el.value = '';
    });

  } catch (error: any) {
    console.error("Lead submission failed:", error);
    alert('Something went wrong. Please try again.');
  }
};

function renderSitePage(slug: string, isPreview: boolean = false) {
  const page = mockPages.find(p => p.slug === slug);
  if (!page || (!isPreview && page.status !== 'published')) {
    app.innerHTML = `<div style="padding: 100px; text-align: center; font-family: sans-serif;">
      <h1 style="font-size: 4rem; color: #cbd5e0;">404</h1>
      <h2 style="margin-bottom: 20px;">${!page ? 'Page Not Found' : 'Draft Page'}</h2>
      <p style="color: #666; margin-bottom: 30px;">
        ${!page
        ? `The requested URL "/site/${slug}" was not found.`
        : 'This page is currently a draft and is not publicly accessible.'}
      </p>
      <button class="btn-primary" onclick="window.navigateTo('dashboard')">Back to CRM</button>
    </div>`;
    return;
  }

  const settings = getWebsiteSettings();
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
    <div class="public-site" style="min-height: 100vh; background: white; font-family: 'Inter', sans-serif;">
      ${isPreview ? `<div style="background: #fdf2f2; color: #dc2626; padding: 10px; text-align: center; font-weight: 700; border-bottom: 1px solid #fee2e2;">PREVIEW MODE: You are viewing a draft version of "${page.name}"</div>` : ''}
      
      <!-- Site Header with Global Info -->
      <header style="padding: 20px 40px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: rgba(255,255,255,0.9); backdrop-filter: blur(8px); z-index: 100;">
        <div style="display: flex; align-items: center; gap: 15px;">
           ${settings.logo_url ? `<img src="${settings.logo_url}" style="height: 40px; width: 40px; border-radius: 8px; object-fit: cover;">` : ''}
           <span style="font-weight: 800; font-size: 1.25rem; color: #1e293b;">${settings.business_name}</span>
        </div>
        <div>
           <a href="tel:${settings.phone}" style="color: var(--primary-color); font-weight: 700; text-decoration: none;">📞 ${settings.phone}</a>
        </div>
      </header>

      ${sections.map(section => {
    // Inject global variables into section content if needed
    const content = { ...section.content, business_name: settings.business_name, phone: settings.phone };
    return renderSection(section.type, content, section.styles, section.id);
  }).join('')}
      
      ${!isPreview ? `
        <button id="sticky-cta" onclick="document.querySelector('.site-form-section')?.scrollIntoView({behavior: 'smooth'})" 
          style="position: fixed; bottom: 25px; right: 25px; z-index: 9999; background: var(--primary-color); color: white; border: none; padding: 16px 32px; border-radius: 50px; font-weight: 700; box-shadow: 0 12px 30px rgba(0,0,0,0.25); cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 1.1rem; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);"
          onmouseover="this.style.transform='scale(1.1) translateY(-5px)'; this.style.boxShadow='0 15px 35px rgba(0,0,0,0.3)';"
          onmouseout="this.style.transform='scale(1) translateY(0)'; this.style.boxShadow='0 12px 30px rgba(0,0,0,0.25)';">
          <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          Get Quote
        </button>
      ` : ''}

      <!-- Public Footer -->
      <footer style="padding: 40px; text-align: center; background: #f8fafc; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 0.9rem;">
        <p>&copy; 2026 ${mockGlobalSettings.businessName}. Built with Hansveer CRM Website Builder.</p>
        <button onclick="window.navigateTo('dashboard')" style="margin-top: 20px; background: none; border: 1px solid #cbd5e0; padding: 5px 15px; border-radius: 4px; cursor: pointer; color: #64748b;">Admin Login</button>
      </footer>
    </div>
  `;

  const finalTitle = mockGlobalSettings.seoTitleFormat
    .replace('{page_name}', page.seo_title || page.name)
    .replace('{business_name}', mockGlobalSettings.businessName);
  document.title = finalTitle;
  updateMetaTag('description', page.seo_description || mockGlobalSettings.seoDescriptionFallback);
  updateMetaTag('keywords', (page.seo_keywords || []).join(', '));

  if (mockGlobalSettings.fbPixelId) {
    if (!document.getElementById('fb-pixel-sim')) {
      console.log('Injecting FB Pixel: ' + mockGlobalSettings.fbPixelId);
      const t = document.createElement('script');
      t.id = 'fb-pixel-sim';
      t.innerHTML = `console.log("FB Pixel [${mockGlobalSettings.fbPixelId}] Initialized"); window.fbq = function() { console.log('fbq:', arguments); };`;
      document.head.appendChild(t);
    }
  }
  if (mockGlobalSettings.gtmId) {
    if (!document.getElementById('gtm-sim')) {
      console.log('Injecting GTM: ' + mockGlobalSettings.gtmId);
      const t = document.createElement('script');
      t.id = 'gtm-sim';
      t.innerHTML = `console.log("GTM [${mockGlobalSettings.gtmId}] Initialized"); window.dataLayer = window.dataLayer || [];`;
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
        <div class="site-form-section" style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); color: #333; text-align: left;">
          <h3 style="margin-bottom: 25px; font-size: 1.75rem; text-align: center;">${content.title || 'Contact Us'}</h3>
          <div style="display: flex; flex-direction: column; gap: 20px;">
            ${(content.fields || []).map((f: string) => {
        if (f === 'message') {
          return `
                  <div class="form-group">
                    <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 0.9rem; color: #666;">Message</label>
                    <textarea id="site-f-${f}-${id}" placeholder="Your message" style="padding: 14px; border: 1px solid #e2e8f0; border-radius: 8px; width: 100%; min-height: 100px; font-family: inherit; font-size: 1rem;"></textarea>
                  </div>
                `;
        }
        if (f === 'service_type') {
          return `
                  <div class="form-group">
                    <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 0.9rem; color: #666;">Service Type</label>
                    <select id="site-f-${f}-${id}" style="padding: 14px; border: 1px solid #e2e8f0; border-radius: 8px; width: 100%; background: white; font-family: inherit; font-size: 1rem;">
                        <option value="Residential">Residential Cleaning</option>
                        <option value="Commercial">Commercial Washing</option>
                        <option value="Roof/Gutter">Roof & Gutter</option>
                        <option value="Other">Other Service</option>
                    </select>
                  </div>
                `;
        }
        return `
                <div class="form-group">
                  <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 0.9rem; color: #666;">${f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')}</label>
                  <input type="${f === 'email' ? 'email' : f === 'phone' ? 'tel' : 'text'}" id="site-f-${f}-${id}" placeholder="Your ${f.replace('_', ' ')}" style="padding: 14px; border: 1px solid #e2e8f0; border-radius: 8px; width: 100%; font-family: inherit; font-size: 1rem;">
                </div>
              `;
      }).join('')}
            <button class="btn-primary" style="padding: 16px; margin-top: 10px; font-size: 1.1rem;" onclick="window.submitBuilderForm('${id}', true)">Send Message</button>
          </div>
        </div>
      `;
    case 'button':
      const sizeMap: any = { small: '10px 20px', medium: '15px 35px', large: '20px 50px' };
      return `<a href="${content.link || '#'}" class="btn-primary" style="display: inline-block; text-decoration: none; background: ${styles.color || 'var(--primary-color)'}; padding: ${sizeMap[styles.size] || '15px 35px'}; border-radius: 8px; font-weight: 600; text-align: center;">${content.label || 'Click Here'}</a>`;
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

  (window as any).updateSettingsField = (field: string, value: string) => {
    const s = getWebsiteSettings(); (s as any)[field] = value; require('./website_settings_repo').persistWebsiteSettings(s);
    renderWebsiteSettings();
    console.log('Settings updated:', field, value);
  };
}

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

(window as any).navigateTo = (view: string, id?: string) => {
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
    setTimeout(() => executeNavigation(view, id), 350);
  } else {
    executeNavigation(view, id);
  }
};

function executeNavigation(view: string, id?: string) {
  if (view === 'dashboard') renderDashboard();
  if (view === 'clients') renderClients();
  if (view === 'opportunities') renderOpportunities();
  if (view === 'quotes') renderQuotes();
  if (view === 'new-quote') renderNewQuote();
  if (view === 'invoices') renderInvoices();
  if (view === 'lead-capture') renderLeadCapture();
  if (view === 'builder') renderBuilder();
  if (view === 'reports') renderReports();
  if (view === 'event-logs') renderEventLogs();
  if (view === 'pages') renderPages();
  if (view === 'page-sections' && id) renderPageSections(id);
  if (view === 'components') renderComponents();
  if (view === 'templates') renderTemplates();
  if (view === 'website-settings') renderWebsiteSettings();
  if (view === 'quickstart') renderQuickstart();
  if (view === 'qa-tools') renderQATools();
  if (view === 'quote-preview' && id) renderQuotePreview(id);
  if (view === 'contact-detail' && selectedContactId) renderContactDetail(selectedContactId);
  if (view === 'site' && id) renderSitePage(id);
  if (view === 'preview' && id) renderSitePage(id, true);

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

// Basic Path Routing
const path = window.location.pathname;

if (path.includes('/site/')) {
  const slug = path.split('/site/')[1];
  (window as any).navigateTo('site', slug);
} else if (path.includes('/preview/')) {
  const slug = path.split('/preview/')[1];
  (window as any).navigateTo('preview', slug);
} else {
  renderDashboard();
}

// Auto-refresh Sidebar Counts & New Lead Alerts (PROMPT 8, 9, 10)
setInterval(() => {
  let changeDetected = false;

  // 1. Detect New Leads (Global Alert)
  if (mockContacts.length > lastContactCount) {
    const diff = mockContacts.length - lastContactCount;
    (window as any).showToast(diff === 1 ? 'New lead received' : `${diff} new leads received`);
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
      if (currentView === 'dashboard') renderDashboard();
    }
  }
}, 30000);
