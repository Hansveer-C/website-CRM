(function(){const i=document.createElement("link").relList;if(i&&i.supports&&i.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))o(e);new MutationObserver(e=>{for(const a of e)if(a.type==="childList")for(const n of a.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&o(n)}).observe(document,{childList:!0,subtree:!0});function c(e){const a={};return e.integrity&&(a.integrity=e.integrity),e.referrerPolicy&&(a.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?a.credentials="include":e.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function o(e){if(e.ep)return;e.ep=!0;const a=c(e);fetch(e.href,a)}})();const d=[{id:"1",name:"John Doe",email:"john@example.com",phone:"555-0101",status:"Job Scheduled",lastContact:"2026-02-23",service:"Full House Wash"},{id:"2",name:"Jane Smith",email:"jane@smithresidence.com",phone:"555-0202",status:"Lead",lastContact:"2026-02-24",service:"Driveway Cleaning"},{id:"3",name:"Solar Power Co.",email:"ops@solarpower.com",phone:"555-0303",status:"Quote Sent",lastContact:"2026-02-22",service:"Solar Panel Wash"}],t=document.querySelector("#app");function r(s){return`
    <div class="sidebar">
      <h1>PressurePro</h1>
      <nav>
        <ul>
          <li onclick="window.navigateTo('dashboard')" class="${s==="dashboard"?"active":""}">Dashboard</li>
          <li onclick="window.navigateTo('clients')" class="${s==="clients"?"active":""}">Clients & Leads</li>
          <li onclick="window.navigateTo('builder')" class="${s==="builder"?"active":""}">Website Builder</li>
          <li onclick="window.navigateTo('reports')" class="${s==="reports"?"active":""}">Reports & Insights</li>
          <li onclick="window.navigateTo('quickstart')" class="${s==="quickstart"?"active":""}">Quickstart Guide</li>
          <li>Payments</li>
          <li>Settings</li>
        </ul>
      </nav>
    </div>
  `}function p(){t.innerHTML=`
    ${r("dashboard")}
    <main class="main-content">
      <header class="view-header">
        <h2>Dashboard Overview</h2>
      </header>
      <div class="dashboard-grid">
        <div class="card">
          <h3>Pipeline Value</h3>
          <p class="value">$1,250.00</p>
        </div>
        <div class="card">
          <h3>Opportunities</h3>
          <p class="value">${d.length}</p>
        </div>
        <div class="card">
          <h3>Conversion Rate</h3>
          <p class="value">33%</p>
        </div>
      </div>
    </main>
  `}function u(){const s=d.map(i=>`
    <tr>
      <td>${i.name}</td>
      <td>${i.service}</td>
      <td><span class="badge badge-${i.status.toLowerCase().replace(" ","-")}">${i.status}</span></td>
      <td>${i.lastContact}</td>
      <td><button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;">View</button></td>
    </tr>
  `).join("");t.innerHTML=`
    ${r("clients")}
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
          ${s}
        </tbody>
      </table>
    </main>
  `}function h(){t.innerHTML=`
    ${r("builder")}
    <main class="main-content">
      <header class="view-header">
        <h2>Website Builder</h2>
        <div>
          <button class="btn-primary" style="background-color: var(--secondary-color); margin-right: 10px;">Preview</button>
          <button class="btn-primary">Publish Website</button>
        </div>
      </header>
      <div class="builder-container">
        <div class="builder-sidebar">
          <h4>Elements</h4>
          <div class="draggable-item">Hero Section</div>
          <div class="draggable-item">Service Grid</div>
          <div class="draggable-item">Contact Form</div>
          <div class="draggable-item">Testimonials</div>
          <div class="draggable-item">Gallery</div>
        </div>
        <div class="builder-canvas">
          <div class="canvas-hero">
            <h1>Expert Pressure Washing Services</h1>
            <p>Making your property shine like new again.</p>
            <button class="btn-primary" style="background: white; color: var(--primary-color); margin-top: 20px;">Get a Free Quote</button>
          </div>
          <div class="canvas-section">
            <h3>Our Premium Services</h3>
            <p>From driveways to roofs, we handle everything with care.</p>
          </div>
          <div class="canvas-section" style="border: 1px dashed #007bff; background: #f0f7ff;">
            <p style="color: #007bff;">+ Drop new elements here</p>
          </div>
        </div>
      </div>
    </main>
  `}function v(){t.innerHTML=`
    ${r("reports")}
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
  `}function l(){t.innerHTML=`
    ${r("quickstart")}
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
  `}window.navigateTo=s=>{s==="dashboard"&&p(),s==="clients"&&u(),s==="builder"&&h(),s==="reports"&&v(),s==="quickstart"&&l()};l();
