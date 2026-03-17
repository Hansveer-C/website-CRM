(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const o of a)if(o.type==="childList")for(const r of o.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&i(r)}).observe(document,{childList:!0,subtree:!0});function n(a){const o={};return a.integrity&&(o.integrity=a.integrity),a.referrerPolicy&&(o.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?o.credentials="include":a.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function i(a){if(a.ep)return;a.ep=!0;const o=n(a);fetch(a.href,o)}})();const C=[{id:"residential-sparkle",name:"Residential Sparkle",description:"Perfect for soft washing and home exterior care specialist.",theme:{primary:"#00d2ff",secondary:"#3a7bd5",font:"Inter"},blocks:[{id:"h1",type:"hero",data:{title:"The Cleanest House on the Block",subtitle:"Professional Soft Washing & Gutter Cleaning in Los Angeles.",buttonText:"Get My Free Estimate"}},{id:"s1",type:"services",data:{title:"Residential Services",items:["House Washing","Roof Cleaning","Gutter Brightening","Driveway Sealing"]}},{id:"c1",type:"contact",data:{title:"Request a Residential Quote"}}]},{id:"commercial-pro",name:"Commercial Pro",description:"Industrial bold styling for large-scale concrete and fleet cleaning.",theme:{primary:"#ff4b2b",secondary:"#ff416c",font:"Roboto"},blocks:[{id:"h2",type:"hero",data:{title:"Industrial Strength Cleaning",subtitle:"Reliable Fleet and Concrete Maintenance for Commercial Properties.",buttonText:"Schedule a Consultation"}},{id:"s2",type:"services",data:{title:"Commercial Solutions",items:["Fleet Washing","Dumpster Pad Cleaning","Parking Lot Restoration","Graffiti Removal"]}},{id:"t2",type:"trust",data:{title:"Trusted by Local Business Leaders",logos:["Starbucks","Walmart","Local Mall"]}}]},{id:"trust-proof",name:"The Trust Proof",description:"Heavy focus on before/after galleries and client testimonials.",theme:{primary:"#11998e",secondary:"#38ef7d",font:"Outfit"},blocks:[{id:"h3",type:"hero",data:{title:"See the Difference for Yourself",subtitle:"Real Results. Real Reviews. Real Experts.",buttonText:"View Our Gallery"}},{id:"g3",type:"gallery",data:{title:"Recent Successes",images:["Before/After 1","Before/After 2","Before/After 3"]}},{id:"t3",type:"trust",data:{title:"What Your Neighbors Say",testimonials:[{name:"Alice R.",text:"Best service ever!"},{name:"Bob S.",text:"My driveway looks new."}]}}]}],p=[{id:"c1",name:"John Doe",phone:"555-0101",email:"john@example.com",address:"123 Pine St, Seattle, WA",tags:["residential","referral"],source:"Google Search",status:"customer",created_at:"2026-02-15T10:00:00Z"},{id:"c2",name:"Jane Smith",phone:"555-0202",email:"jane@smithresidence.com",address:"456 Oak Ave, Portland, OR",tags:["lead","driveway"],source:"Facebook Ad",status:"lead",created_at:"2026-03-01T14:30:00Z"}],L=[{id:"p1",name:"Residential Cleaning Pipeline",stages:["New Lead","Quote Sent","Scheduled","Completed","Paid"]}],c=[{id:"o1",contact_id:"c2",pipeline_stage:"New Lead",value:250,assigned_to:"Hansveer",status:"open",created_at:"2026-03-01T14:35:00Z"},{id:"o2",contact_id:"c1",pipeline_stage:"Completed",value:450,assigned_to:"Hansveer",status:"won",created_at:"2026-02-15T10:05:00Z"}],w=[{id:"a1",contact_id:"c2",type:"call",description:"Initial follow-up call about driveway cleaning",due_date:"2026-03-02T09:00:00Z",completed:!0},{id:"a2",contact_id:"c2",type:"sms",description:"Sent quote via text",due_date:"2026-03-05T10:00:00Z",completed:!1}],N=[{id:"a1",name:"Auto-follow task for new leads",trigger:"OPPORTUNITY_CREATED",action:"CREATE_TASK",actionParams:{type:"call",description:"Call new lead ASAP",dueInMinutes:10}},{id:"a2",name:"Notify when job is scheduled",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:e=>e.pipeline_stage==="Scheduled",action:"SEND_NOTIFICATION",actionParams:{message:"🎉 A job has been scheduled! Get ready."}},{id:"a3",name:"Final follow up when completed",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:e=>e.pipeline_stage==="Completed",action:"CREATE_TASK",actionParams:{type:"visit",description:"Site cleanup & final inspection",dueInDays:0}},{id:"a4",name:"Follow up on sent quote",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:e=>e.pipeline_stage==="Quote Sent",action:"CREATE_TASK",actionParams:{type:"note",description:"Follow up on quote in 24 hours",dueInDays:1}}];function O(e,t){N.filter(i=>i.trigger===e&&(!i.condition||i.condition(t))).forEach(i=>{B(i,t)})}function B(e,t){switch(e.action){case"CREATE_TASK":M(e.actionParams,t);break;case"SEND_NOTIFICATION":j(e.actionParams,t);break}}function M(e,t){const n=p.find(r=>r.id===t.contact_id),i=n?n.name:"Unknown",a=new Date;e.dueInDays&&a.setDate(a.getDate()+e.dueInDays),e.dueInMinutes&&a.setMinutes(a.getMinutes()+e.dueInMinutes);const o={id:"task-"+Date.now()+"-"+Math.floor(Math.random()*1e3),contact_id:t.contact_id,type:e.type||"note",description:e.description||`[AUTOMATED] Follow up for ${i}`,due_date:a.toISOString(),completed:!1};w.push(o),console.log(`[AUTOMATION: TASK CREATED] ${o.description}`)}function j(e,t){const n=p.find(o=>o.id===t.contact_id),i=n?n.name:"Unknown",a=e.message.replace("${contactName}",i);console.log(`%c[AUTOMATION: NOTIFICATION] ${a} (${i})`,"color: #007bff; font-weight: bold;"),alert(`Automation Notification: ${a}`)}const m=document.querySelector("#app");let P="dashboard",b=C[0],d=[...b.blocks],y="",l="all",$=null;function v(e){return`
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
  `}function I(){const e=new Date,t=c.filter(s=>s.status==="open"),n=t.reduce((s,u)=>s+u.value,0),i=t.length,a=c.length,o=c.filter(s=>s.status==="won").length,r=a>0?o/a*100:0,h=L[0].stages.map(s=>{const u=c.filter(f=>f.pipeline_stage===s&&(f.status==="open"||f.status==="won")).reduce((f,R)=>f+R.value,0);return{stage:s,value:u}}).filter(s=>s.value>0),k=Math.max(...h.map(s=>s.value),1),S={};p.forEach(s=>{S[s.source]=(S[s.source]||0)+1});const D=Object.entries(S).map(([s,u])=>({source:s,count:u})),E=Math.max(...D.map(s=>s.count),1),_=w.filter(s=>!s.completed&&new Date(s.due_date)<e);m.innerHTML=`
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
          <p class="value">${r.toFixed(1)}%</p>
        </div>
        <div class="card" style="border-bottom: 4px solid #ff4444;">
          <small style="color: #666;">Attention Needed</small>
          <h3 style="color: #ff4444;">Overdue</h3>
          <p class="value" style="color: #ff4444;">${_.length}</p>
        </div>
      </div>

      <div class="stats-grid" style="margin-top: 30px;">
        <div class="card">
          <h3>Revenue by Pipeline Stage</h3>
          <div class="chart-container" style="margin-top: 20px;">
            ${h.map(s=>`
              <div class="report-item">
                <div class="report-item-header">
                  <span>${s.stage}</span>
                  <span style="font-weight: 600;">$${s.value.toLocaleString()}</span>
                </div>
                <div class="visual-bar-bg">
                  <div class="visual-bar-fill" style="width: ${s.value/k*100}%"></div>
                </div>
              </div>
            `).join("")||'<p style="color: #666; font-style: italic; padding: 20px;">No revenue data for active stages</p>'}
          </div>
        </div>
        <div class="card">
          <h3>Lead Sources Performance</h3>
          <div class="chart-container" style="margin-top: 20px;">
            ${D.map(s=>`
              <div class="report-item">
                <div class="report-item-header">
                  <span>${s.source}</span>
                  <span style="font-weight: 600;">${s.count} Leads</span>
                </div>
                <div class="visual-bar-bg">
                  <div class="visual-bar-fill" style="width: ${s.count/E*100}%; background: #6c757d;"></div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>

      ${_.length>0?`
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
              ${_.map(s=>{const u=p.find(f=>f.id===s.contact_id);return`
                  <tr style="background: #fffafa;">
                    <td style="font-weight: 600;">${u?u.name:"Unknown"}</td>
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
  `}function A(){const t=p.filter(i=>{const a=i.name.toLowerCase().includes(y.toLowerCase())||i.phone.includes(y),o=l==="all"||i.status===l;return a&&o}).map(i=>{const a=w.filter(o=>o.contact_id===i.id).sort((o,r)=>new Date(r.due_date).getTime()-new Date(o.due_date).getTime())[0];return`
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
                   value="${y}" 
                   style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn-primary" style="background: ${l==="all"?"var(--primary-color)":"#eee"}; color: ${l==="all"?"white":"#333"}" onclick="window.filterClients('all')">All</button>
            <button class="btn-primary" style="background: ${l==="lead"?"var(--primary-color)":"#eee"}; color: ${l==="lead"?"white":"#333"}" onclick="window.filterClients('lead')">Leads</button>
            <button class="btn-primary" style="background: ${l==="customer"?"var(--primary-color)":"#eee"}; color: ${l==="customer"?"white":"#333"}" onclick="window.filterClients('customer')">Customers</button>
            <button class="btn-primary" style="background: ${l==="lost"?"var(--primary-color)":"#eee"}; color: ${l==="lost"?"white":"#333"}" onclick="window.filterClients('lost')">Lost</button>
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
  `;const n=document.getElementById("client-search");n==null||n.addEventListener("input",i=>{y=i.target.value,A()}),y&&(n.focus(),n.setSelectionRange(y.length,y.length))}window.filterClients=e=>{l=e,A()};function x(){var e;m.innerHTML=`
    ${v("builder")}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; align-items: center; gap: 20px;">
          <h2>Website Builder</h2>
          <select id="template-select" style="padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
            ${C.map(t=>`<option value="${t.id}" ${t.id===b.id?"selected":""}>${t.name}</option>`).join("")}
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
          ${F()}
        </div>
      </div>
    </main>
  `,(e=document.getElementById("template-select"))==null||e.addEventListener("change",t=>{const n=t.target.value,i=C.find(a=>a.id===n);i&&(b=i,d=[...i.blocks],x())}),document.querySelectorAll(".draggable-item").forEach(t=>{t.addEventListener("click",()=>{const n=t.getAttribute("data-type");window.addBlock(n)})})}function F(){return d.length===0?`<div class="canvas-section" style="border: 2px dashed #007bff; background: #f0f7ff;">
              <p style="color: #007bff;">Click an element to add it here</p>
            </div>`:d.map((e,t)=>{let n="";switch(e.type){case"hero":n=`
          <div class="canvas-hero" style="background: linear-gradient(135deg, ${b.theme.primary}, ${b.theme.secondary});">
            <h1>${e.data.title}</h1>
            <p>${e.data.subtitle}</p>
            <button class="btn-primary" style="background: white; color: ${b.theme.primary}; margin-top: 20px;">${e.data.buttonText}</button>
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
              <button class="btn-primary" style="background: ${b.theme.primary}">Send Quote Request</button>
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
    `}).join("")}window.addBlock=e=>{const t={id:Date.now().toString(),type:e,data:q(e)};d.push(t),x()};window.removeBlock=e=>{d.splice(e,1),x()};window.moveBlock=(e,t)=>{const n=e+t;if(n>=0&&n<d.length){const i=d[e];d[e]=d[n],d[n]=i,x()}};function q(e){switch(e){case"hero":return{title:"Insert Title",subtitle:"Insert Subtitle",buttonText:"Click Me"};case"services":return{title:"Our Services",items:["Service 1","Service 2","Service 3"]};case"contact":return{title:"Get In Touch"};case"gallery":return{title:"Our Work",images:["Image 1","Image 2","Image 3"]};case"trust":return{title:"What Clients Say",testimonials:[{name:"John D.",text:"Great Job!"}]};default:return{}}}function H(){m.innerHTML=`
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
  `}function G(){m.innerHTML=`
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
  `}function U(){var e;m.innerHTML=`
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
  `,(e=document.getElementById("lead-form"))==null||e.addEventListener("submit",W)}function W(e){e.preventDefault();const t=document.getElementById("lead_name").value,n=document.getElementById("lead_phone").value,i=document.getElementById("lead_email").value,a=document.getElementById("lead_address").value,o=document.getElementById("lead_service").value,r="c"+(p.length+1),g="o"+(c.length+1);p.push({id:r,name:t,phone:n,email:i,address:a,tags:["new-lead"],source:"Lead Capture Form",service:o,status:"lead",created_at:new Date().toISOString()});const h={id:g,contact_id:r,pipeline_stage:"New Lead",value:0,assigned_to:"Hansveer",status:"open",created_at:new Date().toISOString()};c.push(h),O("OPPORTUNITY_CREATED",h);const k=document.querySelector(".lead-form-container");k&&(k.innerHTML=`
      <div style="text-align: center; padding: 40px 0;">
        <div style="font-size: 3rem; color: var(--primary-color); margin-bottom: 20px;">✓</div>
        <h2 style="margin-bottom: 10px;">Submission Received</h2>
        <p style="font-size: 1.2rem; color: var(--secondary-color);">Thanks! We’ll contact you shortly.</p>
        <button onclick="window.navigateTo('lead-capture')" class="btn-primary" style="margin-top: 30px; background-color: var(--secondary-color);">Capture Another Lead</button>
        <button onclick="window.navigateTo('opportunities')" class="btn-primary" style="margin-top: 30px; margin-left:10px;">View Pipeline</button>
      </div>
    `)}function Q(){const e=L[0],n=e.stages.map(i=>{const a=c.filter(r=>r.pipeline_stage===i),o=a.map(r=>{const g=p.find(h=>h.id===r.contact_id);return`
        <div class="kanban-card" draggable="true" ondragstart="drag(event, '${r.id}')" onclick="window.navigateTo('contact-detail', '${r.contact_id}')" style="cursor: pointer;">
          <div class="contact-name">${g?g.name:"Unknown Contact"}</div>
          <div class="opportunity-value">$${r.value.toLocaleString()}</div>
          <div class="contact-phone">${g?g.phone:"N/A"}</div>
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
  `}function Y(e,t){const n=c.find(i=>i.id===e);n&&(n.pipeline_stage=t,t==="Completed"||t==="Paid"?n.status="won":t==="Lost"?n.status="lost":n.status="open",window.navigateTo(P),console.log(`Opportunity ${e} updated: Stage=[${t}], Status=[${n.status}]`),O("OPPORTUNITY_STAGE_UPDATED",n))}window.allowDrop=e=>{e.preventDefault()};window.drag=(e,t)=>{var n;(n=e.dataTransfer)==null||n.setData("text",t)};window.drop=(e,t)=>{var i;e.preventDefault();const n=(i=e.dataTransfer)==null?void 0:i.getData("text");n&&Y(n,t)};window.navigateTo=(e,t)=>{P=e,t&&($=t),e==="dashboard"&&I(),e==="clients"&&A(),e==="opportunities"&&Q(),e==="lead-capture"&&U(),e==="builder"&&x(),e==="reports"&&H(),e==="quickstart"&&G(),e==="contact-detail"&&$&&T($)};function T(e){const t=p.find(a=>a.id===e);if(!t)return;const n=c.filter(a=>a.contact_id===e),i=w.filter(a=>a.contact_id===e).sort((a,o)=>new Date(o.due_date).getTime()-new Date(a.due_date).getTime());m.innerHTML=`
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
      </div>

      <div class="detail-container">
        <!-- Sidebar Info -->
        <aside class="detail-sidebar">
          <div class="card">
            <h3>Contact Information</h3>
            <div style="margin-top: 15px;">
              <p><strong>Phone:</strong> ${t.phone}</p>
              <p><strong>Email:</strong> ${t.email}</p>
              <p><strong>Address:</strong> ${t.address}</p>
              <p><strong>Source:</strong> ${t.source}</p>
              <p><strong>Created:</strong> ${new Date(t.created_at).toLocaleDateString()}</p>
            </div>
            
            <h3 style="margin-top: 25px;">Active Opportunities</h3>
            <div style="margin-top: 15px;">
              ${n.map(a=>`
                <div class="opportunity-strip">
                  <div>
                    <div style="font-weight: 600;">$${a.value.toLocaleString()}</div>
                    <small style="color: #666;">${a.pipeline_stage}</small>
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
        </div>
      </div>
    </main>
  `}window.logCall=e=>{const t=prompt("Enter call summary:");t&&(w.push({id:"act-"+Date.now(),contact_id:e,type:"call",description:t,due_date:new Date().toISOString(),completed:!0}),T(e))};window.addNote=e=>{const t=prompt("Enter your note:");t&&(w.push({id:"act-"+Date.now(),contact_id:e,type:"note",description:t,due_date:new Date().toISOString(),completed:!0}),T(e))};window.completeTask=e=>{const t=w.find(n=>n.id===e);t&&(t.completed=!0,$&&T($))};I();
