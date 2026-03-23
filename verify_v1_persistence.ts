import { createLead } from './src/leads_logic';
import { getContact } from './src/contacts_repo';
import { getDB, closeDB, initDB } from './src/database';

async function verifyV1() {
  console.log('================================================');
  console.log('   V1 VERIFICATION: CONTACT PERSISTENCE TEST     ');
  console.log('================================================\n');

  try {
    const db = initDB();
    const phone = '5551110000';
    const email = 'v1@test.com';

    // Cleanup previous runs
    db.prepare('DELETE FROM contacts WHERE email = ?').run(email);

    console.log('[STEP 1] Creating a new lead...');
    const res = await createLead({
        name: 'V1 Persistence User',
        phone: phone,
        email: email,
        source: 'v1_test'
    });

    const contactId = res.contactId;
    console.log(`   Lead created. Contact ID: ${contactId}`);

    // Fetch original state
    const original = getContact(contactId);
    if (!original) throw new Error('Original contact not found');
    const originalPhone = original.phone;
    const originalCreated = original.created_at;

    console.log('\n[STEP 2] Restarting App Simulation (Closing/Re-opening DB)...');
    closeDB();
    
    // Simulate some "wait" time or just re-init
    initDB();

    console.log('\n[STEP 3] Fetching data back...');
    const reFetched = getContact(contactId);

    if (reFetched && 
        reFetched.id === contactId && 
        reFetched.phone === originalPhone && 
        reFetched.created_at === originalCreated) {
      console.log('✅ PASS: Contact survives restart exactly as created.');
      console.log('   Verified Data:');
      console.log(`   - ID: ${reFetched.id} (Matches)`);
      console.log(`   - Phone: ${reFetched.phone} (Matches: ${originalPhone})`);
      console.log(`   - Created At: ${reFetched.created_at} (Matches: ${originalCreated})`);
    } else {
      throw new Error(`FAIL: Data mismatch or missing after restart. Found: ${JSON.stringify(reFetched)}`);
    }

    console.log('\n================================================');
    console.log('   V1 VERDICT: SUCCESS');
    console.log('================================================');

  } catch (err) {
    console.error('\n❌ V1 VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    closeDB();
  }
}

verifyV1().catch(console.error);
