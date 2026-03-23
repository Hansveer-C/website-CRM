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

        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            contact_id TEXT NOT NULL,
            opportunity_id TEXT,
            direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
            type TEXT NOT NULL,
            content TEXT NOT NULL,
            status TEXT NOT NULL,
            source TEXT,
            retryable INTEGER DEFAULT 1,
            provider_message_id TEXT,
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
    INSERT OR REPLACE INTO contacts (
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

// src/config.ts
var import_meta = {};
var twilioConfig = {
  account_sid: typeof import_meta !== "undefined" && import_meta.env?.VITE_TWILIO_ACCOUNT_SID || "",
  auth_token: typeof import_meta !== "undefined" && import_meta.env?.VITE_TWILIO_AUTH_TOKEN || "",
  sending_phone_number: typeof import_meta !== "undefined" && import_meta.env?.VITE_TWILIO_PHONE_NUMBER || ""
};

// src/opportunities_repo.ts
function getOpportunitiesByContact(contact_id) {
  const db2 = getDB();
  const stmt = db2.prepare("SELECT * FROM opportunities WHERE contact_id = ? ORDER BY created_at DESC");
  const rows = stmt.all(contact_id);
  return rows.map((row) => ({
    ...row,
    status: row.status
  }));
}

// src/messages_repo.ts
function persistMessage(message) {
  const db2 = getDB();
  const existing = db2.prepare("SELECT id FROM messages WHERE id = ?").get(message.id);
  if (existing) {
    db2.prepare(`
            UPDATE messages SET
                status = ?,
                retryable = ?,
                provider_message_id = ?
            WHERE id = ?
        `).run(
      message.status,
      message.retryable ? 1 : 0,
      message.provider_message_id || null,
      message.id
    );
  } else {
    db2.prepare(`
            INSERT INTO messages (
                id, contact_id, opportunity_id, direction, type, content, 
                status, source, retryable, provider_message_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
      message.id,
      message.contact_id,
      message.opportunity_id || null,
      message.direction,
      message.type,
      message.content,
      message.status,
      message.source || null,
      message.retryable ? 1 : 0,
      message.provider_message_id || null,
      message.created_at
    );
  }
  return message;
}
function getMessagesByContact(contactId) {
  const db2 = getDB();
  const rows = db2.prepare("SELECT * FROM messages WHERE contact_id = ? ORDER BY created_at ASC").all(contactId);
  return rows.map((row) => ({
    ...row,
    retryable: row.retryable === 1
  }));
}
function updateMessageStatus(id, status, providerMessageId, retryable) {
  const db2 = getDB();
  db2.prepare(`
        UPDATE messages SET
            status = ?,
            provider_message_id = ?,
            retryable = ?
        WHERE id = ?
    `).run(
    status,
    providerMessageId || null,
    retryable ? 1 : 0,
    id
  );
}
function countRecentOutboundMessages(contactId, sinceIso) {
  const db2 = getDB();
  const result = db2.prepare(`
        SELECT count(*) as total FROM messages 
        WHERE contact_id = ? AND direction = 'outbound' AND created_at > ?
    `).get(contactId, sinceIso);
  return result.total;
}
function checkDuplicateMessage(contactId, content, sinceIso) {
  const db2 = getDB();
  const result = db2.prepare(`
        SELECT id FROM messages 
        WHERE contact_id = ? AND direction = 'outbound' AND content = ? AND created_at > ?
        LIMIT 1
    `).get(contactId, content, sinceIso);
  return !!result;
}

// src/messages.ts
function saveMessage(message) {
  const contact = getContact(message.contact_id);
  if (!contact) {
    console.error(`[Message Error] Invalid contact_id: ${message.contact_id}`);
    return false;
  }
  if (!message.opportunity_id) {
    const opps = getOpportunitiesByContact(message.contact_id);
    const latestOpp = opps.filter((o) => o.status === "open").sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
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
  persistMessage(finalMessage);
  console.log(`[Message Saved]: ${finalMessage.id} with status "${finalMessage.status}" for contact ${finalMessage.contact_id}`);
  return true;
}

// src/sms.ts
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
  if (result.success) {
    updateMessageStatus(newMessage.id, "sent", result.provider_message_id, false);
    console.log(`\u2705 [DISPATCH] Message ${newMessage.id} marked as 'sent'. Provider ID: ${result.provider_message_id}`);
  } else {
    updateMessageStatus(newMessage.id, "failed", void 0, true);
    console.error(`\u274C [DISPATCH] Message ${newMessage.id} marked as 'failed'. Error: ${result.error}`);
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
  const sinceIso = new Date(Date.now() - 6e4).toISOString();
  const isDuplicate = checkDuplicateMessage(contact_id, messageText, sinceIso);
  if (isDuplicate) {
    const errorMsg = `Duplicate SMS prevented`;
    console.warn(`[CONTACT HELPER] ${errorMsg}: '${messageText}' was already sent to ${contact.name} within the last 60 seconds.`);
    return { success: false, error: errorMsg };
  }
  const recentMessagesCount = countRecentOutboundMessages(contact_id, sinceIso);
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

// src/db.ts
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
var mockCalls = [];

// src/timeline.ts
function getContactTimeline(contact_id) {
  const contact = getContact(contact_id);
  const phone = contact?.phone;
  const messages = getMessagesByContact(contact_id);
  const eventLogs = mockEventLogs.filter((e) => {
    if (!e.payload)
      return false;
    return e.payload.contact_id === contact_id || phone && e.payload.phone === phone;
  });
  const activities = mockActivities.filter((a) => a.contact_id === contact_id);
  const calls = mockCalls.filter((c) => c.contact_id === contact_id || phone && c.phone === phone);
  const messageItems = messages.map((m) => {
    const isOutbound = m.direction === "outbound";
    const arrow = isOutbound ? "\u2192" : "\u2190";
    const prefix = isOutbound ? "Sent SMS" : "Received SMS";
    const displayContent = m.content.length > 120 ? m.content.substring(0, 117) + "..." : m.content;
    return {
      type: "message",
      content: `${arrow} ${prefix}: ${displayContent}`,
      created_at: m.created_at,
      reference_id: m.id,
      contact_id: m.contact_id,
      metadata: { direction: m.direction, status: m.status }
    };
  });
  const eventItems = eventLogs.map((e) => {
    let type = "event";
    let content = "";
    if (e.event_name === "form_submitted" || e.event_name === "form_submission") {
      type = "form_submission";
      content = "Form submitted via website";
    } else if (e.event_name === "call_received") {
      type = "event";
      content = "\u{1F4DE} Inbound call: STARTED";
    } else if (e.event_name === "call_missed") {
      type = "call_missed";
      content = `[MISSED CALL] Incoming call from ${e.payload.phone || "Unknown"}`;
    } else {
      type = "event";
      content = `Event: ${e.event_name}`;
    }
    return {
      type,
      content,
      created_at: e.created_at,
      reference_id: e.id,
      contact_id,
      metadata: { ...e.payload }
    };
  });
  const callItems = calls.map((c) => {
    const direction = c.direction === "inbound" ? "Inbound call" : "Outbound call";
    const isMissed = c.status === "missed";
    let content = isMissed ? `[MISSED CALL] Incoming call from ${c.phone}` : `\u{1F4DE} ${direction}: ${c.status.toUpperCase()}`;
    if (c.duration && c.duration > 0) {
      content += ` (${c.duration}s)`;
    }
    return {
      type: isMissed ? "call_missed" : "event",
      content,
      created_at: c.created_at,
      reference_id: c.id,
      contact_id,
      metadata: { status: c.status, direction: c.direction, duration: c.duration || 0 }
    };
  });
  const activityItems = activities.map((a) => ({
    type: "event",
    content: `Event: ${a.type.toUpperCase()}`,
    created_at: a.due_date,
    reference_id: a.id,
    contact_id: a.contact_id,
    metadata: { completed: a.completed, activityType: a.type, description: a.description }
  }));
  const allItems = [...messageItems, ...eventItems, ...callItems, ...activityItems].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const now = /* @__PURE__ */ new Date();
  const todayStr = formatDateForComparison(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = formatDateForComparison(yesterday);
  const todayItems = [];
  const yesterdayItems = [];
  const earlierItems = [];
  allItems.forEach((item, idx) => {
    const itemDate = formatDateForComparison(new Date(item.created_at));
    const isLatest = idx === allItems.length - 1;
    const displayItem = {
      ...item,
      is_latest: isLatest,
      created_at: formatTimelineTime(item.created_at)
    };
    if (itemDate === todayStr) {
      todayItems.push(displayItem);
    } else if (itemDate === yesterdayStr) {
      yesterdayItems.push(displayItem);
    } else {
      earlierItems.push(displayItem);
    }
  });
  return [
    { label: "Earlier", items: earlierItems },
    { label: "Yesterday", items: yesterdayItems },
    { label: "Today", items: todayItems }
  ];
}
function formatTimelineTime(timestamp) {
  try {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(date);
  } catch (e) {
    return timestamp;
  }
}
function formatDateForComparison(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

// verify_r6_15_timeline.ts
async function verifyTimeline() {
  console.log("--- Verification: DB-Backed Message Retrieval & Timeline (R6.15) ---");
  initDB();
  try {
    const phone = "+19997776666";
    const contactId = "c-timeline-r615";
    const testContact = {
      id: contactId,
      name: "Timeline Tester",
      phone,
      email: "timeline@example.com",
      status: "lead",
      address: "Test Address",
      source: "test",
      tags: [],
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    persistContact(testContact);
    const initialTimeline = getContactTimeline(contactId);
    const initialCount = initialTimeline.flatMap((g) => g.items).filter((i) => i.type === "message").length;
    console.log(`[TEST] Initial message count in timeline: ${initialCount}`);
    const msgText = `Timeline verification message at ${(/* @__PURE__ */ new Date()).toISOString()}`;
    console.log(`[TEST] Sending message: "${msgText}"`);
    await sendMessageToContact(contactId, msgText, "test");
    const updatedTimeline = getContactTimeline(contactId);
    const updatedMessages = updatedTimeline.flatMap((g) => g.items).filter((i) => i.type === "message");
    console.log(`[TEST] Updated message count in timeline: ${updatedMessages.length}`);
    const latestMsg = updatedMessages[updatedMessages.length - 1];
    if (latestMsg && latestMsg.content.includes(msgText)) {
      console.log("\u2705 PASS: Message correctly appears in contact timeline.");
      console.log(`   - Display Content: "${latestMsg.content}"`);
    } else {
      throw new Error("FAIL: New message missing from timeline.");
    }
    console.log("[TEST] Simulating app restart check...");
    const finalTimeline = getContactTimeline(contactId);
    const finalMessages = finalTimeline.flatMap((g) => g.items).filter((i) => i.type === "message");
    if (finalMessages.some((m) => m.content.includes(msgText))) {
      console.log("\u2705 PASS: Timeline data persisted and retrieved from database.");
    } else {
      throw new Error("FAIL: Message lost after simulated restart.");
    }
  } catch (err) {
    console.error("\u274C VERIFICATION FAILED:", err);
    process.exit(1);
  } finally {
    closeDB();
  }
}
if (typeof process !== "undefined") {
  verifyTimeline();
}
