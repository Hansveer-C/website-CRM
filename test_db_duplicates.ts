import { createLead } from './src/leads_logic';
import { getDB, closeDB } from './src/database';

async function testDuplicateProtection() {
  console.log('--- Testing DB-Backed Duplicate Protection ---');
  try {
    const db = initDB();
    
    // Cleanup previous runs
    console.log('   Cleaning test contacts...');
    db.prepare("DELETE FROM contacts WHERE email = 'duplicate@test.com'").run();

    // 1. First lead
    console.log('   Submitting first lead...');
    const res1 = await createLead({
        name: 'John First',
        phone: '1231231234',
        email: 'duplicate@test.com'
    });
    console.log('   Result 1 - ID:', res1.contactId);

    // 2. Second lead (same email, different name)
    console.log('   Submitting duplicate lead (same email)...');
    let res2: any;
    try {
        res2 = await createLead({
            name: 'John Second',
            phone: '1231231234',
            email: 'duplicate@test.com'
        });
    } catch (e) {
        if (e.message.includes('Duplicate submission window')) {
            console.log('   ✅ Caught expected rate-limiting error.');
            // We know duplication was detected.
        } else {
            throw e;
        }
    }

    // 3. Verification
    const countResult = db.prepare("SELECT count(*) as total FROM contacts WHERE email = 'duplicate@test.com'").get() as any;
    
    if (countResult.total === 1) {
      console.log(`✅ PASS: Duplication prevented. Record count: ${countResult.total}`);
    } else {
      throw new Error(`FAIL: Duplicate protection failed. Count: ${countResult.total}`);
    }

  } catch (err) {
    if (err.message.includes('Duplicate submission window')) {
       console.log('   Caught expected rate-limiting error, but let\'s check IDs...');
       // This error is expected for same-contact submissions within 2 mins
       // But the ID mapping should still hold if it didn't throw before selecting contact
    }
    console.error('❌ Duplicate Test Failed:', err.message);
    process.exit(1);
  } finally {
    closeDB();
  }
}

// Utility because the logic files import database.ts that has initDB
import { initDB } from './src/database';
testDuplicateProtection().catch(console.error);
