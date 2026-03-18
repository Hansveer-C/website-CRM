import { templates, WebsiteTemplate, BuilderBlock } from './templates';
import { mockContacts, mockOpportunities, mockPipelines, mockActivities, mockQuotes, mockQuoteItems, mockInvoices, mockPages, mockPageSections, mockComponents } from './db';
import { Activity } from './types';
import { runAutomations, checkOverdueInvoices } from './automation';

const app = document.querySelector<HTMLDivElement>('#app')!;

// State Management
let currentView: string = 'dashboard';
let currentTemplate: WebsiteTemplate = templates[0];
let canvasBlocks: BuilderBlock[] = [...currentTemplate.blocks];

// Filter & Selection State
let clientSearchQuery: string = '';
let clientStatusFilter: string = 'all';
let selectedContactId: string | null = null;
let invoiceStatusFilter: string = 'all';

// New Quote State
let newQuoteLineItems: { service: string, description: string, quantity: number, price: number, tier: 'basic' | 'standard' | 'premium' }[] = [
  { service: '', description: '', quantity: 1, price: 0, tier: 'basic' }
];
(window as any).newQuoteLineItems = newQuoteLineItems;
let newQuoteContactId: string = '';
(window as any).newQuoteContactId = newQuoteContactId;
let newQuoteOpportunityId: string = '';
(window as any).newQuoteOpportunityId = newQuoteOpportunityId;

function renderSidebar(activeView: string) {
  return `
    <div class="sidebar">
      <h1>PressurePro</h1>
      <nav>
        <ul>
          <li onclick="window.navigateTo('dashboard')" class="${activeView === 'dashboard' ? 'active' : ''}">Dashboard</li>
          <li onclick="window.navigateTo('clients')" class="${activeView === 'clients' ? 'active' : ''}">Clients & Leads</li>
          <li onclick="window.navigateTo('opportunities')" class="${activeView === 'opportunities' ? 'active' : ''}">Opportunities</li>
          <li onclick="window.navigateTo('quotes')" class="${activeView === 'quotes' ? 'active' : ''}">Quotes</li>
          <li onclick="window.navigateTo('invoices')" class="${activeView === 'invoices' ? 'active' : ''}">Invoices</li>
          <li onclick="window.navigateTo('lead-capture')" class="${activeView === 'lead-capture' ? 'active' : ''}">Lead Capture</li>
          <li onclick="window.navigateTo('builder')" class="${activeView === 'builder' ? 'active' : ''}">Website Builder</li>
          <li onclick="window.navigateTo('reports')" class="${activeView === 'reports' ? 'active' : ''}">Reports & Insights</li>
          <li onclick="window.navigateTo('pages')" class="${activeView === 'pages' || activeView === 'page-sections' ? 'active' : ''}">Pages</li>
          <li onclick="window.navigateTo('components')" class="${activeView === 'components' ? 'active' : ''}">Components</li>
          <li onclick="window.navigateTo('quickstart')" class="${activeView === 'quickstart' ? 'active' : ''}">Quickstart Guide</li>
          <li>Payments</li>
          <li>Settings</li>
        </ul>
      </nav>
    </div>
  `;
}

