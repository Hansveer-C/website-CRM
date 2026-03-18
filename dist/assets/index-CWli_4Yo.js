(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))o(a);new MutationObserver(a=>{for(const n of a)if(n.type==="childList")for(const s of n.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&o(s)}).observe(document,{childList:!0,subtree:!0});function i(a){const n={};return a.integrity&&(n.integrity=a.integrity),a.referrerPolicy&&(n.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?n.credentials="include":a.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function o(a){if(a.ep)return;a.ep=!0;const n=i(a);fetch(a.href,n)}})();const P=[{id:"residential-sparkle",name:"Residential Sparkle",description:"Perfect for soft washing and home exterior care specialist.",theme:{primary:"#00d2ff",secondary:"#3a7bd5",font:"Inter"},blocks:[{id:"h1",type:"hero",data:{title:"The Cleanest House on the Block",subtitle:"Professional Soft Washing & Gutter Cleaning in Los Angeles.",buttonText:"Get My Free Estimate"}},{id:"s1",type:"services",data:{title:"Residential Services",items:["House Washing","Roof Cleaning","Gutter Brightening","Driveway Sealing"]}},{id:"c1",type:"contact",data:{title:"Request a Residential Quote"}}]},{id:"commercial-pro",name:"Commercial Pro",description:"Industrial bold styling for large-scale concrete and fleet cleaning.",theme:{primary:"#ff4b2b",secondary:"#ff416c",font:"Roboto"},blocks:[{id:"h2",type:"hero",data:{title:"Industrial Strength Cleaning",subtitle:"Reliable Fleet and Concrete Maintenance for Commercial Properties.",buttonText:"Schedule a Consultation"}},{id:"s2",type:"services",data:{title:"Commercial Solutions",items:["Fleet Washing","Dumpster Pad Cleaning","Parking Lot Restoration","Graffiti Removal"]}},{id:"t2",type:"trust",data:{title:"Trusted by Local Business Leaders",logos:["Starbucks","Walmart","Local Mall"]}}]},{id:"trust-proof",name:"The Trust Proof",description:"Heavy focus on before/after galleries and client testimonials.",theme:{primary:"#11998e",secondary:"#38ef7d",font:"Outfit"},blocks:[{id:"h3",type:"hero",data:{title:"See the Difference for Yourself",subtitle:"Real Results. Real Reviews. Real Experts.",buttonText:"View Our Gallery"}},{id:"g3",type:"gallery",data:{title:"Recent Successes",images:["Before/After 1","Before/After 2","Before/After 3"]}},{id:"t3",type:"trust",data:{title:"What Your Neighbors Say",testimonials:[{name:"Alice R.",text:"Best service ever!"},{name:"Bob S.",text:"My driveway looks new."}]}}]}],g=[{id:"c1",name:"John Doe",phone:"555-0101",email:"john@example.com",address:"123 Pine St, Seattle, WA",tags:["residential","referral"],source:"Google Search",status:"customer",created_at:"2026-02-15T10:00:00Z"},{id:"c2",name:"Jane Smith",phone:"555-0202",email:"jane@smithresidence.com",address:"456 Oak Ave, Portland, OR",tags:["lead","driveway"],source:"Facebook Ad",status:"lead",created_at:"2026-03-01T14:30:00Z"}],Q=[{id:"p1",name:"Residential Cleaning Pipeline",stages:["New Lead","Quote Sent","Scheduled","Completed","Paid"]}],m=[{id:"o1",contact_id:"c2",pipeline_stage:"New Lead",value:250,assigned_to:"Hansveer",status:"open",created_at:"2026-03-01T14:35:00Z"},{id:"o2",contact_id:"c1",pipeline_stage:"Completed",value:450,assigned_to:"Hansveer",status:"won",created_at:"2026-02-15T10:05:00Z"}],p=[{id:"a1",contact_id:"c2",type:"call",description:"Initial follow-up call about driveway cleaning",due_date:"2026-03-02T09:00:00Z",completed:!0},{id:"a2",contact_id:"c2",type:"sms",description:"Sent quote via text",due_date:"2026-03-05T10:00:00Z",completed:!1}],y=[{id:"q1",contact_id:"c2",opportunity_id:"o1",status:"sent",total_amount:250,notes:"Standard driveway cleaning quote",created_at:"2026-03-02T10:00:00Z"}],N=[{id:"qi1",quote_id:"q1",service_name:"Driveway Cleaning",description:"High pressure wash for standard 2-car driveway",quantity:1,unit_price:250,total:250}],f=[{id:"i1",contact_id:"c2",quote_id:"q1",status:"unpaid",amount:250,due_date:"2026-03-24T12:00:00Z",created_at:"2026-03-17T15:00:00Z"}];function z(){const e=new Date;f.forEach(t=>{t.status==="unpaid"&&new Date(t.due_date)<e&&(p.some(o=>o.contact_id===t.contact_id&&o.description.includes(`INV-${t.id}`)&&o.description.includes("Follow up for payment"))||(p.push({id:"task-overdue-"+t.id+"-"+Math.floor(Math.random()*1e3),contact_id:t.contact_id,type:"note",description:`Follow up for payment (INV-${t.id})`,due_date:new Date().toISOString(),completed:!1}),console.log(`[AUTOMATION: OVERDUE] Created payment follow-up for INV-${t.id}`)))})}const G=[{id:"a1",name:"Auto-follow task for new leads",trigger:"OPPORTUNITY_CREATED",action:"CREATE_TASK",actionParams:{type:"call",description:"Call new lead ASAP",dueInMinutes:10}},{id:"a2",name:"Notify when job is scheduled",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:e=>e.pipeline_stage==="Scheduled",action:"SEND_NOTIFICATION",actionParams:{message:"🎉 A job has been scheduled! Get ready."}},{id:"a3",name:"Final follow up when completed",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:e=>e.pipeline_stage==="Completed",action:"CREATE_TASK",actionParams:{type:"visit",description:"Site cleanup & final inspection",dueInDays:0}},{id:"a4",name:"Follow up on sent quote",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:e=>e.pipeline_stage==="Quote Sent",action:"CREATE_TASK",actionParams:{type:"note",description:"Follow up on quote in 24 hours",dueInDays:1}}];function q(e,t){G.filter(o=>o.trigger===e&&(!o.condition||o.condition(t))).forEach(o=>{W(o,t)})}function W(e,t){switch(e.action){case"CREATE_TASK":Y(e.actionParams,t);break;case"SEND_NOTIFICATION":V(e.actionParams,t);break}}function Y(e,t){const i=g.find(s=>s.id===t.contact_id),o=i?i.name:"Unknown",a=new Date;e.dueInDays&&a.setDate(a.getDate()+e.dueInDays),e.dueInMinutes&&a.setMinutes(a.getMinutes()+e.dueInMinutes);const n={id:"task-"+Date.now()+"-"+Math.floor(Math.random()*1e3),contact_id:t.contact_id,type:e.type||"note",description:e.description||`[AUTOMATED] Follow up for ${o}`,due_date:a.toISOString(),completed:!1};p.push(n),console.log(`[AUTOMATION: TASK CREATED] ${n.description}`)}function V(e,t){const i=g.find(n=>n.id===t.contact_id),o=i?i.name:"Unknown",a=e.message.replace("${contactName}",o);console.log(`%c[AUTOMATION: NOTIFICATION] ${a} (${o})`,"color: #007bff; font-weight: bold;"),alert(`Automation Notification: ${a}`)}const b=document.querySelector("#app");let v="dashboard",C=P[0],k=[...C.blocks],T="",x="all",u=null,I="all",Z=[{service:"",description:"",quantity:1,price:0,tier:"basic"}];window.newQuoteLineItems=Z;let K="";window.newQuoteContactId=K;let J="";window.newQuoteOpportunityId=J;function w(e){return`
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
  `}function B(){const e=new Date,t=m.filter(d=>d.status==="open"),i=t.reduce((d,_)=>d+_.value,0),o=t.length,a=m.length,n=m.filter(d=>d.status==="won").length,s=a>0?n/a*100:0,c=Q[0].stages.map(d=>{const _=m.filter(S=>S.pipeline_stage===d&&(S.status==="open"||S.status==="won")).reduce((S,U)=>S+U.value,0);return{stage:d,value:_}}).filter(d=>d.value>0),r=Math.max(...c.map(d=>d.value),1),h={};g.forEach(d=>{h[d.source]=(h[d.source]||0)+1});const R=Object.entries(h).map(([d,_])=>({source:d,count:_})),H=Math.max(...R.map(d=>d.count),1),A=p.filter(d=>!d.completed&&new Date(d.due_date)<e);b.innerHTML=`
    ${w("dashboard")}
    <main class="main-content">
      <header class="view-header">
        <h2>Dashboard Overview</h2>
      </header>
      
      <div class="dashboard-grid" style="grid-template-columns: repeat(4, 1fr);">
        <div class="card">
          <small style="color: #666;">Cash in Pipeline</small>
          <h3>Pipeline Value</h3>
          <p class="value" style="color: var(--primary-color);">$${i.toLocaleString(void 0,{minimumFractionDigits:0,maximumFractionDigits:0})}</p>
        </div>
        <div class="card">
          <small style="color: #666;">Action Required</small>
          <h3>Open Leads</h3>
          <p class="value">${o}</p>
        </div>
        <div class="card">
          <small style="color: #666;">Success Rate</small>
          <h3>Conv. Rate</h3>
          <p class="value">${s.toFixed(1)}%</p>
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
            ${c.map(d=>`
              <div class="report-item">
                <div class="report-item-header">
                  <span>${d.stage}</span>
                  <span style="font-weight: 600;">$${d.value.toLocaleString()}</span>
                </div>
                <div class="visual-bar-bg">
                  <div class="visual-bar-fill" style="width: ${d.value/r*100}%"></div>
                </div>
              </div>
            `).join("")||'<p style="color: #666; font-style: italic; padding: 20px;">No revenue data for active stages</p>'}
          </div>
        </div>
        <div class="card">
          <h3>Lead Sources Performance</h3>
          <div class="chart-container" style="margin-top: 20px;">
            ${R.map(d=>`
              <div class="report-item">
                <div class="report-item-header">
                  <span>${d.source}</span>
                  <span style="font-weight: 600;">${d.count} Leads</span>
                </div>
                <div class="visual-bar-bg">
                  <div class="visual-bar-fill" style="width: ${d.count/H*100}%; background: #6c757d;"></div>
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
              ${A.map(d=>{const _=g.find(S=>S.id===d.contact_id);return`
                  <tr style="background: #fffafa;">
                    <td style="font-weight: 600;">${_?_.name:"Unknown"}</td>
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
  `}function E(){const t=g.filter(o=>{const a=o.name.toLowerCase().includes(T.toLowerCase())||o.phone.includes(T),n=x==="all"||o.status===x;return a&&n}).map(o=>{const a=p.filter(n=>n.contact_id===o.id).sort((n,s)=>new Date(s.due_date).getTime()-new Date(n.due_date).getTime())[0];return`
      <tr onclick="window.navigateTo('contact-detail', '${o.id}')" style="cursor: pointer;">
        <td style="font-weight: 600; color: var(--primary-color);">${o.name}</td>
        <td>${o.phone}</td>
        <td><span class="badge badge-${o.status}">${o.status}</span></td>
        <td><span style="font-size: 0.85rem; color: #666;">${o.source}</span></td>
        <td>${a?new Date(a.due_date).toLocaleDateString():"No activity"}</td>
        <td><button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="event.stopPropagation(); window.navigateTo('contact-detail', '${o.id}')">View</button></td>
      </tr>
    `}).join("");b.innerHTML=`
    ${w("clients")}
    <main class="main-content">
      <header class="view-header">
        <h2>Clients & Leads</h2>
        <button class="btn-primary" onclick="window.navigateTo('lead-capture')">+ Add Lead</button>
      </header>

      <div class="card" style="margin-bottom: 24px; padding: 16px;">
        <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 300px;">
            <input type="text" id="client-search" placeholder="Search by name or phone..." 
                   value="${T}" 
                   style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn-primary" style="background: ${x==="all"?"var(--primary-color)":"#eee"}; color: ${x==="all"?"white":"#333"}" onclick="window.filterClients('all')">All</button>
            <button class="btn-primary" style="background: ${x==="lead"?"var(--primary-color)":"#eee"}; color: ${x==="lead"?"white":"#333"}" onclick="window.filterClients('lead')">Leads</button>
            <button class="btn-primary" style="background: ${x==="customer"?"var(--primary-color)":"#eee"}; color: ${x==="customer"?"white":"#333"}" onclick="window.filterClients('customer')">Customers</button>
            <button class="btn-primary" style="background: ${x==="lost"?"var(--primary-color)":"#eee"}; color: ${x==="lost"?"white":"#333"}" onclick="window.filterClients('lost')">Lost</button>
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
  `;const i=document.getElementById("client-search");i==null||i.addEventListener("input",o=>{T=o.target.value,E()}),T&&(i.focus(),i.setSelectionRange(T.length,T.length))}window.filterClients=e=>{x=e,E()};function D(){var e;b.innerHTML=`
    ${w("builder")}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; align-items: center; gap: 20px;">
          <h2>Website Builder</h2>
          <select id="template-select" style="padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
            ${P.map(t=>`<option value="${t.id}" ${t.id===C.id?"selected":""}>${t.name}</option>`).join("")}
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
          ${X()}
        </div>
      </div>
    </main>
  `,(e=document.getElementById("template-select"))==null||e.addEventListener("change",t=>{const i=t.target.value,o=P.find(a=>a.id===i);o&&(C=o,k=[...o.blocks],D())}),document.querySelectorAll(".draggable-item").forEach(t=>{t.addEventListener("click",()=>{const i=t.getAttribute("data-type");window.addBlock(i)})})}function X(){return k.length===0?`<div class="canvas-section" style="border: 2px dashed #007bff; background: #f0f7ff;">
              <p style="color: #007bff;">Click an element to add it here</p>
            </div>`:k.map((e,t)=>{let i="";switch(e.type){case"hero":i=`
          <div class="canvas-hero" style="background: linear-gradient(135deg, ${C.theme.primary}, ${C.theme.secondary});">
            <h1>${e.data.title}</h1>
            <p>${e.data.subtitle}</p>
            <button class="btn-primary" style="background: white; color: ${C.theme.primary}; margin-top: 20px;">${e.data.buttonText}</button>
          </div>
        `;break;case"services":i=`
          <div class="canvas-section">
            <h3>${e.data.title}</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
              ${e.data.items.map(o=>`<div style="padding: 10px; border: 1px solid #eee; border-radius: 4px;">${o}</div>`).join("")}
            </div>
          </div>
        `;break;case"contact":i=`
          <div class="canvas-section">
            <h3>${e.data.title}</h3>
            <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 10px; max-width: 400px; margin-left: auto; margin-right: auto;">
              <input type="text" placeholder="Name" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
              <input type="email" placeholder="Email" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
              <button class="btn-primary" style="background: ${C.theme.primary}">Send Quote Request</button>
            </div>
          </div>
        `;break;case"gallery":i=`
          <div class="canvas-section">
            <h3>${e.data.title}</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 20px;">
              ${e.data.images.map(o=>`<div style="height: 100px; background: #eee; border-radius: 4px; display: flex; align-items: center; justify-content: center;">${o}</div>`).join("")}
            </div>
          </div>
        `;break;case"trust":i=`
          <div class="canvas-section">
            <h3>${e.data.title}</h3>
            <div style="display: flex; justify-content: center; gap: 30px; margin-top: 20px; opacity: 0.6;">
              ${(e.data.logos||[]).map(o=>`<strong>${o}</strong>`).join("")}
              ${(e.data.testimonials||[]).map(o=>`<div><p>"${o.text}"</p><small>- ${o.name}</small></div>`).join("")}
            </div>
          </div>
        `;break}return`
      <div class="block-wrapper" style="position: relative; width: 100%;">
        <div style="position: absolute; right: -40px; top: 0; display: flex; flex-direction: column; gap: 5px;">
           <button onclick="window.removeBlock(${t})" style="background: #ff4444; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer;">×</button>
           <button onclick="window.moveBlock(${t}, -1)" style="background: #eee; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">↑</button>
           <button onclick="window.moveBlock(${t}, 1)" style="background: #eee; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">↓</button>
        </div>
        ${i}
      </div>
    `}).join("")}window.addBlock=e=>{const t={id:Date.now().toString(),type:e,data:tt(e)};k.push(t),D()};window.removeBlock=e=>{k.splice(e,1),D()};window.moveBlock=(e,t)=>{const i=e+t;if(i>=0&&i<k.length){const o=k[e];k[e]=k[i],k[i]=o,D()}};function tt(e){switch(e){case"hero":return{title:"Insert Title",subtitle:"Insert Subtitle",buttonText:"Click Me"};case"services":return{title:"Our Services",items:["Service 1","Service 2","Service 3"]};case"contact":return{title:"Get In Touch"};case"gallery":return{title:"Our Work",images:["Image 1","Image 2","Image 3"]};case"trust":return{title:"What Clients Say",testimonials:[{name:"John D.",text:"Great Job!"}]};default:return{}}}function et(){b.innerHTML=`
    ${w("reports")}
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
  `}function it(){b.innerHTML=`
    ${w("quickstart")}
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
  `}function at(){var e;b.innerHTML=`
    ${w("lead-capture")}
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
  `,(e=document.getElementById("lead-form"))==null||e.addEventListener("submit",ot)}function ot(e){e.preventDefault();const t=document.getElementById("lead_name").value,i=document.getElementById("lead_phone").value,o=document.getElementById("lead_email").value,a=document.getElementById("lead_address").value,n=document.getElementById("lead_service").value,s="c"+(g.length+1),l="o"+(m.length+1);g.push({id:s,name:t,phone:i,email:o,address:a,tags:["new-lead"],source:"Lead Capture Form",service:n,status:"lead",created_at:new Date().toISOString()});const c={id:l,contact_id:s,pipeline_stage:"New Lead",value:0,assigned_to:"Hansveer",status:"open",created_at:new Date().toISOString()};m.push(c),q("OPPORTUNITY_CREATED",c);const r=document.querySelector(".lead-form-container");r&&(r.innerHTML=`
      <div style="text-align: center; padding: 40px 0;">
        <div style="font-size: 3rem; color: var(--primary-color); margin-bottom: 20px;">✓</div>
        <h2 style="margin-bottom: 10px;">Submission Received</h2>
        <p style="font-size: 1.2rem; color: var(--secondary-color);">Thanks! We’ll contact you shortly.</p>
        <button onclick="window.navigateTo('lead-capture')" class="btn-primary" style="margin-top: 30px; background-color: var(--secondary-color);">Capture Another Lead</button>
        <button onclick="window.navigateTo('opportunities')" class="btn-primary" style="margin-top: 30px; margin-left:10px;">View Pipeline</button>
      </div>
    `)}function nt(){const e=Q[0],i=e.stages.map(o=>{const a=m.filter(s=>s.pipeline_stage===o),n=a.map(s=>{const l=g.find(c=>c.id===s.contact_id);return`
        <div class="kanban-card" draggable="true" ondragstart="drag(event, '${s.id}')" onclick="window.navigateTo('contact-detail', '${s.contact_id}')" style="cursor: pointer;">
          <div class="contact-name">${l?l.name:"Unknown Contact"}</div>
          <div class="opportunity-value" style="display: flex; align-items: center; gap: 4px;">
            <span>$</span>
            <input type="number" 
                   value="${s.value}" 
                   class="inline-input" 
                   style="font-weight: 600; width: 80px;"
                   onclick="event.stopPropagation()" 
                   onchange="window.updateOpportunityField('${s.id}', 'value', this.value)">
          </div>
          <div class="contact-phone">${l?l.phone:"N/A"}</div>
        </div>
      `}).join("");return`
      <div class="kanban-column" ondragover="allowDrop(event)" ondrop="drop(event, '${o}')">
        <h4>${o} <span>${a.length}</span></h4>
        <div class="kanban-cards">
          ${n}
        </div>
      </div>
    `}).join("");b.innerHTML=`
    ${w("opportunities")}
    <main class="main-content">
      <header class="view-header">
        <h2>Sales Pipeline: ${e.name}</h2>
        <button class="btn-primary">+ New Opportunity</button>
      </header>
      <div class="kanban-board">
        ${i}
      </div>
    </main>
  `}function O(){const e=y.map(t=>{const i=g.find(o=>o.id===t.contact_id);return`
      <tr onclick="window.navigateTo('contact-detail', '${t.contact_id}')" style="cursor: pointer;">
        <td style="font-weight: 600; color: var(--primary-color);">Q-${t.id}</td>
        <td>${i?i.name:"Unknown"}</td>
        <td><span class="badge badge-${t.status}">${t.status}</span></td>
        <td style="font-weight: 600;">$${t.total_amount.toLocaleString()}</td>
        <td>${new Date(t.created_at).toLocaleDateString()}</td>
        <td>
          <div style="display: flex; gap: 5px;">
            <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="event.stopPropagation(); window.navigateTo('quote-preview', '${t.id}')">Preview</button>
            <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="event.stopPropagation(); window.navigateTo('contact-detail', '${t.contact_id}')">View</button>
            ${t.status==="draft"?`<button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #28a745;" onclick="event.stopPropagation(); window.sendQuote('${t.id}')">Send</button>`:""}
            ${t.status==="sent"?`
              <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #28a745;" onclick="event.stopPropagation(); window.approveQuote('${t.id}')">Approve</button>
              <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #dc3545;" onclick="event.stopPropagation(); window.rejectQuote('${t.id}')">Reject</button>
            `:""}
          </div>
        </td>
      </tr>
    `}).join("");b.innerHTML=`
    ${w("quotes")}
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
            ${e||'<tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;">No quotes found</td></tr>'}
          </tbody>
        </table>
      </div>
    </main>
  `}function M(){const t=f.filter(i=>I==="all"?!0:i.status===I).map(i=>{const o=g.find(a=>a.id===i.contact_id);return`
      <tr onclick="window.navigateTo('contact-detail', '${i.contact_id}')" style="cursor: pointer;">
        <td style="font-weight: 600; color: var(--primary-color);">INV-${i.id}</td>
        <td>${o?o.name:"Unknown"}</td>
        <td style="font-weight: 600;">$${i.amount.toLocaleString()}</td>
        <td><span class="badge badge-${i.status}">${i.status}</span></td>
        <td>${new Date(i.due_date).toLocaleDateString()}</td>
        <td>
          <div style="display: flex; gap: 5px;">
            <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="event.stopPropagation(); window.navigateTo('contact-detail', '${i.contact_id}')">View</button>
            ${i.status!=="paid"?`<button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #28a745;" onclick="event.stopPropagation(); window.markAsPaid('${i.id}')">Mark as Paid</button>`:""}
          </div>
        </td>
      </tr>
    `}).join("");b.innerHTML=`
    ${w("invoices")}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; align-items: center; gap: 20px;">
          <h2>Invoices</h2>
          <select onchange="window.updateInvoiceFilter(this.value)" style="padding: 8px 12px; border-radius: 4px; border: 1px solid #ddd; background: white; font-family: inherit;">
            <option value="all" ${I==="all"?"selected":""}>All Invoices</option>
            <option value="unpaid" ${I==="unpaid"?"selected":""}>Unpaid</option>
            <option value="paid" ${I==="paid"?"selected":""}>Paid</option>
            <option value="overdue" ${I==="overdue"?"selected":""}>Overdue</option>
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
            ${t||'<tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;">No invoices match your selection</td></tr>'}
          </tbody>
        </table>
      </div>
    </main>
  `}window.updateInvoiceFilter=e=>{I=e,M()};function L(){const e=g,t=window.newQuoteContactId,i=window.newQuoteOpportunityId,o=window.newQuoteLineItems,a=t?m.filter(s=>s.contact_id===t):[],n=s=>{const l=o.map((r,h)=>({...r,index:h})).filter(r=>r.tier===s),c=l.reduce((r,h)=>r+h.quantity*h.price,0);return`
      <div style="flex: 1; min-width: 320px; background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #eef2f6; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin:0; text-transform: capitalize; color: var(--secondary-color); font-size: 1.1rem;">${s} Option</h3>
          <button class="btn-primary" style="padding: 4px 10px; font-size: 0.8rem; background: #f0f7ff; color: var(--primary-color); border: 1px solid var(--primary-color);" onclick="window.addLineItem('${s}')">+ Add Item</button>
        </div>
        
        <div style="flex: 1; overflow-y: auto; max-height: 500px;">
          ${l.map(r=>`
            <div style="padding: 15px; border: 1px solid #f0f0f0; border-radius: 8px; margin-bottom: 15px; position: relative;">
              <button onclick="window.removeLineItem(${r.index})" style="position: absolute; right: 8px; top: 8px; background: none; border: none; color: #ccc; cursor: pointer; font-size: 1.2rem;">×</button>
              <div style="margin-bottom: 10px;">
                <input type="text" placeholder="Service Name" value="${r.service}" style="width: 100%; border: none; font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;" oninput="window.updateLineItem(${r.index}, 'service', this.value, false)">
                <input type="text" placeholder="Short description" value="${r.description}" style="width: 100%; border: none; font-size: 0.85rem; color: #666;" oninput="window.updateLineItem(${r.index}, 'description', this.value, false)">
              </div>
              <div style="display: flex; gap: 10px; align-items: center; background: #f8fafc; padding: 10px; border-radius: 6px;">
                <div style="flex: 1;">
                  <label style="font-size: 0.7rem; color: #999; display: block;">QTY</label>
                  <input type="number" value="${r.quantity}" style="width: 100%; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px;" oninput="window.updateLineItem(${r.index}, 'quantity', this.value, true)">
                </div>
                <div style="flex: 1;">
                  <label style="font-size: 0.7rem; color: #999; display: block;">PRICE</label>
                  <input type="number" value="${r.price}" style="width: 100%; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px;" oninput="window.updateLineItem(${r.index}, 'price', this.value, true)">
                </div>
                <div style="flex: 1; text-align: right;">
                  <label style="font-size: 0.7rem; color: #999; display: block;">TOTAL</label>
                  <span style="font-weight: 700; color: var(--primary-color);">$${(r.quantity*r.price).toLocaleString()}</span>
                </div>
              </div>
            </div>
          `).join("")}
          ${l.length===0?'<div style="text-align: center; color: #ccc; padding: 20px; font-style: italic; border: 1px dashed #eee; border-radius: 8px;">No items in this tier</div>':""}
        </div>

        <div style="margin-top: 20px; padding-top: 15px; border-top: 2px solid #f1f5f9; text-align: right;">
          <div style="font-size: 0.85rem; color: #64748b; font-weight: 500;">Option Total</div>
          <div style="font-size: 1.5rem; font-weight: 800; color: #1e293b;">$${c.toLocaleString()}</div>
        </div>
      </div>
    `};b.innerHTML=`
    ${w("quotes")}
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
                ${e.map(s=>`<option value="${s.id}" ${t===s.id?"selected":""}>${s.name}</option>`).join("")}
              </select>
            </div>
            <div class="form-group" style="margin: 0;">
              <label>Select Opportunity (Optional)</label>
              <select id="quote-opportunity" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;" onchange="window.newQuoteOpportunityId = this.value">
                <option value="">-- No Opportunity --</option>
                ${a.map(s=>`<option value="${s.id}" ${i===s.id?"selected":""}>$${s.value} - ${s.pipeline_stage}</option>`).join("")}
              </select>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 24px; overflow-x: auto; padding-bottom: 10px;">
          ${n("basic")}
          ${n("standard")}
          ${n("premium")}
        </div>

        <div class="card" style="margin-top: 24px; padding: 20px;">
           <label>Add internal notes or terms</label>
           <textarea id="quote-notes" style="width: 100%; height: 80px; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-family: inherit;" placeholder="e.g. Terms & conditions or specific project details..."></textarea>
        </div>
      </div>
    </main>
  `}window.updateNewQuoteContact=e=>{window.newQuoteContactId=e,window.newQuoteOpportunityId="",L()};window.addLineItem=(e="basic")=>{window.newQuoteLineItems.push({service:"",description:"",quantity:1,price:0,tier:e}),L()};window.removeLineItem=e=>{window.newQuoteLineItems.splice(e,1),L()};window.updateLineItem=(e,t,i,o)=>{const a=window.newQuoteLineItems,n=a[e];if(t==="quantity"||t==="price"?n[t]=parseFloat(i)||0:n[t]=i,o){const s=document.getElementById(`line-total-${e}`);s&&(s.textContent=`$${(n.quantity*n.price).toLocaleString()}`);const l=document.getElementById("quote-running-total");if(l){const c=a.reduce((r,h)=>r+h.quantity*h.price,0);l.textContent=`$${c.toLocaleString()}`}}};window.saveQuote=()=>{var s;const e=window.newQuoteContactId,t=window.newQuoteOpportunityId,i=window.newQuoteLineItems;if(!e){alert("Please select a contact.");return}const o=((s=document.getElementById("quote-notes"))==null?void 0:s.value)||"",a="q"+(y.length+1)+"-"+Math.floor(Math.random()*100),n=i.filter(l=>l.tier==="basic").reduce((l,c)=>l+c.quantity*c.price,0);y.push({id:a,contact_id:e,opportunity_id:t||"",status:"draft",total_amount:n,selected_tier:"basic",notes:o,created_at:new Date().toISOString()}),i.forEach((l,c)=>{N.push({id:"qi-"+a+"-"+c,quote_id:a,service_name:l.service,description:l.description,quantity:l.quantity,unit_price:l.price,total:l.quantity*l.price,tier:l.tier})}),window.newQuoteLineItems=[{service:"",description:"",quantity:1,price:0,tier:"basic"}],window.newQuoteContactId="",window.newQuoteOpportunityId="",window.navigateTo("quotes")};function j(e,t){const i=m.find(o=>o.id===e);i&&(i.pipeline_stage=t,t==="Completed"||t==="Paid"?i.status="won":t==="Lost"?i.status="lost":i.status="open",window.navigateTo(v,u||void 0),console.log(`Opportunity ${e} updated: Stage=[${t}], Status=[${i.status}]`),q("OPPORTUNITY_STAGE_UPDATED",i))}window.updateOpportunityStage=j;window.allowDrop=e=>{e.preventDefault()};window.drag=(e,t)=>{var i;(i=e.dataTransfer)==null||i.setData("text",t)};window.drop=(e,t)=>{var o;e.preventDefault();const i=(o=e.dataTransfer)==null?void 0:o.getData("text");i&&j(i,t)};window.navigateTo=(e,t)=>{v=e,t&&(u=t),z(),e==="dashboard"&&B(),e==="clients"&&E(),e==="opportunities"&&nt(),e==="quotes"&&O(),e==="new-quote"&&L(),e==="invoices"&&M(),e==="lead-capture"&&at(),e==="builder"&&D(),e==="reports"&&et(),e==="quickstart"&&it(),e==="quote-preview"&&t&&F(t),e==="contact-detail"&&u&&$(u)};window.selectQuoteTier=(e,t)=>{const i=y.find(o=>o.id===e);if(i){i.selected_tier=t;const o=N.filter(a=>a.quote_id===e&&a.tier===t);i.total_amount=o.reduce((a,n)=>a+n.total,0),F(e)}};function F(e){const t=y.find(n=>n.id===e);if(!t)return;const i=g.find(n=>n.id===t.contact_id),o=N.filter(n=>n.quote_id===e),a=n=>{const s=o.filter(r=>r.tier===n||!r.tier&&n==="basic"),l=s.reduce((r,h)=>r+h.total,0),c=t.selected_tier===n;return`
      <div style="flex: 1; min-width: 280px; border: 2px solid ${c?"var(--primary-color)":"#eef2f6"}; border-radius: 16px; padding: 30px; background: ${c?"#f0f7ff":"#fff"}; display: flex; flex-direction: column; transition: all 0.2s; position: relative; ${c?"box-shadow: 0 10px 25px -5px rgba(0, 123, 255, 0.1);":""}">
        ${c?'<div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: var(--primary-color); color: white; padding: 4px 16px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Recommended</div>':""}
        
        <h3 style="text-align: center; text-transform: capitalize; margin: 0 0 25px 0; color: #1e293b; font-size: 1.25rem;">${n}</h3>
        
        <div style="flex: 1;">
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${s.map(r=>`
              <li style="padding: 12px 0; border-bottom: 1px solid ${c?"#d0e5ff":"#f8fafc"};">
                <div style="font-weight: 600; font-size: 0.95rem; color: #1e293b; margin-bottom: 2px;">${r.service_name}</div>
                <div style="font-size: 0.85rem; color: #64748b; line-height: 1.4;">${r.description}</div>
                <div style="text-align: right; font-weight: 700; color: #1e293b; margin-top: 8px; font-size: 0.95rem;">$${r.total.toLocaleString()}</div>
              </li>
            `).join("")}
            ${s.length===0?'<li style="text-align: center; color: #94a3b8; padding: 40px 0; font-style: italic;">No items included</li>':""}
          </ul>
        </div>

        <div style="margin-top: 30px; text-align: center; border-top: 2px dashed ${c?"#d0e5ff":"#f1f5f9"}; padding-top: 25px;">
          <div style="font-size: 2.25rem; font-weight: 900; color: #0f172a; margin-bottom: 20px;">$${l.toLocaleString()}</div>
          <button class="btn-primary no-print" style="width: 100%; padding: 12px; border-radius: 8px; font-weight: 700; background: ${c?"#28a745":"var(--primary-color)"}; color: white; border: none; cursor: pointer;" onclick="window.selectQuoteTier('${t.id}', '${n}')">
            ${c?"✓ Selected":"Choose "+n}
          </button>
        </div>
      </div>
    `};b.innerHTML=`
    ${w("quotes")}
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
            <div style="font-size: 1.5rem; font-weight: 800; color: #1e293b;">#Q-${t.id}</div>
          </div>
        </div>

        <div style="margin-bottom: 60px; background: #f8fafc; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="display: flex; gap: 60px;">
            <div>
              <div style="text-transform: uppercase; color: #94a3b8; font-size: 0.75rem; font-weight: 800; letter-spacing: 1px; margin-bottom: 12px;">Client Details</div>
              <div style="font-weight: 700; font-size: 1.25rem; color: #1e293b; margin-bottom: 8px;">${i?i.name:"Valued Customer"}</div>
              <div style="color: #64748b; line-height: 1.5;">
                ${i?i.address:""}<br>
                ${i?i.email:""}<br>
                ${i?i.phone:""}
              </div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 40px;">
          <h2 style="font-size: 1.5rem; color: #1e293b; margin-bottom: 25px; text-align: center;">Choose Your Service Level</h2>
          <div style="display: flex; gap: 20px; overflow-x: auto; padding-bottom: 10px; align-items: stretch;">
            ${a("basic")}
            ${a("standard")}
            ${a("premium")}
          </div>
        </div>

        ${t.notes?`
          <div style="margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 40px;">
            <div style="text-transform: uppercase; color: #94a3b8; font-size: 0.75rem; font-weight: 800; letter-spacing: 1px; margin-bottom: 15px;">Additional Terms & Notes</div>
            <div style="color: #475569; line-height: 1.8; font-size: 1rem; white-space: pre-wrap;">${t.notes}</div>
          </div>
        `:""}

        <div style="margin-top: 100px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 40px;">
          <div style="font-size: 1.1rem; color: #1e293b; font-weight: 600; margin-bottom: 10px;">Ready to proceed?</div>
          <p style="color: #64748b; font-size: 0.95rem;">Select your preferred option above. We look forward to working with you!</p>
        </div>
      </div>
    </main>
  `}function $(e){const t=g.find(a=>a.id===e);if(!t)return;const i=m.filter(a=>a.contact_id===e),o=p.filter(a=>a.contact_id===e).sort((a,n)=>new Date(n.due_date).getTime()-new Date(a.due_date).getTime());b.innerHTML=`
    ${w("clients")}
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
              ${i.map(a=>`
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
                      ${Q[0].stages.map(n=>`<option value="${n}" ${n===a.pipeline_stage?"selected":""}>${n}</option>`).join("")}
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
              ${o.map(a=>`
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
                  ${y.filter(a=>a.contact_id===e).map(a=>`
                    <tr>
                      <td style="font-weight: 600;">Q-${a.id}</td>
                      <td><span class="badge badge-${a.status}">${a.status}</span></td>
                      <td>$${a.total_amount.toLocaleString()}</td>
                      <td>
                        <div style="display: flex; gap: 5px;">
                          <button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="event.stopPropagation(); window.navigateTo('quote-preview', '${a.id}')">Preview</button>
                          <button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="event.stopPropagation(); window.navigateTo('contact-detail', '${a.contact_id}')">View</button>
                          ${a.status==="draft"?`<button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem; background: #28a745;" onclick="event.stopPropagation(); window.sendQuote('${a.id}')">Send</button>`:""}
                          ${a.status==="sent"?`
                            <button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem; background: #28a745;" onclick="event.stopPropagation(); window.approveQuote('${a.id}')">Approve</button>
                            <button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem; background: #dc3545;" onclick="event.stopPropagation(); window.rejectQuote('${a.id}')">Reject</button>
                          `:""}
                        </div>
                      </td>
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
                  ${f.filter(a=>a.contact_id===e).map(a=>`
                    <tr>
                      <td style="font-weight: 600;">INV-${a.id}</td>
                      <td><span class="badge badge-${a.status}">${a.status}</span></td>
                      <td>$${a.amount.toLocaleString()}</td>
                      <td>${new Date(a.due_date).toLocaleDateString()}</td>
                      <td>
                        <div style="display: flex; gap: 5px;">
                          <button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="event.stopPropagation(); window.navigateTo('contact-detail', '${a.contact_id}')">View</button>
                          ${a.status!=="paid"?`<button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem; background: #28a745;" onclick="event.stopPropagation(); window.markAsPaid('${a.id}')">Mark as Paid</button>`:""}
                        </div>
                      </td>
                    </tr>
                  `).join("")||'<tr><td colspan="5" style="text-align: center; color: #666; padding: 20px;">No invoices created.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  `}window.logCall=e=>{const t=prompt("Enter call summary:");t&&(p.push({id:"act-"+Date.now(),contact_id:e,type:"call",description:t,due_date:new Date().toISOString(),completed:!0}),$(e))};window.addNote=e=>{const t=prompt("Enter your note:");t&&(p.push({id:"act-"+Date.now(),contact_id:e,type:"note",description:t,due_date:new Date().toISOString(),completed:!0}),$(e))};window.completeTask=e=>{const t=p.find(i=>i.id===e);t&&(t.completed=!0,u&&$(u))};window.createOpportunity=e=>{const t=prompt("Enter Opportunity value (e.g. 500):","0"),i=parseFloat(t||"0"),o={id:"o"+(m.length+1)+"-"+Math.floor(Math.random()*100),contact_id:e,pipeline_stage:"New Lead",value:isNaN(i)?0:i,assigned_to:"Hansveer",status:"open",created_at:new Date().toISOString()};m.push(o),q("OPPORTUNITY_CREATED",o),$(e)};window.updateOpportunityField=(e,t,i)=>{const o=m.find(a=>a.id===e);o&&(t==="value"?o.value=parseFloat(i)||0:o[t]=i,window.navigateTo(v,u||void 0))};window.updateContactField=(e,t,i)=>{const o=g.find(a=>a.id===e);o&&(o[t]=i,window.navigateTo(v,u||void 0))};window.createQuote=e=>{window.newQuoteContactId=e,window.newQuoteOpportunityId="",window.newQuoteLineItems=[{service:"",description:"",quantity:1,price:0}],window.navigateTo("new-quote")};window.markAsPaid=e=>{const t=f.find(i=>i.id===e);if(t){t.status="paid";const i=y.find(o=>o.id===t.quote_id);if(i&&i.opportunity_id){const o=m.find(a=>a.id===i.opportunity_id);o&&(o.pipeline_stage="Paid")}p.push({id:"act-"+(p.length+1)+"-"+Math.floor(Math.random()*100),contact_id:t.contact_id,type:"note",description:`Invoice ${t.id} marked as Paid.`,due_date:new Date().toISOString(),completed:!0}),v==="invoices"&&M(),v==="contact-detail"&&u&&$(u)}};window.convertToInvoice=e=>{const t=y.find(i=>i.id===e);if(t){if(f.some(a=>a.quote_id===e)){alert("Invoice already exists for this quote.");return}const i="inv-"+(f.length+1)+"-"+Math.floor(Math.random()*100),o=new Date;o.setDate(o.getDate()+7),f.push({id:i,contact_id:t.contact_id,quote_id:t.id,amount:t.total_amount,status:"unpaid",due_date:o.toISOString(),created_at:new Date().toISOString()}),p.push({id:"act-"+(p.length+1)+"-"+Math.floor(Math.random()*100),contact_id:t.contact_id,type:"note",description:`Invoice ${i} created from Quote Q-${t.id}`,due_date:new Date().toISOString(),completed:!0}),v==="quotes"&&O(),v==="contact-detail"&&u&&$(u)}};window.approveQuote=e=>{const t=y.find(i=>i.id===e);if(t){t.status="approved";const i=m.find(o=>o.id===t.opportunity_id);if(i&&(i.status="won",i.pipeline_stage="Scheduled"),p.push({id:"act-"+(p.length+1)+"-"+Math.floor(Math.random()*100),contact_id:t.contact_id,type:"note",description:`Quote Q-${t.id} approved! Opportunity marked as Won.`,due_date:new Date().toISOString(),completed:!0}),!f.some(o=>o.quote_id===t.id)){const o="inv-"+(f.length+1)+"-"+Math.floor(Math.random()*100),a=new Date;a.setDate(a.getDate()+7),f.push({id:o,contact_id:t.contact_id,quote_id:t.id,amount:t.total_amount,status:"unpaid",due_date:a.toISOString(),created_at:new Date().toISOString()}),p.push({id:"act-"+(p.length+1)+"-"+Math.floor(Math.random()*100),contact_id:t.contact_id,type:"note",description:`Invoice ${o} automatically created from Quote Q-${t.id}`,due_date:new Date().toISOString(),completed:!0})}v==="quotes"&&O(),v==="contact-detail"&&u&&$(u)}};window.rejectQuote=e=>{const t=y.find(i=>i.id===e);if(t){t.status="rejected";const i=m.find(o=>o.id===t.opportunity_id);i&&(i.status="lost"),p.push({id:"act-"+(p.length+1)+"-"+Math.floor(Math.random()*100),contact_id:t.contact_id,type:"note",description:`Quote Q-${t.id} was rejected. Opportunity marked as Lost.`,due_date:new Date().toISOString(),completed:!0}),v==="quotes"&&O(),v==="contact-detail"&&u&&$(u)}};window.sendQuote=e=>{const t=y.find(i=>i.id===e);t&&(t.status="sent",console.log(`Sending Quote Q-${t.id} to client...`),p.push({id:"act-"+(p.length+1)+"-"+Math.floor(Math.random()*100),contact_id:t.contact_id,type:"note",description:`Quote Q-${t.id} sent to customer`,due_date:new Date().toISOString(),completed:!0}),v==="quotes"&&O(),v==="contact-detail"&&u&&$(u))};window.createInvoice=e=>{const t=y.filter(l=>l.contact_id===e);if(t.length===0){alert("Please create a Quote first.");return}const i=t[t.length-1],o=prompt("Enter Invoice Amount:",i.total_amount.toString()),a=parseFloat(o||"0");if(isNaN(a))return;const n="i"+(f.length+1)+"-"+Math.floor(Math.random()*100),s=new Date;s.setDate(s.getDate()+7),f.push({id:n,contact_id:e,quote_id:i.id,amount:a,status:"unpaid",due_date:s.toISOString(),created_at:new Date().toISOString()}),$(e)};z();B();
