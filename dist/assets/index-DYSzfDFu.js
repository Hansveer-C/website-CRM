(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))i(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const p of r.addedNodes)p.tagName==="LINK"&&p.rel==="modulepreload"&&i(p)}).observe(document,{childList:!0,subtree:!0});function a(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function i(s){if(s.ep)return;s.ep=!0;const r=a(s);fetch(s.href,r)}})();const h=[{id:"1",name:"John Doe",email:"john@example.com",phone:"555-0101",status:"Job Scheduled",lastContact:"2026-02-23",service:"Full House Wash"},{id:"2",name:"Jane Smith",email:"jane@smithresidence.com",phone:"555-0202",status:"Lead",lastContact:"2026-02-24",service:"Driveway Cleaning"},{id:"3",name:"Solar Power Co.",email:"ops@solarpower.com",phone:"555-0303",status:"Quote Sent",lastContact:"2026-02-22",service:"Solar Panel Wash"}],u=[{id:"residential-sparkle",name:"Residential Sparkle",description:"Perfect for soft washing and home exterior care specialist.",theme:{primary:"#00d2ff",secondary:"#3a7bd5",font:"Inter"},blocks:[{id:"h1",type:"hero",data:{title:"The Cleanest House on the Block",subtitle:"Professional Soft Washing & Gutter Cleaning in Los Angeles.",buttonText:"Get My Free Estimate"}},{id:"s1",type:"services",data:{title:"Residential Services",items:["House Washing","Roof Cleaning","Gutter Brightening","Driveway Sealing"]}},{id:"c1",type:"contact",data:{title:"Request a Residential Quote"}}]},{id:"commercial-pro",name:"Commercial Pro",description:"Industrial bold styling for large-scale concrete and fleet cleaning.",theme:{primary:"#ff4b2b",secondary:"#ff416c",font:"Roboto"},blocks:[{id:"h2",type:"hero",data:{title:"Industrial Strength Cleaning",subtitle:"Reliable Fleet and Concrete Maintenance for Commercial Properties.",buttonText:"Schedule a Consultation"}},{id:"s2",type:"services",data:{title:"Commercial Solutions",items:["Fleet Washing","Dumpster Pad Cleaning","Parking Lot Restoration","Graffiti Removal"]}},{id:"t2",type:"trust",data:{title:"Trusted by Local Business Leaders",logos:["Starbucks","Walmart","Local Mall"]}}]},{id:"trust-proof",name:"The Trust Proof",description:"Heavy focus on before/after galleries and client testimonials.",theme:{primary:"#11998e",secondary:"#38ef7d",font:"Outfit"},blocks:[{id:"h3",type:"hero",data:{title:"See the Difference for Yourself",subtitle:"Real Results. Real Reviews. Real Experts.",buttonText:"View Our Gallery"}},{id:"g3",type:"gallery",data:{title:"Recent Successes",images:["Before/After 1","Before/After 2","Before/After 3"]}},{id:"t3",type:"trust",data:{title:"What Your Neighbors Say",testimonials:[{name:"Alice R.",text:"Best service ever!"},{name:"Bob S.",text:"My driveway looks new."}]}}]}],d=document.querySelector("#app");let o=u[0],n=[...o.blocks];function l(e){return`
    <div class="sidebar">
      <h1>PressurePro</h1>
      <nav>
        <ul>
          <li onclick="window.navigateTo('dashboard')" class="${e==="dashboard"?"active":""}">Dashboard</li>
          <li onclick="window.navigateTo('clients')" class="${e==="clients"?"active":""}">Clients & Leads</li>
          <li onclick="window.navigateTo('builder')" class="${e==="builder"?"active":""}">Website Builder</li>
          <li onclick="window.navigateTo('reports')" class="${e==="reports"?"active":""}">Reports & Insights</li>
          <li onclick="window.navigateTo('quickstart')" class="${e==="quickstart"?"active":""}">Quickstart Guide</li>
          <li>Payments</li>
          <li>Settings</li>
        </ul>
      </nav>
    </div>
  `}function m(){d.innerHTML=`
    ${l("dashboard")}
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
          <p class="value">${h.length}</p>
        </div>
        <div class="card">
          <h3>Conversion Rate</h3>
          <p class="value">33%</p>
        </div>
      </div>
    </main>
  `}function v(){const e=h.map(t=>`
    <tr>
      <td>${t.name}</td>
      <td>${t.service}</td>
      <td><span class="badge badge-${t.status.toLowerCase().replace(" ","-")}">${t.status}</span></td>
      <td>${t.lastContact}</td>
      <td><button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;">View</button></td>
    </tr>
  `).join("");d.innerHTML=`
    ${l("clients")}
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
  `}function c(){var e;d.innerHTML=`
    ${l("builder")}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; align-items: center; gap: 20px;">
          <h2>Website Builder</h2>
          <select id="template-select" style="padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
            ${u.map(t=>`<option value="${t.id}" ${t.id===o.id?"selected":""}>${t.name}</option>`).join("")}
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
          ${g()}
        </div>
      </div>
    </main>
  `,(e=document.getElementById("template-select"))==null||e.addEventListener("change",t=>{const a=t.target.value,i=u.find(s=>s.id===a);i&&(o=i,n=[...i.blocks],c())}),document.querySelectorAll(".draggable-item").forEach(t=>{t.addEventListener("click",()=>{const a=t.getAttribute("data-type");window.addBlock(a)})})}function g(){return n.length===0?`<div class="canvas-section" style="border: 2px dashed #007bff; background: #f0f7ff;">
              <p style="color: #007bff;">Click an element to add it here</p>
            </div>`:n.map((e,t)=>{let a="";switch(e.type){case"hero":a=`
          <div class="canvas-hero" style="background: linear-gradient(135deg, ${o.theme.primary}, ${o.theme.secondary});">
            <h1>${e.data.title}</h1>
            <p>${e.data.subtitle}</p>
            <button class="btn-primary" style="background: white; color: ${o.theme.primary}; margin-top: 20px;">${e.data.buttonText}</button>
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
              <button class="btn-primary" style="background: ${o.theme.primary}">Send Quote Request</button>
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
    `}).join("")}window.addBlock=e=>{const t={id:Date.now().toString(),type:e,data:b(e)};n.push(t),c()};window.removeBlock=e=>{n.splice(e,1),c()};window.moveBlock=(e,t)=>{const a=e+t;if(a>=0&&a<n.length){const i=n[e];n[e]=n[a],n[a]=i,c()}};function b(e){switch(e){case"hero":return{title:"Insert Title",subtitle:"Insert Subtitle",buttonText:"Click Me"};case"services":return{title:"Our Services",items:["Service 1","Service 2","Service 3"]};case"contact":return{title:"Get In Touch"};case"gallery":return{title:"Our Work",images:["Image 1","Image 2","Image 3"]};case"trust":return{title:"What Clients Say",testimonials:[{name:"John D.",text:"Great Job!"}]};default:return{}}}function f(){d.innerHTML=`
    ${l("reports")}
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
  `}function y(){d.innerHTML=`
    ${l("quickstart")}
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
  `}window.navigateTo=e=>{e==="dashboard"&&m(),e==="clients"&&v(),e==="builder"&&c(),e==="reports"&&f(),e==="quickstart"&&y()};m();
