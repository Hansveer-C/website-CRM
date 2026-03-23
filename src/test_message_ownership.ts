import { getDB } from './database';

async function testMessageOwnership() {
    console.log('--- Testing Message Table user_id support ---');
    
    const db = getDB();
    const testMsgId = `msg-owned-${Date.now()}`;
    const testUserId = `u-${Date.now()}`;
    const testContactId = `c-msg-test-${Date.now()}`;
    
    // Setup dummy contact
    db.prepare("INSERT INTO contacts (id, user_id, name, status, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(testContactId, 'system', 'Message Test Contact', 'lead', new Date().toISOString());

    console.log(`Inserting message ${testMsgId} owned by ${testUserId}...`);
    
    try {
        const stmt = db.prepare(`
            INSERT INTO messages (id, user_id, contact_id, direction, type, content, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(testMsgId, testUserId, testContactId, 'outbound', 'sms', "Hello secure world!", 'sent', new Date().toISOString());
        console.log('✅ PASS: Manual message insertion with user_id succeeded.');
    } catch (err: any) {
        console.error('❌ FAIL: Could not insert message with user_id.', err.message);
        process.exit(1);
    }
    
    // Verify
    const saved = db.prepare("SELECT * FROM messages WHERE id = ?").get(testMsgId) as any;
    if (saved && saved.user_id === testUserId) {
        console.log(`✅ PASS: Verified saved user_id in database: ${saved.user_id}`);
    } else {
        console.error('❌ FAIL: Saved user_id mismatch.', saved);
        process.exit(1);
    }

    console.log('\n✅ ALL Message Ownership DB tests PASSED.');
}

testMessageOwnership().catch(console.error);
