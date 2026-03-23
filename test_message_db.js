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
function closeDB() {
  if (db) {
    db.close();
    db = null;
    console.log("[DB] SQLite connection closed.");
  }
}

// test_message_db.ts
async function testMessages() {
  console.log("--- Database Messages Schema Test ---");
  const db2 = initDB();
  try {
    db2.prepare(`
      INSERT OR IGNORE INTO contacts (id, name, status, created_at) 
      VALUES (?, ?, ?, ?)
    `).run("c-msg-test", "Message Subject", "lead", (/* @__PURE__ */ new Date()).toISOString());
    const msgId = "m-" + Date.now();
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    console.log(`[DB] Inserting message ${msgId}...`);
    db2.prepare(`
        INSERT INTO messages (
            id, contact_id, direction, type, content, status, source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      msgId,
      "c-msg-test",
      "outbound",
      "sms",
      "Hello from SQLite persistence!",
      "sent",
      "test_script",
      ts
    );
    const row = db2.prepare("SELECT * FROM messages WHERE id = ?").get(msgId);
    if (row && row.content === "Hello from SQLite persistence!") {
      console.log("\u2705 PASS: Message correctly persisted in database.");
      console.log("   - Row:", JSON.stringify(row));
    } else {
      throw new Error("FAIL: Message not found or content mismatch.");
    }
  } catch (err) {
    console.error("\u274C TEST FAILED:", err);
    process.exit(1);
  } finally {
    closeDB();
  }
}
testMessages();
