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

// test_pipeline_db.ts
async function testPipelinePersistence() {
  console.log("--- DB-Backed Pipeline Lookup Test ---");
  const contactId = "c-pipe-test";
  try {
    const db2 = initDB();
    db2.prepare("DELETE FROM contacts WHERE id = ?").run(contactId);
    db2.prepare("INSERT INTO contacts (id, name, created_at) VALUES (?, ?, ?)").run(contactId, "Pipeline User", (/* @__PURE__ */ new Date()).toISOString());
    console.log("   Creating 2 opportunities for the same contact...");
    const opp1 = {
      id: "o-pipe-1",
      contact_id: contactId,
      pipeline_stage: "New Lead",
      status: "open",
      value: 100,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const opp2 = {
      id: "o-pipe-2",
      contact_id: contactId,
      pipeline_stage: "Quote Sent",
      status: "open",
      value: 500,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    persistOpportunity(opp1);
    persistOpportunity(opp2);
    console.log("--- Restarting DB Simulation ---");
    closeDB();
    initDB();
    console.log("   Querying pipeline (opportunities for contact)...");
    const pipeline = getOpportunitiesByContact(contactId);
    if (pipeline.length === 2) {
      console.log("\u2705 PASS: Pipeline lookup correctly returned 2 persistent opportunities.");
      console.log("   Items found:", pipeline.map((o) => `${o.id}: ${o.pipeline_stage}`));
    } else {
      throw new Error(`FAIL: Expected 2 opportunities, found ${pipeline.length}`);
    }
  } catch (err) {
    console.error("\u274C Pipeline Test Failed:", err);
    process.exit(1);
  } finally {
    closeDB();
  }
}
testPipelinePersistence().catch(console.error);
