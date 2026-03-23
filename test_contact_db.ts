import { initDB, getDB, closeDB } from './src/database';

async function testContactPersistence() {
  console.log('--- Testing Contact Persistence ---');
  try {
    const db = initDB();
    
    // Clear any previous test contact
    db.prepare('DELETE FROM contacts WHERE id = ?').run('test-id-123');

    const timestamp = new Date().toISOString();
    
    console.log('   Inserting contact...');
    const insert = db.prepare(`
        INSERT INTO contacts (id, name, phone, email, status, created_at, source)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    insert.run('test-id-123', 'Persistence Test User', '555-9999', 'persist@test.com', 'lead', timestamp, 'test');

    console.log('   Fetching contact back...');
    const result = db.prepare('SELECT * FROM contacts WHERE id = ?').get('test-id-123') as any;
    
    if (result && result.name === 'Persistence Test User' && result.email === 'persist@test.com') {
      console.log('✅ PASS: Contact inserted and recovered successfully.');
      console.log('   Record details:', JSON.stringify(result, null, 2));
    } else {
      throw new Error('Contact recovery failed or data mismatch');
    }

  } catch (err) {
    console.error('❌ Persistence Test Failed:', err);
    process.exit(1);
  } finally {
    closeDB();
  }
}

testContactPersistence().catch(console.error);
