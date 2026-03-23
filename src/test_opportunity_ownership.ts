import { getDB } from './database';

async function testOpportunityOwnership() {
    console.log('--- Testing Opportunity Table user_id support ---');
    
    const db = getDB();
    const testOppId = `opp-owned-${Date.now()}`;
    const testUserId = `u-${Date.now()}`;
    const testContactId = `c-test-${Date.now()}`;
    
    // Setup dummy contact first (due to foreign key constraint)
    db.prepare("INSERT INTO contacts (id, user_id, name, status, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(testContactId, 'system', 'Dummy Contact', 'lead', new Date().toISOString());

    console.log(`Inserting opportunity ${testOppId} owned by ${testUserId}...`);
    
    try {
        const stmt = db.prepare(`
            INSERT INTO opportunities (id, user_id, contact_id, pipeline_stage, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(testOppId, testUserId, testContactId, "New Lead", "open", new Date().toISOString());
        console.log('✅ PASS: Manual insertion with user_id succeeded.');
    } catch (err: any) {
        console.error('❌ FAIL: Could not insert opportunity with user_id.', err.message);
        process.exit(1);
    }
    
    // Verify it was saved correctly
    const saved = db.prepare("SELECT * FROM opportunities WHERE id = ?").get(testOppId) as any;
    if (saved && saved.user_id === testUserId) {
        console.log(`✅ PASS: Verified saved user_id in database: ${saved.user_id}`);
    } else {
        console.error('❌ FAIL: Saved user_id mismatch.', saved);
        process.exit(1);
    }

    console.log('\n✅ ALL Opportunity Ownership DB tests PASSED.');
}

testOpportunityOwnership().catch(err => {
    console.error(err);
    process.exit(1);
});
