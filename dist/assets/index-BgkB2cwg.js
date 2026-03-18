(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))o(n);new MutationObserver(n=>{for(const a of n)if(a.type==="childList")for(const s of a.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&o(s)}).observe(document,{childList:!0,subtree:!0});function i(n){const a={};return n.integrity&&(a.integrity=n.integrity),n.referrerPolicy&&(a.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?a.credentials="include":n.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function o(n){if(n.ep)return;n.ep=!0;const a=i(n);fetch(n.href,a)}})();const h=[{id:"c1",name:"John Doe",phone:"555-0101",email:"john@example.com",address:"123 Pine St, Seattle, WA",tags:["residential","referral"],source:"Google Search",status:"customer",created_at:"2026-02-15T10:00:00Z"},{id:"c2",name:"Jane Smith",phone:"555-0202",email:"jane@smithresidence.com",address:"456 Oak Ave, Portland, OR",tags:["lead","driveway"],source:"Facebook Ad",status:"lead",created_at:"2026-03-01T14:30:00Z"}],E=[{id:"p1",name:"Residential Cleaning Pipeline",stages:["New Lead","Quote Sent","Scheduled","Completed","Paid"]}],p=[{id:"o1",contact_id:"c2",pipeline_stage:"New Lead",value:250,assigned_to:"Hansveer",status:"open",created_at:"2026-03-01T14:35:00Z"},{id:"o2",contact_id:"c1",pipeline_stage:"Completed",value:450,assigned_to:"Hansveer",status:"won",created_at:"2026-02-15T10:05:00Z"}],u=[{id:"a1",contact_id:"c2",type:"call",description:"Initial follow-up call about driveway cleaning",due_date:"2026-03-02T09:00:00Z",completed:!0},{id:"a2",contact_id:"c2",type:"sms",description:"Sent quote via text",due_date:"2026-03-05T10:00:00Z",completed:!1}],$=[{id:"q1",contact_id:"c2",opportunity_id:"o1",status:"sent",total_amount:250,notes:"Standard driveway cleaning quote",created_at:"2026-03-02T10:00:00Z"}],W=[{id:"qi1",quote_id:"q1",service_name:"Driveway Cleaning",description:"High pressure wash for standard 2-car driveway",quantity:1,unit_price:250,total:250}],x=[{id:"i1",contact_id:"c2",quote_id:"q1",status:"unpaid",amount:250,due_date:"2026-03-24T12:00:00Z",created_at:"2026-03-17T15:00:00Z"}],v=[{id:"p1",name:"Home",slug:"home",status:"published",seo_title:"PressurePro - Professional Pressure Washing Services",seo_description:"High-quality pressure washing for residential and commercial properties.",seo_keywords:["pressure washing","exterior cleaning","roof cleaning"],created_at:"2026-01-01T09:00:00Z"},{id:"p2",name:"About Us",slug:"about",status:"published",seo_title:"About HansSays | Our Mission",seo_description:"Professional exterior cleaning services you can trust.",seo_keywords:["about us","quality service","professional cleaners"],created_at:"2026-01-05T10:00:00Z"},{id:"p3",name:"Driveway Cleaning",slug:"driveway-cleaning",status:"published",seo_title:"Driveway Cleaning Services | Professional Pressure Washing",seo_description:"Transform your driveway with our professional pressure washing services.",seo_keywords:["driveway cleaning","concrete washing","restore driveway"],created_at:"2026-03-10T09:00:00Z"},{id:"p4",name:"Patio Cleaning",slug:"patio-cleaning",status:"published",seo_title:"Patio Cleaning & Restoration | Garden Services",seo_description:"Get your patio ready for summer with our high-pressure cleaning solutions.",seo_keywords:["patio cleaning","stone washing","patio restoration"],created_at:"2026-03-12T09:00:00Z"}],g=[{id:"ps1",page_id:"p1",type:"hero",content:{heading:"Welcome to HansSays",subheading:"Leading pressure washing experts in the region."},order:1,styles:{background:"#007bff"}},{id:"ps-d1",page_id:"p3",type:"hero",content:{heading:"Pristine Driveways, Every Time.",subheading:"We remove years of stains, oil, and moss with ease.",button_text:"Get an Instant Quote",background_image:"https://images.unsplash.com/photo-1541604193435-22077a288934?auto=format&fit=crop&w=1200"},order:1,styles:{text_alignment:"center"}},{id:"ps-p1",page_id:"p4",type:"hero",content:{heading:"Revitalize Your Patio.",subheading:"Enjoy your outdoor space again without the grime.",button_text:"See Pricing",background_image:"https://images.unsplash.com/photo-1590150117409-51a66e13885d?auto=format&fit=crop&w=1200"},order:1,styles:{text_alignment:"left"}},{id:"ps2",page_id:"p1",type:"text",content:{text:"We offer professional cleaning for your driveway, roof, and more."},order:2,styles:{padding:"40px"}},{id:"ps3",page_id:"p2",type:"hero",content:{title:"About Us",subtitle:"Founded in 2026 with a mission to clean up the world."},order:1,styles:{backgroundColor:"#333"}}],z=[{id:"comp1",name:"Advanced Hero",type:"hero",default_content:{heading:"Experience the Power of Clean",subheading:"Professional pressure washing for your home and business.",button_text:"Get a Free Quote",button_link:"#contact",background_image:"https://images.unsplash.com/photo-1521791136064-7986c2959210?auto=format&fit=crop&w=1200&q=80"},default_styles:{padding:"100px 20px",text_alignment:"center"}},{id:"comp2",name:"Rich Text Block",type:"text",default_content:{text:"<p>Standard text block for your content. Supporting <b>bold</b> and <i>italic</i> styling where needed.</p>"},default_styles:{font_size:"18px",alignment:"left"}},{id:"comp3",name:"Lead Capture Form",type:"form",default_content:{title:"Get a Free Quote",fields:["name","phone","email","message"],pipeline_id:"p1"},default_styles:{padding:"30px",background:"#f8fafc"}},{id:"comp4",name:"Styled Image",type:"image",default_content:{image_url:"https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80"},default_styles:{width:"100%",border_radius:"12px"}},{id:"comp5",name:"Link Button",type:"button",default_content:{label:"Visit Website",link:"#"},default_styles:{color:"#007bff",size:"medium"}}],de=[{id:"m1",name:"Clean Driveway",url:"https://images.unsplash.com/photo-1541604193435-22077a288934?auto=format&fit=crop&w=800&q=80",type:"image",tags:["driveway","clean","concrete"]},{id:"m2",name:"Power Washing Patio",url:"https://images.unsplash.com/photo-1516743618621-af979b8d49b1?auto=format&fit=crop&w=800&q=80",type:"image",tags:["patio","washing","stone"]},{id:"m3",name:"Siding Cleaning",url:"https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80",type:"image",tags:["house","siding","clean"]},{id:"m4",name:"Roof Moss Removal",url:"https://images.unsplash.com/photo-1626700051175-6518a4993f57?auto=format&fit=crop&w=800&q=80",type:"image",tags:["roof","moss","washing"]},{id:"m5",name:"Commercial Exterior",url:"https://images.unsplash.com/photo-1621905252507-b35221ad889a?auto=format&fit=crop&w=800&q=80",type:"image",tags:["commercial","brick","clean"]}],te=[{id:"residential-sparkle",name:"Residential Sparkle",description:"Perfect for soft washing and home exterior care specialist.",category:"Residential",image:"https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=600",theme:{primary:"#00d2ff",secondary:"#3a7bd5",font:"Inter"},blocks:[{id:"h1",type:"hero",data:{title:"The Cleanest House on the Block",subtitle:"Professional Soft Washing & Gutter Cleaning in Los Angeles.",buttonText:"Get My Free Estimate"}},{id:"s1",type:"services",data:{title:"Residential Services",items:["House Washing","Roof Cleaning","Gutter Brightening","Driveway Sealing"]}},{id:"c1",type:"contact",data:{title:"Request a Residential Quote"}}]},{id:"commercial-pro",name:"Commercial Pro",description:"Industrial bold styling for large-scale concrete and fleet cleaning.",category:"Commercial",image:"https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=600",theme:{primary:"#ff4b2b",secondary:"#ff416c",font:"Roboto"},blocks:[{id:"h2",type:"hero",data:{title:"Industrial Strength Cleaning",subtitle:"Reliable Fleet and Concrete Maintenance for Commercial Properties.",buttonText:"Schedule a Consultation"}},{id:"s2",type:"services",data:{title:"Commercial Solutions",items:["Fleet Washing","Dumpster Pad Cleaning","Parking Lot Restoration","Graffiti Removal"]}},{id:"t2",type:"trust",data:{title:"Trusted by Local Business Leaders",logos:["Starbucks","Walmart","Local Mall"]}}]},{id:"trust-proof",name:"The Trust Proof",description:"Heavy focus on before/after galleries and client testimonials.",category:"Conversion",image:"https://images.unsplash.com/photo-1599839619722-39751411ea63?auto=format&fit=crop&q=80&w=600",theme:{primary:"#11998e",secondary:"#38ef7d",font:"Outfit"},blocks:[{id:"h3",type:"hero",data:{title:"See the Difference for Yourself",subtitle:"Real Results. Real Reviews. Real Experts.",buttonText:"View Our Gallery"}},{id:"g3",type:"gallery",data:{title:"Recent Successes",images:["Before/After 1","Before/After 2","Before/After 3"]}},{id:"t3",type:"trust",data:{title:"What Your Neighbors Say",testimonials:[{name:"Alice R.",text:"Best service ever!"},{name:"Bob S.",text:"My driveway looks new."}]}}]}];function ie(){const t=new Date;x.forEach(e=>{e.status==="unpaid"&&new Date(e.due_date)<t&&(u.some(o=>o.contact_id===e.contact_id&&o.description.includes(`INV-${e.id}`)&&o.description.includes("Follow up for payment"))||(u.push({id:"task-overdue-"+e.id+"-"+Math.floor(Math.random()*1e3),contact_id:e.contact_id,type:"note",description:`Follow up for payment (INV-${e.id})`,due_date:new Date().toISOString(),completed:!1}),console.log(`[AUTOMATION: OVERDUE] Created payment follow-up for INV-${e.id}`)))})}const re=[{id:"a1",name:"Auto-follow task for new leads",trigger:"OPPORTUNITY_CREATED",action:"CREATE_TASK",actionParams:{type:"call",description:"Call new lead ASAP",dueInMinutes:10}},{id:"a2",name:"Notify when job is scheduled",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:t=>t.pipeline_stage==="Scheduled",action:"SEND_NOTIFICATION",actionParams:{message:"🎉 A job has been scheduled! Get ready."}},{id:"a3",name:"Final follow up when completed",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:t=>t.pipeline_stage==="Completed",action:"CREATE_TASK",actionParams:{type:"visit",description:"Site cleanup & final inspection",dueInDays:0}},{id:"a4",name:"Follow up on sent quote",trigger:"OPPORTUNITY_STAGE_UPDATED",condition:t=>t.pipeline_stage==="Quote Sent",action:"CREATE_TASK",actionParams:{type:"note",description:"Follow up on quote in 24 hours",dueInDays:1}}];function R(t,e){re.filter(o=>o.trigger===t&&(!o.condition||o.condition(e))).forEach(o=>{le(o,e)})}function le(t,e){switch(t.action){case"CREATE_TASK":ce(t.actionParams,e);break;case"SEND_NOTIFICATION":pe(t.actionParams,e);break}}function ce(t,e){const i=h.find(s=>s.id===e.contact_id),o=i?i.name:"Unknown",n=new Date;t.dueInDays&&n.setDate(n.getDate()+t.dueInDays),t.dueInMinutes&&n.setMinutes(n.getMinutes()+t.dueInMinutes);const a={id:"task-"+Date.now()+"-"+Math.floor(Math.random()*1e3),contact_id:e.contact_id,type:t.type||"note",description:t.description||`[AUTOMATED] Follow up for ${o}`,due_date:n.toISOString(),completed:!1};u.push(a),console.log(`[AUTOMATION: TASK CREATED] ${a.description}`)}function pe(t,e){const i=h.find(a=>a.id===e.contact_id),o=i?i.name:"Unknown",n=t.message.replace("${contactName}",o);console.log(`%c[AUTOMATION: NOTIFICATION] ${n} (${o})`,"color: #007bff; font-weight: bold;"),alert(`Automation Notification: ${n}`)}const m=document.querySelector("#app");let w="dashboard",O="",S="all",b=null,A="all";var ee;let C=((ee=v[0])==null?void 0:ee.id)||"",I=null,L=null,ue=[{service:"",description:"",quantity:1,price:0,tier:"basic"}];window.newQuoteLineItems=ue;let ge="";window.newQuoteContactId=ge;let me="";window.newQuoteOpportunityId=me;function y(t){return`
    <div class="sidebar">
      <h1>PressurePro</h1>
      <nav>
        <ul>
          <div class="nav-group-title" style="margin-top: 0;">Main Menu</div>
          <li onclick="window.navigateTo('dashboard')" class="${t==="dashboard"?"active":""}">Dashboard</li>
          <li onclick="window.navigateTo('clients')" class="${t==="clients"?"active":""}">Clients & Leads</li>
          <li onclick="window.navigateTo('opportunities')" class="${t==="opportunities"?"active":""}">Opportunities</li>
          <li onclick="window.navigateTo('quotes')" class="${t==="quotes"?"active":""}">Quotes</li>
          <li onclick="window.navigateTo('invoices')" class="${t==="invoices"?"active":""}">Invoices</li>
          <li onclick="window.navigateTo('lead-capture')" class="${t==="lead-capture"?"active":""}">Lead Capture</li>
          
          <div class="nav-group-title">Websites</div>
          <li onclick="window.navigateTo('pages')" class="${t==="pages"||t==="page-sections"?"active":""}">Pages</li>
          <li onclick="window.navigateTo('templates')" class="${t==="templates"?"active":""}">Templates</li>
          <li onclick="window.navigateTo('components')" class="${t==="components"?"active":""}">Components</li>
          <li onclick="window.navigateTo('website-settings')" class="${t==="website-settings"?"active":""}">Settings</li>
          
          <div class="nav-group-title">System</div>
          <li onclick="window.navigateTo('reports')" class="${t==="reports"?"active":""}">Reports & Insights</li>
          <li onclick="window.navigateTo('quickstart')" class="${t==="quickstart"?"active":""}">Quickstart Guide</li>
          <li>Payments</li>
          <li>Settings</li>
        </ul>
      </nav>
    </div>
  `}function ne(){const t=new Date,e=p.filter(c=>c.status==="open"),i=e.reduce((c,_)=>c+_.value,0),o=e.length,n=p.length,a=p.filter(c=>c.status==="won").length,s=n>0?a/n*100:0,r=E[0].stages.map(c=>{const _=p.filter(P=>P.pipeline_stage===c&&(P.status==="open"||P.status==="won")).reduce((P,j)=>P+j.value,0);return{stage:c,value:_}}).filter(c=>c.value>0),l=Math.max(...r.map(c=>c.value),1),f={};h.forEach(c=>{f[c.source]=(f[c.source]||0)+1});const D=Object.entries(f).map(([c,_])=>({source:c,count:_})),B=Math.max(...D.map(c=>c.count),1),N=u.filter(c=>!c.completed&&new Date(c.due_date)<t);m.innerHTML=`
    ${y("dashboard")}
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
          <p class="value" style="color: #ff4444;">${N.length}</p>
        </div>
      </div>

      <div class="stats-grid" style="margin-top: 30px;">
        <div class="card">
          <h3>Revenue by Pipeline Stage</h3>
          <div class="chart-container" style="margin-top: 20px;">
            ${r.map(c=>`
              <div class="report-item">
                <div class="report-item-header">
                  <span>${c.stage}</span>
                  <span style="font-weight: 600;">$${c.value.toLocaleString()}</span>
                </div>
                <div class="visual-bar-bg">
                  <div class="visual-bar-fill" style="width: ${c.value/l*100}%"></div>
                </div>
              </div>
            `).join("")||'<p style="color: #666; font-style: italic; padding: 20px;">No revenue data for active stages</p>'}
          </div>
        </div>
        <div class="card">
          <h3>Lead Sources Performance</h3>
          <div class="chart-container" style="margin-top: 20px;">
            ${D.map(c=>`
              <div class="report-item">
                <div class="report-item-header">
                  <span>${c.source}</span>
                  <span style="font-weight: 600;">${c.count} Leads</span>
                </div>
                <div class="visual-bar-bg">
                  <div class="visual-bar-fill" style="width: ${c.count/B*100}%; background: #6c757d;"></div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>

      ${N.length>0?`
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
              ${N.map(c=>{const _=h.find(P=>P.id===c.contact_id);return`
                  <tr style="background: #fffafa;">
                    <td style="font-weight: 600;">${_?_.name:"Unknown"}</td>
                    <td>${c.description}</td>
                    <td style="color: #ff4444; font-weight: 500;">${new Date(c.due_date).toLocaleDateString()}</td>
                    <td><button class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; background: #ff4444; border-radius: 4px;">Resolve</button></td>
                  </tr>
                `}).join("")}
            </tbody>
          </table>
        </div>
      `:""}
    </main>
  `}function G(){const e=h.filter(o=>{const n=o.name.toLowerCase().includes(O.toLowerCase())||o.phone.includes(O),a=S==="all"||o.status===S;return n&&a}).map(o=>{const n=u.filter(a=>a.contact_id===o.id).sort((a,s)=>new Date(s.due_date).getTime()-new Date(a.due_date).getTime())[0];return`
      <tr onclick="window.navigateTo('contact-detail', '${o.id}')" style="cursor: pointer;">
        <td style="font-weight: 600; color: var(--primary-color);">${o.name}</td>
        <td>${o.phone}</td>
        <td><span class="badge badge-${o.status}">${o.status}</span></td>
        <td><span style="font-size: 0.85rem; color: #666;">${o.source}</span></td>
        <td>${n?new Date(n.due_date).toLocaleDateString():"No activity"}</td>
        <td><button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="event.stopPropagation(); window.navigateTo('contact-detail', '${o.id}')">View</button></td>
      </tr>
    `}).join("");m.innerHTML=`
    ${y("clients")}
    <main class="main-content">
      <header class="view-header">
        <h2>Clients & Leads</h2>
        <button class="btn-primary" onclick="window.navigateTo('lead-capture')">+ Add Lead</button>
      </header>

      <div class="card" style="margin-bottom: 24px; padding: 16px;">
        <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 300px;">
            <input type="text" id="client-search" placeholder="Search by name or phone..." 
                   value="${O}" 
                   style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn-primary" style="background: ${S==="all"?"var(--primary-color)":"#eee"}; color: ${S==="all"?"white":"#333"}" onclick="window.filterClients('all')">All</button>
            <button class="btn-primary" style="background: ${S==="lead"?"var(--primary-color)":"#eee"}; color: ${S==="lead"?"white":"#333"}" onclick="window.filterClients('lead')">Leads</button>
            <button class="btn-primary" style="background: ${S==="customer"?"var(--primary-color)":"#eee"}; color: ${S==="customer"?"white":"#333"}" onclick="window.filterClients('customer')">Customers</button>
            <button class="btn-primary" style="background: ${S==="lost"?"var(--primary-color)":"#eee"}; color: ${S==="lost"?"white":"#333"}" onclick="window.filterClients('lost')">Lost</button>
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
  `;const i=document.getElementById("client-search");i==null||i.addEventListener("input",o=>{O=o.target.value,G()}),O&&(i.focus(),i.setSelectionRange(O.length,O.length))}window.filterClients=t=>{S=t,G()};window.updatePageName=(t,e)=>{const i=v.find(o=>o.id===t);i&&(i.name=e,i.updated_at=new Date().toISOString())};window.togglePublishFromBuilder=t=>{const e=v.find(i=>i.id===t);e&&(e.status=e.status==="published"?"draft":"published",e.updated_at=new Date().toISOString(),k())};let Q=!1,V;window.triggerAutoSave=()=>{Q=!0;const t=document.getElementById("pb-autosave-indicator");t&&(t.innerHTML='<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #ffc107; box-shadow: 0 0 5px #ffc107;"></span> Saving...'),clearTimeout(V),V=setTimeout(()=>{Q=!1;const e=v.find(o=>o.id===C);e&&(e.updated_at=new Date().toISOString());const i=document.getElementById("pb-autosave-indicator");i&&(i.innerHTML='<span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #28a745;"></span> Saved')},1e3)};let U="content";window.setBuilderTab=t=>{U=t,k()};function k(){if(!document.startViewTransition){K();return}document.startViewTransition(()=>{K()})}function K(){const t=v.find(o=>o.id===C);if(!t)return;const e=g.filter(o=>o.page_id===C).sort((o,n)=>o.order-n.order),i=e.find(o=>o.id===I);m.innerHTML=`
    ${y("builder")}
    <main class="main-content" style="padding: 0; overflow: hidden; height: 100vh; display: flex; flex-direction: column;">
      <header style="background: #111; border-bottom: 1px solid #333; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 100; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 15px;">
          <button class="btn-primary" style="background: transparent; border: 1px solid #333; color: #888; padding: 6px 12px; font-size: 0.8rem;" onclick="window.navigateTo('pages')">← Back to List</button>
          <input type="text" value="${t.name}" onchange="window.updatePageName('${t.id}', this.value)" style="background: transparent; border: 1px solid transparent; color: white; font-size: 1.1rem; font-weight: 600; padding: 4px 8px; border-radius: 4px; transition: border-color 0.2s; outline: none; width: 300px;" onfocus="this.style.borderColor='#333'; this.style.background='#000'" onblur="this.style.borderColor='transparent'; this.style.background='transparent'" title="Edit Page Name">
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span id="pb-autosave-indicator" style="color: #888; font-size: 0.8rem; margin-right: 15px; display: flex; align-items: center; gap: 6px; font-weight: 600;">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${Q?"#ffc107":"#28a745"}; box-shadow: ${Q?"0 0 5px #ffc107":"none"};"></span> ${Q?"Saving...":"Saved"}
          </span>
          <button class="btn-primary" style="background: #222; border: 1px solid #444; padding: 6px 15px; font-size: 0.85rem;" onclick="window.navigateTo('preview', '${t.slug}')">Preview</button>
          <div style="width: 1px; height: 20px; background: #333; margin: 0 5px;"></div>
          <button class="btn-primary" style="background: ${t.status==="published"?"#ea580c":"var(--primary-color)"}; padding: 6px 15px; font-size: 0.85rem;" onclick="window.togglePublishFromBuilder('${t.id}')">${t.status==="published"?"Unpublish":"Publish"}</button>
        </div>
      </header>
      <div class="pb-layout" style="flex: 1;">
        <!-- Left Panel: Navigator & Components -->
        <aside class="pb-left-panel">
          <div class="pb-panel-header">
            <h3>Library</h3>
            <span style="font-size: 0.7rem; background: #333; padding: 2px 6px; border-radius: 4px; color: #888;">${z.length} Assets</span>
          </div>
          
          <div class="pb-component-list">
            <div style="font-size: 0.7rem; color: #555; margin-bottom: 10px; font-weight: 800; text-transform: uppercase;">Basic</div>
            ${z.filter(o=>["text","button","image"].includes(o.type)).map(o=>`
              <div class="pb-component-item" onclick="window.addSectionToPage('${o.id}')">
                <div style="width: 32px; height: 32px; background: #333; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">+</div>
                <div><div style="font-weight: 600; font-size: 0.85rem;">${o.name}</div></div>
              </div>
            `).join("")}

            <div style="font-size: 0.7rem; color: #555; margin: 20px 0 10px 0; font-weight: 800; text-transform: uppercase;">Layout</div>
            ${z.filter(o=>["hero","section"].includes(o.type)).map(o=>`
              <div class="pb-component-item" onclick="window.addSectionToPage('${o.id}')">
                <div style="width: 32px; height: 32px; background: #333; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">+</div>
                <div><div style="font-weight: 600; font-size: 0.85rem;">${o.name}</div></div>
              </div>
            `).join("")}
            
            <div style="font-size: 0.7rem; color: #555; margin: 20px 0 10px 0; font-weight: 800; text-transform: uppercase;">Forms</div>
            ${z.filter(o=>["form"].includes(o.type)).map(o=>`
              <div class="pb-component-item" onclick="window.addSectionToPage('${o.id}')">
                <div style="width: 32px; height: 32px; background: #333; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">+</div>
                <div><div style="font-weight: 600; font-size: 0.85rem;">${o.name}</div></div>
              </div>
            `).join("")}

            <div style="font-size: 0.7rem; color: #555; margin: 20px 0 10px 0; font-weight: 800; text-transform: uppercase;">Advanced</div>
            ${z.filter(o=>!["text","button","image","hero","section","form"].includes(o.type)).map(o=>`
              <div class="pb-component-item" onclick="window.addSectionToPage('${o.id}')">
                <div style="width: 32px; height: 32px; background: #333; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">+</div>
                <div><div style="font-weight: 600; font-size: 0.85rem;">${o.name}</div></div>
              </div>
            `).join("")}
          </div>
          
          <div style="margin-top: auto; padding: 15px; background: #111; border-top: 1px solid #222;">
             <label style="font-size: 0.65rem; color: #666; display: block; margin-bottom: 8px; text-transform: uppercase; font-weight: 800;">Acting on Page</label>
             <select onchange="window.switchBuilderPage(this.value)" style="width: 100%; padding: 10px; border-radius: 4px; background: #000; border: 1px solid #333; color: white; font-size: 0.85rem;">
                ${v.map(o=>`<option value="${o.id}" ${o.id===C?"selected":""}>${o.name}</option>`).join("")}
             </select>
          </div>
        </aside>

        <!-- Center Panel: Live Canvas -->
        <section class="pb-canvas-area" style="overflow-y: auto; height: 100%; padding-bottom: 50px;">
          
          <div class="pb-canvas-inner" style="padding-top: 25px;">
            ${["Add Initial",...e].map(o=>{const n=o==="Add Initial",a=n?null:o,s=n?0:a.order+.5;return`
                <div class="pb-add-between" onclick="window.showComponentPickerAt('${s}')">
                   <div class="pb-add-btn">+</div>
                </div>
                ${n?"":`
                  <div class="pb-section-preview ${I===a.id?"active":""}" 
                       style="position: relative; view-transition-name: section-${a.id}; ${I===a.id?"outline: 3px solid var(--primary-color); outline-offset: -3px; box-shadow: 0 0 15px rgba(0,0,0,0.1);":""} transition: all 0.2s;"
                       onclick="window.selectSectionForBuilder('${a.id}')"
                       onmouseenter="this.querySelector('.pb-section-controls').style.opacity='1'"
                       onmouseleave="this.querySelector('.pb-section-controls').style.opacity='0'">
                      
                      <div style="padding: ${a.styles.padding||"60px 20px"}; 
                                  text-align: ${a.styles.text_alignment||a.styles.alignment||a.styles.textAlign||"left"}; 
                                  background-image: ${a.content.background_image?`url('${a.content.background_image}')`:"none"};
                                  background-size: cover;
                                  background-position: center;
                                  background-color: ${a.styles.background||a.styles.backgroundColor||"white"}; 
                                  color: ${a.styles.color||(a.content.background_image?"white":"inherit")}; 
                                  width: ${a.styles.width||"100%"};
                                  margin-left: auto; margin-right: auto;
                                  min-height: ${a.type==="hero"?"500px":"auto"};
                                  display: flex;
                                  flex-direction: column;
                                  justify-content: ${a.type==="hero"?"center":"flex-start"};
                                  position: relative;
                                  overflow: hidden;">
                        ${a.content.background_image?'<div style="position: absolute; inset: 0; background: rgba(0,0,0,0.4);"></div>':""}
                        <div style="position: relative; z-index: 1;">
                          ${be(a)}
                        </div>
                      </div>

                      <div class="pb-section-controls" style="opacity: 0; transition: opacity 0.2s; position: absolute; top: 10px; right: 10px; display: flex; gap: 5px; z-index: 10;">
                        <button title="Add section below" onclick="event.stopPropagation(); window.showComponentPickerAt('${s}')" style="background: #28a745; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-weight: 600;">+ Add</button>
                        <button title="Duplicate section" onclick="event.stopPropagation(); window.duplicateBuilderSection('${a.id}')" style="background: #ffc107; color: #000; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-weight: 600;">Copy</button>
                        <button title="Move Up" onclick="event.stopPropagation(); window.moveSection('${a.id}', -1)" style="background: #333; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-weight: 600;">↑</button>
                        <button title="Move Down" onclick="event.stopPropagation(); window.moveSection('${a.id}', 1)" style="background: #333; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-weight: 600;">↓</button>
                        <button title="Delete section" onclick="event.stopPropagation(); window.removeSection('${a.id}')" style="background: #dc3545; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-weight: 600;">Delete</button>
                      </div>
                  </div>
                `}
              `}).join("")||`
              <div style="padding: 100px 40px; text-align: center; color: #999; border: 2px dashed #eee; margin: 40px;">
                <h3 style="margin-bottom: 10px;">Your Canvas is Empty</h3>
                <p>Click components on the left to start building your page.</p>
              </div>
            `}
          </div>
        </section>

        <!-- Right Panel: Settings -->
        <aside class="pb-right-panel">
          <div class="pb-panel-header">
             <h3>Inspector</h3>
          </div>
          
          <div class="pb-settings-form">
            ${i?fe(i):`
              <div style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #555; padding: 40px;">
                <div style="font-size: 3rem; margin-bottom: 20px;">?</div>
                <div style="font-weight: 700; color: #888; text-transform: uppercase; font-size: 0.75rem;">No Selection</div>
                <p style="font-size: 0.85rem; margin-top: 10px;">Select a section on the canvas to configure settings</p>
              </div>
            `}
          </div>
        </aside>
      </div>
    </main>
  `}function fe(t){const e=U==="content",i=U==="styles",o=[];if(o.push(`
    <div style="display: flex; border-bottom: 1px solid #333; margin-bottom: 20px;">
      <button style="flex: 1; padding: 10px; background: ${e?"#222":"transparent"}; border: none; color: ${e?"white":"#888"}; cursor: pointer; border-bottom: ${e?"2px solid var(--primary-color)":"none"}; font-weight: 600;" onclick="window.setBuilderTab('content')">Content</button>
      <button style="flex: 1; padding: 10px; background: ${i?"#222":"transparent"}; border: none; color: ${i?"white":"#888"}; cursor: pointer; border-bottom: ${i?"2px solid var(--primary-color)":"none"}; font-weight: 600;" onclick="window.setBuilderTab('styles')">Styles</button>
    </div>
  `),e){o.push('<div class="pb-settings-group">');for(const n in t.content){const a=t.content[n],s=n==="background_image"||n==="image_url"||n==="url"&&t.type==="image";typeof a=="string"&&!s&&n!=="pipeline_id"?o.push(`
           <div class="pb-control-group">
             <label>${n.replace(/_/g," ").toUpperCase()}</label>
             <input type="text" class="pb-control-input" value="${a}" oninput="window.updateSpecificField('${t.id}', 'content', '${n}', this.value)">
           </div>
         `):n==="pipeline_id"?o.push(`
           <div class="pb-control-group">
             <label>TARGET PIPELINE</label>
             <select class="pb-control-input" onchange="window.updateSpecificField('${t.id}', 'content', '${n}', this.value)" style="margin-top: 5px; padding: 8px; border-radius: 4px; background: #222; color: #fff; border: 1px solid #444; width: 100%;">
               ${E.map(d=>`<option value="${d.id}" ${d.id===a?"selected":""}>${d.name}</option>`).join("")}
             </select>
           </div>
         `):s&&o.push(`
           <div class="pb-control-group">
             <label>${n.replace(/_/g," ").toUpperCase()}</label>
             <div class="pb-asset-grid">
               ${de.map(d=>`
                 <div class="pb-asset-thumb ${a===d.url?"active":""}" 
                      style="background-image: url('${d.url}');" 
                      title="${d.name}"
                      onclick="window.updateSpecificField('${t.id}', 'content', '${n}', '${d.url}')">
                 </div>
               `).join("")}
             </div>
             <input type="text" class="pb-control-input" style="margin-top: 8px; font-size: 0.7rem;" value="${a}" 
                    oninput="window.updateSpecificField('${t.id}', 'content', '${n}', this.value)" 
                    placeholder="Or paste custom URL...">
           </div>
         `)}o.push("</div>")}return i&&(o.push('<div class="pb-settings-group">'),[{label:"Background Color",key:"background",type:"color"},{label:"Text Alignment",key:"text_alignment",type:"select",options:["left","center","right"]},{label:"Vertical Padding",key:"padding",type:"text"},{label:"Container Width",key:"width",type:"text"}].forEach(a=>{const s=t.styles[a.key]||"";o.push(`
        <div class="pb-control-group">
          <label>${a.label.toUpperCase()}</label>
          ${a.type==="select"?`<select class="pb-control-input" onchange="window.updateSpecificField('${t.id}', 'styles', '${a.key}', this.value)">
                ${a.options.map(d=>`<option value="${d}" ${d===s?"selected":""}>${d.toUpperCase()}</option>`).join("")}
               </select>`:`<input type="${a.type}" class="pb-control-input" value="${s}" oninput="window.updateSpecificField('${t.id}', 'styles', '${a.key}', this.value)">`}
        </div>
      `)}),o.push("</div>")),o.join("")}window.updateSpecificField=(t,e,i,o)=>{const n=g.find(a=>a.id===t);n&&(n[e][i]=o,k(),window.triggerAutoSave())};function be(t){const e=t.content;switch(t.type){case"hero":return`
        <h1 style="font-size: 3rem; margin-bottom: 1.5rem; font-weight: 800;">${e.heading||e.title||"Hero Heading"}</h1>
        <p style="font-size: 1.5rem; opacity: 0.9; margin-bottom: 2.5rem; max-width: 600px; margin-left: ${t.styles.text_alignment==="center"?"auto":"0"}; margin-right: ${t.styles.text_alignment==="center"?"auto":"0"};">${e.subheading||e.subtitle||"Hero Subheading"}</p>
        <button class="btn-primary" style="padding: 15px 30px; font-size: 1.1rem; border-radius: 50px;">${e.button_text||e.buttonText||"Action"}</button>
      `;case"text":return`<div style="line-height: 1.6; font-size: ${t.styles.font_size||"inherit"}">${e.text||"Text content goes here..."}</div>`;case"image":return`<img src="${e.image_url||e.url}" alt="Image" style="width: 100%; height: auto; border-radius: inherit;">`;case"form":return`
        <h3 style="margin-bottom: 20px; color: var(--primary-color);">${e.title||"Contact Form"}</h3>
        <div style="display: flex; flex-direction: column; gap: 15px;">
          ${(e.fields||[]).map(o=>`
            <div class="form-group" style="margin-bottom: 0;">
              <input type="${o==="email"?"email":"text"}" 
                     id="pf-${o}-${t.id}" 
                     placeholder="Your ${o.charAt(0).toUpperCase()+o.slice(1)}" 
                     style="padding: 12px; border: 1px solid #cbd5e0; border-radius: 6px; width: 100%; focus: border-color: var(--primary-color);">
            </div>
          `).join("")}
          <button class="btn-primary" 
                  style="padding: 14px; font-weight: 700; margin-top: 10px;" 
                  onclick="window.submitBuilderForm('${t.id}')">
            Submit Request
          </button>
        </div>
      `;case"button":const i={small:"8px 16px",medium:"12px 24px",large:"16px 32px"};return`<button class="btn-primary" style="background: ${t.styles.color||"var(--primary-color)"}; padding: ${i[t.styles.size]||"12px 24px"}" onclick="alert('Link: ${e.link}')">${e.label||e.text||"Click Here"}</button>`;default:return`<pre>${JSON.stringify(e,null,2)}</pre>`}}window.switchBuilderPage=(t,e=!1)=>{C=t,I=null,L=null,e?k():(m.innerHTML=`
      ${y("builder")}
      <style>@keyframes pbPulse { 0% { opacity: 0.8; } 50% { opacity: 0.4; } 100% { opacity: 0.8; } }</style>
      <main class="main-content" style="padding: 0; overflow: hidden; height: 100vh; display: flex; flex-direction: column;">
        <header style="background: #111; border-bottom: 1px solid #333; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 100; flex-shrink: 0;">
           <div style="width: 200px; height: 30px; background: #222; border-radius: 4px; animation: pbPulse 1.5s infinite;"></div>
           <div style="width: 300px; height: 30px; background: #222; border-radius: 4px; animation: pbPulse 1.5s infinite;"></div>
        </header>
        <div class="pb-layout" style="flex: 1; display: flex;">
           <div style="width: 280px; background: #1a1a1a; padding: 20px;">
              <div style="height: 40px; background: #222; border-radius: 4px; margin-bottom: 20px; animation: pbPulse 1.5s infinite;"></div>
              <div style="height: 100px; background: #222; border-radius: 4px; margin-bottom: 20px; animation: pbPulse 1.5s infinite;"></div>
              <div style="height: 100px; background: #222; border-radius: 4px; margin-bottom: 20px; animation: pbPulse 1.5s infinite;"></div>
           </div>
           <div style="flex: 1; padding: 40px; display: flex; flex-direction: column; gap: 30px; background: #000;">
              <div style="height: 400px; background: #111; border-radius: 8px; animation: pbPulse 1.5s infinite;"></div>
              <div style="height: 200px; background: #111; border-radius: 8px; animation: pbPulse 1.5s infinite;"></div>
           </div>
        </div>
      </main>
    `,setTimeout(()=>k(),400))};window.selectSectionForBuilder=t=>{I=t,L=null,k()};window.showComponentPickerAt=t=>{L=parseFloat(t);const e=document.querySelector(".pb-left-panel");e&&(e.setAttribute("style","box-shadow: 0 0 0 3px var(--primary-color) inset; transition: box-shadow 0.2s; border-right: none;"),setTimeout(()=>e.removeAttribute("style"),1500))};window.duplicateBuilderSection=t=>{const e=g.find(o=>o.id===t);if(!e)return;const i={...e,id:`sec-${Date.now()}`,content:JSON.parse(JSON.stringify(e.content)),styles:JSON.parse(JSON.stringify(e.styles)),order:e.order+.1};g.push(i),k(),window.triggerAutoSave()};window.addSectionToPage=t=>{const e=z.find(a=>a.id===t);if(!e)return;const i=g.filter(a=>a.page_id===C);let o=0;L!==null?(o=L,L=null):o=Math.max(...i.map(a=>a.order),0)+1;const n={id:`sec-${Date.now()}`,page_id:C,type:e.type,content:JSON.parse(JSON.stringify(e.default_content)),styles:JSON.parse(JSON.stringify(e.default_styles)),order:o};g.push(n),I=n.id,k(),window.triggerAutoSave()};window.removeSection=t=>{const e=g.findIndex(i=>i.id===t);e!==-1&&(g.splice(e,1),I===t&&(I=null),L=null,k(),window.triggerAutoSave())};window.moveSection=(t,e)=>{const i=g.filter(a=>a.page_id===C).sort((a,s)=>a.order-s.order),o=i.findIndex(a=>a.id===t),n=o+e;if(n>=0&&n<i.length){const a=i[o],s=i[n],d=a.order;a.order=s.order,s.order=d,k(),window.triggerAutoSave()}};window.updateSectionData=(t,e,i)=>{const o=g.find(n=>n.id===t);if(o)try{o[e]=JSON.parse(i),k()}catch{}};window.savePageSections=()=>{alert("All changes saved to database!")};window.submitBuilderForm=(t,e=!1)=>{var N,c,_,P,j;const i=g.find(M=>M.id===t);if(!i)return;const o=e?"site-f-":"pf-",n=(N=document.getElementById(`${o}name-${t}`))==null?void 0:N.value,a=(c=document.getElementById(`${o}phone-${t}`))==null?void 0:c.value,s=(_=document.getElementById(`${o}email-${t}`))==null?void 0:_.value,d=(P=document.getElementById(`${o}message-${t}`))==null?void 0:P.value;if(!n||!s){alert("Please provide at least a name and email.");return}const r=`c-${Date.now()}`;h.push({id:r,name:n,phone:a||"---",email:s,address:"From Website Form",tags:["web-lead"],source:"Website Form",status:"lead",notes:d||"",created_at:new Date().toISOString()});const l=((j=i.content)==null?void 0:j.pipeline_id)||"p1",f=E.find(M=>M.id===l)||E[0],D=(f==null?void 0:f.stages[0])||"New Lead",B={id:`opp-${Date.now()}`,contact_id:r,pipeline_stage:D,value:0,assigned_to:"Unassigned",status:"open",created_at:new Date().toISOString()};p.push(B),R("OPPORTUNITY_CREATED",B),alert(`🚀 Form submitted successfully!

New Lead "${n}" has been added to your CRM pipeline.

Automations triggered!`),["name","phone","email","message"].forEach(M=>{const Z=document.getElementById(`${o}${M}-${t}`);Z&&(Z.value="")})};function X(t,e=!1){const i=v.find(n=>n.slug===t);if(!i||!e&&i.status!=="published"){m.innerHTML=`<div style="padding: 100px; text-align: center; font-family: sans-serif;">
      <h1 style="font-size: 4rem; color: #cbd5e0;">404</h1>
      <h2 style="margin-bottom: 20px;">${i?"Draft Page":"Page Not Found"}</h2>
      <p style="color: #666; margin-bottom: 30px;">
        ${i?"This page is currently a draft and is not publicly accessible.":`The requested URL "/site/${t}" was not found.`}
      </p>
      <button class="btn-primary" onclick="window.navigateTo('dashboard')">Back to CRM</button>
    </div>`;return}const o=g.filter(n=>n.page_id===i.id).sort((n,a)=>n.order-a.order);m.innerHTML=`
    <div class="public-site" style="min-height: 100vh; background: white;">
      ${e?`<div style="background: #fdf2f2; color: #dc2626; padding: 10px; text-align: center; font-weight: 700; border-bottom: 1px solid #fee2e2;">PREVIEW MODE: You are viewing a draft version of "${i.name}"</div>`:""}
      ${o.map(n=>oe(n.type,n.content,n.styles,n.id)).join("")}
      
      <!-- Public Footer -->
      <footer style="padding: 40px; text-align: center; background: #f8fafc; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 0.9rem;">
        <p>&copy; 2026 ${i.name}. Built with Hansveer CRM Website Builder.</p>
        <button onclick="window.navigateTo('dashboard')" style="margin-top: 20px; background: none; border: 1px solid #cbd5e0; padding: 5px 15px; border-radius: 4px; cursor: pointer; color: #64748b;">Admin Login</button>
      </footer>
    </div>
  `,document.title=i.seo_title||i.name,F("description",i.seo_description),F("keywords",(i.seo_keywords||[]).join(", "))}function F(t,e){let i=document.querySelector(`meta[name="${t}"]`);i||(i=document.createElement("meta"),i.setAttribute("name",t),document.head.appendChild(i)),i.setAttribute("content",e||"")}function oe(t,e,i,o){return`
    <section id="section-${o}" style="
      padding: ${i.padding||"60px 20px"};
      text-align: ${i.text_alignment||i.alignment||i.textAlign||"left"};
      background-image: ${e.background_image?`url('${e.background_image}')`:"none"};
      background-size: cover;
      background-position: center;
      background-color: ${i.background||i.backgroundColor||"transparent"};
      color: ${i.color||(e.background_image?"white":"inherit")};
      width: ${i.width||"100%"};
      margin: 0 auto;
      min-height: ${t==="hero"?"70vh":"auto"};
      display: flex;
      flex-direction: column;
      justify-content: ${t==="hero"?"center":"flex-start"};
      position: relative;
    ">
      ${e.background_image?'<div style="position: absolute; inset: 0; background: rgba(0,0,0,0.4);"></div>':""}
      <div style="position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; width: 100%;">
        ${ye(t,e,i,o)}
      </div>
    </section>
  `}function ye(t,e,i,o){switch(t){case"hero":return`
        <h1 style="font-size: clamp(2.5rem, 8vw, 4rem); margin-bottom: 1.5rem; font-weight: 800; line-height: 1.1;">${e.heading||"Hero Heading"}</h1>
        <p style="font-size: clamp(1.1rem, 3vw, 1.5rem); opacity: 0.9; margin-bottom: 2.5rem; max-width: 700px; margin-left: ${i.text_alignment==="center"?"auto":"0"}; margin-right: ${i.text_alignment==="center"?"auto":"0"};">${e.subheading||"Hero Subheading"}</p>
        <a href="${e.button_link||"#"}" class="btn-primary" style="display: inline-block; text-decoration: none; padding: 18px 40px; font-size: 1.2rem; border-radius: 50px; text-align: center;">${e.button_text||"Get Started"}</a>
      `;case"text":return`<div style="line-height: 1.8; font-size: ${i.font_size||"1.1rem"}; max-width: 800px; margin: 0 auto;">${e.text||""}</div>`;case"image":return`<img src="${e.image_url}" alt="Site Image" style="width: 100%; height: auto; border-radius: ${i.border_radius||"0"}; display: block; margin: 0 auto;">`;case"form":return`
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); color: #333; text-align: left;">
          <h3 style="margin-bottom: 25px; font-size: 1.75rem; text-align: center;">${e.title||"Contact Us"}</h3>
          <div style="display: flex; flex-direction: column; gap: 20px;">
            ${(e.fields||[]).map(a=>`
              <div class="form-group">
                <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 0.9rem; color: #666;">${a.charAt(0).toUpperCase()+a.slice(1)}</label>
                <input type="${a==="email"?"email":"text"}" id="site-f-${a}-${o}" placeholder="Your ${a}" style="padding: 14px; border: 1px solid #e2e8f0; border-radius: 8px; width: 100%;">
              </div>
            `).join("")}
            <button class="btn-primary" style="padding: 16px; margin-top: 10px; font-size: 1.1rem;" onclick="window.submitBuilderForm('${o}', true)">Send Message</button>
          </div>
        </div>
      `;case"button":const n={small:"10px 20px",medium:"15px 35px",large:"20px 50px"};return`<a href="${e.link||"#"}" class="btn-primary" style="display: inline-block; text-decoration: none; background: ${i.color||"var(--primary-color)"}; padding: ${n[i.size]||"15px 35px"}; border-radius: 8px; font-weight: 600; text-align: center;">${e.label||"Click Here"}</a>`;default:return`<div>Component type "${t}" not implemented</div>`}}function he(){m.innerHTML=`
    ${y("reports")}
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
  `}window.openNewPageModal=t=>{if(t==="template"){window.navigateTo("templates");return}const e={blank:"Create Blank Page",ai:"Generate Page with AI"},i=document.createElement("div");i.id="page-name-modal",i.innerHTML=`
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;">
      <div style="background: white; padding: 40px; border-radius: 12px; width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
        <h2 style="margin-top: 0; margin-bottom: 20px; font-size: 1.5rem;">${e[t]}</h2>
        <div class="form-group" style="margin-bottom: 20px;">
          <label style="display: block; font-weight: 600; margin-bottom: 8px;">Page Name</label>
          <input type="text" id="new_page_name_input" placeholder="e.g. About Us" style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; width: 100%; box-sizing: border-box;" onkeydown="if(event.key === 'Enter') window.submitNewPage('${t}')">
        </div>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button onclick="document.getElementById('page-name-modal').remove()" style="padding: 10px 20px; border: 1px solid #e2e8f0; background: white; border-radius: 8px; cursor: pointer; font-weight: 600; color: #666;">Cancel</button>
          <button onclick="window.submitNewPage('${t}')" class="btn-primary" style="padding: 10px 20px;">Create Page</button>
        </div>
      </div>
    </div>
  `,document.body.appendChild(i),setTimeout(()=>{var o;return(o=document.getElementById("new_page_name_input"))==null?void 0:o.focus()},100)};window.submitNewPage=t=>{var a;const i=document.getElementById("new_page_name_input").value.trim();if(!i){alert("Please enter a page name");return}(a=document.getElementById("page-name-modal"))==null||a.remove();const o=i.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)+/g,""),n={id:`p${Date.now()}`,name:i,slug:o,status:"draft",seo_title:i,seo_description:"",seo_keywords:[],created_at:new Date().toISOString(),updated_at:new Date().toISOString()};v.push(n),t==="template"?g.push({id:`ps-tpl-${Date.now()}`,page_id:n.id,type:"hero",content:{heading:"Stunning Template Applied",subheading:"Ready for you to customize visually!"},order:1,styles:{background:"#2c3e50",color:"#ffffff"}}):t==="ai"&&g.push({id:`ps-ai-${Date.now()}`,page_id:n.id,type:"text",content:{text:"✨ This content was generated by AI specifically for "+i},order:1,styles:{padding:"40px",background:"#fdfbfe"}}),window.switchBuilderPage(n.id),window.navigateTo("builder")};window.duplicatePage=t=>{const e=v.find(n=>n.id===t);if(!e)return;const i={...e,id:`p${Date.now()}`,name:`${e.name} (Copy)`,slug:`${e.slug}-copy`,status:"draft",created_at:new Date().toISOString(),updated_at:new Date().toISOString()};v.push(i),g.filter(n=>n.page_id===t).forEach(n=>{g.push({...n,id:`ps${Date.now()}-${Math.random().toString().slice(2,6)}`,page_id:i.id})}),J()};window.togglePublish=t=>{const e=v.find(i=>i.id===t);e&&(e.status=e.status==="published"?"draft":"published",e.updated_at=new Date().toISOString(),J())};window.generatePageWithAI=t=>{g.push({id:`ps-ai-${Date.now()}`,page_id:t,type:"text",content:{text:"✨ This content was generated by AI specifically for this page."},order:1,styles:{padding:"40px",background:"#fdfbfe"}}),window.switchBuilderPage(t),window.navigateTo("builder")};window.applyTemplate=t=>{g.push({id:`ps-tpl-${Date.now()}`,page_id:t,type:"hero",content:{heading:"Stunning Template Applied",subheading:"Ready for you to customize visually!"},order:1,styles:{background:"#2c3e50",color:"#ffffff"}}),window.switchBuilderPage(t),window.navigateTo("builder")};function J(){const t=v.map(e=>{const i=e.updated_at?new Date(e.updated_at).toLocaleDateString():new Date(e.created_at).toLocaleDateString();return`
    <tr>
      <td style="font-weight: 600; color: var(--primary-color);">${e.name}</td>
      <td><code>/${e.slug}</code></td>
      <td><span class="badge badge-${e.status}">${e.status}</span></td>
      <td style="color: #666; font-size: 0.9rem;">${i}</td>
      <td>
        <div style="font-size: 0.85rem; color: #666; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${e.seo_title}">
          ${e.seo_title}
        </div>
      </td>
      <td style="text-align: center;">
        <span class="badge" style="background: #eef2f6; color: #333;">${g.filter(o=>o.page_id===e.id).length}</span>
      </td>
      <td>
        <div style="display: flex; gap: 5px; flex-wrap: wrap; max-width: 380px;">
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="window.switchBuilderPage('${e.id}'); window.navigateTo('builder');">Edit</button>
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #6c757d;" onclick="window.duplicatePage('${e.id}')">Duplicate</button>
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: ${e.status==="published"?"#ea580c":"#28a745"};" onclick="window.togglePublish('${e.id}')">${e.status==="published"?"Unpublish":"Publish"}</button>
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #8a2be2;" onclick="window.generatePageWithAI('${e.id}')">✨ AI Gen</button>
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #17a2b8;" onclick="window.applyTemplate('${e.id}')">Template</button>
        </div>
      </td>
    </tr>
  `}).join("");m.innerHTML=`
    ${y("pages")}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; gap: 10px; align-items: center;">
          <h2>Website Pages</h2>
          <button class="btn-primary" style="background: #6c757d; padding: 5px 15px; font-size: 0.85rem;" onclick="window.downloadSitemap()">Export sitemap.xml</button>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <button class="btn-primary" style="background: #8a2be2;" onclick="window.openNewPageModal('ai')">✨ Generate with AI</button>
          <button class="btn-primary" style="background: #17a2b8;" onclick="window.openNewPageModal('template')">📄 Use Template</button>
          <button class="btn-primary" onclick="window.openNewPageModal('blank')">+ New Page</button>
        </div>
      </header>

      <div class="card" style="padding: 0; overflow: hidden;">
        <table class="clients-table" style="box-shadow: none; margin-top: 0;">
          <thead>
            <tr>
              <th>Page Name</th>
              <th>Slug</th>
              <th>Status</th>
              <th>Last Edited</th>
              <th>SEO Title</th>
              <th>Sections</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${t||'<tr><td colspan="7" style="text-align: center; padding: 40px; color: #666;">No pages found</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="stats-grid" style="margin-top: 30px;">
        <div class="card">
          <h3>Collection: Pages</h3>
          <p style="color: #666; margin-bottom: 15px;">Schema defined with the following fields:</p>
          <ul style="list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>id</strong>: auto (string)</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>name</strong>: string</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>slug</strong>: string (unique)</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>status</strong>: draft | published</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>seo_title</strong>: string</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>seo_description</strong>: text</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>seo_keywords</strong>: array</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>created_at</strong>: timestamp</li>
          </ul>
        </div>
        <div class="card">
          <h3>Collection: PageSections</h3>
          <p style="color: #666; margin-bottom: 15px;">Schema defined with the following fields:</p>
          <ul style="list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>id</strong>: auto (string)</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>page_id</strong>: relation to Pages</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>type</strong>: string (hero, text, etc.)</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>content</strong>: JSON</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>order</strong>: number</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>styles</strong>: JSON</li>
          </ul>
        </div>
      </div>
    </main>
  `}function ve(t){const e=v.find(n=>n.id===t);if(!e)return;const o=g.filter(n=>n.page_id===t).sort((n,a)=>n.order-a.order).map(n=>`
    <tr>
      <td style="font-weight: 600;">#${n.order}</td>
      <td><span class="badge" style="background: #e9ecef; color: #495057;">${n.type.toUpperCase()}</span></td>
      <td>
        <pre style="font-size: 0.75rem; background: #f8f9fa; padding: 10px; border-radius: 4px; max-width: 300px; overflow: auto;">${JSON.stringify(n.content,null,2)}</pre>
      </td>
      <td>
        <pre style="font-size: 0.75rem; background: #f8f9fa; padding: 10px; border-radius: 4px; max-width: 300px; overflow: auto;">${JSON.stringify(n.styles,null,2)}</pre>
      </td>
      <td>
        <div style="display: flex; gap: 5px;">
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="alert('Edit Section: ${n.id}')">Edit</button>
          <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #dc3545;" onclick="alert('Delete Section: ${n.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");m.innerHTML=`
    ${y("pages")}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; align-items: center; gap: 15px;">
          <button onclick="window.navigateTo('pages')" class="btn-primary" style="background: #eee; color: #333; padding: 5px 10px;">← Back</button>
          <h2>Sections for: ${e.name}</h2>
        </div>
        <button class="btn-primary">+ Add Section</button>
      </header>

      <div class="card" style="padding: 0; overflow: hidden;">
        <table class="clients-table" style="box-shadow: none; margin-top: 0;">
          <thead>
            <tr>
              <th>Order</th>
              <th>Type</th>
              <th>Content (JSON)</th>
              <th>Styles (JSON)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${o||'<tr><td colspan="5" style="text-align: center; padding: 40px; color: #666;">No sections found for this page</td></tr>'}
          </tbody>
        </table>
      </div>
    </main>
  `}function we(){const t=z.map(e=>`
    <div class="card" style="display: flex; flex-direction: column; gap: 15px;">
      <!-- Visual Preview -->
      <div style="width: 100%; height: 250px; overflow: hidden; border: 1px solid #e2e8f0; border-radius: 8px; position: relative; background: #f8fafc;">
        <div style="width: 200%; height: 500px; transform: scale(0.5); transform-origin: top left; pointer-events: none;">
           ${oe(e.type,e.default_content,e.default_styles,e.id)}
        </div>
      </div>
      
      <!-- Name & Type -->
      <div>
        <h3 style="margin: 0; font-size: 1.1rem; color: var(--primary-color);">${e.name}</h3>
        <span class="badge" style="background: #e9ecef; color: #495057; font-size: 0.7rem; margin-top: 5px; display: inline-block;">${e.type.toUpperCase()}</span>
      </div>
      
      <!-- Actions -->
      <div style="display: flex; gap: 10px;">
        <button class="btn-primary" style="flex: 1; padding: 8px; font-size: 0.85rem; background: #222;" onclick="alert('Edit Content for ${e.name}')">Edit Content</button>
        <button class="btn-primary" style="flex: 1; padding: 8px; font-size: 0.85rem; background: #222;" onclick="alert('Edit Styles for ${e.name}')">Edit Styles</button>
      </div>
      
      <!-- Advanced JSON -->
      <details style="background: #f8f9fa; border-radius: 6px; padding: 10px; border: 1px solid #e2e8f0;">
        <summary style="cursor: pointer; font-size: 0.8rem; font-weight: 600; color: #666; outline: none;">Advanced JSON</summary>
        <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 10px;">
          <div>
            <label style="font-size: 0.7rem; color: #999; text-transform: uppercase;">Default Content</label>
            <pre style="font-size: 0.7rem; background: #1e1e1e; color: #d4d4d4; padding: 10px; border-radius: 4px; overflow-x: auto; margin: 0;">${JSON.stringify(e.default_content,null,2)}</pre>
          </div>
          <div>
            <label style="font-size: 0.7rem; color: #999; text-transform: uppercase;">Default Styles</label>
            <pre style="font-size: 0.7rem; background: #1e1e1e; color: #d4d4d4; padding: 10px; border-radius: 4px; overflow-x: auto; margin: 0;">${JSON.stringify(e.default_styles,null,2)}</pre>
          </div>
        </div>
      </details>
    </div>
  `).join("");m.innerHTML=`
    ${y("components")}
    <main class="main-content">
      <header class="view-header">
        <h2>Component Library</h2>
        <button class="btn-primary" onclick="alert('Register New Component')">+ New Component</button>
      </header>

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 24px;">
        ${t||'<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">No components found</div>'}
      </div>

      <div class="stats-grid" style="margin-top: 40px;">
        <div class="card">
          <h3>Collection: Components</h3>
          <p style="color: #666; margin-bottom: 15px;">Schema defined with the following fields:</p>
          <ul style="list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>id</strong>: auto (string)</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>name</strong>: string</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>type</strong>: string</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>default_content</strong>: JSON</li>
            <li style="padding: 8px; background: #f8fafc; border-radius: 4px;"><strong>default_styles</strong>: JSON</li>
          </ul>
        </div>
      </div>
    </main>
  `}window.useTemplate=t=>{const e=te.find(a=>a.id===t);if(!e)return;const i=prompt("Enter new page name:",e.name+" Copy");if(!i)return;const o=i.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)+/g,""),n={id:`p${Date.now()}`,name:i,slug:o,status:"draft",seo_title:i,seo_description:"",seo_keywords:[],created_at:new Date().toISOString(),updated_at:new Date().toISOString()};v.push(n),e.blocks.forEach((a,s)=>{let d={...a.data},r={background:"#ffffff",color:"#333333"};a.type==="hero"?(d={heading:a.data.title,subheading:a.data.subtitle,button_text:a.data.buttonText},r={background:e.theme.primary,color:"white",text_alignment:"center",padding:"100px 20px"}):a.type==="services"?(d={heading:a.data.title,items:a.data.items},r={background:"#f8fafc",color:"#333",padding:"80px 20px"}):a.type==="trust"?(d={heading:a.data.title,logos:a.data.logos,testimonials:a.data.testimonials},r={background:"white",color:"#333",padding:"60px 20px"}):a.type==="gallery"?(d={heading:a.data.title,images:a.data.images},r={background:"#fdfbfe",color:"#333",padding:"80px 20px"}):a.type==="contact"&&(d={title:a.data.title,fields:["name","email","phone","message"]},r={background:e.theme.secondary,color:"white",padding:"80px 20px"}),g.push({id:`ps-tpl-${Date.now()}-${s}`,page_id:n.id,type:a.type==="services"||a.type==="trust"||a.type==="gallery"?"text":a.type==="contact"?"form":a.type,content:d,order:s+1,styles:r})}),window.switchBuilderPage(n.id),window.navigateTo("builder")};function xe(){const t=te.map(e=>`
    <div class="card" style="padding: 0; overflow: hidden; display: flex; flex-direction: column; height: 100%;">
      <div style="height: 200px; width: 100%; background: #e2e8f0; background-image: url('${e.image}'); background-size: cover; background-position: center; border-bottom: 1px solid #e2e8f0;"></div>
      <div style="padding: 24px; flex: 1; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 1.25rem; color: var(--primary-color);">${e.name}</h3>
          <span class="badge" style="background: #eef2f6; color: #64748b; font-size: 0.75rem;">${e.category}</span>
        </div>
        <p style="color: #666; font-size: 0.95rem; margin-bottom: 24px; flex: 1; line-height: 1.5;">${e.description}</p>
        <button class="btn-primary" style="width: 100%; padding: 14px; font-weight: 600; font-size: 1rem; border-radius: 8px;" onclick="window.useTemplate('${e.id}')">Use Template</button>
      </div>
    </div>
  `).join("");m.innerHTML=`
    ${y("templates")}
    <main class="main-content">
      <header class="view-header">
        <h2>Website Templates</h2>
      </header>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 30px; padding: 10px;">
        ${t}
      </div>
    </main>
  `}function $e(){m.innerHTML=`
    ${y("website-settings")}
    <main class="main-content">
      <header class="view-header"><h2>Website Settings</h2></header>
      <div style="padding: 40px; text-align: center; color: #666;">Global site settings coming soon</div>
    </main>
  `}function ke(){m.innerHTML=`
    ${y("quickstart")}
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
  `}function _e(){var t;m.innerHTML=`
    ${y("lead-capture")}
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
  `,(t=document.getElementById("lead-form"))==null||t.addEventListener("submit",Se)}function Se(t){t.preventDefault();const e=document.getElementById("lead_name").value,i=document.getElementById("lead_phone").value,o=document.getElementById("lead_email").value,n=document.getElementById("lead_address").value,a=document.getElementById("lead_service").value,s="c"+(h.length+1),d="o"+(p.length+1);h.push({id:s,name:e,phone:i,email:o,address:n,tags:["new-lead"],source:"Lead Capture Form",service:a,status:"lead",created_at:new Date().toISOString()});const r={id:d,contact_id:s,pipeline_stage:"New Lead",value:0,assigned_to:"Hansveer",status:"open",created_at:new Date().toISOString()};p.push(r),R("OPPORTUNITY_CREATED",r);const l=document.querySelector(".lead-form-container");l&&(l.innerHTML=`
      <div style="text-align: center; padding: 40px 0;">
        <div style="font-size: 3rem; color: var(--primary-color); margin-bottom: 20px;">✓</div>
        <h2 style="margin-bottom: 10px;">Submission Received</h2>
        <p style="font-size: 1.2rem; color: var(--secondary-color);">Thanks! We’ll contact you shortly.</p>
        <button onclick="window.navigateTo('lead-capture')" class="btn-primary" style="margin-top: 30px; background-color: var(--secondary-color);">Capture Another Lead</button>
        <button onclick="window.navigateTo('opportunities')" class="btn-primary" style="margin-top: 30px; margin-left:10px;">View Pipeline</button>
      </div>
    `)}function Te(){const t=E[0],i=t.stages.map(o=>{const n=p.filter(s=>s.pipeline_stage===o),a=n.map(s=>{const d=h.find(r=>r.id===s.contact_id);return`
        <div class="kanban-card" draggable="true" ondragstart="drag(event, '${s.id}')" onclick="window.navigateTo('contact-detail', '${s.contact_id}')" style="cursor: pointer;">
          <div class="contact-name">${d?d.name:"Unknown Contact"}</div>
          <div class="opportunity-value" style="display: flex; align-items: center; gap: 4px;">
            <span>$</span>
            <input type="number" 
                   value="${s.value}" 
                   class="inline-input" 
                   style="font-weight: 600; width: 80px;"
                   onclick="event.stopPropagation()" 
                   onchange="window.updateOpportunityField('${s.id}', 'value', this.value)">
          </div>
          <div class="contact-phone">${d?d.phone:"N/A"}</div>
        </div>
      `}).join("");return`
      <div class="kanban-column" ondragover="allowDrop(event)" ondrop="drop(event, '${o}')">
        <h4>${o} <span>${n.length}</span></h4>
        <div class="kanban-cards">
          ${a}
        </div>
      </div>
    `}).join("");m.innerHTML=`
    ${y("opportunities")}
    <main class="main-content">
      <header class="view-header">
        <h2>Sales Pipeline: ${t.name}</h2>
        <button class="btn-primary">+ New Opportunity</button>
      </header>
      <div class="kanban-board">
        ${i}
      </div>
    </main>
  `}function q(){const t=$.map(e=>{const i=h.find(o=>o.id===e.contact_id);return`
      <tr onclick="window.navigateTo('contact-detail', '${e.contact_id}')" style="cursor: pointer;">
        <td style="font-weight: 600; color: var(--primary-color);">Q-${e.id}</td>
        <td>${i?i.name:"Unknown"}</td>
        <td><span class="badge badge-${e.status}">${e.status}</span></td>
        <td style="font-weight: 600;">$${e.total_amount.toLocaleString()}</td>
        <td>${new Date(e.created_at).toLocaleDateString()}</td>
        <td>
          <div style="display: flex; gap: 5px;">
            <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="event.stopPropagation(); window.navigateTo('quote-preview', '${e.id}')">Preview</button>
            <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="event.stopPropagation(); window.navigateTo('contact-detail', '${e.contact_id}')">View</button>
            ${e.status==="draft"?`<button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #28a745;" onclick="event.stopPropagation(); window.sendQuote('${e.id}')">Send</button>`:""}
            ${e.status==="sent"?`
              <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #28a745;" onclick="event.stopPropagation(); window.approveQuote('${e.id}')">Approve</button>
              <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; background: #dc3545;" onclick="event.stopPropagation(); window.rejectQuote('${e.id}')">Reject</button>
            `:""}
          </div>
        </td>
      </tr>
    `}).join("");m.innerHTML=`
    ${y("quotes")}
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
  `}function Y(){const e=x.filter(i=>A==="all"?!0:i.status===A).map(i=>{const o=h.find(n=>n.id===i.contact_id);return`
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
    `}).join("");m.innerHTML=`
    ${y("invoices")}
    <main class="main-content">
      <header class="view-header">
        <div style="display: flex; align-items: center; gap: 20px;">
          <h2>Invoices</h2>
          <select onchange="window.updateInvoiceFilter(this.value)" style="padding: 8px 12px; border-radius: 4px; border: 1px solid #ddd; background: white; font-family: inherit;">
            <option value="all" ${A==="all"?"selected":""}>All Invoices</option>
            <option value="unpaid" ${A==="unpaid"?"selected":""}>Unpaid</option>
            <option value="paid" ${A==="paid"?"selected":""}>Paid</option>
            <option value="overdue" ${A==="overdue"?"selected":""}>Overdue</option>
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
            ${e||'<tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;">No invoices match your selection</td></tr>'}
          </tbody>
        </table>
      </div>
    </main>
  `}window.updateInvoiceFilter=t=>{A=t,Y()};function H(){const t=h,e=window.newQuoteContactId,i=window.newQuoteOpportunityId,o=window.newQuoteLineItems,n=e?p.filter(s=>s.contact_id===e):[],a=s=>{const d=o.map((l,f)=>({...l,index:f})).filter(l=>l.tier===s),r=d.reduce((l,f)=>l+f.quantity*f.price,0);return`
      <div style="flex: 1; min-width: 320px; background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #eef2f6; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin:0; text-transform: capitalize; color: var(--secondary-color); font-size: 1.1rem;">${s} Option</h3>
          <button class="btn-primary" style="padding: 4px 10px; font-size: 0.8rem; background: #f0f7ff; color: var(--primary-color); border: 1px solid var(--primary-color);" onclick="window.addLineItem('${s}')">+ Add Item</button>
        </div>
        
        <div style="flex: 1; overflow-y: auto; max-height: 500px;">
          ${d.map(l=>`
            <div style="padding: 15px; border: 1px solid #f0f0f0; border-radius: 8px; margin-bottom: 15px; position: relative;">
              <button onclick="window.removeLineItem(${l.index})" style="position: absolute; right: 8px; top: 8px; background: none; border: none; color: #ccc; cursor: pointer; font-size: 1.2rem;">×</button>
              <div style="margin-bottom: 10px;">
                <input type="text" placeholder="Service Name" value="${l.service}" style="width: 100%; border: none; font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;" oninput="window.updateLineItem(${l.index}, 'service', this.value, false)">
                <input type="text" placeholder="Short description" value="${l.description}" style="width: 100%; border: none; font-size: 0.85rem; color: #666;" oninput="window.updateLineItem(${l.index}, 'description', this.value, false)">
              </div>
              <div style="display: flex; gap: 10px; align-items: center; background: #f8fafc; padding: 10px; border-radius: 6px;">
                <div style="flex: 1;">
                  <label style="font-size: 0.7rem; color: #999; display: block;">QTY</label>
                  <input type="number" value="${l.quantity}" style="width: 100%; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px;" oninput="window.updateLineItem(${l.index}, 'quantity', this.value, true)">
                </div>
                <div style="flex: 1;">
                  <label style="font-size: 0.7rem; color: #999; display: block;">PRICE</label>
                  <input type="number" value="${l.price}" style="width: 100%; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px;" oninput="window.updateLineItem(${l.index}, 'price', this.value, true)">
                </div>
                <div style="flex: 1; text-align: right;">
                  <label style="font-size: 0.7rem; color: #999; display: block;">TOTAL</label>
                  <span id="line-total-${l.index}" style="font-weight: 700; color: var(--primary-color);">$${(l.quantity*l.price).toLocaleString()}</span>
                </div>
              </div>
            </div>
          `).join("")}
          ${d.length===0?'<div style="text-align: center; color: #ccc; padding: 20px; font-style: italic; border: 1px dashed #eee; border-radius: 8px;">No items in this tier</div>':""}
        </div>

        <div style="margin-top: 20px; padding-top: 15px; border-top: 2px solid #f1f5f9; text-align: right;">
          <div style="font-size: 0.85rem; color: #64748b; font-weight: 500;">Option Total</div>
          <div id="tier-total-${s}" style="font-size: 1.5rem; font-weight: 800; color: #1e293b;">$${r.toLocaleString()}</div>
        </div>
      </div>
    `};m.innerHTML=`
    ${y("quotes")}
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
                ${t.map(s=>`<option value="${s.id}" ${e===s.id?"selected":""}>${s.name}</option>`).join("")}
              </select>
            </div>
            <div class="form-group" style="margin: 0;">
              <label>Select Opportunity (Optional)</label>
              <select id="quote-opportunity" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;" onchange="window.newQuoteOpportunityId = this.value">
                <option value="">-- No Opportunity --</option>
                ${n.map(s=>`<option value="${s.id}" ${i===s.id?"selected":""}>$${s.value} - ${s.pipeline_stage}</option>`).join("")}
              </select>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 24px; overflow-x: auto; padding-bottom: 10px;">
          ${a("basic")}
          ${a("standard")}
          ${a("premium")}
        </div>

        <div class="card" style="margin-top: 24px; padding: 20px;">
           <label>Add internal notes or terms</label>
           <textarea id="quote-notes" style="width: 100%; height: 80px; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-family: inherit;" placeholder="e.g. Terms & conditions or specific project details..."></textarea>
        </div>
      </div>
    </main>
  `}window.updateNewQuoteContact=t=>{window.newQuoteContactId=t,window.newQuoteOpportunityId="",H()};window.addLineItem=(t="basic")=>{window.newQuoteLineItems.push({service:"",description:"",quantity:1,price:0,tier:t}),H()};window.removeLineItem=t=>{window.newQuoteLineItems.splice(t,1),H()};window.updateLineItem=(t,e,i,o)=>{const n=window.newQuoteLineItems,a=n[t];if(e==="quantity"||e==="price"?a[e]=parseFloat(i)||0:a[e]=i,o){const s=document.getElementById(`line-total-${t}`);s&&(s.textContent=`$${(a.quantity*a.price).toLocaleString()}`);const d=a.tier,r=n.filter(f=>f.tier===d).reduce((f,D)=>f+D.quantity*D.price,0),l=document.getElementById(`tier-total-${d}`);l&&(l.textContent=`$${r.toLocaleString()}`)}};window.saveQuote=()=>{var s;const t=window.newQuoteContactId,e=window.newQuoteOpportunityId,i=window.newQuoteLineItems;if(!t){alert("Please select a contact.");return}const o=((s=document.getElementById("quote-notes"))==null?void 0:s.value)||"",n="q"+($.length+1)+"-"+Math.floor(Math.random()*100),a=i.filter(d=>d.tier==="basic").reduce((d,r)=>d+r.quantity*r.price,0);if($.push({id:n,contact_id:t,opportunity_id:e||"",status:"draft",total_amount:a,selected_tier:"basic",notes:o,created_at:new Date().toISOString()}),e){const d=p.find(r=>r.id===e);d&&(d.value=a)}i.forEach((d,r)=>{W.push({id:"qi-"+n+"-"+r,quote_id:n,service_name:d.service,description:d.description,quantity:d.quantity,unit_price:d.price,total:d.quantity*d.price,tier:d.tier})}),window.newQuoteLineItems=[{service:"",description:"",quantity:1,price:0,tier:"basic"}],window.newQuoteContactId="",window.newQuoteOpportunityId="",window.navigateTo("quotes")};function ae(t,e){const i=p.find(o=>o.id===t);i&&(i.pipeline_stage=e,e==="Completed"||e==="Paid"?i.status="won":e==="Lost"?i.status="lost":i.status="open",window.navigateTo(w,b||void 0),console.log(`Opportunity ${t} updated: Stage=[${e}], Status=[${i.status}]`),R("OPPORTUNITY_STAGE_UPDATED",i))}window.updateOpportunityStage=ae;window.allowDrop=t=>{t.preventDefault()};window.drag=(t,e)=>{var i;(i=t.dataTransfer)==null||i.setData("text",e)};window.drop=(t,e)=>{var o;t.preventDefault();const i=(o=t.dataTransfer)==null?void 0:o.getData("text");i&&ae(i,e)};window.navigateTo=(t,e)=>{w=t,e&&(b=e),ie(),t==="dashboard"&&ne(),t==="clients"&&G(),t==="opportunities"&&Te(),t==="quotes"&&q(),t==="new-quote"&&H(),t==="invoices"&&Y(),t==="lead-capture"&&_e(),t==="builder"&&k(),t==="reports"&&he(),t==="pages"&&J(),t==="page-sections"&&e&&ve(e),t==="components"&&we(),t==="templates"&&xe(),t==="website-settings"&&$e(),t==="quickstart"&&ke(),t==="quote-preview"&&e&&se(e),t==="contact-detail"&&b&&T(b),t==="site"&&e&&X(e),t==="preview"&&e?X(e,!0):(document.title="Hansveer CRM",F("description","Professional CRM for Handyman Businesses"),F("keywords","crm, handyman, pressure washing"))};window.downloadSitemap=()=>{const t=v.filter(s=>s.status==="published"),e="https://hanssays.com/site",i=`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${t.map(s=>`  <url>
    <loc>${e}/${s.slug}</loc>
    <lastmod>${new Date(s.created_at).toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${s.slug==="home"?"1.0":"0.8"}</priority>
  </url>`).join(`
`)}
</urlset>`,o=new Blob([i],{type:"application/xml"}),n=URL.createObjectURL(o),a=document.createElement("a");a.href=n,a.download="sitemap.xml",document.body.appendChild(a),a.click(),document.body.removeChild(a),URL.revokeObjectURL(n),alert("Dynamic Sitemap generated and downloaded for "+t.length+" published pages.")};window.selectQuoteTier=(t,e)=>{const i=$.find(o=>o.id===t);if(i){i.selected_tier=e;const o=W.filter(n=>n.quote_id===t&&n.tier===e);if(i.total_amount=o.reduce((n,a)=>n+a.total,0),i.opportunity_id){const n=p.find(a=>a.id===i.opportunity_id);n&&(n.value=i.total_amount)}se(t)}};function se(t){const e=$.find(a=>a.id===t);if(!e)return;const i=h.find(a=>a.id===e.contact_id),o=W.filter(a=>a.quote_id===t),n=a=>{const s=o.filter(l=>l.tier===a||!l.tier&&a==="basic"),d=s.reduce((l,f)=>l+f.total,0),r=e.selected_tier===a;return`
      <div style="flex: 1; min-width: 280px; border: 2px solid ${r?"var(--primary-color)":"#eef2f6"}; border-radius: 16px; padding: 30px; background: ${r?"#f0f7ff":"#fff"}; display: flex; flex-direction: column; transition: all 0.2s; position: relative; ${r?"box-shadow: 0 10px 25px -5px rgba(0, 123, 255, 0.1);":""}">
        ${r?'<div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: var(--primary-color); color: white; padding: 4px 16px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Recommended</div>':""}
        
        <h3 style="text-align: center; text-transform: capitalize; margin: 0 0 10px 0; color: #1e293b; font-size: 1.25rem;">${a}</h3>
        
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 25px; border-bottom: 2px dashed ${r?"#d0e5ff":"#f1f5f9"};">
          <div style="font-size: 2.25rem; font-weight: 900; color: #0f172a; margin-bottom: 20px;">$${d.toLocaleString()}</div>
          <button class="btn-primary no-print" style="width: 100%; padding: 12px; border-radius: 8px; font-weight: 700; background: ${r?"#28a745":"var(--primary-color)"}; color: white; border: none; cursor: pointer;" onclick="window.selectQuoteTier('${e.id}', '${a}')">
            ${r?"✓ Selected":"Choose "+a}
          </button>
        </div>

        <div style="flex: 1;">
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${s.map(l=>`
              <li style="padding: 12px 0; border-bottom: 1px solid ${r?"#d0e5ff":"#f8fafc"};">
                <div style="font-weight: 600; font-size: 0.95rem; color: #1e293b; margin-bottom: 2px;">${l.service_name}</div>
                <div style="font-size: 0.85rem; color: #64748b; line-height: 1.4;">${l.description}</div>
                <div style="text-align: right; font-weight: 700; color: #1e293b; margin-top: 8px; font-size: 0.95rem;">$${l.total.toLocaleString()}</div>
              </li>
            `).join("")}
            ${s.length===0?'<li style="text-align: center; color: #94a3b8; padding: 40px 0; font-style: italic;">No items included</li>':""}
          </ul>
        </div>
      </div>
    `};m.innerHTML=`
    ${y("quotes")}
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
            <div style="font-size: 1.5rem; font-weight: 800; color: #1e293b;">#Q-${e.id}</div>
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
            ${n("basic")}
            ${n("standard")}
            ${n("premium")}
          </div>
        </div>

        ${e.notes?`
          <div style="margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 40px;">
            <div style="text-transform: uppercase; color: #94a3b8; font-size: 0.75rem; font-weight: 800; letter-spacing: 1px; margin-bottom: 15px;">Additional Terms & Notes</div>
            <div style="color: #475569; line-height: 1.8; font-size: 1rem; white-space: pre-wrap;">${e.notes}</div>
          </div>
        `:""}

        <div style="margin-top: 100px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 40px;">
          <div style="font-size: 1.1rem; color: #1e293b; font-weight: 600; margin-bottom: 10px;">Ready to proceed?</div>
          <p style="color: #64748b; font-size: 0.95rem;">Select your preferred option above. We look forward to working with you!</p>
        </div>
      </div>
    </main>
  `}function T(t){const e=h.find(n=>n.id===t);if(!e)return;const i=p.filter(n=>n.contact_id===t),o=u.filter(n=>n.contact_id===t).sort((n,a)=>new Date(a.due_date).getTime()-new Date(n.due_date).getTime());m.innerHTML=`
    ${y("clients")}
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
              ${i.map(n=>`
                <div class="opportunity-strip">
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center;">
                      <span>$</span>
                      <input type="number" 
                             value="${n.value}" 
                             class="inline-input" 
                             onchange="window.updateOpportunityField('${n.id}', 'value', this.value)" 
                             style="width: 80px; font-weight: 600;">
                    </div>
                    <select class="inline-select" onchange="window.updateOpportunityStage('${n.id}', this.value)">
                      ${E[0].stages.map(a=>`<option value="${a}" ${a===n.pipeline_stage?"selected":""}>${a}</option>`).join("")}
                    </select>
                  </div>
                  <span class="badge badge-${n.status}" style="font-size: 0.7rem;">${n.status}</span>
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
              ${o.map(n=>`
                <div class="timeline-item">
                  <div class="timeline-dot" style="background: ${n.completed?"#28a745":"var(--primary-color)"}"></div>
                  <div class="timeline-content">
                    <div class="timeline-time">${new Date(n.due_date).toLocaleString()}</div>
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                      <div>
                        <strong>${n.type.toUpperCase()}</strong>: ${n.description}
                      </div>
                      ${n.completed?'<span style="color: #28a745;">✓</span>':`<button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem; background: #28a745;" onclick="window.completeTask('${n.id}')">Complete</button>`}
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
                  ${$.filter(n=>n.contact_id===t).map(n=>`
                    <tr>
                      <td style="font-weight: 600;">Q-${n.id}</td>
                      <td><span class="badge badge-${n.status}">${n.status}</span></td>
                      <td>$${n.total_amount.toLocaleString()}</td>
                      <td>
                        <div style="display: flex; gap: 5px;">
                          <button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="event.stopPropagation(); window.navigateTo('quote-preview', '${n.id}')">Preview</button>
                          <button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="event.stopPropagation(); window.navigateTo('contact-detail', '${n.contact_id}')">View</button>
                          ${n.status==="draft"?`<button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem; background: #28a745;" onclick="event.stopPropagation(); window.sendQuote('${n.id}')">Send</button>`:""}
                          ${n.status==="sent"?`
                            <button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem; background: #28a745;" onclick="event.stopPropagation(); window.approveQuote('${n.id}')">Approve</button>
                            <button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem; background: #dc3545;" onclick="event.stopPropagation(); window.rejectQuote('${n.id}')">Reject</button>
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
                  ${x.filter(n=>n.contact_id===t).map(n=>`
                    <tr>
                      <td style="font-weight: 600;">INV-${n.id}</td>
                      <td><span class="badge badge-${n.status}">${n.status}</span></td>
                      <td>$${n.amount.toLocaleString()}</td>
                      <td>${new Date(n.due_date).toLocaleDateString()}</td>
                      <td>
                        <div style="display: flex; gap: 5px;">
                          <button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="event.stopPropagation(); window.navigateTo('contact-detail', '${n.contact_id}')">View</button>
                          ${n.status!=="paid"?`<button class="btn-primary" style="padding: 4px 8px; font-size: 0.75rem; background: #28a745;" onclick="event.stopPropagation(); window.markAsPaid('${n.id}')">Mark as Paid</button>`:""}
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
  `}window.logCall=t=>{const e=prompt("Enter call summary:");e&&(u.push({id:"act-"+Date.now(),contact_id:t,type:"call",description:e,due_date:new Date().toISOString(),completed:!0}),T(t))};window.addNote=t=>{const e=prompt("Enter your note:");e&&(u.push({id:"act-"+Date.now(),contact_id:t,type:"note",description:e,due_date:new Date().toISOString(),completed:!0}),T(t))};window.completeTask=t=>{const e=u.find(i=>i.id===t);e&&(e.completed=!0,b&&T(b))};window.createOpportunity=t=>{const e=prompt("Enter Opportunity value (e.g. 500):","0"),i=parseFloat(e||"0"),o={id:"o"+(p.length+1)+"-"+Math.floor(Math.random()*100),contact_id:t,pipeline_stage:"New Lead",value:isNaN(i)?0:i,assigned_to:"Hansveer",status:"open",created_at:new Date().toISOString()};p.push(o),R("OPPORTUNITY_CREATED",o),T(t)};window.updateOpportunityField=(t,e,i)=>{const o=p.find(n=>n.id===t);o&&(e==="value"?o.value=parseFloat(i)||0:o[e]=i,window.navigateTo(w,b||void 0))};window.updateContactField=(t,e,i)=>{const o=h.find(n=>n.id===t);o&&(o[e]=i,window.navigateTo(w,b||void 0))};window.createQuote=t=>{window.newQuoteContactId=t;const e=p.filter(i=>i.contact_id===t&&i.status==="open").sort((i,o)=>new Date(o.created_at).getTime()-new Date(i.created_at).getTime())[0];window.newQuoteOpportunityId=e?e.id:"",window.newQuoteLineItems=[{service:"",description:"",quantity:1,price:0,tier:"basic"}],window.navigateTo("new-quote")};window.markAsPaid=t=>{const e=x.find(i=>i.id===t);if(e){e.status="paid";const i=$.find(o=>o.id===e.quote_id);if(i&&i.opportunity_id){const o=p.find(n=>n.id===i.opportunity_id);o&&(o.pipeline_stage="Paid")}u.push({id:"act-"+(u.length+1)+"-"+Math.floor(Math.random()*100),contact_id:e.contact_id,type:"note",description:`Invoice ${e.id} marked as Paid.`,due_date:new Date().toISOString(),completed:!0}),w==="invoices"&&Y(),w==="contact-detail"&&b&&T(b)}};window.convertToInvoice=t=>{const e=$.find(i=>i.id===t);if(e){if(x.some(n=>n.quote_id===t)){alert("Invoice already exists for this quote.");return}const i="inv-"+(x.length+1)+"-"+Math.floor(Math.random()*100),o=new Date;o.setDate(o.getDate()+7),x.push({id:i,contact_id:e.contact_id,quote_id:e.id,amount:e.total_amount,status:"unpaid",due_date:o.toISOString(),created_at:new Date().toISOString()}),u.push({id:"act-"+(u.length+1)+"-"+Math.floor(Math.random()*100),contact_id:e.contact_id,type:"note",description:`Invoice ${i} created from Quote Q-${e.id}`,due_date:new Date().toISOString(),completed:!0}),w==="quotes"&&q(),w==="contact-detail"&&b&&T(b)}};window.approveQuote=t=>{const e=$.find(i=>i.id===t);if(e){e.status="approved";const i=p.find(o=>o.id===e.opportunity_id);if(i&&(i.status="won",i.pipeline_stage="Scheduled",i.value=e.total_amount),u.push({id:"act-"+(u.length+1)+"-"+Math.floor(Math.random()*100),contact_id:e.contact_id,type:"note",description:`Quote Q-${e.id} approved! Opportunity marked as Won.`,due_date:new Date().toISOString(),completed:!0}),!x.some(o=>o.quote_id===e.id)){const o="inv-"+(x.length+1)+"-"+Math.floor(Math.random()*100),n=new Date;n.setDate(n.getDate()+7),x.push({id:o,contact_id:e.contact_id,quote_id:e.id,amount:e.total_amount,status:"unpaid",due_date:n.toISOString(),created_at:new Date().toISOString()}),u.push({id:"act-"+(u.length+1)+"-"+Math.floor(Math.random()*100),contact_id:e.contact_id,type:"note",description:`Invoice ${o} automatically created from Quote Q-${e.id}`,due_date:new Date().toISOString(),completed:!0})}w==="quotes"&&q(),w==="contact-detail"&&b&&T(b)}};window.rejectQuote=t=>{const e=$.find(i=>i.id===t);if(e){e.status="rejected";const i=p.find(o=>o.id===e.opportunity_id);i&&(i.status="lost"),u.push({id:"act-"+(u.length+1)+"-"+Math.floor(Math.random()*100),contact_id:e.contact_id,type:"note",description:`Quote Q-${e.id} was rejected. Opportunity marked as Lost.`,due_date:new Date().toISOString(),completed:!0}),w==="quotes"&&q(),w==="contact-detail"&&b&&T(b)}};window.sendQuote=t=>{const e=$.find(i=>i.id===t);if(e){if(e.status="sent",console.log(`Sending Quote Q-${e.id} to client...`),u.push({id:"act-"+(u.length+1)+"-"+Math.floor(Math.random()*100),contact_id:e.contact_id,type:"note",description:`Quote Q-${e.id} sent to customer`,due_date:new Date().toISOString(),completed:!0}),e.opportunity_id){const i=p.find(o=>o.id===e.opportunity_id);i&&(i.pipeline_stage="Quote Sent",i.value=e.total_amount,R("OPPORTUNITY_STAGE_UPDATED",i))}w==="quotes"&&q(),w==="contact-detail"&&b&&T(b)}};window.createInvoice=t=>{const e=$.filter(d=>d.contact_id===t);if(e.length===0){alert("Please create a Quote first.");return}const i=e[e.length-1],o=prompt("Enter Invoice Amount:",i.total_amount.toString()),n=parseFloat(o||"0");if(isNaN(n))return;const a="i"+(x.length+1)+"-"+Math.floor(Math.random()*100),s=new Date;s.setDate(s.getDate()+7),x.push({id:a,contact_id:t,quote_id:i.id,amount:n,status:"unpaid",due_date:s.toISOString(),created_at:new Date().toISOString()}),T(t)};ie();ne();
