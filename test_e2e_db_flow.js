"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/db.ts
var mockContacts = [
  {
    id: "c1",
    name: "John Doe",
    phone: "555-0101",
    email: "john@example.com",
    address: "123 Pine St, Seattle, WA",
    tags: ["residential", "referral"],
    source: "Google Search",
    status: "customer",
    created_at: "2026-02-15T10:00:00Z"
  },
  {
    id: "c2",
    name: "Jane Smith",
    phone: "555-0202",
    email: "jane@smithresidence.com",
    address: "456 Oak Ave, Portland, OR",
    tags: ["lead", "driveway"],
    source: "Facebook Ad",
    status: "lead",
    created_at: "2026-03-01T14:30:00Z"
  }
];
var mockOpportunities = [
  {
    id: "o1",
    contact_id: "c2",
    pipeline_stage: "New Lead",
    value: 250,
    assigned_to: "Hansveer",
    status: "open",
    created_at: "2026-03-01T14:35:00Z"
  },
  {
    id: "o2",
    contact_id: "c1",
    pipeline_stage: "Completed",
    value: 450,
    assigned_to: "Hansveer",
    status: "won",
    created_at: "2026-02-15T10:05:00Z"
  }
];
var mockActivities = [
  {
    id: "a1",
    contact_id: "c2",
    type: "call",
    description: "Initial follow-up call about driveway cleaning",
    due_date: "2026-03-02T09:00:00Z",
    completed: true
  },
  {
    id: "a2",
    contact_id: "c2",
    type: "sms",
    description: "Sent quote via text",
    due_date: "2026-03-05T10:00:00Z",
    completed: false
  }
];
var mockTemplates = [
  {
    id: "tpl1",
    name: "Standard Landing Page",
    category: "Landing Pages",
    sections: [
      {
        type: "hero",
        content: { heading: "Welcome to our Service", subheading: "The best experience you ever had." },
        styles: { padding: "100px 20px", background: "#f8fafc", text_alignment: "center" },
        order: 1
      },
      {
        type: "text",
        content: { heading: "Our Features", body: "Discover why thousands of users trust us every day." },
        styles: { padding: "60px 20px", background: "#ffffff" },
        order: 2
      },
      {
        type: "form",
        content: { title: "Contact Us", fields: ["name", "email", "message"] },
        styles: { padding: "60px 20px", background: "#f8fafc" },
        order: 3
      }
    ],
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "tpl-generic",
    name: "Generic Service Template",
    category: "Landing Pages",
    sections: [
      {
        type: "hero",
        content: { heading: "", subheading: "", button_text: "" },
        styles: { padding: "100px 20px", background: "#f8fafc", text_alignment: "center" },
        order: 1
      },
      {
        type: "text",
        content: { heading: "Our Service", text: "" },
        styles: { padding: "60px 20px", background: "#ffffff" },
        order: 2
      },
      {
        type: "text",
        content: { heading: "Key Benefits", text: "" },
        styles: { padding: "60px 20px", background: "#f1f5f9" },
        order: 3
      },
      {
        type: "text",
        content: { heading: "Frequently Asked Questions", text: "" },
        styles: { padding: "60px 20px", background: "#ffffff" },
        order: 4
      }
    ],
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "tpl-quote-funnel",
    name: "Quote Funnel Template",
    category: "conversion",
    sections: [
      {
        type: "hero",
        content: { heading: "Expert Exterior Cleaning", subheading: "Professional pressure washing for your home or business.", button_text: "See Our Services" },
        styles: { padding: "100px 20px", background: "#f8fafc", text_alignment: "center" },
        order: 1
      },
      {
        type: "cta",
        content: { heading: "Quick Price Check", subheading: "Need an estimate fast? Fill out our form below.", button_text: "Jump to Form" },
        styles: { padding: "60px 20px", cta_background: "#f1f5f9" },
        order: 2
      },
      {
        type: "form",
        content: { title: "Request Your Free Quote", fields: ["name", "phone", "address", "service_type", "message"] },
        styles: { padding: "80px 20px", background: "#ffffff" },
        order: 3
      },
      {
        type: "text",
        content: {
          heading: "Trusted by local homeowners",
          text: '<p style="text-align: center; max-width: 800px; margin: 0 auto;">We have helped over 500 families protect and beautify their homes with professional results and a local touch. Our specialized equipment ensures a deep clean without damaging your surfaces.</p>'
        },
        styles: { padding: "60px 20px", background: "#f8fafc" },
        order: 4
      },
      {
        type: "cta",
        content: { heading: "Start Your Project Today", subheading: "Professional results are just a click away.", button_text: "Get Started Now" },
        styles: { padding: "100px 20px", cta_background: "#4f46e5" },
        order: 5
      }
    ],
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  }
];
var mockWebsiteSettings = {
  id: "settings-001",
  business_name: "Handyman Hans Pressure Washing",
  phone: "555-0199",
  email: "hans@example.com",
  logo_url: "https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?q=80&w=200&h=200&auto=format&fit=crop",
  primary_color: "#4f46e5",
  facebook_pixel_id: "",
  gtm_id: "",
  auto_lead_sms_enabled: true,
  auto_lead_sms_template: "Hey {name}, thanks for reaching out! I'll get back to you ASAP.",
  missed_call_sms_enabled: true,
  missed_call_sms_template: "",
  created_at: (/* @__PURE__ */ new Date()).toISOString()
};
var mockEventLogs = [];
var mockMessages = [];
var mockCalls = [];

