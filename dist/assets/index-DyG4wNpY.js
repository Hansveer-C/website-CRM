(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const o of a)if(o.type==="childList")for(const d of o.addedNodes)d.tagName==="LINK"&&d.rel==="modulepreload"&&i(d)}).observe(document,{childList:!0,subtree:!0});function n(a){const o={};return a.integrity&&(o.integrity=a.integrity),a.referrerPolicy&&(o.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?o.credentials="include":a.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function i(a){if(a.ep)return;a.ep=!0;const o=n(a);fetch(a.href,o)}})();const O=[{id:"residential-sparkle",name:"Residential Sparkle",description:"Perfect for soft washing and home exterior care specialist.",theme:{primary:"#00d2ff",secondary:"#3a7bd5",font:"Inter"},blocks:[{id:"h1",type:"hero",data:{title:"The Cleanest House on the Block",subtitle:"Professional Soft Washing & Gutter Cleaning in Los Angeles.",buttonText:"Get My Free Estimate"}},{id:"s1",type:"services",data:{title:"Residential Services",items:["House Washing","Roof Cleaning","Gutter Brightening","Driveway Sealing"]}},{id:"c1",type:"contact",data:{title:"Request a Residential Quote"}}]},{id:"commercial-pro",name:"Commercial Pro",description:"Industrial bold styling for large-scale concrete and fleet cleaning.",theme:{primary:"#ff4b2b",secondary:"#ff416c",font:"Roboto"},blocks:[{id:"h2",type:"hero",data:{title:"Industrial Strength Cleaning",subtitle:"Reliable Fleet and Concrete Maintenance for Commercial Properties.",buttonText:"Schedule a Consultation"}},{id:"s2",type:"services",data:{title:"Commercial Solutions",items:["Fleet Washing","Dumpster Pad Cleaning","Parking Lot Restoration","Graffiti Removal"]}},{id:"t2",type:"trust",data:{title:"Trusted by Local Business Leaders",logos:["Starbucks","Walmart","Local Mall"]}}]},{id:"trust-proof",name:"The Trust Proof",description:"Heavy focus on before/after galleries and client testimonials.",theme:{primary:"#11998e",secondary:"#38ef7d",font:"Outfit"},blocks:[{id:"h3",type:"hero",data:{title:"See the Difference for Yourself",subtitle:"Real Results. Real Reviews. Real Experts.",buttonText:"View Our Gallery"}},{id:"g3",type:"gallery",data:{title:"Recent Successes",images:["Before/After 1","Before/After 2","Before/After 3"]}},{id:"t3",type:"trust",data:{title:"What Your Neighbors Say",testimonials:[{name:"Alice R.",text:"Best service ever!"},{name:"Bob S.",text:"My driveway looks new."}]}}]}],l=[{id:"c1",name:"John Doe",phone:"555-0101",email:"john@example.com",address:"123 Pine St, Seattle, WA",tags:["residential","referral"],source:"Google Search",status:"customer",created_at:"2026-02-15T10:00:00Z"},{id:"c2",name:"Jane Smith",phone:"555-0202",email:"jane@smithresidence.com",address:"456 Oak Ave, Portland, OR",tags:["lead","driveway"],source:"Facebook Ad",status:"lead",created_at:"2026-03-01T14:30:00Z"}],L=[{id:"p1",name:"Residential Cleaning Pipeline",stages:["New Lead","Quote Sent","Scheduled","Completed","Paid"]}],r=[{id:"o1",contact_id:"c2",pipeline_stage:"New Lead",value:250,assigned_to:"Hansveer",status:"open",created_at:"2026-03-01T14:35:00Z"},{id:"o2",contact_id:"c1",pipeline_stage:"Completed",value:450,assigned_to:"Hansveer",status:"won",created_at:"2026-02-15T10:05:00Z"}],$=[{id:"a1",contact_id:"c2",type:"call",description:"Initial follow-up call about driveway cleaning",due_date:"2026-03-02T09:00:00Z",completed:!0},{id:"a2",contact_id:"c2",type:"sms",description:"Sent quote via text",due_date:"2026-03-05T10:00:00Z",completed:!1}],k=[{id:"q1",contact_id:"c2",opportunity_id:"o1",status:"sent",total_amount:250,notes:"Standard driveway cleaning quote",created_at:"2026-03-02T10:00:00Z"}],_=[{id:"i1",contact_id:"c2",quote_id:"q1",status:"unpaid",amount:250,due_date:"2026-03-24T12:00:00Z",created_at:"2026-03-17T15:00:00Z"}],F=[{id:"a1",name:"Auto-follow task for new leads",trigger:"OPPORTUNITY_CREATED",action:"CREATE_TASK",actionParams:{type:"call",description:"Call new lead ASAP",dueInMinutes:10}},{id:"a2",name:"Notify when job is scheduled",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:e=>e.pipeline_stage==="Scheduled",action:"SEND_NOTIFICATION",actionParams:{message:"🎉 A job has been scheduled! Get ready."}},{id:"a3",name:"Final follow up when completed",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:e=>e.pipeline_stage==="Completed",action:"CREATE_TASK",actionParams:{type:"visit",description:"Site cleanup & final inspection",dueInDays:0}},{id:"a4",name:"Follow up on sent quote",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:e=>e.pipeline_stage==="Quote Sent",action:"CREATE_TASK",actionParams:{type:"note",description:"Follow up on quote in 24 hours",dueInDays:1}}];function N(e,t){F.filter(i=>i.trigger===e&&(!i.condition||i.condition(t))).forEach(i=>{j(i,t)})}function j(e,t){switch(e.action){case"CREATE_TASK":Q(e.actionParams,t);break;case"SEND_NOTIFICATION":q(e.actionParams,t);break}}function Q(e,t){const n=l.find(d=>d.id===t.contact_id),i=n?n.name:"Unknown",a=new Date;e.dueInDays&&a.setDate(a.getDate()+e.dueInDays),e.dueInMinutes&&a.setMinutes(a.getMinutes()+e.dueInMinutes);const o={id:"task-"+Date.now()+"-"+Math.floor(Math.random()*1e3),contact_id:t.contact_id,type:e.type||"note",description:e.description||`[AUTOMATED] Follow up for ${i}`,due_date:a.toISOString(),completed:!1};$.push(o),console.log(`[AUTOMATION: TASK CREATED] ${o.description}`)}function q(e,t){const n=l.find(o=>o.id===t.contact_id),i=n?n.name:"Unknown",a=e.message.replace("${contactName}",i);console.log(`%c[AUTOMATION: NOTIFICATION] ${a} (${i})`,"color: #007bff; font-weight: bold;"),alert(`Automation Notification: ${a}`)}const m=document.querySelector("#app");let C="dashboard",w=O[0],u=[...w.blocks],f="",p="all",g=null;function v(e){return`
    <div class="sidebar">
      <h1>PressurePro</h1>
      <nav>
        <ul>
          <li onclick="window.navigateTo('dashboard')" class="${e==="dashboard"?"active":""}">Dashboard</li>
          <li onclick="window.navigateTo('clients')" class="${e==="clients"?"active":""}">Clients & Leads</li>
          <li onclick="window.navigateTo('opportunities')" class="${e==="opportunities"?"active":""}">Opportunities</li>
          <li onclick="window.navigateTo('quotes')" class="${e==="quotes"?"active":""}">Quotes</li>
          <li onclick="window.navigateTo('invoices')" class="${e==="invoices"?"active":""}">Invoices</li>
          <li onclick="window.navigateTo('lead-capture')" class="${e==="lead-capture"?"active":""}">Lead Capture</li>
          <li onclick="window.navigateTo('builder')" class="${e==="builder"?"active":""}">Website Builder</li>
          <li onclick="window.navigateTo('reports')" class="${e==="reports"?"active":""}">Reports & Insights</li>
          <li onclick="window.navigateTo('quickstart')" class="${e==="quickstart"?"active":""}">Quickstart Guide</li>
          <li>Payments</li>
          <li>Settings</li>
        </ul>
      </nav>
    </div>
  `}function E(){const e=new Date,t=r.filter(s=>s.status==="open"),n=t.reduce((s,h)=>s+h.value,0),i=t.length,a=r.length,o=r.filter(s=>s.status==="won").length,d=a>0?o/a*100:0,y=L[0].stages.map(s=>{const h=r.filter(b=>b.pipeline_stage===s&&(b.status==="open"||b.status==="won")).reduce((b,M)=>b+M.value,0);return{stage:s,value:h}}).filter(s=>s.value>0),S=Math.max(...y.map(s=>s.value),1),D={};l.forEach(s=>{D[s.source]=(D[s.source]||0)+1});const P=Object.entries(D).map(([s,h])=>({source:s,count:h})),B=Math.max(...P.map(s=>s.count),1),A=$.filter(s=>!s.completed&&new Date(s.due_date)<e);m.innerHTML=`
    ${v("dashboard")}
    <main class="main-content">
      <header class="view-header">
        <h2>Dashboard Overview</h2>
      </header>
      
      <div class="dashboard-grid" style="grid-template-columns: repeat(4, 1fr);">
        <div class="card">
          <small style="color: #666;">Cash in Pipeline</small>
          <h3>Pipeline Value</h3>
          <p class="value" style="color: var(--primary-color);">$${n.toLocaleString(void 0,{minimumFractionDigits:0,maximumFractionDigits:0})}</p>
        </div>
        <div class="card">
          <small style="color: #666;">Action Required</small>
          <h3>Open Leads</h3>
          <p class="value">${i}</p>
        </div>
        <div class="card">
          <small style="color: #666;">Success Rate</small>
          <h3>Conv. Rate</h3>
          <p class="value">${d.toFixed(1)}%</p>
        </div>
        <div class="card" style="border-bottom: 4px solid #ff4444;">
          <small style="color: #666;">Attention Needed</small>
          <h3 style="color: #ff4444;">Overdue</h3>
          <p class="value" style="color: #ff4444;">${A.length}</p>
        </div>
      </div>

      <div class="stats-grid" style="margin-top: 30px;">
        <div class="card">
          <h3>Revenue by Pipeline Stage</h3>
          <div class="chart-container" style="margin-top: 20px;">
            ${y.map(s=>`
              <div class="report-item">
                <div class="report-item-header">
                  <span>${s.stage}</span>
                  <span style="font-weight: 600;">$${s.value.toLocaleString()}</span>
                </div>
                <div class="visual-bar-bg">
                  <div class="visual-bar-fill" style="width: ${s.value/S*100}%"></div>
                </div>
              </div>
            `).join("")||'<p style="color: #666; font-style: italic; padding: 20px;">No revenue data for active stages</p>'}
          </div>
        </div>
        <div class="card">
          <h3>Lead Sources Performance</h3>
          <div class="chart-container" style="margin-top: 20px;">
            ${P.map(s=>`
              <div class="report-item">
                <div class="report-item-header">
                  <span>${s.source}</span>
                  <span style="font-weight: 600;">${s.count} Leads</span>
                </div>
                <div class="visual-bar-bg">
                  <div class="visual-bar-fill" style="width: ${s.count/B*100}%; background: #6c757d;"></div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>

      ${A.length>0?`
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
              ${A.map(s=>{const h=l.find(b=>b.id===s.contact_id);return`
                  <tr style="background: #fffafa;">
                    <td style="font-weight: 600;">${h?h.name:"Unknown"}</td>
                    <td>${s.description}</td>
                    <td style="color: #ff4444; font-weight: 500;">${new Date(s.due_date).toLocaleDateString()}</td>
                    <td><button class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; background: #ff4444; border-radius: 4px;">Resolve</button></td>
                  </tr>
                `}).join("")}
            </tbody>
          </table>
        </div>
      `:""}
    </main>
  `}function I(){const t=l.filter(i=>{const a=i.name.toLowerCase().includes(f.toLowerCase())||i.phone.includes(f),o=p==="all"||i.status===p;return a&&o}).map(i=>{const a=$.filter(o=>o.contact_id===i.id).sort((o,d)=>new Date(d.due_date).getTime()-new Date(o.due_date).getTime())[0];return`
      <tr onclick="window.navigateTo('contact-detail', '${i.id}')" style="cursor: pointer;">
        <td style="font-weight: 600; color: var(--primary-color);">${i.name}</td>
        <td>${i.phone}</td>
        <td><span class="badge badge-${i.status}">${i.status}</span></td>
        <td><span style="font-size: 0.85rem; color: #666;">${i.source}</span></td>
        <td>${a?new Date(a.due_date).toLocaleDateString():"No activity"}</td>
        <td><button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;">View</button></td>
      </tr>
    `}).join("");m.innerHTML=`
    ${v("clients")}
    <main class="main-content">
      <header class="view-header">
        <h2>Clients & Leads</h2>
        <button class="btn-primary" onclick="window.navigateTo('lead-capture')">+ Add Lead</button>
      </header>

      <div class="card" style="margin-bottom: 24px; padding: 16px;">
        <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 300px;">
            <input type="text" id="client-search" placeholder="Search by name or phone..." 
                   value="${f}" 
                   style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn-primary" style="background: ${p==="all"?"var(--primary-color)":"#eee"}; color: ${p==="all"?"white":"#333"}" onclick="window.filterClients('all')">All</button>
            <button class="btn-primary" style="background: ${p==="lead"?"var(--primary-color)":"#eee"}; color: ${p==="lead"?"white":"#333"}" onclick="window.filterClients('lead')">Leads</button>
            <button class="btn-primary" style="background: ${p==="customer"?"var(--primary-color)":"#eee"}; color: ${p==="customer"?"white":"#333"}" onclick="window.filterClients('customer')">Customers</button>
            <button class="btn-primary" style="background: ${p==="lost"?"var(--primary-color)":"#eee"}; color: ${p==="lost"?"white":"#333"}" onclick="window.filterClients('lost')">Lost</button>
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
            ${t||'<tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;">No clients found matching your criteria</td></tr>'}
          </tbody>
        </table>
      </div>
    </main>
  `;const n=document.getElementById("client-search");n==null||n.addEventListener("input",i=>{f=i.target.value,I()}),f&&(n.focus(),n.setSelectionRange(f.length,f.length))}window.filterClients=e=>{p=e,I()};function T(){var e;m.innerHTML=`
    ${v("builder")}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; align-items: center; gap: 20px;">
          <h2>Website Builder</h2>
          <select id="template-select" style="padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
            ${O.map(t=>`<option value="${t.id}" ${t.id===w.id?"selected":""}>${t.name}</option>`).join("")}
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
          ${H()}
        </div>
      </div>
    </main>
  `,(e=document.getElementById("template-select"))==null||e.addEventListener("change",t=>{const n=t.target.value,i=O.find(a=>a.id===n);i&&(w=i,u=[...i.blocks],T())}),document.querySelectorAll(".draggable-item").forEach(t=>{t.addEventListener("click",()=>{const n=t.getAttribute("data-type");window.addBlock(n)})})}function H(){return u.length===0?`<div class="canvas-section" style="border: 2px dashed #007bff; background: #f0f7ff;">
              <p style="color: #007bff;">Click an element to add it here</p>
            </div>`:u.map((e,t)=>{let n="";switch(e.type){case"hero":n=`
          <div class="canvas-hero" style="background: linear-gradient(135deg, ${w.theme.primary}, ${w.theme.secondary});">
            <h1>${e.data.title}</h1>
            <p>${e.data.subtitle}</p>
            <button class="btn-primary" style="background: white; color: ${w.theme.primary}; margin-top: 20px;">${e.data.buttonText}</button>
          </div>
        `;break;case"services":n=`
          <div class="canvas-section">
            <h3>${e.data.title}</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
              ${e.data.items.map(i=>`<div style="padding: 10px; border: 1px solid #eee; border-radius: 4px;">${i}</div>`).join("")}
            </div>
          </div>
        `;break;case"contact":n=`
          <div class="canvas-section">
            <h3>${e.data.title}</h3>
            <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 10px; max-width: 400px; margin-left: auto; margin-right: auto;">
              <input type="text" placeholder="Name" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
              <input type="email" placeholder="Email" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
              <button class="btn-primary" style="background: ${w.theme.primary}">Send Quote Request</button>
            </div>
          </div>
        `;break;case"gallery":n=`
          <div class="canvas-section">
            <h3>${e.data.title}</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 20px;">
              ${e.data.images.map(i=>`<div style="height: 100px; background: #eee; border-radius: 4px; display: flex; align-items: center; justify-content: center;">${i}</div>`).join("")}
            </div>
          </div>
        `;break;case"trust":n=`
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
        ${n}
      </div>
    `}).join("")}window.addBlock=e=>{const t={id:Date.now().toString(),type:e,data:U(e)};u.push(t),T()};window.removeBlock=e=>{u.splice(e,1),T()};window.moveBlock=(e,t)=>{const n=e+t;if(n>=0&&n<u.length){const i=u[e];u[e]=u[n],u[n]=i,T()}};function U(e){switch(e){case"hero":return{title:"Insert Title",subtitle:"Insert Subtitle",buttonText:"Click Me"};case"services":return{title:"Our Services",items:["Service 1","Service 2","Service 3"]};case"contact":return{title:"Get In Touch"};case"gallery":return{title:"Our Work",images:["Image 1","Image 2","Image 3"]};case"trust":return{title:"What Clients Say",testimonials:[{name:"John D.",text:"Great Job!"}]};default:return{}}}function G(){m.innerHTML=`
    ${v("reports")}
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
  `}function W(){m.innerHTML=`
    ${v("quickstart")}
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
  `}function z(){var e;m.innerHTML=`
    ${v("lead-capture")}
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
  `,(e=document.getElementById("lead-form"))==null||e.addEventListener("submit",Y)}function Y(e){e.preventDefault();const t=document.getElementById("lead_name").value,n=document.getElementById("lead_phone").value,i=document.getElementById("lead_email").value,a=document.getElementById("lead_address").value,o=document.getElementById("lead_service").value,d="c"+(l.length+1),c="o"+(r.length+1);l.push({id:d,name:t,phone:n,email:i,address:a,tags:["new-lead"],source:"Lead Capture Form",service:o,status:"lead",created_at:new Date().toISOString()});const y={id:c,contact_id:d,pipeline_stage:"New Lead",value:0,assigned_to:"Hansveer",status:"open",created_at:new Date().toISOString()};r.push(y),N("OPPORTUNITY_CREATED",y);const S=document.querySelector(".lead-form-container");S&&(S.innerHTML=`
      <div style="text-align: center; padding: 40px 0;">
        <div style="font-size: 3rem; color: var(--primary-color); margin-bottom: 20px;">✓</div>
        <h2 style="margin-bottom: 10px;">Submission Received</h2>
        <p style="font-size: 1.2rem; color: var(--secondary-color);">Thanks! We’ll contact you shortly.</p>
        <button onclick="window.navigateTo('lead-capture')" class="btn-primary" style="margin-top: 30px; background-color: var(--secondary-color);">Capture Another Lead</button>
        <button onclick="window.navigateTo('opportunities')" class="btn-primary" style="margin-top: 30px; margin-left:10px;">View Pipeline</button>
      </div>
    `)}function Z(){const e=L[0],n=e.stages.map(i=>{const a=r.filter(d=>d.pipeline_stage===i),o=a.map(d=>{const c=l.find(y=>y.id===d.contact_id);return`
        <div class="kanban-card" draggable="true" ondragstart="drag(event, '${d.id}')" onclick="window.navigateTo('contact-detail', '${d.contact_id}')" style="cursor: pointer;">
          <div class="contact-name">${c?c.name:"Unknown Contact"}</div>
          <div class="opportunity-value" style="display: flex; align-items: center; gap: 4px;">
            <span>$</span>
            <input type="number" 
                   value="${d.value}" 
                   class="inline-input" 
                   style="font-weight: 600; width: 80px;"
                   onclick="event.stopPropagation()" 
                   onchange="window.updateOpportunityField('${d.id}', 'value', this.value)">
          </div>
          <div class="contact-phone">${c?c.phone:"N/A"}</div>
        </div>
      `}).join("");return`
      <div class="kanban-column" ondragover="allowDrop(event)" ondrop="drop(event, '${i}')">
        <h4>${i} <span>${a.length}</span></h4>
        <div class="kanban-cards">
          ${o}
        </div>
      </div>
    `}).join("");m.innerHTML=`
    ${v("opportunities")}
    <main class="main-content">
      <header class="view-header">
        <h2>Sales Pipeline: ${e.name}</h2>
        <button class="btn-primary">+ New Opportunity</button>
      </header>
      <div class="kanban-board">
        ${n}
      </div>
    </main>
  `}function K(){const e=k.map(t=>{const n=l.find(i=>i.id===t.contact_id);return`
      <tr onclick="window.navigateTo('contact-detail', '${t.contact_id}')" style="cursor: pointer;">
        <td style="font-weight: 600; color: var(--primary-color);">Q-${t.id}</td>
        <td>${n?n.name:"Unknown"}</td>
        <td><span class="badge badge-${t.status}">${t.status}</span></td>
        <td style="font-weight: 600;">$${t.total_amount.toLocaleString()}</td>
        <td>${new Date(t.created_at).toLocaleDateString()}</td>
        <td><button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;">View</button></td>
      </tr>
    `}).join("");m.innerHTML=`
    ${v("quotes")}
    <main class="main-content">
      <header class="view-header">
        <h2>Quotes</h2>
        <button class="btn-primary" onclick="alert('Create Quote from Client Detail page')">+ New Quote</button>
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
            ${e||'<tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;">No quotes found</td></tr>'}
          </tbody>
        </table>
      </div>
    </main>
  `}function J(){const e=_.map(t=>{const n=l.find(i=>i.id===t.contact_id);return`
      <tr onclick="window.navigateTo('contact-detail', '${t.contact_id}')" style="cursor: pointer;">
        <td style="font-weight: 600; color: var(--primary-color);">INV-${t.id}</td>
        <td>${n?n.name:"Unknown"}</td>
        <td><span class="badge badge-${t.status}">${t.status}</span></td>
        <td style="font-weight: 600;">$${t.amount.toLocaleString()}</td>
        <td>${new Date(t.due_date).toLocaleDateString()}</td>
        <td><button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;">View</button></td>
      </tr>
    `}).join("");m.innerHTML=`
    ${v("invoices")}
    <main class="main-content">
      <header class="view-header">
        <h2>Invoices</h2>
        <button class="btn-primary" onclick="alert('Create Invoice from Quote or Client Detail page')">+ New Invoice</button>
      </header>

      <div class="card" style="padding: 0; overflow: hidden;">
        <table class="clients-table" style="box-shadow: none; margin-top: 0;">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Due Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${e||'<tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;">No invoices found</td></tr>'}
          </tbody>
        </table>
      </div>
    </main>
  `}function R(e,t){const n=r.find(i=>i.id===e);n&&(n.pipeline_stage=t,t==="Completed"||t==="Paid"?n.status="won":t==="Lost"?n.status="lost":n.status="open",window.navigateTo(C,g||void 0),console.log(`Opportunity ${e} updated: Stage=[${t}], Status=[${n.status}]`),N("OPPORTUNITY_STAGE_UPDATED",n))}window.updateOpportunityStage=R;window.allowDrop=e=>{e.preventDefault()};window.drag=(e,t)=>{var n;(n=e.dataTransfer)==null||n.setData("text",t)};window.drop=(e,t)=>{var i;e.preventDefault();const n=(i=e.dataTransfer)==null?void 0:i.getData("text");n&&R(n,t)};window.navigateTo=(e,t)=>{C=e,t&&(g=t),e==="dashboard"&&E(),e==="clients"&&I(),e==="opportunities"&&Z(),e==="quotes"&&K(),e==="invoices"&&J(),e==="lead-capture"&&z(),e==="builder"&&T(),e==="reports"&&G(),e==="quickstart"&&W(),e==="contact-detail"&&g&&x(g)};function x(e){const t=l.find(a=>a.id===e);if(!t)return;const n=r.filter(a=>a.contact_id===e),i=$.filter(a=>a.contact_id===e).sort((a,o)=>new Date(o.due_date).getTime()-new Date(a.due_date).getTime());m.innerHTML=`
    ${v("clients")}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; align-items: center; gap: 15px;">
          <button onclick="window.navigateTo('clients')" class="btn-primary" style="background: #eee; color: #333; padding: 5px 10px;">← Back</button>
          <h2>${t.name}</h2>
          <span class="badge badge-${t.status}">${t.status}</span>
        </div>
      </header>

      <div class="action-bar">
        <button class="btn-primary" onclick="window.logCall('${e}')">📞 Log Call</button>
        <button class="btn-primary" onclick="window.addNote('${e}')" style="background: var(--secondary-color);">📝 Add Note</button>
        <button class="btn-primary" onclick="window.createOpportunity('${e}')" style="background: #28a745;">💰 New Opportunity</button>
        <button class="btn-primary" onclick="window.createQuote('${e}')" style="background: #17a2b8;">📄 Create Quote</button>
        <button class="btn-primary" onclick="window.createInvoice('${e}')" style="background: #e67e22;">💳 Create Invoice</button>
      </div>

      <div class="detail-container">
        <!-- Sidebar Info -->
        <aside class="detail-sidebar">
          <div class="card">
            <h3>Contact Information</h3>
            <div style="margin-top: 15px; display: flex; flex-direction: column; gap: 8px;">
              <div>
                <label style="display: block; font-size: 0.75rem; color: #666;">Phone</label>
                <input type="text" value="${t.phone}" class="inline-input" onchange="window.updateContactField('${e}', 'phone', this.value)" style="width: 100%;">
              </div>
              <div>
                <label style="display: block; font-size: 0.75rem; color: #666;">Email</label>
                <input type="email" value="${t.email}" class="inline-input" onchange="window.updateContactField('${e}', 'email', this.value)" style="width: 100%;">
              </div>
              <p><strong>Address:</strong> ${t.address}</p>
              <p><strong>Source:</strong> ${t.source}</p>
              <p><strong>Created:</strong> ${new Date(t.created_at).toLocaleDateString()}</p>
            </div>
            
            <h3 style="margin-top: 25px;">Active Opportunities</h3>
            <div style="margin-top: 15px;">
              ${n.map(a=>`
                <div class="opportunity-strip">
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center;">
                      <span>$</span>
                      <input type="number" 
                             value="${a.value}" 
                             class="inline-input" 
                             onchange="window.updateOpportunityField('${a.id}', 'value', this.value)" 
                             style="width: 80px; font-weight: 600;">
                    </div>
                    <select class="inline-select" onchange="window.updateOpportunityStage('${a.id}', this.value)">
                      ${L[0].stages.map(o=>`<option value="${o}" ${o===a.pipeline_stage?"selected":""}>${o}</option>`).join("")}
                    </select>
                  </div>
                  <span class="badge badge-${a.status}" style="font-size: 0.7rem;">${a.status}</span>
                </div>
              `).join("")||"<p>No opportunities</p>"}
            </div>
          </div>
        </aside>

        <!-- Main Timeline -->
        <div class="timeline-container">
          <div class="card">
            <h3>Activity Timeline</h3>
            <div class="timeline">
              ${i.map(a=>`
                <div class="timeline-item">
                  <div class="timeline-dot" style="background: ${a.completed?"#28a745":"var(--primary-color)"}"></div>
                  <div class="timeline-content">
                    <div class="timeline-time">${new Date(a.due_date).toLocaleString()}</div>
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                      <div>
                        <strong>${a.type.toUpperCase()}</strong>: ${a.description}
                      </div>
                      ${a.completed?'<span style="color: #28a745;">✓</span>':`<button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem; background: #28a745;" onclick="window.completeTask('${a.id}')">Complete</button>`}
                    </div>
                  </div>
                </div>
              `).join("")||'<p style="padding: 20px;">No activity logged.</p>'}
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
                  ${k.filter(a=>a.contact_id===e).map(a=>`
                    <tr>
                      <td style="font-weight: 600;">Q-${a.id}</td>
                      <td><span class="badge badge-${a.status}">${a.status}</span></td>
                      <td>$${a.total_amount.toLocaleString()}</td>
                      <td><button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem;">View</button></td>
                    </tr>
                  `).join("")||'<tr><td colspan="4" style="text-align: center; color: #666; padding: 20px;">No quotes created.</td></tr>'}
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
                  ${_.filter(a=>a.contact_id===e).map(a=>`
                    <tr>
                      <td style="font-weight: 600;">INV-${a.id}</td>
                      <td><span class="badge badge-${a.status}">${a.status}</span></td>
                      <td>$${a.amount.toLocaleString()}</td>
                      <td>${new Date(a.due_date).toLocaleDateString()}</td>
                      <td><button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem;">View</button></td>
                    </tr>
                  `).join("")||'<tr><td colspan="5" style="text-align: center; color: #666; padding: 20px;">No invoices created.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  `}window.logCall=e=>{const t=prompt("Enter call summary:");t&&($.push({id:"act-"+Date.now(),contact_id:e,type:"call",description:t,due_date:new Date().toISOString(),completed:!0}),x(e))};window.addNote=e=>{const t=prompt("Enter your note:");t&&($.push({id:"act-"+Date.now(),contact_id:e,type:"note",description:t,due_date:new Date().toISOString(),completed:!0}),x(e))};window.completeTask=e=>{const t=$.find(n=>n.id===e);t&&(t.completed=!0,g&&x(g))};window.createOpportunity=e=>{const t=prompt("Enter Opportunity value (e.g. 500):","0"),n=parseFloat(t||"0"),i={id:"o"+(r.length+1)+"-"+Math.floor(Math.random()*100),contact_id:e,pipeline_stage:"New Lead",value:isNaN(n)?0:n,assigned_to:"Hansveer",status:"open",created_at:new Date().toISOString()};r.push(i),N("OPPORTUNITY_CREATED",i),x(e)};window.updateOpportunityField=(e,t,n)=>{const i=r.find(a=>a.id===e);i&&(t==="value"?i.value=parseFloat(n)||0:i[t]=n,window.navigateTo(C,g||void 0))};window.updateContactField=(e,t,n)=>{const i=l.find(a=>a.id===e);i&&(i[t]=n,window.navigateTo(C,g||void 0))};window.createQuote=e=>{if(!prompt("Enter Service Name:","Driveway Cleaning"))return;const n=prompt("Enter Total Amount:","250"),i=parseFloat(n||"0");if(isNaN(i))return;const a="q"+(k.length+1)+"-"+Math.floor(Math.random()*100),o=r.filter(c=>c.contact_id===e),d=o.length>0?o[0].id:"new";k.push({id:a,contact_id:e,opportunity_id:d,status:"draft",total_amount:i,notes:"Created via CRM",created_at:new Date().toISOString()}),x(e)};window.createInvoice=e=>{const t=k.filter(c=>c.contact_id===e);if(t.length===0){alert("Please create a Quote first.");return}const n=t[t.length-1],i=prompt("Enter Invoice Amount:",n.total_amount.toString()),a=parseFloat(i||"0");if(isNaN(a))return;const o="i"+(_.length+1)+"-"+Math.floor(Math.random()*100),d=new Date;d.setDate(d.getDate()+7),_.push({id:o,contact_id:e,quote_id:n.id,amount:a,status:"unpaid",due_date:d.toISOString(),created_at:new Date().toISOString()}),x(e)};E();
