import Database from 'better-sqlite3';

const DB_PATH = './crm.db';

let db: Database.Database | null = null;

/**
 * Initializes the database connection and creates files if missing.
 */
export function initDB(): Database.Database {
  if (db) return db;

  try {
    console.log(`[DB INITIALIZATION] Opening database at ${DB_PATH}...`);
    
    db = new Database(DB_PATH, { 
      verbose: console.log 
    });

    // Pragma checks and basic optimization
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');

    // Run migrations
    migrate(db);

    console.log('✅ [DB INITIALIZATION] SQLite connection active (WAL Mode).');
    return db;
  } catch (err) {
    console.error('❌ [DB INITIALIZATION] Failed to initialize SQLite:', err);
    throw err;
  }
}

/**
 * Creates tables if they don't exist.
 */
function migrate(database: Database.Database) {
    console.log('[DB] Running migrations...');
    
    database.exec(`
        CREATE TABLE IF NOT EXISTS contacts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            address TEXT,
            tags TEXT,
            source TEXT,
            service TEXT,
            status TEXT NOT NULL CHECK(status IN ('lead', 'customer', 'lost')),
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

        CREATE TABLE IF NOT EXISTS calls (
            id TEXT PRIMARY KEY,
            contact_id TEXT,
            opportunity_id TEXT,
            phone TEXT NOT NULL,
            direction TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
            status TEXT NOT NULL,
            duration INTEGER DEFAULT 0,
            recording_url TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (contact_id) REFERENCES contacts (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS event_logs (
            id TEXT PRIMARY KEY,
            event_name TEXT NOT NULL,
            payload TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS activities (
            id TEXT PRIMARY KEY,
            contact_id TEXT NOT NULL,
            type TEXT NOT NULL,
            description TEXT NOT NULL,
            due_date TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            FOREIGN KEY (contact_id) REFERENCES contacts (id) ON DELETE CASCADE
        );
    `);
    
    console.log('✅ [DB] Migrations completed: contacts, opportunities, messages, calls, event_logs, and activities initialized.');
}

/**
 * Returns the active DB connection.
 */
export function getDB(): Database.Database {
  if (!db) {
    return initDB();
  }
  return db;
}

/**
 * Closes the database connection safely.
 */
export function closeDB(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] SQLite connection closed.');
  }
}