// src/database.ts
var import_better_sqlite3 = __toESM(require("better-sqlite3"));
var DB_PATH = "./crm.db";
var db = null;
function initDB() {
  if (db)
    return db;
  try {
    console.log(`[DB INITIALIZATION] Opening database at ${DB_PATH}...`);
    db = new import_better_sqlite3.default(DB_PATH, {
      verbose: console.log
    });
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    console.log("\u2705 [DB INITIALIZATION] SQLite connection active (WAL Mode).");
    return db;
  } catch (err) {
    console.error("\u274C [DB INITIALIZATION] Failed to initialize SQLite:", err);
    throw err;
  }
}
function migrate(db2) {
  console.log("[DB] Running migrations...");
  db2.exec(`
        CREATE TABLE IF NOT EXISTS contacts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            address TEXT,
            tags TEXT,
            source TEXT,
            service TEXT,
            status TEXT CHECK(status IN ('lead', 'customer', 'lost')),
            notes TEXT,
            created_at TEXT NOT NULL,
            invalid_phone INTEGER DEFAULT 0,
            lead_status TEXT,
            follow_up_required INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS opportunities (
            id TEXT PRIMARY KEY,
            contact_id TEXT NOT NULL,
            pipeline_stage TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('open', 'won', 'lost')),
            value REAL DEFAULT 0,
            source TEXT,
            notes TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (contact_id) REFERENCES contacts (id) ON DELETE CASCADE
        );
    `);
  console.log("\u2705 [DB] Migrations completed: contacts and opportunities initialized.");
}
function getDB() {
  if (!db) {
    return initDB();
  }
  return db;
}
function closeDB() {
  if (db) {
    db.close();
    db = null;
    console.log("[DB] SQLite connection closed.");
  }
}

