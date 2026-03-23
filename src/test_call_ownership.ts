import { getDB } from './database';

async function testCallOwnership() {
    console.log('--- Testing Call Table user_id support ---');
    
    const db = getDB();
    const testCallId = `call-owned-${Date.now()}`;
    const testUserId = `u-${Date.now()}`;
    
    console.log(`Inserting call ${testCallId} owned by ${testUserId}...`);
    
    try {
        const stmt = db.prepare(`
            INSERT INTO calls (id, user_id, phone, direction, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(testCallId, testUserId, "+15550109999", 'inbound', 'missed', new Date().toISOString());
        console.log('✅ PASS: Manual call insertion with user_id succeeded.');
    } catch (err: any) {
        console.error('❌ FAIL: Could not insert call with user_id.', err.message);
        process.exit(1);
    }
    
    // Verify
    const saved = db.prepare("SELECT * FROM calls WHERE id = ?").get(testCallId) as any;
    if (saved && saved.user_id === testUserId) {
        console.log(`✅ PASS: Verified saved user_id in database: ${saved.user_id}`);
    } else {
        console.error('❌ FAIL: Saved user_id mismatch.', saved);
        process.exit(1);
    }

    console.log('\n✅ ALL Call Ownership DB tests PASSED.');
}

testCallOwnership().catch(console.error);
