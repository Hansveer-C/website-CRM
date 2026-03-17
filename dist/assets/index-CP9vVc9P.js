(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))a(i);new MutationObserver(i=>{for(const s of i)if(s.type==="childList")for(const l of s.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&a(l)}).observe(document,{childList:!0,subtree:!0});function n(i){const s={};return i.integrity&&(s.integrity=i.integrity),i.referrerPolicy&&(s.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?s.credentials="include":i.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function a(i){if(i.ep)return;i.ep=!0;const s=n(i);fetch(i.href,s)}})();const A=[{id:"residential-sparkle",name:"Residential Sparkle",description:"Perfect for soft washing and home exterior care specialist.",theme:{primary:"#00d2ff",secondary:"#3a7bd5",font:"Inter"},blocks:[{id:"h1",type:"hero",data:{title:"The Cleanest House on the Block",subtitle:"Professional Soft Washing & Gutter Cleaning in Los Angeles.",buttonText:"Get My Free Estimate"}},{id:"s1",type:"services",data:{title:"Residential Services",items:["House Washing","Roof Cleaning","Gutter Brightening","Driveway Sealing"]}},{id:"c1",type:"contact",data:{title:"Request a Residential Quote"}}]},{id:"commercial-pro",name:"Commercial Pro",description:"Industrial bold styling for large-scale concrete and fleet cleaning.",theme:{primary:"#ff4b2b",secondary:"#ff416c",font:"Roboto"},blocks:[{id:"h2",type:"hero",data:{title:"Industrial Strength Cleaning",subtitle:"Reliable Fleet and Concrete Maintenance for Commercial Properties.",buttonText:"Schedule a Consultation"}},{id:"s2",type:"services",data:{title:"Commercial Solutions",items:["Fleet Washing","Dumpster Pad Cleaning","Parking Lot Restoration","Graffiti Removal"]}},{id:"t2",type:"trust",data:{title:"Trusted by Local Business Leaders",logos:["Starbucks","Walmart","Local Mall"]}}]},{id:"trust-proof",name:"The Trust Proof",description:"Heavy focus on before/after galleries and client testimonials.",theme:{primary:"#11998e",secondary:"#38ef7d",font:"Outfit"},blocks:[{id:"h3",type:"hero",data:{title:"See the Difference for Yourself",subtitle:"Real Results. Real Reviews. Real Experts.",buttonText:"View Our Gallery"}},{id:"g3",type:"gallery",data:{title:"Recent Successes",images:["Before/After 1","Before/After 2","Before/After 3"]}},{id:"t3",type:"trust",data:{title:"What Your Neighbors Say",testimonials:[{name:"Alice R.",text:"Best service ever!"},{name:"Bob S.",text:"My driveway looks new."}]}}]}],p=[{id:"c1",name:"John Doe",phone:"555-0101",email:"john@example.com",address:"123 Pine St, Seattle, WA",tags:["residential","referral"],source:"Google Search",status:"customer",created_at:"2026-02-15T10:00:00Z"},{id:"c2",name:"Jane Smith",phone:"555-0202",email:"jane@smithresidence.com",address:"456 Oak Ave, Portland, OR",tags:["lead","driveway"],source:"Facebook Ad",status:"lead",created_at:"2026-03-01T14:30:00Z"}],D=[{id:"p1",name:"Residential Cleaning Pipeline",stages:["New Lead","Quote Sent","Scheduled","Completed","Paid"]}],r=[{id:"o1",contact_id:"c2",pipeline_stage:"New Lead",value:250,assigned_to:"Hansveer",status:"open",created_at:"2026-03-01T14:35:00Z"},{id:"o2",contact_id:"c1",pipeline_stage:"Completed",value:450,assigned_to:"Hansveer",status:"won",created_at:"2026-02-15T10:05:00Z"}],$=[{id:"a1",contact_id:"c2",type:"call",description:"Initial follow-up call about driveway cleaning",due_date:"2026-03-02T09:00:00Z",completed:!0},{id:"a2",contact_id:"c2",type:"sms",description:"Sent quote via text",due_date:"2026-03-05T10:00:00Z",completed:!1}],B=[{id:"a1",name:"Auto-follow task for new leads",trigger:"OPPORTUNITY_CREATED",action:"CREATE_TASK",actionParams:{type:"call",description:"Call new lead ASAP",dueInMinutes:10}},{id:"a2",name:"Notify when job is scheduled",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:e=>e.pipeline_stage==="Scheduled",action:"SEND_NOTIFICATION",actionParams:{message:"🎉 A job has been scheduled! Get ready."}},{id:"a3",name:"Final follow up when completed",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:e=>e.pipeline_stage==="Completed",action:"CREATE_TASK",actionParams:{type:"visit",description:"Site cleanup & final inspection",dueInDays:0}},{id:"a4",name:"Follow up on sent quote",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:e=>e.pipeline_stage==="Quote Sent",action:"CREATE_TASK",actionParams:{type:"note",description:"Follow up on quote in 24 hours",dueInDays:1}}];function O(e,t){B.filter(a=>a.trigger===e&&(!a.condition||a.condition(t))).forEach(a=>{M(a,t)})}function M(e,t){switch(e.action){case"CREATE_TASK":F(e.actionParams,t);break;case"SEND_NOTIFICATION":j(e.actionParams,t);break}}function F(e,t){const n=p.find(l=>l.id===t.contact_id),a=n?n.name:"Unknown",i=new Date;e.dueInDays&&i.setDate(i.getDate()+e.dueInDays),e.dueInMinutes&&i.setMinutes(i.getMinutes()+e.dueInMinutes);const s={id:"task-"+Date.now()+"-"+Math.floor(Math.random()*1e3),contact_id:t.contact_id,type:e.type||"note",description:e.description||`[AUTOMATED] Follow up for ${a}`,due_date:i.toISOString(),completed:!1};$.push(s),console.log(`[AUTOMATION: TASK CREATED] ${s.description}`)}function j(e,t){const n=p.find(s=>s.id===t.contact_id),a=n?n.name:"Unknown",i=e.message.replace("${contactName}",a);console.log(`%c[AUTOMATION: NOTIFICATION] ${i} (${a})`,"color: #007bff; font-weight: bold;"),alert(`Automation Notification: ${i}`)}const v=document.querySelector("#app");let S="dashboard",w=A[0],c=[...w.blocks],b="",d="all",m=null;function g(e){return`
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
  `}function E(){const e=new Date,t=r.filter(o=>o.status==="open"),n=t.reduce((o,u)=>o+u.value,0),a=t.length,i=r.length,s=r.filter(o=>o.status==="won").length,l=i>0?s/i*100:0,y=D[0].stages.map(o=>{const u=r.filter(f=>f.pipeline_stage===o&&(f.status==="open"||f.status==="won")).reduce((f,N)=>f+N.value,0);return{stage:o,value:u}}).filter(o=>o.value>0),T=Math.max(...y.map(o=>o.value),1),_={};p.forEach(o=>{_[o.source]=(_[o.source]||0)+1});const L=Object.entries(_).map(([o,u])=>({source:o,count:u})),I=Math.max(...L.map(o=>o.count),1),C=$.filter(o=>!o.completed&&new Date(o.due_date)<e);v.innerHTML=`
    ${g("dashboard")}
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
          <p class="value">${a}</p>
        </div>
        <div class="card">
          <small style="color: #666;">Success Rate</small>
          <h3>Conv. Rate</h3>
          <p class="value">${l.toFixed(1)}%</p>
        </div>
        <div class="card" style="border-bottom: 4px solid #ff4444;">
          <small style="color: #666;">Attention Needed</small>
          <h3 style="color: #ff4444;">Overdue</h3>
          <p class="value" style="color: #ff4444;">${C.length}</p>
        </div>
      </div>

      <div class="stats-grid" style="margin-top: 30px;">
        <div class="card">
          <h3>Revenue by Pipeline Stage</h3>
          <div class="chart-container" style="margin-top: 20px;">
            ${y.map(o=>`
              <div class="report-item">
                <div class="report-item-header">
                  <span>${o.stage}</span>
                  <span style="font-weight: 600;">$${o.value.toLocaleString()}</span>
                </div>
                <div class="visual-bar-bg">
                  <div class="visual-bar-fill" style="width: ${o.value/T*100}%"></div>
                </div>
              </div>
            `).join("")||'<p style="color: #666; font-style: italic; padding: 20px;">No revenue data for active stages</p>'}
          </div>
        </div>
        <div class="card">
          <h3>Lead Sources Performance</h3>
          <div class="chart-container" style="margin-top: 20px;">
            ${L.map(o=>`
              <div class="report-item">
                <div class="report-item-header">
                  <span>${o.source}</span>
                  <span style="font-weight: 600;">${o.count} Leads</span>
                </div>
                <div class="visual-bar-bg">
                  <div class="visual-bar-fill" style="width: ${o.count/I*100}%; background: #6c757d;"></div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>

      ${C.length>0?`
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
              ${C.map(o=>{const u=p.find(f=>f.id===o.contact_id);return`
                  <tr style="background: #fffafa;">
                    <td style="font-weight: 600;">${u?u.name:"Unknown"}</td>
                    <td>${o.description}</td>
                    <td style="color: #ff4444; font-weight: 500;">${new Date(o.due_date).toLocaleDateString()}</td>
                    <td><button class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; background: #ff4444; border-radius: 4px;">Resolve</button></td>
                  </tr>
                `}).join("")}
            </tbody>
          </table>
        </div>
      `:""}
    </main>
  `}function P(){const t=p.filter(a=>{const i=a.name.toLowerCase().includes(b.toLowerCase())||a.phone.includes(b),s=d==="all"||a.status===d;return i&&s}).map(a=>{const i=$.filter(s=>s.contact_id===a.id).sort((s,l)=>new Date(l.due_date).getTime()-new Date(s.due_date).getTime())[0];return`
      <tr onclick="window.navigateTo('contact-detail', '${a.id}')" style="cursor: pointer;">
        <td style="font-weight: 600; color: var(--primary-color);">${a.name}</td>
        <td>${a.phone}</td>
        <td><span class="badge badge-${a.status}">${a.status}</span></td>
        <td><span style="font-size: 0.85rem; color: #666;">${a.source}</span></td>
        <td>${i?new Date(i.due_date).toLocaleDateString():"No activity"}</td>
        <td><button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;">View</button></td>
      </tr>
    `}).join("");v.innerHTML=`
    ${g("clients")}
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
            <button class="btn-primary" style="background: ${d==="all"?"var(--primary-color)":"#eee"}; color: ${d==="all"?"white":"#333"}" onclick="window.filterClients('all')">All</button>
            <button class="btn-primary" style="background: ${d==="lead"?"var(--primary-color)":"#eee"}; color: ${d==="lead"?"white":"#333"}" onclick="window.filterClients('lead')">Leads</button>
            <button class="btn-primary" style="background: ${d==="customer"?"var(--primary-color)":"#eee"}; color: ${d==="customer"?"white":"#333"}" onclick="window.filterClients('customer')">Customers</button>
            <button class="btn-primary" style="background: ${d==="lost"?"var(--primary-color)":"#eee"}; color: ${d==="lost"?"white":"#333"}" onclick="window.filterClients('lost')">Lost</button>
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
  `;const n=document.getElementById("client-search");n==null||n.addEventListener("input",a=>{b=a.target.value,P()}),b&&(n.focus(),n.setSelectionRange(b.length,b.length))}window.filterClients=e=>{d=e,P()};function x(){var e;v.innerHTML=`
    ${g("builder")}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; align-items: center; gap: 20px;">
          <h2>Website Builder</h2>
          <select id="template-select" style="padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
            ${A.map(t=>`<option value="${t.id}" ${t.id===w.id?"selected":""}>${t.name}</option>`).join("")}
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
  `,(e=document.getElementById("template-select"))==null||e.addEventListener("change",t=>{const n=t.target.value,a=A.find(i=>i.id===n);a&&(w=a,c=[...a.blocks],x())}),document.querySelectorAll(".draggable-item").forEach(t=>{t.addEventListener("click",()=>{const n=t.getAttribute("data-type");window.addBlock(n)})})}function H(){return c.length===0?`<div class="canvas-section" style="border: 2px dashed #007bff; background: #f0f7ff;">
              <p style="color: #007bff;">Click an element to add it here</p>
            </div>`:c.map((e,t)=>{let n="";switch(e.type){case"hero":n=`
          <div class="canvas-hero" style="background: linear-gradient(135deg, ${w.theme.primary}, ${w.theme.secondary});">
            <h1>${e.data.title}</h1>
            <p>${e.data.subtitle}</p>
            <button class="btn-primary" style="background: white; color: ${w.theme.primary}; margin-top: 20px;">${e.data.buttonText}</button>
          </div>
        `;break;case"services":n=`
          <div class="canvas-section">
            <h3>${e.data.title}</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
              ${e.data.items.map(a=>`<div style="padding: 10px; border: 1px solid #eee; border-radius: 4px;">${a}</div>`).join("")}
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
              ${e.data.images.map(a=>`<div style="height: 100px; background: #eee; border-radius: 4px; display: flex; align-items: center; justify-content: center;">${a}</div>`).join("")}
            </div>
          </div>
        `;break;case"trust":n=`
          <div class="canvas-section">
            <h3>${e.data.title}</h3>
            <div style="display: flex; justify-content: center; gap: 30px; margin-top: 20px; opacity: 0.6;">
              ${(e.data.logos||[]).map(a=>`<strong>${a}</strong>`).join("")}
              ${(e.data.testimonials||[]).map(a=>`<div><p>"${a.text}"</p><small>- ${a.name}</small></div>`).join("")}
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
    `}).join("")}window.addBlock=e=>{const t={id:Date.now().toString(),type:e,data:q(e)};c.push(t),x()};window.removeBlock=e=>{c.splice(e,1),x()};window.moveBlock=(e,t)=>{const n=e+t;if(n>=0&&n<c.length){const a=c[e];c[e]=c[n],c[n]=a,x()}};function q(e){switch(e){case"hero":return{title:"Insert Title",subtitle:"Insert Subtitle",buttonText:"Click Me"};case"services":return{title:"Our Services",items:["Service 1","Service 2","Service 3"]};case"contact":return{title:"Get In Touch"};case"gallery":return{title:"Our Work",images:["Image 1","Image 2","Image 3"]};case"trust":return{title:"What Clients Say",testimonials:[{name:"John D.",text:"Great Job!"}]};default:return{}}}function U(){v.innerHTML=`
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
  `}function G(){v.innerHTML=`
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
  `}function W(){var e;v.innerHTML=`
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
  `,(e=document.getElementById("lead-form"))==null||e.addEventListener("submit",z)}function z(e){e.preventDefault();const t=document.getElementById("lead_name").value,n=document.getElementById("lead_phone").value,a=document.getElementById("lead_email").value,i=document.getElementById("lead_address").value,s=document.getElementById("lead_service").value,l="c"+(p.length+1),h="o"+(r.length+1);p.push({id:l,name:t,phone:n,email:a,address:i,tags:["new-lead"],source:"Lead Capture Form",service:s,status:"lead",created_at:new Date().toISOString()});const y={id:h,contact_id:l,pipeline_stage:"New Lead",value:0,assigned_to:"Hansveer",status:"open",created_at:new Date().toISOString()};r.push(y),O("OPPORTUNITY_CREATED",y);const T=document.querySelector(".lead-form-container");T&&(T.innerHTML=`
      <div style="text-align: center; padding: 40px 0;">
        <div style="font-size: 3rem; color: var(--primary-color); margin-bottom: 20px;">✓</div>
        <h2 style="margin-bottom: 10px;">Submission Received</h2>
        <p style="font-size: 1.2rem; color: var(--secondary-color);">Thanks! We’ll contact you shortly.</p>
        <button onclick="window.navigateTo('lead-capture')" class="btn-primary" style="margin-top: 30px; background-color: var(--secondary-color);">Capture Another Lead</button>
        <button onclick="window.navigateTo('opportunities')" class="btn-primary" style="margin-top: 30px; margin-left:10px;">View Pipeline</button>
      </div>
    `)}function Y(){const e=D[0],n=e.stages.map(a=>{const i=r.filter(l=>l.pipeline_stage===a),s=i.map(l=>{const h=p.find(y=>y.id===l.contact_id);return`
        <div class="kanban-card" draggable="true" ondragstart="drag(event, '${l.id}')" onclick="window.navigateTo('contact-detail', '${l.contact_id}')" style="cursor: pointer;">
          <div class="contact-name">${h?h.name:"Unknown Contact"}</div>
          <div class="opportunity-value" style="display: flex; align-items: center; gap: 4px;">
            <span>$</span>
            <input type="number" 
                   value="${l.value}" 
                   class="inline-input" 
                   style="font-weight: 600; width: 80px;"
                   onclick="event.stopPropagation()" 
                   onchange="window.updateOpportunityField('${l.id}', 'value', this.value)">
          </div>
          <div class="contact-phone">${h?h.phone:"N/A"}</div>
        </div>
      `}).join("");return`
      <div class="kanban-column" ondragover="allowDrop(event)" ondrop="drop(event, '${a}')">
        <h4>${a} <span>${i.length}</span></h4>
        <div class="kanban-cards">
          ${s}
        </div>
      </div>
    `}).join("");v.innerHTML=`
    ${g("opportunities")}
    <main class="main-content">
      <header class="view-header">
        <h2>Sales Pipeline: ${e.name}</h2>
        <button class="btn-primary">+ New Opportunity</button>
      </header>
      <div class="kanban-board">
        ${n}
      </div>
    </main>
  `}function R(e,t){const n=r.find(a=>a.id===e);n&&(n.pipeline_stage=t,t==="Completed"||t==="Paid"?n.status="won":t==="Lost"?n.status="lost":n.status="open",window.navigateTo(S,m||void 0),console.log(`Opportunity ${e} updated: Stage=[${t}], Status=[${n.status}]`),O("OPPORTUNITY_STAGE_UPDATED",n))}window.updateOpportunityStage=R;window.allowDrop=e=>{e.preventDefault()};window.drag=(e,t)=>{var n;(n=e.dataTransfer)==null||n.setData("text",t)};window.drop=(e,t)=>{var a;e.preventDefault();const n=(a=e.dataTransfer)==null?void 0:a.getData("text");n&&R(n,t)};window.navigateTo=(e,t)=>{S=e,t&&(m=t),e==="dashboard"&&E(),e==="clients"&&P(),e==="opportunities"&&Y(),e==="lead-capture"&&W(),e==="builder"&&x(),e==="reports"&&U(),e==="quickstart"&&G(),e==="contact-detail"&&m&&k(m)};function k(e){const t=p.find(i=>i.id===e);if(!t)return;const n=r.filter(i=>i.contact_id===e),a=$.filter(i=>i.contact_id===e).sort((i,s)=>new Date(s.due_date).getTime()-new Date(i.due_date).getTime());v.innerHTML=`
    ${g("clients")}
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
              ${n.map(i=>`
                <div class="opportunity-strip">
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center;">
                      <span>$</span>
                      <input type="number" 
                             value="${i.value}" 
                             class="inline-input" 
                             onchange="window.updateOpportunityField('${i.id}', 'value', this.value)" 
                             style="width: 80px; font-weight: 600;">
                    </div>
                    <select class="inline-select" onchange="window.updateOpportunityStage('${i.id}', this.value)">
                      ${D[0].stages.map(s=>`<option value="${s}" ${s===i.pipeline_stage?"selected":""}>${s}</option>`).join("")}
                    </select>
                  </div>
                  <span class="badge badge-${i.status}" style="font-size: 0.7rem;">${i.status}</span>
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
              ${a.map(i=>`
                <div class="timeline-item">
                  <div class="timeline-dot" style="background: ${i.completed?"#28a745":"var(--primary-color)"}"></div>
                  <div class="timeline-content">
                    <div class="timeline-time">${new Date(i.due_date).toLocaleString()}</div>
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                      <div>
                        <strong>${i.type.toUpperCase()}</strong>: ${i.description}
                      </div>
                      ${i.completed?'<span style="color: #28a745;">✓</span>':`<button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem; background: #28a745;" onclick="window.completeTask('${i.id}')">Complete</button>`}
                    </div>
                  </div>
                </div>
              `).join("")||'<p style="padding: 20px;">No activity logged.</p>'}
            </div>
          </div>
        </div>
      </div>
    </main>
  `}window.logCall=e=>{const t=prompt("Enter call summary:");t&&($.push({id:"act-"+Date.now(),contact_id:e,type:"call",description:t,due_date:new Date().toISOString(),completed:!0}),k(e))};window.addNote=e=>{const t=prompt("Enter your note:");t&&($.push({id:"act-"+Date.now(),contact_id:e,type:"note",description:t,due_date:new Date().toISOString(),completed:!0}),k(e))};window.completeTask=e=>{const t=$.find(n=>n.id===e);t&&(t.completed=!0,m&&k(m))};window.createOpportunity=e=>{const t=prompt("Enter Opportunity value (e.g. 500):","0"),n=parseFloat(t||"0"),a={id:"o"+(r.length+1)+"-"+Math.floor(Math.random()*100),contact_id:e,pipeline_stage:"New Lead",value:isNaN(n)?0:n,assigned_to:"Hansveer",status:"open",created_at:new Date().toISOString()};r.push(a),O("OPPORTUNITY_CREATED",a),k(e)};window.updateOpportunityField=(e,t,n)=>{const a=r.find(i=>i.id===e);a&&(t==="value"?a.value=parseFloat(n)||0:a[t]=n,window.navigateTo(S,m||void 0))};window.updateContactField=(e,t,n)=>{const a=p.find(i=>i.id===e);a&&(a[t]=n,window.navigateTo(S,m||void 0))};E();