function renderDashboard() {
  const now = new Date();
  
  // Top Level Metrics
  const openOpportunities = mockOpportunities.filter(o => o.status === 'open');
  const pipelineValue = openOpportunities.reduce((sum, o) => sum + o.value, 0);
  const openCount = openOpportunities.length;
  
  const totalCount = mockOpportunities.length;
  const wonCount = mockOpportunities.filter(o => o.status === 'won').length;
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

function renderClients() {
  const filteredContacts = mockContacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) || 
                         contact.phone.includes(clientSearchQuery);
    const matchesFilter = clientStatusFilter === 'all' || contact.status === clientStatusFilter;
    return matchesSearch && matchesFilter;
  });

  const tableRows = filteredContacts.map(contact => {
    const lastActivity = mockActivities
      .filter(a => a.contact_id === contact.id)
      .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())[0];
    
    return `
      <tr onclick="window.navigateTo('contact-detail', '${contact.id}')" style="cursor: pointer;">
        <td style="font-weight: 600; color: var(--primary-color);">${contact.name}</td>
        <td>${contact.phone}</td>
        <td><span class="badge badge-${contact.status}">${contact.status}</span></td>
        <td><span style="font-size: 0.85rem; color: #666;">${contact.source}</span></td>
        <td>${lastActivity ? new Date(lastActivity.due_date).toLocaleDateString() : 'No activity'}</td>
        <td><button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="event.stopPropagation(); window.navigateTo('contact-detail', '${contact.id}')">View</button></td>
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

(window as any).filterClients = (status: string) => {
  clientStatusFilter = status;
  renderClients();
};

// Builder Rendering Logic
function renderBuilder() {
  app.innerHTML = `
    ${renderSidebar('builder')}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; align-items: center; gap: 20px;">
          <h2>Website Builder</h2>
          <select id="template-select" style="padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
            ${templates.map(t => `<option value="${t.id}" ${t.id === currentTemplate.id ? 'selected' : ''}>${t.name}</option>`).join('')}
          </select>
        </div>
        <div>
          <button class="btn-primary" style="background-color: var(--secondary-color); margin-right: 10px;">Preview</button>
          <button class="btn-primary">Publish Website</button>
        </div>
      </header>
      <div class="builder-container">
        <div class="builder-sidebar">
          <h4>Add Elements</h4>
          <div class="draggable-item" data-type="hero">Hero Block</div>
          <div class="draggable-item" data-type="services">Services Block</div>
          <div class="draggable-item" data-type="contact">Contact Block</div>
          <div class="draggable-item" data-type="gallery">Gallery Block</div>
          <div class="draggable-item" data-type="trust">Trust Block</div>
        </div>
        <div class="builder-canvas" id="canvas">
          ${renderCanvasBlocks()}
        </div>
      </div>
    </main>
  `;

  // Attach event listeners
  document.getElementById('template-select')?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value;
    const template = templates.find(t => t.id === val);
    if (template) {
      currentTemplate = template;
      canvasBlocks = [...template.blocks];
      renderBuilder();
    }
  });

  // Attach drag listeners to draggable items
  document.querySelectorAll('.draggable-item').forEach(item => {
    item.addEventListener('click', () => {
      const type = item.getAttribute('data-type') as any;
      (window as any).addBlock(type);
    });
  });
}

function renderCanvasBlocks() {
  if (canvasBlocks.length === 0) {
    return `<div class="canvas-section" style="border: 2px dashed #007bff; background: #f0f7ff;">
              <p style="color: #007bff;">Click an element to add it here</p>
            </div>`;
  }

  return canvasBlocks.map((block, index) => {
    let content = '';
    switch (block.type) {
      case 'hero':
        content = `
          <div class="canvas-hero" style="background: linear-gradient(135deg, ${currentTemplate.theme.primary}, ${currentTemplate.theme.secondary});">
            <h1>${block.data.title}</h1>
            <p>${block.data.subtitle}</p>
            <button class="btn-primary" style="background: white; color: ${currentTemplate.theme.primary}; margin-top: 20px;">${block.data.buttonText}</button>
          </div>
        `;
        break;
      case 'services':
        content = `
          <div class="canvas-section">
            <h3>${block.data.title}</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
              ${block.data.items.map((i: string) => `<div style="padding: 10px; border: 1px solid #eee; border-radius: 4px;">${i}</div>`).join('')}
            </div>
          </div>
        `;
        break;
      case 'contact':
        content = `
          <div class="canvas-section">
            <h3>${block.data.title}</h3>
            <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 10px; max-width: 400px; margin-left: auto; margin-right: auto;">
              <input type="text" placeholder="Name" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
              <input type="email" placeholder="Email" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
              <button class="btn-primary" style="background: ${currentTemplate.theme.primary}">Send Quote Request</button>
            </div>
          </div>
        `;
        break;
      case 'gallery':
        content = `
          <div class="canvas-section">
            <h3>${block.data.title}</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 20px;">
              ${block.data.images.map((img: string) => `<div style="height: 100px; background: #eee; border-radius: 4px; display: flex; align-items: center; justify-content: center;">${img}</div>`).join('')}
            </div>
          </div>
        `;
        break;
      case 'trust':
        content = `
          <div class="canvas-section">
            <h3>${block.data.title}</h3>
            <div style="display: flex; justify-content: center; gap: 30px; margin-top: 20px; opacity: 0.6;">
              ${(block.data.logos || []).map((l: string) => `<strong>${l}</strong>`).join('')}
              ${(block.data.testimonials || []).map((t: any) => `<div><p>"${t.text}"</p><small>- ${t.name}</small></div>`).join('')}
            </div>
          </div>
        `;
        break;
    }

    return `
      <div class="block-wrapper" style="position: relative; width: 100%;">
        <div style="position: absolute; right: -40px; top: 0; display: flex; flex-direction: column; gap: 5px;">
           <button onclick="window.removeBlock(${index})" style="background: #ff4444; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer;">×</button>
           <button onclick="window.moveBlock(${index}, -1)" style="background: #eee; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">↑</button>
           <button onclick="window.moveBlock(${index}, 1)" style="background: #eee; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">↓</button>
        </div>
        ${content}
      </div>
    `;
  }).join('');
}

// Global functions for block manipulation
(window as any).addBlock = (type: any) => {
  const newBlock: BuilderBlock = {
    id: Date.now().toString(),
    type,
    data: getInitialData(type)
  };
  canvasBlocks.push(newBlock);
  renderBuilder();
};

(window as any).removeBlock = (index: number) => {
  canvasBlocks.splice(index, 1);
  renderBuilder();
};

(window as any).moveBlock = (index: number, direction: number) => {
  const newIndex = index + direction;
  if (newIndex >= 0 && newIndex < canvasBlocks.length) {
    const temp = canvasBlocks[index];
    canvasBlocks[index] = canvasBlocks[newIndex];
    canvasBlocks[newIndex] = temp;
    renderBuilder();
  }
};

function getInitialData(type: string) {
  switch (type) {
    case 'hero': return { title: 'Insert Title', subtitle: 'Insert Subtitle', buttonText: 'Click Me' };
    case 'services': return { title: 'Our Services', items: ['Service 1', 'Service 2', 'Service 3'] };
    case 'contact': return { title: 'Get In Touch' };
    case 'gallery': return { title: 'Our Work', images: ['Image 1', 'Image 2', 'Image 3'] };
    case 'trust': return { title: 'What Clients Say', testimonials: [{ name: 'John D.', text: 'Great Job!' }] };
    default: return {};
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

function renderPages() {
  const tableRows = mockPages.map(page => `
    <tr>
      <td style="font-weight: 600; color: var(--primary-color);">${page.name}</td>
      <td><code>/${page.slug}</code></td>
      <td><span class="badge badge-${page.status}">${page.status}</span></td>
      <td>
        <div style="font-size: 0.85rem; color: #666; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${page.seo_title}">
          ${page.seo_title}
        </div>
      </td>
      <td style="text-align: center;">
        <span class="badge" style="background: #eef2f6; color: #333;">${mockPageSections.filter(s => s.page_id === page.id).length}</span>
      </td>
      <td>
        <div style="display: flex; gap: 5px;">
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="window.navigateTo('page-sections', '${page.id}')">Sections</button>
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="alert('Edit Page: ${page.name}')">Edit</button>
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #6c757d;" onclick="alert('SEO Settings for: ${page.name}')">SEO</button>
        </div>
      </td>
    </tr>
  `).join('');

  app.innerHTML = `
    ${renderSidebar('pages')}
    <main class="main-content">
      <header class="view-header">
        <h2>Website Pages</h2>
        <button class="btn-primary" onclick="alert('Create New Page logic would go here')">+ New Page</button>
      </header>

      <div class="card" style="padding: 0; overflow: hidden;">
        <table class="clients-table" style="box-shadow: none; margin-top: 0;">
          <thead>
            <tr>
              <th>Page Name</th>
              <th>Slug</th>
              <th>Status</th>
              <th>SEO Title</th>
              <th>Sections</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;">No pages found</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="stats-grid" style="margin-top: 30px;">
        <div class="card">
          <h3>Collection: Pages</h3>
          <p style="color: #666; margin-bottom: 15px;">Schema defined with the following fields:</p>
          <ul style="list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>id</strong>: auto (string)</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>name</strong>: string</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>slug</strong>: string (unique)</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>status</strong>: draft | published</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>seo_title</strong>: string</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>seo_description</strong>: text</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>seo_keywords</strong>: array</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>created_at</strong>: timestamp</li>
          </ul>
        </div>
        <div class="card">
          <h3>Collection: PageSections</h3>
          <p style="color: #666; margin-bottom: 15px;">Schema defined with the following fields:</p>
          <ul style="list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>id</strong>: auto (string)</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>page_id</strong>: relation to Pages</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>type</strong>: string (hero, text, etc.)</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>content</strong>: JSON</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>order</strong>: number</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>styles</strong>: JSON</li>
          </ul>
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
  const tableRows = mockComponents.map(comp => `
    <tr>
      <td style="font-weight: 600; color: var(--primary-color);">${comp.name}</td>
      <td><span class="badge" style="background: #e9ecef; color: #495057;">${comp.type.toUpperCase()}</span></td>
      <td>
        <pre style="font-size: 0.75rem; background: #f8f9fa; padding: 10px; border-radius: 4px; max-width: 300px; overflow: auto;">${JSON.stringify(comp.default_content, null, 2)}</pre>
      </td>
      <td>
        <pre style="font-size: 0.75rem; background: #f8f9fa; padding: 10px; border-radius: 4px; max-width: 300px; overflow: auto;">${JSON.stringify(comp.default_styles, null, 2)}</pre>
      </td>
      <td>
        <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="alert('Edit Component: ${comp.name}')">Edit</button>
      </td>
    </tr>
  `).join('');

  app.innerHTML = `
    ${renderSidebar('components')}
    <main class="main-content">
      <header class="view-header">
        <h2>System Components</h2>
        <button class="btn-primary" onclick="alert('Register New Component')">+ New Component</button>
      </header>

      <div class="card" style="padding: 0; overflow: hidden;">
        <table class="clients-table" style="box-shadow: none; margin-top: 0;">
          <thead>
            <tr>
              <th>Component Name</th>
              <th>Type</th>
              <th>Default Content</th>
              <th>Default Styles</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="5" style="text-align: center; padding: 40px; color: #666;">No components found</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="stats-grid" style="margin-top: 30px;">
        <div class="card">
          <h3>Collection: Components</h3>
          <p style="color: #666; margin-bottom: 15px;">Schema defined with the following fields:</p>
          <ul style="list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>id</strong>: auto (string)</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>name</strong>: string</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>type</strong>: string</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>default_content</strong>: JSON</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>default_styles</strong>: JSON</li>
          </ul>
        </div>
      </div>
    </main>
  `;
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
            <label for="lead_service">Service Needed</label>
            <textarea id="lead_service" placeholder="Description of what needs cleaning..." required></textarea>
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

function handleLeadCaptureSubmission(e: Event) {
  e.preventDefault();
  const name = (document.getElementById('lead_name') as HTMLInputElement).value;
  const phone = (document.getElementById('lead_phone') as HTMLInputElement).value;
  const email = (document.getElementById('lead_email') as HTMLInputElement).value;
  const address = (document.getElementById('lead_address') as HTMLInputElement).value;
  const service = (document.getElementById('lead_service') as HTMLTextAreaElement).value;

  const contact_id = 'c' + (mockContacts.length + 1);
  const opp_id = 'o' + (mockOpportunities.length + 1);

  // 1. Create new contact
  mockContacts.push({
    id: contact_id,
    name,
    phone,
    email,
    address,
    tags: ['new-lead'],
    source: 'Lead Capture Form',
    service,
    status: 'lead',
    created_at: new Date().toISOString()
  });

  // 2. Create new opportunity
  const newOpp = {
    id: opp_id,
    contact_id,
    pipeline_stage: 'New Lead',
    value: 0, // Initial value
    assigned_to: 'Hansveer',
    status: 'open' as any,
    created_at: new Date().toISOString()
  };
  mockOpportunities.push(newOpp);

  // Trigger Automation
  runAutomations('OPPORTUNITY_CREATED', newOpp);

  const container = document.querySelector('.lead-form-container');
  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 0;">
        <div style="font-size: 3rem; color: var(--primary-color); margin-bottom: 20px;">✓</div>
        <h2 style="margin-bottom: 10px;">Submission Received</h2>
        <p style="font-size: 1.2rem; color: var(--secondary-color);">Thanks! We’ll contact you shortly.</p>
        <button onclick="window.navigateTo('lead-capture')" class="btn-primary" style="margin-top: 30px; background-color: var(--secondary-color);">Capture Another Lead</button>
        <button onclick="window.navigateTo('opportunities')" class="btn-primary" style="margin-top: 30px; margin-left:10px;">View Pipeline</button>
      </div>
    `;
  }
}

function renderOpportunities() {
  const defaultPipeline = mockPipelines[0];
  const stages = defaultPipeline.stages;
  
  const columnsHtml = stages.map(stage => {
    const stageOpportunities = mockOpportunities.filter(opp => opp.pipeline_stage === stage);
    const cardsHtml = stageOpportunities.map(opp => {
      const contact = mockContacts.find(c => c.id === opp.contact_id);
      return `
        <div class="kanban-card" draggable="true" ondragstart="drag(event, '${opp.id}')" onclick="window.navigateTo('contact-detail', '${opp.contact_id}')" style="cursor: pointer;">
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

(window as any).navigateTo = (view: string, id?: string) => {
  currentView = view;
  if (id) selectedContactId = id;
  
  // Automation: Check for overdue invoices on navigation
  checkOverdueInvoices();

  if (view === 'dashboard') renderDashboard();
  if (view === 'clients') renderClients();
  if (view === 'opportunities') renderOpportunities();
  if (view === 'quotes') renderQuotes();
  if (view === 'new-quote') renderNewQuote();
  if (view === 'invoices') renderInvoices();
  if (view === 'lead-capture') renderLeadCapture();
  if (view === 'builder') renderBuilder();
  if (view === 'reports') renderReports();
  if (view === 'pages') renderPages();
  if (view === 'page-sections' && id) renderPageSections(id);
  if (view === 'components') renderComponents();
  if (view === 'quickstart') renderQuickstart();
  if (view === 'quote-preview' && id) renderQuotePreview(id);
  if (view === 'contact-detail' && selectedContactId) renderContactDetail(selectedContactId);
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
                ${contact ? contact.email : ''}<br>
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

function renderContactDetail(contactId: string) {
  const contact = mockContacts.find(c => c.id === contactId);
  if (!contact) return;

  const contactOpps = mockOpportunities.filter(opp => opp.contact_id === contactId);
  const contactActivities = mockActivities
    .filter(a => a.contact_id === contactId)
    .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());

  app.innerHTML = `
    ${renderSidebar('clients')}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; align-items: center; gap: 15px;">
          <button onclick="window.navigateTo('clients')" class="btn-primary" style="background: #eee; color: #333; padding: 5px 10px;">← Back</button>
          <h2>${contact.name}</h2>
          <span class="badge badge-${contact.status}">${contact.status}</span>
        </div>
      </header>

      <div class="action-bar">
        <button class="btn-primary" onclick="window.logCall('${contactId}')">📞 Log Call</button>
        <button class="btn-primary" onclick="window.addNote('${contactId}')" style="background: var(--secondary-color);">📝 Add Note</button>
        <button class="btn-primary" onclick="window.createOpportunity('${contactId}')" style="background: #28a745;">💰 New Opportunity</button>
        <button class="btn-primary" onclick="window.createQuote('${contactId}')" style="background: #17a2b8;">📄 Create Quote</button>
        <button class="btn-primary" onclick="window.createInvoice('${contactId}')" style="background: #e67e22;">💳 Create Invoice</button>
      </div>

      <div class="detail-container">
        <!-- Sidebar Info -->
        <aside class="detail-sidebar">
          <div class="card">
            <h3>Contact Information</h3>
            <div style="margin-top: 15px; display: flex; flex-direction: column; gap: 8px;">
              <div>
                <label style="display: block; font-size: 0.75rem; color: #666;">Phone</label>
                <input type="text" value="${contact.phone}" class="inline-input" onchange="window.updateContactField('${contactId}', 'phone', this.value)" style="width: 100%;">
              </div>
              <div>
                <label style="display: block; font-size: 0.75rem; color: #666;">Email</label>
                <input type="email" value="${contact.email}" class="inline-input" onchange="window.updateContactField('${contactId}', 'email', this.value)" style="width: 100%;">
              </div>
              <p><strong>Address:</strong> ${contact.address}</p>
              <p><strong>Source:</strong> ${contact.source}</p>
              <p><strong>Created:</strong> ${new Date(contact.created_at).toLocaleDateString()}</p>
            </div>
            
            <h3 style="margin-top: 25px;">Active Opportunities</h3>
            <div style="margin-top: 15px;">
              ${contactOpps.map(opp => `
                <div class="opportunity-strip">
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center;">
                      <span>$</span>
                      <input type="number" 
                             value="${opp.value}" 
                             class="inline-input" 
                             onchange="window.updateOpportunityField('${opp.id}', 'value', this.value)" 
                             style="width: 80px; font-weight: 600;">
                    </div>
                    <select class="inline-select" onchange="window.updateOpportunityStage('${opp.id}', this.value)">
                      ${mockPipelines[0].stages.map(s => `<option value="${s}" ${s === opp.pipeline_stage ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                  </div>
                  <span class="badge badge-${opp.status}" style="font-size: 0.7rem;">${opp.status}</span>
                </div>
              `).join('') || '<p>No opportunities</p>'}
            </div>
          </div>
        </aside>

        <!-- Main Timeline -->
        <div class="timeline-container">
          <div class="card">
            <h3>Activity Timeline</h3>
            <div class="timeline">
              ${contactActivities.map(activity => `
                <div class="timeline-item">
                  <div class="timeline-dot" style="background: ${activity.completed ? '#28a745' : 'var(--primary-color)'}"></div>
                  <div class="timeline-content">
                    <div class="timeline-time">${new Date(activity.due_date).toLocaleString()}</div>
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                      <div>
                        <strong>${activity.type.toUpperCase()}</strong>: ${activity.description}
                      </div>
                      ${!activity.completed ? `<button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem; background: #28a745;" onclick="window.completeTask('${activity.id}')">Complete</button>` : '<span style="color: #28a745;">✓</span>'}
                    </div>
                  </div>
                </div>
              `).join('') || '<p style="padding: 20px;">No activity logged.</p>'}
            </div>
          </div>

          <div class="card" style="margin-top: 24px;">
            <h3>Quotes</h3>
            <div style="margin-top: 15px;">
              <table class="clients-table" style="box-shadow: none; border: 1px solid #eee;">
                <thead>
                  <tr>
                    <th>Quote #</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${mockQuotes.filter(q => q.contact_id === contactId).map(quote => `
                    <tr>
                      <td style="font-weight: 600;">Q-${quote.id}</td>
                      <td><span class="badge badge-${quote.status}">${quote.status}</span></td>
                      <td>$${quote.total_amount.toLocaleString()}</td>
                      <td>
                        <div style="display: flex; gap: 5px;">
                          <button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="event.stopPropagation(); window.navigateTo('quote-preview', '${quote.id}')">Preview</button>
                          <button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="event.stopPropagation(); window.navigateTo('contact-detail', '${quote.contact_id}')">View</button>
                          ${quote.status === 'draft' ? `<button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem; background: #28a745;" onclick="event.stopPropagation(); window.sendQuote('${quote.id}')">Send</button>` : ''}
                          ${quote.status === 'sent' ? `
                            <button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem; background: #28a745;" onclick="event.stopPropagation(); window.approveQuote('${quote.id}')">Approve</button>
                            <button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem; background: #dc3545;" onclick="event.stopPropagation(); window.rejectQuote('${quote.id}')">Reject</button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `).join('') || '<tr><td colspan="4" style="text-align: center; color: #666; padding: 20px;">No quotes created.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card" style="margin-top: 24px;">
            <h3>Invoices</h3>
            <div style="margin-top: 15px;">
              <table class="clients-table" style="box-shadow: none; border: 1px solid #eee;">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Due Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${mockInvoices.filter(i => i.contact_id === contactId).map(invoice => `
                    <tr>
                      <td style="font-weight: 600;">INV-${invoice.id}</td>
                      <td><span class="badge badge-${invoice.status}">${invoice.status}</span></td>
                      <td>$${invoice.amount.toLocaleString()}</td>
                      <td>${new Date(invoice.due_date).toLocaleDateString()}</td>
                      <td>
                        <div style="display: flex; gap: 5px;">
                          <button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="event.stopPropagation(); window.navigateTo('contact-detail', '${invoice.contact_id}')">View</button>
                          ${invoice.status !== 'paid' ? `<button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem; background: #28a745;" onclick="event.stopPropagation(); window.markAsPaid('${invoice.id}')">Mark as Paid</button>` : ''}
                        </div>
                      </td>
                    </tr>
                  `).join('') || '<tr><td colspan="5" style="text-align: center; color: #666; padding: 20px;">No invoices created.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  `;
}

(window as any).logCall = (contactId: string) => {
  const note = prompt("Enter call summary:");
  if (note) {
    mockActivities.push({
      id: 'act-' + Date.now(),
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
    (contact as any)[field] = value;
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

checkOverdueInvoices();
renderDashboard();
