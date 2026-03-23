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
            tags TEXT, -- Store as JSON array or comma-separated
            source TEXT,
            service TEXT,
            status TEXT CHECK(status IN ('lead', 'customer', 'lost')),
            notes TEXT,
            created_at TEXT NOT NULL,
            invalid_phone INTEGER DEFAULT 0, -- Boolean (0/1)
            lead_status TEXT,
            follow_up_required INTEGER DEFAULT 0 -- Boolean (0/1)
        );
    `);
  console.log("\u2705 [DB] Migrations completed: contacts table initialized.");
}
function closeDB() {
  if (db) {
    db.close();
    db = null;
    console.log("[DB] SQLite connection closed.");
  }
}

// test_contact_db.ts
async function testContactPersistence() {
  console.log("--- Testing Contact Persistence ---");
  try {
    const db2 = initDB();
    db2.prepare("DELETE FROM contacts WHERE id = ?").run("test-id-123");
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    console.log("   Inserting contact...");
    const insert = db2.prepare(`
        INSERT INTO contacts (id, name, phone, email, status, created_at, source)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run("test-id-123", "Persistence Test User", "555-9999", "persist@test.com", "lead", timestamp, "test");
    console.log("   Fetching contact back...");
    const result = db2.prepare("SELECT * FROM contacts WHERE id = ?").get("test-id-123");
    if (result && result.name === "Persistence Test User" && result.email === "persist@test.com") {
      console.log("\u2705 PASS: Contact inserted and recovered successfully.");
      console.log("   Record details:", JSON.stringify(result, null, 2));
    } else {
      throw new Error("Contact recovery failed or data mismatch");
    }
  } catch (err) {
    console.error("\u274C Persistence Test Failed:", err);
    process.exit(1);
  } finally {
    closeDB();
  }
}
testContactPersistence().catch(console.error);
