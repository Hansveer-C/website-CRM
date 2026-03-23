import { initDB, closeDB } from './src/database';

async function testMessages() {
  console.log('--- Database Messages Schema Test ---');
  const db = initDB();

  try {
    // 1. Create a dummy contact (foreign key dependency)
    db.prepare(`
      INSERT OR IGNORE INTO contacts (id, name, status, created_at) 
      VALUES (?, ?, ?, ?)
    `).run('c-msg-test', 'Message Subject', 'lead', new Date().toISOString());

    // 2. Insert a message
    const msgId = 'm-' + Date.now();
    const ts = new Date().toISOString();
    
    console.log(`[DB] Inserting message ${msgId}...`);
    db.prepare(`
        INSERT INTO messages (
            id, contact_id, direction, type, content, status, source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        msgId, 
        'c-msg-test', 
        'outbound', 
        'sms', 
        'Hello from SQLite persistence!', 
        'sent', 
        'test_script', 
        ts
    );

    // 3. Verify
    const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId) as any;
    if (row && row.content === 'Hello from SQLite persistence!') {
        console.log('✅ PASS: Message correctly persisted in database.');
        console.log('   - Row:', JSON.stringify(row));
    } else {
        throw new Error('FAIL: Message not found or content mismatch.');
    }

  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    closeDB();
  }
}

testMessages();
