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
function getAllMessagesOrdered() {
  const db2 = getDB();
  const rows = db2.prepare("SELECT * FROM messages ORDER BY created_at ASC").all();
  return rows.map((row) => ({
    ...row,
    retryable: row.retryable === 1
  }));
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

// verify_r6_14_messages.ts
async function verifyMessages() {
  console.log("--- Verification: DB-Backed Message Creation (R6.14) ---");
  initDB();
  try {
    const phone = "+19998881234";
    const contactId = "c-msg-r614-v2";
    const testContact = {
      id: contactId,
      name: "R6.14 Tester V2",
      phone,
      email: "testerv2@example.com",
      status: "lead",
      address: "Test Address",
      source: "test",
      tags: [],
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    persistContact(testContact);
    console.log(`[TEST] Sending manual SMS to ${phone} (Twilio call will fail due to config)...`);
    const sentResult = await sendMessageToContact(contactId, "Manual test message V2 from R6.14 verification script", "manual");
    console.log(`[TEST] Dispatch finished. Success: ${sentResult.success}, Error: ${sentResult.error}`);
    console.log(`[TEST] Internal ID: ${sentResult.internal_id}`);
    const messages = getMessagesByContact(contactId);
    console.log(`[DB] Found ${messages.length} messages for contact ${contactId}`);
    const found = messages.find((m) => m.id === sentResult.internal_id);
    if (found) {
      console.log("\u2705 PASS: Message found in persistent storage.");
      console.log(`   - ID: ${found.id}`);
      console.log(`   - Content: "${found.content}"`);
      console.log(`   - Status: "${found.status}"`);
      console.log(`   - Source: "${found.source}"`);
    } else {
      throw new Error("FAIL: Message NOT found in database after dispatch.");
    }
    console.log("[TEST] Attempting duplicate message send...");
    const dupResult = await sendMessageToContact(contactId, "Manual test message V2 from R6.14 verification script", "manual");
    if (!dupResult.success && dupResult.error === "Duplicate SMS prevented") {
      console.log("\u2705 PASS: Database-backed deduplication prevented duplicate send.");
    } else {
      throw new Error(`FAIL: Deduplication check failed. Result: ${JSON.stringify(dupResult)}`);
    }
    const all = getAllMessagesOrdered();
    if (all.some((m) => m.id === sentResult.internal_id)) {
      console.log("\u2705 PASS: Message correctly appears in global chronological feed.");
    } else {
      throw new Error("FAIL: Message missing from global feed.");
    }
  } catch (err) {
    console.error("\u274C VERIFICATION FAILED:", err);
    process.exit(1);
  } finally {
    closeDB();
  }
}
if (typeof process !== "undefined") {
  verifyMessages();
}
