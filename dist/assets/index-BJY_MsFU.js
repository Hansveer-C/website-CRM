(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))i(s);new MutationObserver(s=>{for(const n of s)if(n.type==="childList")for(const r of n.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&i(r)}).observe(document,{childList:!0,subtree:!0});function a(s){const n={};return s.integrity&&(n.integrity=s.integrity),s.referrerPolicy&&(n.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?n.credentials="include":s.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function i(s){if(s.ep)return;s.ep=!0;const n=a(s);fetch(s.href,n)}})();const f=[{id:"1",name:"John Doe",email:"john@example.com",phone:"555-0101",status:"Job Scheduled",lastContact:"2026-02-23",service:"Full House Wash"},{id:"2",name:"Jane Smith",email:"jane@smithresidence.com",phone:"555-0202",status:"Lead",lastContact:"2026-02-24",service:"Driveway Cleaning"},{id:"3",name:"Solar Power Co.",email:"ops@solarpower.com",phone:"555-0303",status:"Quote Sent",lastContact:"2026-02-22",service:"Solar Panel Wash"}],h=[{id:"residential-sparkle",name:"Residential Sparkle",description:"Perfect for soft washing and home exterior care specialist.",theme:{primary:"#00d2ff",secondary:"#3a7bd5",font:"Inter"},blocks:[{id:"h1",type:"hero",data:{title:"The Cleanest House on the Block",subtitle:"Professional Soft Washing & Gutter Cleaning in Los Angeles.",buttonText:"Get My Free Estimate"}},{id:"s1",type:"services",data:{title:"Residential Services",items:["House Washing","Roof Cleaning","Gutter Brightening","Driveway Sealing"]}},{id:"c1",type:"contact",data:{title:"Request a Residential Quote"}}]},{id:"commercial-pro",name:"Commercial Pro",description:"Industrial bold styling for large-scale concrete and fleet cleaning.",theme:{primary:"#ff4b2b",secondary:"#ff416c",font:"Roboto"},blocks:[{id:"h2",type:"hero",data:{title:"Industrial Strength Cleaning",subtitle:"Reliable Fleet and Concrete Maintenance for Commercial Properties.",buttonText:"Schedule a Consultation"}},{id:"s2",type:"services",data:{title:"Commercial Solutions",items:["Fleet Washing","Dumpster Pad Cleaning","Parking Lot Restoration","Graffiti Removal"]}},{id:"t2",type:"trust",data:{title:"Trusted by Local Business Leaders",logos:["Starbucks","Walmart","Local Mall"]}}]},{id:"trust-proof",name:"The Trust Proof",description:"Heavy focus on before/after galleries and client testimonials.",theme:{primary:"#11998e",secondary:"#38ef7d",font:"Outfit"},blocks:[{id:"h3",type:"hero",data:{title:"See the Difference for Yourself",subtitle:"Real Results. Real Reviews. Real Experts.",buttonText:"View Our Gallery"}},{id:"g3",type:"gallery",data:{title:"Recent Successes",images:["Before/After 1","Before/After 2","Before/After 3"]}},{id:"t3",type:"trust",data:{title:"What Your Neighbors Say",testimonials:[{name:"Alice R.",text:"Best service ever!"},{name:"Bob S.",text:"My driveway looks new."}]}}]}],y=[{id:"c1",name:"John Doe",phone:"555-0101",email:"john@example.com",address:"123 Pine St, Seattle, WA",tags:["residential","referral"],source:"Google Search",status:"customer",created_at:"2026-02-15T10:00:00Z"},{id:"c2",name:"Jane Smith",phone:"555-0202",email:"jane@smithresidence.com",address:"456 Oak Ave, Portland, OR",tags:["lead","driveway"],source:"Facebook Ad",status:"lead",created_at:"2026-03-01T14:30:00Z"}],$=[{id:"p1",name:"Residential Cleaning Pipeline",stages:["New Lead","Quote Sent","Scheduled","Completed","Paid"]}],u=[{id:"o1",contact_id:"c2",pipeline_stage:"New Lead",value:250,assigned_to:"Hansveer",status:"open",created_at:"2026-03-01T14:35:00Z"},{id:"o2",contact_id:"c1",pipeline_stage:"Completed",value:450,assigned_to:"Hansveer",status:"won",created_at:"2026-02-15T10:05:00Z"}],c=document.querySelector("#app");let v="dashboard",d=h[0],o=[...d.blocks];function p(e){return`
    <div class="sidebar">
      <h1>PressurePro</h1>
      <nav>
        <ul>
          <li onclick="window.navigateTo('dashboard')" class="${e==="dashboard"?"active":""}">Dashboard</li>
          <li onclick="window.navigateTo('clients')" class="${e==="clients"?"active":""}">Clients & Leads</li>
          <li onclick="window.navigateTo('opportunities')" class="${e==="opportunities"?"active":""}">Opportunities</li>
          <li onclick="window.navigateTo('builder')" class="${e==="builder"?"active":""}">Website Builder</li>
          <li onclick="window.navigateTo('reports')" class="${e==="reports"?"active":""}">Reports & Insights</li>
          <li onclick="window.navigateTo('quickstart')" class="${e==="quickstart"?"active":""}">Quickstart Guide</li>
          <li>Payments</li>
          <li>Settings</li>
        </ul>
      </nav>
    </div>
  `}function g(){const e=u.filter(r=>r.status==="open"),t=e.reduce((r,l)=>r+l.value,0),a=e.length,i=u.length,s=u.filter(r=>r.status==="won").length,n=i>0?s/i*100:0;c.innerHTML=`
    ${p("dashboard")}
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
          <p class="value">${n.toFixed(1)}%</p>
        </div>
      </div>
    </main>
  `}function w(){const e=f.map(t=>`
    <tr>
      <td>${t.name}</td>
      <td>${t.service}</td>
      <td><span class="badge badge-${t.status.toLowerCase().replace(" ","-")}">${t.status}</span></td>
      <td>${t.lastContact}</td>
      <td><button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;">View</button></td>
    </tr>
  `).join("");c.innerHTML=`
    ${p("clients")}
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
  `}function m(){var e;c.innerHTML=`
    ${p("builder")}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; align-items: center; gap: 20px;">
          <h2>Website Builder</h2>
          <select id="template-select" style="padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
            ${h.map(t=>`<option value="${t.id}" ${t.id===d.id?"selected":""}>${t.name}</option>`).join("")}
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
          ${x()}
        </div>
      </div>
    </main>
  `,(e=document.getElementById("template-select"))==null||e.addEventListener("change",t=>{const a=t.target.value,i=h.find(s=>s.id===a);i&&(d=i,o=[...i.blocks],m())}),document.querySelectorAll(".draggable-item").forEach(t=>{t.addEventListener("click",()=>{const a=t.getAttribute("data-type");window.addBlock(a)})})}function x(){return o.length===0?`<div class="canvas-section" style="border: 2px dashed #007bff; background: #f0f7ff;">
              <p style="color: #007bff;">Click an element to add it here</p>
            </div>`:o.map((e,t)=>{let a="";switch(e.type){case"hero":a=`
          <div class="canvas-hero" style="background: linear-gradient(135deg, ${d.theme.primary}, ${d.theme.secondary});">
            <h1>${e.data.title}</h1>
            <p>${e.data.subtitle}</p>
            <button class="btn-primary" style="background: white; color: ${d.theme.primary}; margin-top: 20px;">${e.data.buttonText}</button>
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
              <button class="btn-primary" style="background: ${d.theme.primary}">Send Quote Request</button>
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
    `}).join("")}window.addBlock=e=>{const t={id:Date.now().toString(),type:e,data:k(e)};o.push(t),m()};window.removeBlock=e=>{o.splice(e,1),m()};window.moveBlock=(e,t)=>{const a=e+t;if(a>=0&&a<o.length){const i=o[e];o[e]=o[a],o[a]=i,m()}};function k(e){switch(e){case"hero":return{title:"Insert Title",subtitle:"Insert Subtitle",buttonText:"Click Me"};case"services":return{title:"Our Services",items:["Service 1","Service 2","Service 3"]};case"contact":return{title:"Get In Touch"};case"gallery":return{title:"Our Work",images:["Image 1","Image 2","Image 3"]};case"trust":return{title:"What Clients Say",testimonials:[{name:"John D.",text:"Great Job!"}]};default:return{}}}function S(){c.innerHTML=`
    ${p("reports")}
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
  `}function C(){c.innerHTML=`
    ${p("quickstart")}
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
  `}function T(){const e=$[0],a=e.stages.map(i=>{const s=u.filter(r=>r.pipeline_stage===i),n=s.map(r=>{const l=y.find(b=>b.id===r.contact_id);return`
        <div class="kanban-card" draggable="true" ondragstart="drag(event, '${r.id}')">
          <div class="contact-name">${l?l.name:"Unknown Contact"}</div>
          <div class="opportunity-value">$${r.value.toLocaleString()}</div>
          <div class="contact-phone">${l?l.phone:"N/A"}</div>
        </div>
      `}).join("");return`
      <div class="kanban-column" ondragover="allowDrop(event)" ondrop="drop(event, '${i}')">
        <h4>${i} <span>${s.length}</span></h4>
        <div class="kanban-cards">
          ${n}
        </div>
      </div>
    `}).join("");c.innerHTML=`
    ${p("opportunities")}
    <main class="main-content">
      <header class="view-header">
        <h2>Sales Pipeline: ${e.name}</h2>
        <button class="btn-primary">+ New Opportunity</button>
      </header>
      <div class="kanban-board">
        ${a}
      </div>
    </main>
  `}function L(e,t){const a=u.find(i=>i.id===e);a&&(a.pipeline_stage=t,t==="Completed"||t==="Paid"?a.status="won":t==="Lost"?a.status="lost":a.status="open",window.navigateTo(v),console.log(`Opportunity ${e} updated: Stage=[${t}], Status=[${a.status}]`))}window.allowDrop=e=>{e.preventDefault()};window.drag=(e,t)=>{var a;(a=e.dataTransfer)==null||a.setData("text",t)};window.drop=(e,t)=>{var i;e.preventDefault();const a=(i=e.dataTransfer)==null?void 0:i.getData("text");a&&L(a,t)};window.navigateTo=e=>{v=e,e==="dashboard"&&g(),e==="clients"&&w(),e==="opportunities"&&T(),e==="builder"&&m(),e==="reports"&&S(),e==="quickstart"&&C()};g();
