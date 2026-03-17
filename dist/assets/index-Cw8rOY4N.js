(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const s of a)if(s.type==="childList")for(const o of s.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&i(o)}).observe(document,{childList:!0,subtree:!0});function n(a){const s={};return a.integrity&&(s.integrity=a.integrity),a.referrerPolicy&&(s.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?s.credentials="include":a.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function i(a){if(a.ep)return;a.ep=!0;const s=n(a);fetch(a.href,s)}})();const A=[{id:"residential-sparkle",name:"Residential Sparkle",description:"Perfect for soft washing and home exterior care specialist.",theme:{primary:"#00d2ff",secondary:"#3a7bd5",font:"Inter"},blocks:[{id:"h1",type:"hero",data:{title:"The Cleanest House on the Block",subtitle:"Professional Soft Washing & Gutter Cleaning in Los Angeles.",buttonText:"Get My Free Estimate"}},{id:"s1",type:"services",data:{title:"Residential Services",items:["House Washing","Roof Cleaning","Gutter Brightening","Driveway Sealing"]}},{id:"c1",type:"contact",data:{title:"Request a Residential Quote"}}]},{id:"commercial-pro",name:"Commercial Pro",description:"Industrial bold styling for large-scale concrete and fleet cleaning.",theme:{primary:"#ff4b2b",secondary:"#ff416c",font:"Roboto"},blocks:[{id:"h2",type:"hero",data:{title:"Industrial Strength Cleaning",subtitle:"Reliable Fleet and Concrete Maintenance for Commercial Properties.",buttonText:"Schedule a Consultation"}},{id:"s2",type:"services",data:{title:"Commercial Solutions",items:["Fleet Washing","Dumpster Pad Cleaning","Parking Lot Restoration","Graffiti Removal"]}},{id:"t2",type:"trust",data:{title:"Trusted by Local Business Leaders",logos:["Starbucks","Walmart","Local Mall"]}}]},{id:"trust-proof",name:"The Trust Proof",description:"Heavy focus on before/after galleries and client testimonials.",theme:{primary:"#11998e",secondary:"#38ef7d",font:"Outfit"},blocks:[{id:"h3",type:"hero",data:{title:"See the Difference for Yourself",subtitle:"Real Results. Real Reviews. Real Experts.",buttonText:"View Our Gallery"}},{id:"g3",type:"gallery",data:{title:"Recent Successes",images:["Before/After 1","Before/After 2","Before/After 3"]}},{id:"t3",type:"trust",data:{title:"What Your Neighbors Say",testimonials:[{name:"Alice R.",text:"Best service ever!"},{name:"Bob S.",text:"My driveway looks new."}]}}]}],c=[{id:"c1",name:"John Doe",phone:"555-0101",email:"john@example.com",address:"123 Pine St, Seattle, WA",tags:["residential","referral"],source:"Google Search",status:"customer",created_at:"2026-02-15T10:00:00Z"},{id:"c2",name:"Jane Smith",phone:"555-0202",email:"jane@smithresidence.com",address:"456 Oak Ave, Portland, OR",tags:["lead","driveway"],source:"Facebook Ad",status:"lead",created_at:"2026-03-01T14:30:00Z"}],O=[{id:"p1",name:"Residential Cleaning Pipeline",stages:["New Lead","Quote Sent","Scheduled","Completed","Paid"]}],l=[{id:"o1",contact_id:"c2",pipeline_stage:"New Lead",value:250,assigned_to:"Hansveer",status:"open",created_at:"2026-03-01T14:35:00Z"},{id:"o2",contact_id:"c1",pipeline_stage:"Completed",value:450,assigned_to:"Hansveer",status:"won",created_at:"2026-02-15T10:05:00Z"}],x=[{id:"a1",contact_id:"c2",type:"call",description:"Initial follow-up call about driveway cleaning",due_date:"2026-03-02T09:00:00Z",completed:!0},{id:"a2",contact_id:"c2",type:"sms",description:"Sent quote via text",due_date:"2026-03-05T10:00:00Z",completed:!1}],$=[{id:"q1",contact_id:"c2",opportunity_id:"o1",status:"sent",total_amount:250,notes:"Standard driveway cleaning quote",created_at:"2026-03-02T10:00:00Z"}],Q=[{id:"qi1",quote_id:"q1",service_name:"Driveway Cleaning",description:"High pressure wash for standard 2-car driveway",quantity:1,unit_price:250,total:250}],I=[{id:"i1",contact_id:"c2",quote_id:"q1",status:"unpaid",amount:250,due_date:"2026-03-24T12:00:00Z",created_at:"2026-03-17T15:00:00Z"}],F=[{id:"a1",name:"Auto-follow task for new leads",trigger:"OPPORTUNITY_CREATED",action:"CREATE_TASK",actionParams:{type:"call",description:"Call new lead ASAP",dueInMinutes:10}},{id:"a2",name:"Notify when job is scheduled",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:t=>t.pipeline_stage==="Scheduled",action:"SEND_NOTIFICATION",actionParams:{message:"🎉 A job has been scheduled! Get ready."}},{id:"a3",name:"Final follow up when completed",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:t=>t.pipeline_stage==="Completed",action:"CREATE_TASK",actionParams:{type:"visit",description:"Site cleanup & final inspection",dueInDays:0}},{id:"a4",name:"Follow up on sent quote",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:t=>t.pipeline_stage==="Quote Sent",action:"CREATE_TASK",actionParams:{type:"note",description:"Follow up on quote in 24 hours",dueInDays:1}}];function N(t,e){F.filter(i=>i.trigger===t&&(!i.condition||i.condition(e))).forEach(i=>{j(i,e)})}function j(t,e){switch(t.action){case"CREATE_TASK":H(t.actionParams,e);break;case"SEND_NOTIFICATION":U(t.actionParams,e);break}}function H(t,e){const n=c.find(o=>o.id===e.contact_id),i=n?n.name:"Unknown",a=new Date;t.dueInDays&&a.setDate(a.getDate()+t.dueInDays),t.dueInMinutes&&a.setMinutes(a.getMinutes()+t.dueInMinutes);const s={id:"task-"+Date.now()+"-"+Math.floor(Math.random()*1e3),contact_id:e.contact_id,type:t.type||"note",description:t.description||`[AUTOMATED] Follow up for ${i}`,due_date:a.toISOString(),completed:!1};x.push(s),console.log(`[AUTOMATION: TASK CREATED] ${s.description}`)}function U(t,e){const n=c.find(s=>s.id===e.contact_id),i=n?n.name:"Unknown",a=t.message.replace("${contactName}",i);console.log(`%c[AUTOMATION: NOTIFICATION] ${a} (${i})`,"color: #007bff; font-weight: bold;"),alert(`Automation Notification: ${a}`)}const u=document.querySelector("#app");let C="dashboard",f=A[0],h=[...f.blocks],b="",p="all",g=null,G=[{service:"",description:"",quantity:1,price:0}];window.newQuoteLineItems=G;let z="";window.newQuoteContactId=z;let W="";window.newQuoteOpportunityId=W;function m(t){return`
    <div class="sidebar">
      <h1>PressurePro</h1>
      <nav>
        <ul>
          <li onclick="window.navigateTo('dashboard')" class="${t==="dashboard"?"active":""}">Dashboard</li>
          <li onclick="window.navigateTo('clients')" class="${t==="clients"?"active":""}">Clients & Leads</li>
          <li onclick="window.navigateTo('opportunities')" class="${t==="opportunities"?"active":""}">Opportunities</li>
          <li onclick="window.navigateTo('quotes')" class="${t==="quotes"?"active":""}">Quotes</li>
          <li onclick="window.navigateTo('invoices')" class="${t==="invoices"?"active":""}">Invoices</li>
          <li onclick="window.navigateTo('lead-capture')" class="${t==="lead-capture"?"active":""}">Lead Capture</li>
          <li onclick="window.navigateTo('builder')" class="${t==="builder"?"active":""}">Website Builder</li>
          <li onclick="window.navigateTo('reports')" class="${t==="reports"?"active":""}">Reports & Insights</li>
          <li onclick="window.navigateTo('quickstart')" class="${t==="quickstart"?"active":""}">Quickstart Guide</li>
          <li>Payments</li>
          <li>Settings</li>
        </ul>
      </nav>
    </div>
  `}function E(){const t=new Date,e=l.filter(d=>d.status==="open"),n=e.reduce((d,v)=>d+v.value,0),i=e.length,a=l.length,s=l.filter(d=>d.status==="won").length,o=a>0?s/a*100:0,y=O[0].stages.map(d=>{const v=l.filter(w=>w.pipeline_stage===d&&(w.status==="open"||w.status==="won")).reduce((w,B)=>w+B.value,0);return{stage:d,value:v}}).filter(d=>d.value>0),_=Math.max(...y.map(d=>d.value),1),D={};c.forEach(d=>{D[d.source]=(D[d.source]||0)+1});const q=Object.entries(D).map(([d,v])=>({source:d,count:v})),M=Math.max(...q.map(d=>d.count),1),L=x.filter(d=>!d.completed&&new Date(d.due_date)<t);u.innerHTML=`
    ${m("dashboard")}
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
          <p class="value">${o.toFixed(1)}%</p>
        </div>
        <div class="card" style="border-bottom: 4px solid #ff4444;">
          <small style="color: #666;">Attention Needed</small>
          <h3 style="color: #ff4444;">Overdue</h3>
          <p class="value" style="color: #ff4444;">${L.length}</p>
        </div>
      </div>

      <div class="stats-grid" style="margin-top: 30px;">
        <div class="card">
          <h3>Revenue by Pipeline Stage</h3>
          <div class="chart-container" style="margin-top: 20px;">
            ${y.map(d=>`
              <div class="report-item">
                <div class="report-item-header">
                  <span>${d.stage}</span>
                  <span style="font-weight: 600;">$${d.value.toLocaleString()}</span>
                </div>
                <div class="visual-bar-bg">
                  <div class="visual-bar-fill" style="width: ${d.value/_*100}%"></div>
                </div>
              </div>
            `).join("")||'<p style="color: #666; font-style: italic; padding: 20px;">No revenue data for active stages</p>'}
          </div>
        </div>
        <div class="card">
          <h3>Lead Sources Performance</h3>
          <div class="chart-container" style="margin-top: 20px;">
            ${q.map(d=>`
              <div class="report-item">
                <div class="report-item-header">
                  <span>${d.source}</span>
                  <span style="font-weight: 600;">${d.count} Leads</span>
                </div>
                <div class="visual-bar-bg">
                  <div class="visual-bar-fill" style="width: ${d.count/M*100}%; background: #6c757d;"></div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>

      ${L.length>0?`
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
              ${L.map(d=>{const v=c.find(w=>w.id===d.contact_id);return`
                  <tr style="background: #fffafa;">
                    <td style="font-weight: 600;">${v?v.name:"Unknown"}</td>
                    <td>${d.description}</td>
                    <td style="color: #ff4444; font-weight: 500;">${new Date(d.due_date).toLocaleDateString()}</td>
                    <td><button class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; background: #ff4444; border-radius: 4px;">Resolve</button></td>
                  </tr>
                `}).join("")}
            </tbody>
          </table>
        </div>
      `:""}
    </main>
  `}function P(){const e=c.filter(i=>{const a=i.name.toLowerCase().includes(b.toLowerCase())||i.phone.includes(b),s=p==="all"||i.status===p;return a&&s}).map(i=>{const a=x.filter(s=>s.contact_id===i.id).sort((s,o)=>new Date(o.due_date).getTime()-new Date(s.due_date).getTime())[0];return`
      <tr onclick="window.navigateTo('contact-detail', '${i.id}')" style="cursor: pointer;">
        <td style="font-weight: 600; color: var(--primary-color);">${i.name}</td>
        <td>${i.phone}</td>
        <td><span class="badge badge-${i.status}">${i.status}</span></td>
        <td><span style="font-size: 0.85rem; color: #666;">${i.source}</span></td>
        <td>${a?new Date(a.due_date).toLocaleDateString():"No activity"}</td>
        <td><button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;">View</button></td>
      </tr>
    `}).join("");u.innerHTML=`
    ${m("clients")}
    <main class="main-content">
      <header class="view-header">
        <h2>Clients & Leads</h2>
        <button class="btn-primary" onclick="window.navigateTo('lead-capture')">+ Add Lead</button>
      </header>

      <div class="card" style="margin-bottom: 24px; padding: 16px;">
        <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 300px;">
            <input type="text" id="client-search" placeholder="Search by name or phone..." 
                   value="${b}" 
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
            ${e||'<tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;">No clients found matching your criteria</td></tr>'}
          </tbody>
        </table>
      </div>
    </main>
  `;const n=document.getElementById("client-search");n==null||n.addEventListener("input",i=>{b=i.target.value,P()}),b&&(n.focus(),n.setSelectionRange(b.length,b.length))}window.filterClients=t=>{p=t,P()};function S(){var t;u.innerHTML=`
    ${m("builder")}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; align-items: center; gap: 20px;">
          <h2>Website Builder</h2>
          <select id="template-select" style="padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
            ${A.map(e=>`<option value="${e.id}" ${e.id===f.id?"selected":""}>${e.name}</option>`).join("")}
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
          ${Y()}
        </div>
      </div>
    </main>
  `,(t=document.getElementById("template-select"))==null||t.addEventListener("change",e=>{const n=e.target.value,i=A.find(a=>a.id===n);i&&(f=i,h=[...i.blocks],S())}),document.querySelectorAll(".draggable-item").forEach(e=>{e.addEventListener("click",()=>{const n=e.getAttribute("data-type");window.addBlock(n)})})}function Y(){return h.length===0?`<div class="canvas-section" style="border: 2px dashed #007bff; background: #f0f7ff;">
              <p style="color: #007bff;">Click an element to add it here</p>
            </div>`:h.map((t,e)=>{let n="";switch(t.type){case"hero":n=`
          <div class="canvas-hero" style="background: linear-gradient(135deg, ${f.theme.primary}, ${f.theme.secondary});">
            <h1>${t.data.title}</h1>
            <p>${t.data.subtitle}</p>
            <button class="btn-primary" style="background: white; color: ${f.theme.primary}; margin-top: 20px;">${t.data.buttonText}</button>
          </div>
        `;break;case"services":n=`
          <div class="canvas-section">
            <h3>${t.data.title}</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
              ${t.data.items.map(i=>`<div style="padding: 10px; border: 1px solid #eee; border-radius: 4px;">${i}</div>`).join("")}
            </div>
          </div>
        `;break;case"contact":n=`
          <div class="canvas-section">
            <h3>${t.data.title}</h3>
            <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 10px; max-width: 400px; margin-left: auto; margin-right: auto;">
              <input type="text" placeholder="Name" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
              <input type="email" placeholder="Email" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
              <button class="btn-primary" style="background: ${f.theme.primary}">Send Quote Request</button>
            </div>
          </div>
        `;break;case"gallery":n=`
          <div class="canvas-section">
            <h3>${t.data.title}</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 20px;">
              ${t.data.images.map(i=>`<div style="height: 100px; background: #eee; border-radius: 4px; display: flex; align-items: center; justify-content: center;">${i}</div>`).join("")}
            </div>
          </div>
        `;break;case"trust":n=`
          <div class="canvas-section">
            <h3>${t.data.title}</h3>
            <div style="display: flex; justify-content: center; gap: 30px; margin-top: 20px; opacity: 0.6;">
              ${(t.data.logos||[]).map(i=>`<strong>${i}</strong>`).join("")}
              ${(t.data.testimonials||[]).map(i=>`<div><p>"${i.text}"</p><small>- ${i.name}</small></div>`).join("")}
            </div>
          </div>
        `;break}return`
      <div class="block-wrapper" style="position: relative; width: 100%;">
        <div style="position: absolute; right: -40px; top: 0; display: flex; flex-direction: column; gap: 5px;">
           <button onclick="window.removeBlock(${e})" style="background: #ff4444; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer;">×</button>
           <button onclick="window.moveBlock(${e}, -1)" style="background: #eee; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">↑</button>
           <button onclick="window.moveBlock(${e}, 1)" style="background: #eee; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">↓</button>
        </div>
        ${n}
      </div>
    `}).join("")}window.addBlock=t=>{const e={id:Date.now().toString(),type:t,data:Z(t)};h.push(e),S()};window.removeBlock=t=>{h.splice(t,1),S()};window.moveBlock=(t,e)=>{const n=t+e;if(n>=0&&n<h.length){const i=h[t];h[t]=h[n],h[n]=i,S()}};function Z(t){switch(t){case"hero":return{title:"Insert Title",subtitle:"Insert Subtitle",buttonText:"Click Me"};case"services":return{title:"Our Services",items:["Service 1","Service 2","Service 3"]};case"contact":return{title:"Get In Touch"};case"gallery":return{title:"Our Work",images:["Image 1","Image 2","Image 3"]};case"trust":return{title:"What Clients Say",testimonials:[{name:"John D.",text:"Great Job!"}]};default:return{}}}function K(){u.innerHTML=`
    ${m("reports")}
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
  `}function J(){u.innerHTML=`
    ${m("quickstart")}
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
  `}function V(){var t;u.innerHTML=`
    ${m("lead-capture")}
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
  `,(t=document.getElementById("lead-form"))==null||t.addEventListener("submit",X)}function X(t){t.preventDefault();const e=document.getElementById("lead_name").value,n=document.getElementById("lead_phone").value,i=document.getElementById("lead_email").value,a=document.getElementById("lead_address").value,s=document.getElementById("lead_service").value,o="c"+(c.length+1),r="o"+(l.length+1);c.push({id:o,name:e,phone:n,email:i,address:a,tags:["new-lead"],source:"Lead Capture Form",service:s,status:"lead",created_at:new Date().toISOString()});const y={id:r,contact_id:o,pipeline_stage:"New Lead",value:0,assigned_to:"Hansveer",status:"open",created_at:new Date().toISOString()};l.push(y),N("OPPORTUNITY_CREATED",y);const _=document.querySelector(".lead-form-container");_&&(_.innerHTML=`
      <div style="text-align: center; padding: 40px 0;">
        <div style="font-size: 3rem; color: var(--primary-color); margin-bottom: 20px;">✓</div>
        <h2 style="margin-bottom: 10px;">Submission Received</h2>
        <p style="font-size: 1.2rem; color: var(--secondary-color);">Thanks! We’ll contact you shortly.</p>
        <button onclick="window.navigateTo('lead-capture')" class="btn-primary" style="margin-top: 30px; background-color: var(--secondary-color);">Capture Another Lead</button>
        <button onclick="window.navigateTo('opportunities')" class="btn-primary" style="margin-top: 30px; margin-left:10px;">View Pipeline</button>
      </div>
    `)}function tt(){const t=O[0],n=t.stages.map(i=>{const a=l.filter(o=>o.pipeline_stage===i),s=a.map(o=>{const r=c.find(y=>y.id===o.contact_id);return`
        <div class="kanban-card" draggable="true" ondragstart="drag(event, '${o.id}')" onclick="window.navigateTo('contact-detail', '${o.contact_id}')" style="cursor: pointer;">
          <div class="contact-name">${r?r.name:"Unknown Contact"}</div>
          <div class="opportunity-value" style="display: flex; align-items: center; gap: 4px;">
            <span>$</span>
            <input type="number" 
                   value="${o.value}" 
                   class="inline-input" 
                   style="font-weight: 600; width: 80px;"
                   onclick="event.stopPropagation()" 
                   onchange="window.updateOpportunityField('${o.id}', 'value', this.value)">
          </div>
          <div class="contact-phone">${r?r.phone:"N/A"}</div>
        </div>
      `}).join("");return`
      <div class="kanban-column" ondragover="allowDrop(event)" ondrop="drop(event, '${i}')">
        <h4>${i} <span>${a.length}</span></h4>
        <div class="kanban-cards">
          ${s}
        </div>
      </div>
    `}).join("");u.innerHTML=`
    ${m("opportunities")}
    <main class="main-content">
      <header class="view-header">
        <h2>Sales Pipeline: ${t.name}</h2>
        <button class="btn-primary">+ New Opportunity</button>
      </header>
      <div class="kanban-board">
        ${n}
      </div>
    </main>
  `}function et(){const t=$.map(e=>{const n=c.find(i=>i.id===e.contact_id);return`
      <tr onclick="window.navigateTo('contact-detail', '${e.contact_id}')" style="cursor: pointer;">
        <td style="font-weight: 600; color: var(--primary-color);">Q-${e.id}</td>
        <td>${n?n.name:"Unknown"}</td>
        <td><span class="badge badge-${e.status}">${e.status}</span></td>
        <td style="font-weight: 600;">$${e.total_amount.toLocaleString()}</td>
        <td>${new Date(e.created_at).toLocaleDateString()}</td>
        <td><button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;">View</button></td>
      </tr>
    `}).join("");u.innerHTML=`
    ${m("quotes")}
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
            ${t||'<tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;">No quotes found</td></tr>'}
          </tbody>
        </table>
      </div>
    </main>
  `}function at(){const t=I.map(e=>{const n=c.find(i=>i.id===e.contact_id);return`
      <tr onclick="window.navigateTo('contact-detail', '${e.contact_id}')" style="cursor: pointer;">
        <td style="font-weight: 600; color: var(--primary-color);">INV-${e.id}</td>
        <td>${n?n.name:"Unknown"}</td>
        <td><span class="badge badge-${e.status}">${e.status}</span></td>
        <td style="font-weight: 600;">$${e.amount.toLocaleString()}</td>
        <td>${new Date(e.due_date).toLocaleDateString()}</td>
        <td><button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;">View</button></td>
      </tr>
    `}).join("");u.innerHTML=`
    ${m("invoices")}
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
            ${t||'<tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;">No invoices found</td></tr>'}
          </tbody>
        </table>
      </div>
    </main>
  `}function T(){const t=c,e=window.newQuoteContactId,n=window.newQuoteOpportunityId,i=window.newQuoteLineItems,a=e?l.filter(o=>o.contact_id===e):[],s=i.reduce((o,r)=>o+r.quantity*r.price,0);u.innerHTML=`
    ${m("quotes")}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; align-items: center; gap: 15px;">
          <button onclick="window.navigateTo('quotes')" class="btn-primary" style="background: #eee; color: #333; padding: 5px 10px;">← Back</button>
          <h2>Create New Quote</h2>
        </div>
      </header>

      <div class="card" style="padding: 24px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
          <div class="form-group">
            <label>Select Contact</label>
            <select id="quote-contact" style="width: 100%; padding: 10px;" onchange="window.updateNewQuoteContact(this.value)">
              <option value="">-- Choose Contact --</option>
              ${t.map(o=>`<option value="${o.id}" ${e===o.id?"selected":""}>${o.name}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label>Select Opportunity (Optional)</label>
            <select id="quote-opportunity" style="width: 100%; padding: 10px;" onchange="window.newQuoteOpportunityId = this.value">
              <option value="">-- No Opportunity --</option>
              ${a.map(o=>`<option value="${o.id}" ${n===o.id?"selected":""}>$${o.value} - ${o.pipeline_stage}</option>`).join("")}
            </select>
          </div>
        </div>

        <h3>Line Items</h3>
        <table class="clients-table" style="box-shadow: none; border: 1px solid #eee; margin-top: 15px; margin-bottom: 15px;">
          <thead>
            <tr>
              <th>Service</th>
              <th>Description</th>
              <th style="width: 80px;">Qty</th>
              <th style="width: 120px;">Unit Price</th>
              <th style="width: 120px;">Total</th>
              <th style="width: 50px;"></th>
            </tr>
          </thead>
          <tbody>
            ${i.map((o,r)=>`
              <tr>
                <td><input type="text" placeholder="Service Name" value="${o.service}" style="width: 100%; padding: 8px;" onchange="window.updateLineItem(${r}, 'service', this.value)"></td>
                <td><input type="text" placeholder="Description" value="${o.description}" style="width: 100%; padding: 8px;" onchange="window.updateLineItem(${r}, 'description', this.value)"></td>
                <td><input type="number" value="${o.quantity}" style="width: 100%; padding: 8px;" onchange="window.updateLineItem(${r}, 'quantity', this.value)"></td>
                <td><input type="number" value="${o.price}" style="width: 100%; padding: 8px;" onchange="window.updateLineItem(${r}, 'price', this.value)"></td>
                <td style="font-weight: 600;">$${(o.quantity*o.price).toLocaleString()}</td>
                <td><button onclick="window.removeLineItem(${r})" style="background:none; border:none; color:#ff4444; cursor:pointer; font-size:1.2rem;">×</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px;">
          <button class="btn-primary" style="background: #28a745;" onclick="window.addLineItem()">+ Add Line Item</button>
          <div style="text-align: right;">
            <div style="font-size: 0.9rem; color: #666;">Total Amount</div>
            <div style="font-size: 1.5rem; font-weight: 600; color: var(--primary-color);">$${s.toLocaleString()}</div>
          </div>
        </div>

        <div style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
          <button class="btn-primary" style="width: 100%; padding: 15px; font-size: 1.1rem;" onclick="window.saveQuote()">Create Quote</button>
        </div>
      </div>
    </main>
  `}window.updateNewQuoteContact=t=>{window.newQuoteContactId=t,window.newQuoteOpportunityId="",T()};window.addLineItem=()=>{window.newQuoteLineItems.push({service:"",description:"",quantity:1,price:0}),T()};window.removeLineItem=t=>{window.newQuoteLineItems.splice(t,1),window.newQuoteLineItems.length===0&&window.newQuoteLineItems.push({service:"",description:"",quantity:1,price:0}),T()};window.updateLineItem=(t,e,n)=>{const i=window.newQuoteLineItems[t];e==="quantity"||e==="price"?i[e]=parseFloat(n)||0:i[e]=n,T()};window.saveQuote=()=>{const t=window.newQuoteContactId,e=window.newQuoteOpportunityId,n=window.newQuoteLineItems;if(!t){alert("Please select a contact.");return}const i="q"+($.length+1)+"-"+Math.floor(Math.random()*100),a=n.reduce((s,o)=>s+o.quantity*o.price,0);$.push({id:i,contact_id:t,opportunity_id:e||"none",status:"sent",total_amount:a,notes:"Created via New Quote page",created_at:new Date().toISOString()}),n.forEach((s,o)=>{Q.push({id:"qi-"+i+"-"+o,quote_id:i,service_name:s.service,description:s.description,quantity:s.quantity,unit_price:s.price,total:s.quantity*s.price})}),window.newQuoteLineItems=[{service:"",description:"",quantity:1,price:0}],window.newQuoteContactId="",window.newQuoteOpportunityId="",window.navigateTo("quotes")};function R(t,e){const n=l.find(i=>i.id===t);n&&(n.pipeline_stage=e,e==="Completed"||e==="Paid"?n.status="won":e==="Lost"?n.status="lost":n.status="open",window.navigateTo(C,g||void 0),console.log(`Opportunity ${t} updated: Stage=[${e}], Status=[${n.status}]`),N("OPPORTUNITY_STAGE_UPDATED",n))}window.updateOpportunityStage=R;window.allowDrop=t=>{t.preventDefault()};window.drag=(t,e)=>{var n;(n=t.dataTransfer)==null||n.setData("text",e)};window.drop=(t,e)=>{var i;t.preventDefault();const n=(i=t.dataTransfer)==null?void 0:i.getData("text");n&&R(n,e)};window.navigateTo=(t,e)=>{C=t,e&&(g=e),t==="dashboard"&&E(),t==="clients"&&P(),t==="opportunities"&&tt(),t==="quotes"&&et(),t==="new-quote"&&T(),t==="invoices"&&at(),t==="lead-capture"&&V(),t==="builder"&&S(),t==="reports"&&K(),t==="quickstart"&&J(),t==="contact-detail"&&g&&k(g)};function k(t){const e=c.find(a=>a.id===t);if(!e)return;const n=l.filter(a=>a.contact_id===t),i=x.filter(a=>a.contact_id===t).sort((a,s)=>new Date(s.due_date).getTime()-new Date(a.due_date).getTime());u.innerHTML=`
    ${m("clients")}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; align-items: center; gap: 15px;">
          <button onclick="window.navigateTo('clients')" class="btn-primary" style="background: #eee; color: #333; padding: 5px 10px;">← Back</button>
          <h2>${e.name}</h2>
          <span class="badge badge-${e.status}">${e.status}</span>
        </div>
      </header>

      <div class="action-bar">
        <button class="btn-primary" onclick="window.logCall('${t}')">📞 Log Call</button>
        <button class="btn-primary" onclick="window.addNote('${t}')" style="background: var(--secondary-color);">📝 Add Note</button>
        <button class="btn-primary" onclick="window.createOpportunity('${t}')" style="background: #28a745;">💰 New Opportunity</button>
        <button class="btn-primary" onclick="window.createQuote('${t}')" style="background: #17a2b8;">📄 Create Quote</button>
        <button class="btn-primary" onclick="window.createInvoice('${t}')" style="background: #e67e22;">💳 Create Invoice</button>
      </div>

      <div class="detail-container">
        <!-- Sidebar Info -->
        <aside class="detail-sidebar">
          <div class="card">
            <h3>Contact Information</h3>
            <div style="margin-top: 15px; display: flex; flex-direction: column; gap: 8px;">
              <div>
                <label style="display: block; font-size: 0.75rem; color: #666;">Phone</label>
                <input type="text" value="${e.phone}" class="inline-input" onchange="window.updateContactField('${t}', 'phone', this.value)" style="width: 100%;">
              </div>
              <div>
                <label style="display: block; font-size: 0.75rem; color: #666;">Email</label>
                <input type="email" value="${e.email}" class="inline-input" onchange="window.updateContactField('${t}', 'email', this.value)" style="width: 100%;">
              </div>
              <p><strong>Address:</strong> ${e.address}</p>
              <p><strong>Source:</strong> ${e.source}</p>
              <p><strong>Created:</strong> ${new Date(e.created_at).toLocaleDateString()}</p>
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
                      ${O[0].stages.map(s=>`<option value="${s}" ${s===a.pipeline_stage?"selected":""}>${s}</option>`).join("")}
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
                  ${$.filter(a=>a.contact_id===t).map(a=>`
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
                  ${I.filter(a=>a.contact_id===t).map(a=>`
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
  `}window.logCall=t=>{const e=prompt("Enter call summary:");e&&(x.push({id:"act-"+Date.now(),contact_id:t,type:"call",description:e,due_date:new Date().toISOString(),completed:!0}),k(t))};window.addNote=t=>{const e=prompt("Enter your note:");e&&(x.push({id:"act-"+Date.now(),contact_id:t,type:"note",description:e,due_date:new Date().toISOString(),completed:!0}),k(t))};window.completeTask=t=>{const e=x.find(n=>n.id===t);e&&(e.completed=!0,g&&k(g))};window.createOpportunity=t=>{const e=prompt("Enter Opportunity value (e.g. 500):","0"),n=parseFloat(e||"0"),i={id:"o"+(l.length+1)+"-"+Math.floor(Math.random()*100),contact_id:t,pipeline_stage:"New Lead",value:isNaN(n)?0:n,assigned_to:"Hansveer",status:"open",created_at:new Date().toISOString()};l.push(i),N("OPPORTUNITY_CREATED",i),k(t)};window.updateOpportunityField=(t,e,n)=>{const i=l.find(a=>a.id===t);i&&(e==="value"?i.value=parseFloat(n)||0:i[e]=n,window.navigateTo(C,g||void 0))};window.updateContactField=(t,e,n)=>{const i=c.find(a=>a.id===t);i&&(i[e]=n,window.navigateTo(C,g||void 0))};window.createQuote=t=>{const e=prompt("Enter Service Name:","Driveway Cleaning");if(!e)return;const n=prompt("Enter Total Amount:","250"),i=parseFloat(n||"0");if(isNaN(i))return;const a="q"+($.length+1)+"-"+Math.floor(Math.random()*100),s=l.filter(r=>r.contact_id===t),o=s.length>0?s[0].id:"new";$.push({id:a,contact_id:t,opportunity_id:o,status:"draft",total_amount:i,notes:"Created via CRM",created_at:new Date().toISOString()}),Q.push({id:"qi-"+Date.now(),quote_id:a,service_name:e,description:e,quantity:1,unit_price:i,total:i}),k(t)};window.createInvoice=t=>{const e=$.filter(r=>r.contact_id===t);if(e.length===0){alert("Please create a Quote first.");return}const n=e[e.length-1],i=prompt("Enter Invoice Amount:",n.total_amount.toString()),a=parseFloat(i||"0");if(isNaN(a))return;const s="i"+(I.length+1)+"-"+Math.floor(Math.random()*100),o=new Date;o.setDate(o.getDate()+7),I.push({id:s,contact_id:t,quote_id:n.id,amount:a,status:"unpaid",due_date:o.toISOString(),created_at:new Date().toISOString()}),k(t)};E();
