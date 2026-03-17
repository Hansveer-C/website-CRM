(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))i(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const n of r.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&i(n)}).observe(document,{childList:!0,subtree:!0});function a(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function i(s){if(s.ep)return;s.ep=!0;const r=a(s);fetch(s.href,r)}})();const y=[{id:"1",name:"John Doe",email:"john@example.com",phone:"555-0101",status:"Job Scheduled",lastContact:"2026-02-23",service:"Full House Wash"},{id:"2",name:"Jane Smith",email:"jane@smithresidence.com",phone:"555-0202",status:"Lead",lastContact:"2026-02-24",service:"Driveway Cleaning"},{id:"3",name:"Solar Power Co.",email:"ops@solarpower.com",phone:"555-0303",status:"Quote Sent",lastContact:"2026-02-22",service:"Solar Panel Wash"}],v=[{id:"residential-sparkle",name:"Residential Sparkle",description:"Perfect for soft washing and home exterior care specialist.",theme:{primary:"#00d2ff",secondary:"#3a7bd5",font:"Inter"},blocks:[{id:"h1",type:"hero",data:{title:"The Cleanest House on the Block",subtitle:"Professional Soft Washing & Gutter Cleaning in Los Angeles.",buttonText:"Get My Free Estimate"}},{id:"s1",type:"services",data:{title:"Residential Services",items:["House Washing","Roof Cleaning","Gutter Brightening","Driveway Sealing"]}},{id:"c1",type:"contact",data:{title:"Request a Residential Quote"}}]},{id:"commercial-pro",name:"Commercial Pro",description:"Industrial bold styling for large-scale concrete and fleet cleaning.",theme:{primary:"#ff4b2b",secondary:"#ff416c",font:"Roboto"},blocks:[{id:"h2",type:"hero",data:{title:"Industrial Strength Cleaning",subtitle:"Reliable Fleet and Concrete Maintenance for Commercial Properties.",buttonText:"Schedule a Consultation"}},{id:"s2",type:"services",data:{title:"Commercial Solutions",items:["Fleet Washing","Dumpster Pad Cleaning","Parking Lot Restoration","Graffiti Removal"]}},{id:"t2",type:"trust",data:{title:"Trusted by Local Business Leaders",logos:["Starbucks","Walmart","Local Mall"]}}]},{id:"trust-proof",name:"The Trust Proof",description:"Heavy focus on before/after galleries and client testimonials.",theme:{primary:"#11998e",secondary:"#38ef7d",font:"Outfit"},blocks:[{id:"h3",type:"hero",data:{title:"See the Difference for Yourself",subtitle:"Real Results. Real Reviews. Real Experts.",buttonText:"View Our Gallery"}},{id:"g3",type:"gallery",data:{title:"Recent Successes",images:["Before/After 1","Before/After 2","Before/After 3"]}},{id:"t3",type:"trust",data:{title:"What Your Neighbors Say",testimonials:[{name:"Alice R.",text:"Best service ever!"},{name:"Bob S.",text:"My driveway looks new."}]}}]}],h=[{id:"c1",name:"John Doe",phone:"555-0101",email:"john@example.com",address:"123 Pine St, Seattle, WA",tags:["residential","referral"],source:"Google Search",status:"customer",created_at:"2026-02-15T10:00:00Z"},{id:"c2",name:"Jane Smith",phone:"555-0202",email:"jane@smithresidence.com",address:"456 Oak Ave, Portland, OR",tags:["lead","driveway"],source:"Facebook Ad",status:"lead",created_at:"2026-03-01T14:30:00Z"}],w=[{id:"p1",name:"Residential Cleaning Pipeline",stages:["New Lead","Quote Sent","Scheduled","Completed","Paid"]}],c=[{id:"o1",contact_id:"c2",pipeline_stage:"New Lead",value:250,assigned_to:"Hansveer",status:"open",created_at:"2026-03-01T14:35:00Z"},{id:"o2",contact_id:"c1",pipeline_stage:"Completed",value:450,assigned_to:"Hansveer",status:"won",created_at:"2026-02-15T10:05:00Z"}],p=document.querySelector("#app");let g="dashboard",l=v[0],o=[...l.blocks];function u(e){return`
    <div class="sidebar">
      <h1>PressurePro</h1>
      <nav>
        <ul>
          <li onclick="window.navigateTo('dashboard')" class="${e==="dashboard"?"active":""}">Dashboard</li>
          <li onclick="window.navigateTo('clients')" class="${e==="clients"?"active":""}">Clients & Leads</li>
          <li onclick="window.navigateTo('opportunities')" class="${e==="opportunities"?"active":""}">Opportunities</li>
          <li onclick="window.navigateTo('lead-capture')" class="${e==="lead-capture"?"active":""}">Lead Capture</li>
          <li onclick="window.navigateTo('builder')" class="${e==="builder"?"active":""}">Website Builder</li>
          <li onclick="window.navigateTo('reports')" class="${e==="reports"?"active":""}">Reports & Insights</li>
          <li onclick="window.navigateTo('quickstart')" class="${e==="quickstart"?"active":""}">Quickstart Guide</li>
          <li>Payments</li>
          <li>Settings</li>
        </ul>
      </nav>
    </div>
  `}function b(){const e=c.filter(n=>n.status==="open"),t=e.reduce((n,d)=>n+d.value,0),a=e.length,i=c.length,s=c.filter(n=>n.status==="won").length,r=i>0?s/i*100:0;p.innerHTML=`
    ${u("dashboard")}
    <main class="main-content">
      <header class="view-header">
        <h2>Dashboard Overview</h2>
      </header>
      <div class="dashboard-grid">
        <div class="card">
          <h3>Pipeline Value (Open)</h3>
          <p class="value">$${t.toLocaleString(void 0,{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
        </div>
        <div class="card">
          <h3>Open Opportunities</h3>
          <p class="value">${a}</p>
        </div>
        <div class="card">
          <h3>Conversion Rate</h3>
          <p class="value">${r.toFixed(1)}%</p>
        </div>
      </div>
    </main>
  `}function x(){const e=y.map(t=>`
    <tr>
      <td>${t.name}</td>
      <td>${t.service}</td>
      <td><span class="badge badge-${t.status.toLowerCase().replace(" ","-")}">${t.status}</span></td>
      <td>${t.lastContact}</td>
      <td><button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;">View</button></td>
    </tr>
  `).join("");p.innerHTML=`
    ${u("clients")}
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
          ${e}
        </tbody>
      </table>
    </main>
  `}function m(){var e;p.innerHTML=`
    ${u("builder")}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; align-items: center; gap: 20px;">
          <h2>Website Builder</h2>
          <select id="template-select" style="padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
            ${v.map(t=>`<option value="${t.id}" ${t.id===l.id?"selected":""}>${t.name}</option>`).join("")}
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
          ${$()}
        </div>
      </div>
    </main>
  `,(e=document.getElementById("template-select"))==null||e.addEventListener("change",t=>{const a=t.target.value,i=v.find(s=>s.id===a);i&&(l=i,o=[...i.blocks],m())}),document.querySelectorAll(".draggable-item").forEach(t=>{t.addEventListener("click",()=>{const a=t.getAttribute("data-type");window.addBlock(a)})})}function $(){return o.length===0?`<div class="canvas-section" style="border: 2px dashed #007bff; background: #f0f7ff;">
              <p style="color: #007bff;">Click an element to add it here</p>
            </div>`:o.map((e,t)=>{let a="";switch(e.type){case"hero":a=`
          <div class="canvas-hero" style="background: linear-gradient(135deg, ${l.theme.primary}, ${l.theme.secondary});">
            <h1>${e.data.title}</h1>
            <p>${e.data.subtitle}</p>
            <button class="btn-primary" style="background: white; color: ${l.theme.primary}; margin-top: 20px;">${e.data.buttonText}</button>
          </div>
        `;break;case"services":a=`
          <div class="canvas-section">
            <h3>${e.data.title}</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
              ${e.data.items.map(i=>`<div style="padding: 10px; border: 1px solid #eee; border-radius: 4px;">${i}</div>`).join("")}
            </div>
          </div>
        `;break;case"contact":a=`
          <div class="canvas-section">
            <h3>${e.data.title}</h3>
            <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 10px; max-width: 400px; margin-left: auto; margin-right: auto;">
              <input type="text" placeholder="Name" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
              <input type="email" placeholder="Email" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
              <button class="btn-primary" style="background: ${l.theme.primary}">Send Quote Request</button>
            </div>
          </div>
        `;break;case"gallery":a=`
          <div class="canvas-section">
            <h3>${e.data.title}</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 20px;">
              ${e.data.images.map(i=>`<div style="height: 100px; background: #eee; border-radius: 4px; display: flex; align-items: center; justify-content: center;">${i}</div>`).join("")}
            </div>
          </div>
        `;break;case"trust":a=`
          <div class="canvas-section">
            <h3>${e.data.title}</h3>
            <div style="display: flex; justify-content: center; gap: 30px; margin-top: 20px; opacity: 0.6;">
              ${(e.data.logos||[]).map(i=>`<strong>${i}</strong>`).join("")}
              ${(e.data.testimonials||[]).map(i=>`<div><p>"${i.text}"</p><small>- ${i.name}</small></div>`).join("")}
            </div>
          </div>
        `;break}return`
      <div class="block-wrapper" style="position: relative; width: 100%;">
        <div style="position: absolute; right: -40px; top: 0; display: flex; flex-direction: column; gap: 5px;">
           <button onclick="window.removeBlock(${t})" style="background: #ff4444; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer;">×</button>
           <button onclick="window.moveBlock(${t}, -1)" style="background: #eee; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">↑</button>
           <button onclick="window.moveBlock(${t}, 1)" style="background: #eee; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">↓</button>
        </div>
        ${a}
      </div>
    `}).join("")}window.addBlock=e=>{const t={id:Date.now().toString(),type:e,data:k(e)};o.push(t),m()};window.removeBlock=e=>{o.splice(e,1),m()};window.moveBlock=(e,t)=>{const a=e+t;if(a>=0&&a<o.length){const i=o[e];o[e]=o[a],o[a]=i,m()}};function k(e){switch(e){case"hero":return{title:"Insert Title",subtitle:"Insert Subtitle",buttonText:"Click Me"};case"services":return{title:"Our Services",items:["Service 1","Service 2","Service 3"]};case"contact":return{title:"Get In Touch"};case"gallery":return{title:"Our Work",images:["Image 1","Image 2","Image 3"]};case"trust":return{title:"What Clients Say",testimonials:[{name:"John D.",text:"Great Job!"}]};default:return{}}}function S(){p.innerHTML=`
    ${u("reports")}
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
  `}function C(){p.innerHTML=`
    ${u("quickstart")}
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
  `}function L(){var e;p.innerHTML=`
    ${u("lead-capture")}
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
  `,(e=document.getElementById("lead-form"))==null||e.addEventListener("submit",T)}function T(e){e.preventDefault();const t=document.getElementById("lead_name").value,a=document.getElementById("lead_phone").value,i=document.getElementById("lead_email").value,s=document.getElementById("lead_address").value,r=document.getElementById("lead_service").value,n="c"+(h.length+1),d="o"+(c.length+1);h.push({id:n,name:t,phone:a,email:i,address:s,tags:["new-lead"],source:"Lead Capture Form",service:r,status:"lead",created_at:new Date().toISOString()}),c.push({id:d,contact_id:n,pipeline_stage:"New Lead",value:0,assigned_to:"Hansveer",status:"open",created_at:new Date().toISOString()}),alert(`Lead for ${t} captured successfully! Created Opportunity ${d}.`),window.navigateTo("opportunities")}function B(){const e=w[0],a=e.stages.map(i=>{const s=c.filter(n=>n.pipeline_stage===i),r=s.map(n=>{const d=h.find(f=>f.id===n.contact_id);return`
        <div class="kanban-card" draggable="true" ondragstart="drag(event, '${n.id}')">
          <div class="contact-name">${d?d.name:"Unknown Contact"}</div>
          <div class="opportunity-value">$${n.value.toLocaleString()}</div>
          <div class="contact-phone">${d?d.phone:"N/A"}</div>
        </div>
      `}).join("");return`
      <div class="kanban-column" ondragover="allowDrop(event)" ondrop="drop(event, '${i}')">
        <h4>${i} <span>${s.length}</span></h4>
        <div class="kanban-cards">
          ${r}
        </div>
      </div>
    `}).join("");p.innerHTML=`
    ${u("opportunities")}
    <main class="main-content">
      <header class="view-header">
        <h2>Sales Pipeline: ${e.name}</h2>
        <button class="btn-primary">+ New Opportunity</button>
      </header>
      <div class="kanban-board">
        ${a}
      </div>
    </main>
  `}function P(e,t){const a=c.find(i=>i.id===e);a&&(a.pipeline_stage=t,t==="Completed"||t==="Paid"?a.status="won":t==="Lost"?a.status="lost":a.status="open",window.navigateTo(g),console.log(`Opportunity ${e} updated: Stage=[${t}], Status=[${a.status}]`))}window.allowDrop=e=>{e.preventDefault()};window.drag=(e,t)=>{var a;(a=e.dataTransfer)==null||a.setData("text",t)};window.drop=(e,t)=>{var i;e.preventDefault();const a=(i=e.dataTransfer)==null?void 0:i.getData("text");a&&P(a,t)};window.navigateTo=e=>{g=e,e==="dashboard"&&b(),e==="clients"&&x(),e==="opportunities"&&B(),e==="lead-capture"&&L(),e==="builder"&&m(),e==="reports"&&S(),e==="quickstart"&&C()};b();
