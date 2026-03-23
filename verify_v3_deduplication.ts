import { createLead } from './src/leads_logic';
import { getDB, closeDB, initDB } from './src/database';

async function verifyV3() {
  console.log('================================================');
  console.log('   V3 VERIFICATION: DUPLICATE PROTECTION         ');
  console.log('================================================\n');

  try {
    const db = initDB();
    const phone = '5553330000';
    const email = 'v3@test.com';

    // Cleanup previous runs
    db.prepare("DELETE FROM contacts WHERE email = ?").run(email);
    db.prepare("DELETE FROM opportunities WHERE source = 'v3_test'").run();

    console.log('[STEP 1] Submitting first lead...');
    const res1 = await createLead({
        name: 'V3 First User',
        phone: phone,
        email: email,
        source: 'v3_test'
    });
    console.log(`   Lead 1 Created. Contact: ${res1.contactId}`);

    console.log('\n[STEP 2] Submitting second lead (Duplicate phone/email)...');
    try {
        const res2 = await createLead({
            name: 'V3 Second User', // Attempting to "overwrite" or create new
            phone: phone,
            email: email,
            source: 'v3_test'
        });
        console.log(`   Lead 2 Created (Unexpected!): ${res2.contactId}`);
    } catch (e) {
        if (e.message.includes('Duplicate submission window')) {
            console.log('   ✅ PASS: Duplicate submission detected & blocked by rate-limit.');
        } else {
            throw e;
        }
    }

    console.log('\n[STEP 3] Inspecting Database...');
    const contactCount = db.prepare("SELECT count(*) as total FROM contacts WHERE email = ?").get(email) as any;
    const oppCount = db.prepare("SELECT count(*) as total FROM opportunities WHERE contact_id = ?").get(res1.contactId) as any;

    if (contactCount.total === 1 && oppCount.total === 1) {
      console.log('✅ PASS: Persistent deduplication works.');
      console.log(`   - Contacts found: ${contactCount.total} (Correct)`);
      console.log(`   - Opportunities found for this contact: ${oppCount.total} (Correct)`);
    } else {
      throw new Error(`FAIL: Duplicates found. Contacts: ${contactCount.total}, Opps: ${oppCount.total}`);
    }

    console.log('\n================================================');
    console.log('   V3 VERDICT: SUCCESS');
    console.log('================================================');

  } catch (err) {
    console.error('\n❌ V3 VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    closeDB();
  }
}

verifyV3().catch(console.error);
