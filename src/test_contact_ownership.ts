import { getDB } from './database';

async function testContactOwnership() {
    console.log('--- Testing Contact Table user_id support ---');
    
    const db = getDB();
    const testContactId = `owned-${Date.now()}`;
    const testUserId = `u-${Date.now()}`;
    
    console.log(`Inserting contact ${testContactId} owned by ${testUserId}...`);
    
    // Using raw SQL because we were told NOT to update repositories yet
    try {
        const stmt = db.prepare(`
            INSERT INTO contacts (id, user_id, name, status, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        stmt.run(testContactId, testUserId, "Owned Contact", "lead", new Date().toISOString());
        console.log('✅ PASS: Manual insertion with user_id succeeded.');
    } catch (err: any) {
        console.error('❌ FAIL: Could not insert contact with user_id.', err.message);
        process.exit(1);
    }
    
    // Verify it was saved correctly
    const saved = db.prepare("SELECT * FROM contacts WHERE id = ?").get(testContactId) as any;
    if (saved && saved.user_id === testUserId) {
        console.log(`✅ PASS: Verified saved user_id in database: ${saved.user_id}`);
    } else {
        console.error('❌ FAIL: Saved user_id mismatch.', saved);
        process.exit(1);
    }

    console.log('\n✅ ALL Contact Ownership DB tests PASSED.');
}

testContactOwnership().catch(console.error);