// src/contacts_repo.ts
function persistContact(contact) {
  const db2 = getDB();
  const stmt = db2.prepare(`
    INSERT INTO contacts (
        id, name, phone, email, address, tags, source, service, status, notes, created_at, invalid_phone, lead_status, follow_up_required
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    contact.id,
    contact.name,
    contact.phone,
    contact.email,
    contact.address,
    JSON.stringify(contact.tags || []),
    contact.source,
    contact.service || null,
    contact.status,
    contact.notes || null,
    contact.created_at,
    contact.invalid_phone ? 1 : 0,
    contact.lead_status || null,
    contact.follow_up_required ? 1 : 0
  );
  return contact;
}
function findContact(phone, email) {
  const db2 = getDB();
  const stmt = db2.prepare(`
    SELECT * FROM contacts 
    WHERE (phone = ? AND phone != '') 
       OR (email = ? AND email != '')
    LIMIT 1
  `);
  const row = stmt.get(phone, email);
  if (!row)
    return null;
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    invalid_phone: !!row.invalid_phone,
    follow_up_required: !!row.follow_up_required
  };
}
function getContact(id) {
  const db2 = getDB();
  const stmt = db2.prepare("SELECT * FROM contacts WHERE id = ?");
  const row = stmt.get(id);
  if (!row)
    return null;
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    invalid_phone: !!row.invalid_phone,
    follow_up_required: !!row.follow_up_required
  };
}

// src/opportunities_repo.ts
function persistOpportunity(opp) {
  const db2 = getDB();
  const stmt = db2.prepare(`
    INSERT INTO opportunities (
        id, contact_id, pipeline_stage, status, value, source, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    opp.id,
    opp.contact_id,
    opp.pipeline_stage,
    opp.status,
    opp.value || 0,
    opp.source || null,
    opp.notes || null,
    opp.created_at
  );
  return opp;
}
function getOpportunitiesByContact(contact_id) {
  const db2 = getDB();
  const stmt = db2.prepare("SELECT * FROM opportunities WHERE contact_id = ? ORDER BY created_at DESC");
  const rows = stmt.all(contact_id);
  return rows.map((row) => ({
    ...row,
    status: row.status
  }));
}

// src/config.ts
var import_meta = {};
var twilioConfig = {
  account_sid: typeof import_meta !== "undefined" && import_meta.env?.VITE_TWILIO_ACCOUNT_SID || "",
  auth_token: typeof import_meta !== "undefined" && import_meta.env?.VITE_TWILIO_AUTH_TOKEN || "",
  sending_phone_number: typeof import_meta !== "undefined" && import_meta.env?.VITE_TWILIO_PHONE_NUMBER || ""
};

// src/messages.ts
function saveMessage(message) {
  const contactExists = mockContacts.some((c) => c.id === message.contact_id);
  if (!contactExists) {
    console.error(`[Message Error] Invalid contact_id: ${message.contact_id}`);
    return false;
  }
  if (!message.opportunity_id) {
    const latestOpp = mockOpportunities.filter((o) => o.contact_id === message.contact_id && o.status === "open").sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    if (latestOpp) {
      message.opportunity_id = latestOpp.id;
    }
  }
  const finalMessage = {
    id: message.id || `msg-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    contact_id: message.contact_id,
    opportunity_id: message.opportunity_id,
    direction: message.direction || "outbound",
    type: message.type || "sms",
    content: message.content || "",
    status: message.status || "pending",
    // Default to 'pending'
    source: message.source,
    created_at: message.created_at || (/* @__PURE__ */ new Date()).toISOString()
  };
  mockMessages.push(finalMessage);
  console.log(`[Message Saved]: ${finalMessage.id} with status "${finalMessage.status}" for contact ${finalMessage.contact_id}`);
  return true;
}

// src/sms.ts
function getDefaultLeadReply(contact, template) {
  const name = contact?.name?.trim() || "";
  if (template && template.trim()) {
    return template.replace(/{name}/g, name || "there");
  }
  const greeting = name ? `Hey ${name}` : "Hey there";
  return `${greeting}, thanks for reaching out! I got your request and will get back to you shortly.`;
}
function getMissedCallReply(contact, template) {
  const name = (contact?.name?.trim() || "").replace("Unknown Caller", "");
  if (template && template.trim()) {
    return template.replace(/{name}/g, name || "there");
  }
  if (!name) {
    return "Hey, sorry I missed your call. How can I help?";
  }
  return `Hey ${name}, sorry I missed your call. How can I help?`;
}
async function sendSMS(phone, message) {
  const { account_sid, auth_token, sending_phone_number } = twilioConfig;
  if (!account_sid || !auth_token || !sending_phone_number) {
    const errorMsg = "Twilio credentials not fully configured in environment variables.";
    console.error(`[SMS SERVICE] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`;
  const auth = btoa(`${account_sid}:${auth_token}`);
  const params = new URLSearchParams();
  params.append("To", phone);
  params.append("From", sending_phone_number);
  params.append("Body", message);
  try {
    console.log(`[SMS SERVICE] Attempting to send message to ${phone}...`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    const data = await response.json();
    if (response.ok) {
      console.log(`\u2705 [SMS SERVICE] Message successfully dispatched. Twilio SID: ${data.sid}`);
      return {
        success: true,
        provider_message_id: data.sid
      };
    } else {
      const errorDetail = data.message || response.statusText;
      console.error(`\u274C [SMS SERVICE] Dispatch failed: ${errorDetail}`);
      return {
        success: false,
        error: errorDetail
      };
    }
  } catch (error) {
    console.error(`\u274C [SMS SERVICE] Network or Runtime Error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
async function dispatchSMS(contact_id, phone, messageText, opportunity_id, source) {
  const newMessage = {
    id: `msg-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    contact_id,
    opportunity_id,
    direction: "outbound",
    type: "sms",
    content: messageText,
    status: "pending",
    source,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  saveMessage(newMessage);
  console.log(`[DISPATCH] Message record created with status "pending": ${newMessage.id}`);
  const result = await sendSMS(phone, messageText);
  const dbRecord = mockMessages.find((m) => m.id === newMessage.id);
  if (dbRecord) {
    if (result.success) {
      dbRecord.status = "sent";
      dbRecord.retryable = false;
      dbRecord.provider_message_id = result.provider_message_id;
      console.log(`\u2705 [DISPATCH] Message ${dbRecord.id} marked as 'sent'. Provider ID: ${result.provider_message_id}`);
    } else {
      dbRecord.status = "failed";
      dbRecord.retryable = true;
      console.error(`\u274C [DISPATCH] Message ${dbRecord.id} marked as 'failed'. Error: ${result.error}`);
    }
  }
  return {
    internal_id: newMessage.id,
    twilio_result: result
  };
}
async function sendMessageToContact(contact_id, messageText, source) {
  const contact = getContact(contact_id);
  if (!contact) {
    const errorMsg = `Contact lookup failed: ID ${contact_id} not found in database.`;
    console.error(`[CONTACT HELPER] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
  if (!contact.phone) {
    const errorMsg = `SMS Aborted: Contact ${contact.name} (${contact_id}) has no phone number recorded.`;
    console.error(`[CONTACT HELPER] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
  const now = (/* @__PURE__ */ new Date()).getTime();
  const isDuplicate = mockMessages.some(
    (m) => m.contact_id === contact_id && m.direction === "outbound" && m.content === messageText && now - new Date(m.created_at).getTime() < 6e4
  );
  if (isDuplicate) {
    const errorMsg = `Duplicate SMS prevented`;
    console.warn(`[CONTACT HELPER] ${errorMsg}: '${messageText}' was already sent to ${contact.name} within the last 60 seconds.`);
    return { success: false, error: errorMsg };
  }
  const recentMessagesCount = mockMessages.filter(
    (m) => m.contact_id === contact_id && m.direction === "outbound" && now - new Date(m.created_at).getTime() < 6e4
  ).length;
  if (recentMessagesCount >= 3) {
    const errorMsg = `Rate limit hit`;
    console.warn(`[CONTACT HELPER] ${errorMsg}: Contact ${contact.name} has already received 3 messages in the last minute.`);
    return { success: false, error: errorMsg };
  }
  console.log(`[CONTACT HELPER] Initializing SMS lifecycle for ${contact.name}...`);
  const result = await dispatchSMS(contact_id, contact.phone, messageText, void 0, source);
  return {
    success: result.twilio_result.success,
    internal_id: result.internal_id,
    error: result.twilio_result.error
  };
}

// src/events.ts
var listeners = {};
function onEvent(name, callback) {
  if (!listeners[name]) {
    listeners[name] = [];
  }
  listeners[name].push(callback);
}
function createEvent(name, payload = {}) {
  return {
    event_name: name,
    payload,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var eventLog = [];
async function emitEvent(name, payload = {}) {
  if (name === "form_submitted" || name === "lead_created") {
    if (!payload.contact_id || !payload.opportunity_id) {
      console.error("Invalid event payload", { event_name: name, payload });
      return null;
    }
  }
  const event = createEvent(name, payload);
  eventLog.push(event);
  const logEntry = {
    id: `ev-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    event_name: event.event_name,
    payload: event.payload,
    status: "pending",
    created_at: event.created_at
  };
  mockEventLogs.push(logEntry);
  logEntry.status = "processed";
  console.log("[Event Logged]:", event);
  if (listeners[name]) {
    for (const fn of listeners[name]) {
      try {
        await fn(payload);
      } catch (e) {
        console.error(`[Event Listener Error] ${name}:`, e);
      }
    }
  }
  return event;
}
onEvent("lead_created", async (payload) => {
  if (!mockWebsiteSettings.auto_lead_sms_enabled) {
    console.log("Automated lead SMS skipped: auto-response disabled globally");
    return;
  }
  console.log("Lead created event received");
  const contact_id = payload.contact_id;
  let phone = payload.phone;
  if (!phone && contact_id) {
    const contact2 = getContact(contact_id);
    if (contact2 && contact2.phone) {
      phone = contact2.phone;
    }
  }
  if (!phone) {
    console.log("Automated lead SMS skipped: No phone available");
    return;
  }
  const contact = getContact(contact_id);
  if (!contact) {
    console.log("Contact not found for SMS");
    return;
  }
  const template = mockWebsiteSettings.auto_lead_sms_template;
  const message = getDefaultLeadReply(contact, template);
  const now = Date.now();
  const twoMinutesAgo = now - 2 * 60 * 1e3;
  const alreadySent = mockMessages.some(
    (m) => m.contact_id === contact_id && m.direction === "outbound" && new Date(m.created_at).getTime() >= twoMinutesAgo && (m.content === message || m.content.includes("thanks for reaching out"))
  );
  if (alreadySent) {
    console.log("Automated lead SMS skipped: duplicate prevented");
    return;
  }
  console.log(`[AUTOMATION] Triggering automated SMS for lead: ${contact.name}`);
  const result = await sendMessageToContact(contact_id, message, "automation");
  if (result.success) {
    console.log("Automated lead SMS sent");
  } else {
    console.log("Auto SMS failed");
    contact.follow_up_required = true;
  }
});
onEvent("call_missed", async (payload) => {
  console.log("call_missed event received");
  if (!mockWebsiteSettings.missed_call_sms_enabled) {
    console.log("Missed call SMS disabled");
    return;
  }
  const { phone, call_id } = payload;
  if (!phone) {
    console.log("[SMS PREP] No phone provided, exiting");
    return;
  }
  const phoneNorm = normalizePhone(phone);
  let existingContact = findContact(phoneNorm.normalized, null);
  let contactIdToUse;
  if (existingContact) {
    console.log(`Contact matched: ${existingContact.name} (${existingContact.id})`);
    contactIdToUse = existingContact.id;
  } else {
    const newContact = {
      id: `c-${Date.now()}`,
      name: "Unknown Caller",
      phone: phoneNorm.normalized,
      email: null,
      address: "New lead from missed call",
      tags: ["missed-call"],
      source: "missed_call",
      status: "lead",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    persistContact(newContact);
    console.log("New contact created from missed call");
    contactIdToUse = newContact.id;
  }
  const targetContact = getContact(contactIdToUse);
  if (!targetContact) {
    console.log("[SMS PREP] No contact resolved, exiting");
    return;
  }
  console.log(`[SMS PREP] Target contact resolved: ${targetContact.name} (${targetContact.id})`);
  const now = Date.now();
  const recentAutomation = mockMessages.find(
    (m) => m.contact_id === targetContact.id && m.source === "missed_call_automation" && now - new Date(m.created_at).getTime() < 12e4
    // 2 minutes
  );
  if (recentAutomation) {
    console.log("Missed call SMS already sent");
    console.log(`[SMS SKIPPED] Prevented duplicate follow-up within 2-minute window for ${targetContact.name}`);
    return;
  }
  const fiveMinutesAgo = now - 3e5;
  const recentCount = mockMessages.filter(
    (m) => m.contact_id === targetContact.id && m.source === "missed_call_automation" && new Date(m.created_at).getTime() > fiveMinutesAgo
  ).length;
  if (recentCount >= 2) {
    console.log("Missed call SMS rate limited");
    console.warn(`[SMS SKIPPED] Rate limit of 2 messages reached within 5 minutes for ${targetContact.name}`);
    return;
  }
  const smsMessage = getMissedCallReply(targetContact, mockWebsiteSettings.missed_call_sms_template);
  console.log(`[SMS PREP] Message prepared: "${smsMessage}"`);
  const smsResult = await sendMessageToContact(targetContact.id, smsMessage, "missed_call_automation");
  if (smsResult.success) {
    console.log("Missed call SMS sent");
    console.log(`[SMS SUCCESS] Automated reply sent to ${targetContact.name}: "${smsMessage}"`);
  } else if (smsResult.error === "Duplicate SMS prevented" || smsResult.error === "Rate limit hit") {
    console.log("Missed call SMS skipped");
    console.warn(`[SMS SKIPPED] ${smsResult.error} for ${targetContact.name}`);
  } else {
    console.log("Missed call SMS failed");
    console.error(`[SMS FAILURE] Could not send reply to ${targetContact.name}: ${smsResult.error}`);
    targetContact.follow_up_required = true;
  }
  const newOpportunity = {
    id: `opp-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    contact_id: contactIdToUse,
    pipeline_stage: "New Lead",
    status: "open",
    value: 0,
    assigned_to: "Unassigned",
    source: "missed_call",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  persistOpportunity(newOpportunity);
  console.log(`Opportunity created for contact ${contactIdToUse}`);
  if (call_id) {
    const callRecord = mockCalls.find((c) => c.id === call_id);
    if (callRecord) {
      callRecord.contact_id = contactIdToUse;
      callRecord.opportunity_id = newOpportunity.id;
      console.log(`Call record ${call_id} linked to contact ${contactIdToUse} and opportunity ${newOpportunity.id}`);
    }
  }
});

// src/automation.ts
var automations = [
  {
    id: "a1",
    name: "Auto-follow task for new leads",
    trigger: "OPPORTUNITY_CREATED",
    action: "CREATE_TASK",
    actionParams: {
      type: "call",
      description: "Call new lead ASAP",
      dueInMinutes: 10
    }
  },
  {
    id: "a2",
    name: "Notify when job is scheduled",
    trigger: "OPPORTUNITY_STAGE_UPDATED",
    condition: (context) => context.pipeline_stage === "Scheduled",
    action: "SEND_NOTIFICATION",
    actionParams: {
      message: "\u{1F389} A job has been scheduled! Get ready."
    }
  },
  {
    id: "a3",
    name: "Final follow up when completed",
    trigger: "OPPORTUNITY_STAGE_UPDATED",
    condition: (context) => context.pipeline_stage === "Completed",
    action: "CREATE_TASK",
    actionParams: {
      type: "visit",
      description: "Site cleanup & final inspection",
      dueInDays: 0
    }
  },
  {
    id: "a4",
    name: "Follow up on sent quote",
    trigger: "OPPORTUNITY_STAGE_UPDATED",
    condition: (context) => context.pipeline_stage === "Quote Sent",
    action: "CREATE_TASK",
    actionParams: {
      type: "note",
      description: "Follow up on quote in 24 hours",
      dueInDays: 1
    }
  }
];
function runAutomations(trigger, context) {
  const activeAutomations = automations.filter(
    (a) => a.trigger === trigger && (!a.condition || a.condition(context))
  );
  activeAutomations.forEach((automation) => {
    executeAction(automation, context);
  });
}
function executeAction(automation, context) {
  switch (automation.action) {
    case "CREATE_TASK":
      createTaskAction(automation.actionParams, context);
      break;
    case "SEND_NOTIFICATION":
      sendNotificationAction(automation.actionParams, context);
      break;
  }
}
function createTaskAction(params, context) {
  const contact = getContact(context.contact_id);
  const contactName = contact ? contact.name : "Unknown";
  const dueDate = /* @__PURE__ */ new Date();
  if (params.dueInDays) {
    dueDate.setDate(dueDate.getDate() + params.dueInDays);
  }
  if (params.dueInMinutes) {
    dueDate.setMinutes(dueDate.getMinutes() + params.dueInMinutes);
  }
  const newTask = {
    id: "task-" + Date.now() + "-" + Math.floor(Math.random() * 1e3),
    contact_id: context.contact_id,
    type: params.type || "note",
    description: params.description || `[AUTOMATED] Follow up for ${contactName}`,
    due_date: dueDate.toISOString(),
    completed: false
  };
  mockActivities.push(newTask);
  console.log(`[AUTOMATION: TASK CREATED] ${newTask.description}`);
}
function sendNotificationAction(params, context) {
  const contact = getContact(context.contact_id);
  const contactName = contact ? contact.name : "Unknown";
  const message = params.message.replace("${contactName}", contactName);
  console.log(`%c[AUTOMATION: NOTIFICATION] ${message} (${contactName})`, "color: #007bff; font-weight: bold;");
  if (typeof window !== "undefined") {
    alert(`Automation Notification: ${message}`);
  }
}

// src/leads_logic.ts
function normalizePhone(phone) {
  if (!phone)
    return { normalized: "", invalid: true };
  const cleaned = phone.replace(/[\s\-\(\)\[\]\{\}\.\,\/]/g, "").replace(/\D/g, "");
  if (cleaned.length === 10) {
    return { normalized: `+1${cleaned}`, invalid: false };
  } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return { normalized: `+${cleaned}`, invalid: false };
  }
  return { normalized: cleaned || phone, invalid: true };
}
function normalizeEmail(email) {
  if (!email || !email.trim())
    return null;
  return email.trim().toLowerCase();
}
function normalizeName(name) {
  if (!name)
    return "";
  return name.trim().replace(/\s\s+/g, " ");
}
async function createLead(data) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const phoneNorm = normalizePhone(data.phone || "");
  const emailNorm = normalizeEmail(data.email);
  const normalizedName = normalizeName(data.name);
  if (!normalizedName) {
    throw new Error("Name is required for lead creation.");
  }
  const existingContact = findContact(phoneNorm.normalized, emailNorm);
  let contactIdToUse;
  if (existingContact) {
    contactIdToUse = existingContact.id;
    console.log(`Duplicate lead found: using existing contact ${contactIdToUse}.`);
    const contactOpps = getOpportunitiesByContact(contactIdToUse);
    const recentOpp = contactOpps.find(
      (opp) => (/* @__PURE__ */ new Date()).getTime() - new Date(opp.created_at).getTime() < 12e4
    );
    if (recentOpp) {
      throw new Error(`Duplicate submission window open for contact ${contactIdToUse}.`);
    }
  } else {
    contactIdToUse = `c-${Date.now()}`;
    const newContact = {
      id: contactIdToUse,
      name: normalizedName,
      phone: phoneNorm.normalized,
      email: emailNorm,
      address: data.address || "Lead API Submission",
      tags: ["web-lead"],
      source: data.source || "api",
      service: data.service_type || void 0,
      status: "lead",
      created_at: timestamp,
      invalid_phone: phoneNorm.invalid || void 0
    };
    persistContact(newContact);
  }
  const newOpportunity = {
    id: `opp-${Date.now()}`,
    contact_id: contactIdToUse,
    pipeline_stage: "New Lead",
    value: 0,
    assigned_to: "Unassigned",
    status: "open",
    notes: `Service Type: ${data.service_type || "N/A"}
Address: ${data.address || "N/A"}
Message: ${data.message || "N/A"}`,
    source: data.source || "api",
    created_at: timestamp
  };
  persistOpportunity(newOpportunity);
  const emissionsInThisCycle = /* @__PURE__ */ new Set();
  const guardedEmit = (name, payload) => {
    if (!emissionsInThisCycle.has(name)) {
      emitEvent(name, payload);
      emissionsInThisCycle.add(name);
    }
  };
  guardedEmit("lead_created", {
    contact_id: contactIdToUse,
    opportunity_id: newOpportunity.id,
    phone: phoneNorm.normalized,
    email: emailNorm,
    pipeline_stage: "New Lead",
    source: data.source || "api"
  });
  runAutomations("OPPORTUNITY_CREATED", newOpportunity);
  return {
    contactId: contactIdToUse,
    opportunityId: newOpportunity.id,
    status: "success"
  };
}

// test_e2e_db_flow.ts
async function testE2EDBFlow() {
  console.log("================================================");
  console.log("   CRM DB MIGRATION VERIFICATION - E2E TEST     ");
  console.log("================================================\n");
  try {
    const db2 = initDB();
    const uniqueEmail = `e2e-${Date.now()}@test.com`;
    const uniquePhone = `999${Math.floor(Math.random() * 899999 + 1e5)}`;
    console.log("[STEP 1] Running createLead()...");
    const res = await createLead({
      name: "E2E Persistence User",
      phone: uniquePhone,
      email: uniqueEmail,
      address: "456 DB Lane",
      source: "e2e_verification"
    });
    console.log(`   Contact Created: ${res.contactId}`);
    console.log(`   Opportunity Created: ${res.opportunityId}`);
    console.log("\n[STEP 2] Verifying Contact in SQLite...");
    const contact = getContact(res.contactId);
    console.log("   Fetched Contact:", JSON.stringify(contact));
    if (contact && contact.email === uniqueEmail) {
      console.log("\u2705 PASS: Contact found in database with correct email.");
    } else {
      throw new Error(`FAIL: Contact not found in DB or email mismatch. Expected: ${uniqueEmail}, Got: ${contact?.email}`);
    }
    console.log("\n[STEP 3] Verifying Opportunity in SQLite...");
    const opps = getOpportunitiesByContact(res.contactId);
    const mainOpp = opps.find((o) => o.id === res.opportunityId);
    if (mainOpp && mainOpp.contact_id === res.contactId) {
      console.log("\u2705 PASS: Opportunity found in database and correctly linked.");
    } else {
      throw new Error(`FAIL: Opportunity not found or linkage broken.`);
    }
    console.log("\n[STEP 4] Restarting DB Simulation...");
    closeDB();
    initDB();
    const reFetchedContact = getContact(res.contactId);
    if (reFetchedContact) {
      console.log('\u2705 PASS: Persistence surviving "restart".');
    } else {
      throw new Error(`FAIL: Persistence lost after restart.`);
    }
    console.log("\n================================================");
    console.log("   OVERALL RESULT: SUCCESS");
    console.log("================================================");
  } catch (err) {
    console.error("\n\u274C E2E FLOW TEST FAILED:", err);
    process.exit(1);
  } finally {
    closeDB();
  }
}
testE2EDBFlow().catch(console.error);
