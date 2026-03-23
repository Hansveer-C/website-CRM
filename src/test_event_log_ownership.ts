import { getDB } from './database';

async function testEventLogOwnership() {
    console.log('--- Testing EventLog Table user_id support ---');
    
    const db = getDB();
    const testLogId = `log-owned-${Date.now()}`;
    const testUserId = `u-${Date.now()}`;
    
    console.log(`Inserting event log ${testLogId} owned by ${testUserId}...`);
    
    try {
        const stmt = db.prepare(`
            INSERT INTO event_logs (id, user_id, event_name, payload, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
            testLogId, 
            testUserId, 
            'test_action', 
            JSON.stringify({ note: 'verification' }), 
            'processed', 
            new Date().toISOString()
        );
        console.log('✅ PASS: Manual event log insertion with user_id succeeded.');
    } catch (err: any) {
        console.error('❌ FAIL: Could not insert event log with user_id.', err.message);
        process.exit(1);
    }
    
    // Verify
    const saved = db.prepare("SELECT * FROM event_logs WHERE id = ?").get(testLogId) as any;
    if (saved && saved.user_id === testUserId) {
        console.log(`✅ PASS: Verified saved user_id in database: ${saved.user_id}`);
    } else {
        console.error('❌ FAIL: Saved user_id mismatch.', saved);
        process.exit(1);
    }

    console.log('\n✅ ALL EventLog Ownership DB tests PASSED.');
}

testEventLogOwnership().catch(console.error);
