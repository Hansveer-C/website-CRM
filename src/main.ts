import { mockClients } from './mockData';
import { templates, WebsiteTemplate, BuilderBlock } from './templates';
import { mockContacts, mockOpportunities, mockPipelines } from './db';

const app = document.querySelector<HTMLDivElement>('#app')!;

// State Management
let currentView: string = 'dashboard';
let currentTemplate: WebsiteTemplate = templates[0];
let canvasBlocks: BuilderBlock[] = [...currentTemplate.blocks];

function renderSidebar(activeView: string) {
  return `
    <div class="sidebar">
      <h1>PressurePro</h1>
      <nav>
        <ul>
          <li onclick="window.navigateTo('dashboard')" class="${activeView === 'dashboard' ? 'active' : ''}">Dashboard</li>
          <li onclick="window.navigateTo('clients')" class="${activeView === 'clients' ? 'active' : ''}">Clients & Leads</li>
          <li onclick="window.navigateTo('opportunities')" class="${activeView === 'opportunities' ? 'active' : ''}">Opportunities</li>
          <li onclick="window.navigateTo('builder')" class="${activeView === 'builder' ? 'active' : ''}">Website Builder</li>
          <li onclick="window.navigateTo('reports')" class="${activeView === 'reports' ? 'active' : ''}">Reports & Insights</li>
          <li onclick="window.navigateTo('quickstart')" class="${activeView === 'quickstart' ? 'active' : ''}">Quickstart Guide</li>
          <li>Payments</li>
          <li>Settings</li>
        </ul>
      </nav>
    </div>
  `;
}

function renderDashboard() {
  const openOpportunities = mockOpportunities.filter(o => o.status === 'open');
  const pipelineValue = openOpportunities.reduce((sum, o) => sum + o.value, 0);
  const openCount = openOpportunities.length;
  
  const totalCount = mockOpportunities.length;
  const wonCount = mockOpportunities.filter(o => o.status === 'won').length;
  const conversionRate = totalCount > 0 ? (wonCount / totalCount) * 100 : 0;

  app.innerHTML = `
    ${renderSidebar('dashboard')}
    <main class="main-content">
      <header class="view-header">
        <h2>Dashboard Overview</h2>
      </header>
      <div class="dashboard-grid">
        <div class="card">
          <h3>Pipeline Value (Open)</h3>
          <p class="value">$${pipelineValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div class="card">
          <h3>Open Opportunities</h3>
          <p class="value">${openCount}</p>
        </div>
        <div class="card">
          <h3>Conversion Rate</h3>
          <p class="value">${conversionRate.toFixed(1)}%</p>
        </div>
      </div>
    </main>
  `;
}

function renderClients() {
  const tableRows = mockClients.map(client => `
    <tr>
      <td>${client.name}</td>
      <td>${client.service}</td>
      <td><span class="badge badge-${client.status.toLowerCase().replace(' ', '-')}">${client.status}</span></td>
      <td>${client.lastContact}</td>
      <td><button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;">View</button></td>
    </tr>
  `).join('');

  app.innerHTML = `
    ${renderSidebar('clients')}
    <main class="main-content">
      <header class="view-header">
        <h2>Clients & Leads</h2>
        <button class="btn-primary">+ Add Lead</button>
      </header>
      <table class="clients-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Service</th>
            <th>Status</th>
            <th>Last Contact</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </main>
  `;
}

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

function renderOpportunities() {
  const defaultPipeline = mockPipelines[0];
  const stages = defaultPipeline.stages;
  
  const columnsHtml = stages.map(stage => {
    const stageOpportunities = mockOpportunities.filter(opp => opp.pipeline_stage === stage);
    const cardsHtml = stageOpportunities.map(opp => {
      const contact = mockContacts.find(c => c.id === opp.contact_id);
      return `
        <div class="kanban-card" draggable="true" ondragstart="drag(event, '${opp.id}')">
          <div class="contact-name">${contact ? contact.name : 'Unknown Contact'}</div>
          <div class="opportunity-value">$${opp.value.toLocaleString()}</div>
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
    (window as any).navigateTo(currentView);
    console.log(`Opportunity ${opportunity_id} updated: Stage=[${new_stage}], Status=[${opp.status}]`);
  }
}

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

(window as any).navigateTo = (view: string) => {
  currentView = view;
  if (view === 'dashboard') renderDashboard();
  if (view === 'clients') renderClients();
  if (view === 'opportunities') renderOpportunities();
  if (view === 'builder') renderBuilder();
  if (view === 'reports') renderReports();
  if (view === 'quickstart') renderQuickstart();
};

renderDashboard();
