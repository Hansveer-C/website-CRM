import { initDB, getDB, closeDB } from './src/database';

async function testOpportunityPersistence() {
  console.log('--- Testing Opportunity Persistence ---');
  try {
    const db = initDB();
    
    // 1. Ensure a contact exists
    const contactId = 'c-opp-test';
    db.prepare('DELETE FROM contacts WHERE id = ?').run(contactId);
    db.prepare(`
        INSERT INTO contacts (id, name, phone, email, status, created_at, source)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(contactId, 'Opp Test User', '555-1212', 'opp@test.com', 'lead', new Date().toISOString(), 'test');

    // 2. Create an Opportunity
    const oppId = 'o-test-999';
    db.prepare('DELETE FROM opportunities WHERE id = ?').run(oppId);
    
    console.log('   Inserting opportunity linked to contact...');
    db.prepare(`
        INSERT INTO opportunities (id, contact_id, pipeline_stage, status, value, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(oppId, contactId, 'New Lead', 'open', 500.0, 'website', new Date().toISOString());

    // 3. Verify
    console.log('   Fetching opportunity with contact details...');
    const result = db.prepare(`
        SELECT o.*, c.name as contact_name 
        FROM opportunities o
        JOIN contacts c ON o.contact_id = c.id
        WHERE o.id = ?
    `).get(oppId) as any;
    
    if (result && result.contact_name === 'Opp Test User' && result.value === 500) {
      console.log('✅ PASS: Opportunity inserted and linked correctly.');
      console.log('   Opportunity Record:', JSON.stringify(result, null, 2));
    } else {
      throw new Error('Opportunity recovery failed or linkage broken');
    }

  } catch (err) {
    console.error('❌ Opportunity Test Failed:', err);
    process.exit(1);
  } finally {
    closeDB();
  }
}

testOpportunityPersistence().catch(console.error);
