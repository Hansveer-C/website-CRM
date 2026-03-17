(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))i(n);new MutationObserver(n=>{for(const o of n)if(o.type==="childList")for(const r of o.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&i(r)}).observe(document,{childList:!0,subtree:!0});function a(n){const o={};return n.integrity&&(o.integrity=n.integrity),n.referrerPolicy&&(o.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?o.credentials="include":n.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function i(n){if(n.ep)return;n.ep=!0;const o=a(n);fetch(n.href,o)}})();const D=[{id:"1",name:"John Doe",email:"john@example.com",phone:"555-0101",status:"Job Scheduled",lastContact:"2026-02-23",service:"Full House Wash"},{id:"2",name:"Jane Smith",email:"jane@smithresidence.com",phone:"555-0202",status:"Lead",lastContact:"2026-02-24",service:"Driveway Cleaning"},{id:"3",name:"Solar Power Co.",email:"ops@solarpower.com",phone:"555-0303",status:"Quote Sent",lastContact:"2026-02-22",service:"Solar Panel Wash"}],T=[{id:"residential-sparkle",name:"Residential Sparkle",description:"Perfect for soft washing and home exterior care specialist.",theme:{primary:"#00d2ff",secondary:"#3a7bd5",font:"Inter"},blocks:[{id:"h1",type:"hero",data:{title:"The Cleanest House on the Block",subtitle:"Professional Soft Washing & Gutter Cleaning in Los Angeles.",buttonText:"Get My Free Estimate"}},{id:"s1",type:"services",data:{title:"Residential Services",items:["House Washing","Roof Cleaning","Gutter Brightening","Driveway Sealing"]}},{id:"c1",type:"contact",data:{title:"Request a Residential Quote"}}]},{id:"commercial-pro",name:"Commercial Pro",description:"Industrial bold styling for large-scale concrete and fleet cleaning.",theme:{primary:"#ff4b2b",secondary:"#ff416c",font:"Roboto"},blocks:[{id:"h2",type:"hero",data:{title:"Industrial Strength Cleaning",subtitle:"Reliable Fleet and Concrete Maintenance for Commercial Properties.",buttonText:"Schedule a Consultation"}},{id:"s2",type:"services",data:{title:"Commercial Solutions",items:["Fleet Washing","Dumpster Pad Cleaning","Parking Lot Restoration","Graffiti Removal"]}},{id:"t2",type:"trust",data:{title:"Trusted by Local Business Leaders",logos:["Starbucks","Walmart","Local Mall"]}}]},{id:"trust-proof",name:"The Trust Proof",description:"Heavy focus on before/after galleries and client testimonials.",theme:{primary:"#11998e",secondary:"#38ef7d",font:"Outfit"},blocks:[{id:"h3",type:"hero",data:{title:"See the Difference for Yourself",subtitle:"Real Results. Real Reviews. Real Experts.",buttonText:"View Our Gallery"}},{id:"g3",type:"gallery",data:{title:"Recent Successes",images:["Before/After 1","Before/After 2","Before/After 3"]}},{id:"t3",type:"trust",data:{title:"What Your Neighbors Say",testimonials:[{name:"Alice R.",text:"Best service ever!"},{name:"Bob S.",text:"My driveway looks new."}]}}]}],v=[{id:"c1",name:"John Doe",phone:"555-0101",email:"john@example.com",address:"123 Pine St, Seattle, WA",tags:["residential","referral"],source:"Google Search",status:"customer",created_at:"2026-02-15T10:00:00Z"},{id:"c2",name:"Jane Smith",phone:"555-0202",email:"jane@smithresidence.com",address:"456 Oak Ave, Portland, OR",tags:["lead","driveway"],source:"Facebook Ad",status:"lead",created_at:"2026-03-01T14:30:00Z"}],$=[{id:"p1",name:"Residential Cleaning Pipeline",stages:["New Lead","Quote Sent","Scheduled","Completed","Paid"]}],c=[{id:"o1",contact_id:"c2",pipeline_stage:"New Lead",value:250,assigned_to:"Hansveer",status:"open",created_at:"2026-03-01T14:35:00Z"},{id:"o2",contact_id:"c1",pipeline_stage:"Completed",value:450,assigned_to:"Hansveer",status:"won",created_at:"2026-02-15T10:05:00Z"}],x=[{id:"a1",contact_id:"c2",type:"call",description:"Initial follow-up call about driveway cleaning",due_date:"2026-03-02T09:00:00Z",completed:!0},{id:"a2",contact_id:"c2",type:"sms",description:"Sent quote via text",due_date:"2026-03-05T10:00:00Z",completed:!1}],O=[{id:"a1",name:"Auto-follow task for new leads",trigger:"OPPORTUNITY_CREATED",action:"CREATE_TASK",actionParams:{type:"call",description:"Call new lead ASAP",dueInMinutes:10}},{id:"a2",name:"Notify when job is scheduled",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:e=>e.pipeline_stage==="Scheduled",action:"SEND_NOTIFICATION",actionParams:{message:"🎉 A job has been scheduled! Get ready."}},{id:"a3",name:"Final follow up when completed",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:e=>e.pipeline_stage==="Completed",action:"CREATE_TASK",actionParams:{type:"visit",description:"Site cleanup & final inspection",dueInDays:0}},{id:"a4",name:"Follow up on sent quote",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:e=>e.pipeline_stage==="Quote Sent",action:"CREATE_TASK",actionParams:{type:"note",description:"Follow up on quote in 24 hours",dueInDays:1}}];function k(e,t){O.filter(i=>i.trigger===e&&(!i.condition||i.condition(t))).forEach(i=>{P(i,t)})}function P(e,t){switch(e.action){case"CREATE_TASK":I(e.actionParams,t);break;case"SEND_NOTIFICATION":L(e.actionParams,t);break}}function I(e,t){const a=v.find(r=>r.id===t.contact_id),i=a?a.name:"Unknown",n=new Date;e.dueInDays&&n.setDate(n.getDate()+e.dueInDays),e.dueInMinutes&&n.setMinutes(n.getMinutes()+e.dueInMinutes);const o={id:"task-"+Date.now()+"-"+Math.floor(Math.random()*1e3),contact_id:t.contact_id,type:e.type||"note",description:e.description||`[AUTOMATED] Follow up for ${i}`,due_date:n.toISOString(),completed:!1};x.push(o),console.log(`[AUTOMATION: TASK CREATED] ${o.description}`)}function L(e,t){const a=v.find(o=>o.id===t.contact_id),i=a?a.name:"Unknown",n=e.message.replace("${contactName}",i);console.log(`%c[AUTOMATION: NOTIFICATION] ${n} (${i})`,"color: #007bff; font-weight: bold;"),alert(`Automation Notification: ${n}`)}const h=document.querySelector("#app");let S="dashboard",m=T[0],d=[...m.blocks];function g(e){return`
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
  `}function C(){const e=new Date,t=c.filter(s=>s.status==="open"),a=t.reduce((s,l)=>s+l.value,0),i=t.length,n=c.length,o=c.filter(s=>s.status==="won").length,r=n>0?o/n*100:0,f=$[0].stages.map(s=>{const l=c.filter(u=>u.pipeline_stage===s&&(u.status==="open"||u.status==="won")).reduce((u,_)=>u+_.value,0);return{stage:s,value:l}}).filter(s=>s.value>0),b={};v.forEach(s=>{b[s.source]=(b[s.source]||0)+1});const A=Object.entries(b).map(([s,l])=>({source:s,count:l})),w=x.filter(s=>!s.completed&&new Date(s.due_date)<e);h.innerHTML=`
    ${g("dashboard")}
    <main class="main-content">
      <header class="view-header">
        <h2>Dashboard Overview</h2>
      </header>
      
      <div class="dashboard-grid">
        <div class="card">
          <h3>Pipeline Value (Open)</h3>
          <p class="value">$${a.toLocaleString(void 0,{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
        </div>
        <div class="card">
          <h3>Open Opportunities</h3>
          <p class="value">${i}</p>
        </div>
        <div class="card">
          <h3>Conversion Rate</h3>
          <p class="value">${r.toFixed(1)}%</p>
        </div>
        <div class="card" style="border-left: 5px solid #ff4444;">
          <h3>Overdue Tasks</h3>
          <p class="value" style="color: #ff4444;">${w.length}</p>
        </div>
      </div>

      <div class="stats-grid" style="margin-top: 30px;">
        <div class="card">
          <h3>Revenue by Pipeline Stage</h3>
          <div class="chart-container" style="margin-top: 15px;">
            ${f.map(s=>`
              <div class="report-item">
                <span>${s.stage}</span>
                <span style="font-weight: 600;">$${s.value.toLocaleString()}</span>
              </div>
            `).join("")||'<p style="color: #666; font-style: italic;">No revenue data for active stages</p>'}
          </div>
        </div>
        <div class="card">
          <h3>Leads by Source</h3>
          <div class="chart-container" style="margin-top: 15px;">
            ${A.map(s=>`
              <div class="report-item">
                <span>${s.source}</span>
                <span class="badge" style="background: #e9ecef; color: #495057;">${s.count} Leads</span>
              </div>
            `).join("")}
          </div>
        </div>
      </div>

      ${w.length>0?`
        <div class="card" style="margin-top: 30px;">
          <h3>Critical: Overdue Tasks</h3>
          <table class="clients-table" style="box-shadow: none; border: 1px solid #eee; margin-top: 15px;">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Task</th>
                <th>Due Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${w.map(s=>{const l=v.find(u=>u.id===s.contact_id);return`
                  <tr style="background: #fff5f5;">
                    <td style="font-weight: 600;">${l?l.name:"Unknown"}</td>
                    <td>${s.description}</td>
                    <td style="color: #ff4444; font-weight: 500;">${new Date(s.due_date).toLocaleDateString()}</td>
                    <td><button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #ff4444;">Resolve</button></td>
                  </tr>
                `}).join("")}
            </tbody>
          </table>
        </div>
      `:""}
    </main>
  `}function R(){const e=D.map(t=>`
    <tr>
      <td>${t.name}</td>
      <td>${t.service}</td>
      <td><span class="badge badge-${t.status.toLowerCase().replace(" ","-")}">${t.status}</span></td>
      <td>${t.lastContact}</td>
      <td><button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;">View</button></td>
    </tr>
  `).join("");h.innerHTML=`
    ${g("clients")}
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
  `}function y(){var e;h.innerHTML=`
    ${g("builder")}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; align-items: center; gap: 20px;">
          <h2>Website Builder</h2>
          <select id="template-select" style="padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
            ${T.map(t=>`<option value="${t.id}" ${t.id===m.id?"selected":""}>${t.name}</option>`).join("")}
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
          ${E()}
        </div>
      </div>
    </main>
  `,(e=document.getElementById("template-select"))==null||e.addEventListener("change",t=>{const a=t.target.value,i=T.find(n=>n.id===a);i&&(m=i,d=[...i.blocks],y())}),document.querySelectorAll(".draggable-item").forEach(t=>{t.addEventListener("click",()=>{const a=t.getAttribute("data-type");window.addBlock(a)})})}function E(){return d.length===0?`<div class="canvas-section" style="border: 2px dashed #007bff; background: #f0f7ff;">
              <p style="color: #007bff;">Click an element to add it here</p>
            </div>`:d.map((e,t)=>{let a="";switch(e.type){case"hero":a=`
          <div class="canvas-hero" style="background: linear-gradient(135deg, ${m.theme.primary}, ${m.theme.secondary});">
            <h1>${e.data.title}</h1>
            <p>${e.data.subtitle}</p>
            <button class="btn-primary" style="background: white; color: ${m.theme.primary}; margin-top: 20px;">${e.data.buttonText}</button>
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
              <button class="btn-primary" style="background: ${m.theme.primary}">Send Quote Request</button>
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
    `}).join("")}window.addBlock=e=>{const t={id:Date.now().toString(),type:e,data:B(e)};d.push(t),y()};window.removeBlock=e=>{d.splice(e,1),y()};window.moveBlock=(e,t)=>{const a=e+t;if(a>=0&&a<d.length){const i=d[e];d[e]=d[a],d[a]=i,y()}};function B(e){switch(e){case"hero":return{title:"Insert Title",subtitle:"Insert Subtitle",buttonText:"Click Me"};case"services":return{title:"Our Services",items:["Service 1","Service 2","Service 3"]};case"contact":return{title:"Get In Touch"};case"gallery":return{title:"Our Work",images:["Image 1","Image 2","Image 3"]};case"trust":return{title:"What Clients Say",testimonials:[{name:"John D.",text:"Great Job!"}]};default:return{}}}function N(){h.innerHTML=`
    ${g("reports")}
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
  `}function M(){h.innerHTML=`
    ${g("quickstart")}
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
  `}function j(){var e;h.innerHTML=`
    ${g("lead-capture")}
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
  `,(e=document.getElementById("lead-form"))==null||e.addEventListener("submit",F)}function F(e){e.preventDefault();const t=document.getElementById("lead_name").value,a=document.getElementById("lead_phone").value,i=document.getElementById("lead_email").value,n=document.getElementById("lead_address").value,o=document.getElementById("lead_service").value,r="c"+(v.length+1),p="o"+(c.length+1);v.push({id:r,name:t,phone:a,email:i,address:n,tags:["new-lead"],source:"Lead Capture Form",service:o,status:"lead",created_at:new Date().toISOString()});const f={id:p,contact_id:r,pipeline_stage:"New Lead",value:0,assigned_to:"Hansveer",status:"open",created_at:new Date().toISOString()};c.push(f),k("OPPORTUNITY_CREATED",f);const b=document.querySelector(".lead-form-container");b&&(b.innerHTML=`
      <div style="text-align: center; padding: 40px 0;">
        <div style="font-size: 3rem; color: var(--primary-color); margin-bottom: 20px;">✓</div>
        <h2 style="margin-bottom: 10px;">Submission Received</h2>
        <p style="font-size: 1.2rem; color: var(--secondary-color);">Thanks! We’ll contact you shortly.</p>
        <button onclick="window.navigateTo('lead-capture')" class="btn-primary" style="margin-top: 30px; background-color: var(--secondary-color);">Capture Another Lead</button>
        <button onclick="window.navigateTo('opportunities')" class="btn-primary" style="margin-top: 30px; margin-left:10px;">View Pipeline</button>
      </div>
    `)}function H(){const e=$[0],a=e.stages.map(i=>{const n=c.filter(r=>r.pipeline_stage===i),o=n.map(r=>{const p=v.find(f=>f.id===r.contact_id);return`
        <div class="kanban-card" draggable="true" ondragstart="drag(event, '${r.id}')">
          <div class="contact-name">${p?p.name:"Unknown Contact"}</div>
          <div class="opportunity-value">$${r.value.toLocaleString()}</div>
          <div class="contact-phone">${p?p.phone:"N/A"}</div>
        </div>
      `}).join("");return`
      <div class="kanban-column" ondragover="allowDrop(event)" ondrop="drop(event, '${i}')">
        <h4>${i} <span>${n.length}</span></h4>
        <div class="kanban-cards">
          ${o}
        </div>
      </div>
    `}).join("");h.innerHTML=`
    ${g("opportunities")}
    <main class="main-content">
      <header class="view-header">
        <h2>Sales Pipeline: ${e.name}</h2>
        <button class="btn-primary">+ New Opportunity</button>
      </header>
      <div class="kanban-board">
        ${a}
      </div>
    </main>
  `}function q(e,t){const a=c.find(i=>i.id===e);a&&(a.pipeline_stage=t,t==="Completed"||t==="Paid"?a.status="won":t==="Lost"?a.status="lost":a.status="open",window.navigateTo(S),console.log(`Opportunity ${e} updated: Stage=[${t}], Status=[${a.status}]`),k("OPPORTUNITY_STAGE_UPDATED",a))}window.allowDrop=e=>{e.preventDefault()};window.drag=(e,t)=>{var a;(a=e.dataTransfer)==null||a.setData("text",t)};window.drop=(e,t)=>{var i;e.preventDefault();const a=(i=e.dataTransfer)==null?void 0:i.getData("text");a&&q(a,t)};window.navigateTo=e=>{S=e,e==="dashboard"&&C(),e==="clients"&&R(),e==="opportunities"&&H(),e==="lead-capture"&&j(),e==="builder"&&y(),e==="reports"&&N(),e==="quickstart"&&M()};C();
