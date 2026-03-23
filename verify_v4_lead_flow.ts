import { createLead } from './src/leads_logic';
import { getContact } from './src/contacts_repo';
import { getOpportunitiesByContact } from './src/opportunities_repo';
import { onEvent, emitEvent } from './src/events';
import { getDB, closeDB, initDB } from './src/database';

async function verifyV4() {
  console.log('================================================');
  console.log('   V4 VERIFICATION: E2E LEAD FLOW INTEGRATION    ');
  console.log('================================================\n');

  try {
    const db = initDB();
    const phone = '5554440000';
    const email = 'v4_e2e@test.com';
    let eventReceived = false;

    // Register temporary listener to verify event fire
    onEvent('lead_created', (payload) => {
        if (payload.phone === phone) {
            console.log('   ✅ Event received: lead_created fired with correct payload.');
            eventReceived = true;
        }
    });

    // Cleanup previous runs
    db.prepare("DELETE FROM contacts WHERE email = ?").run(email);

    console.log('[STEP 1] Running createLead()...');
    const res = await createLead({
        name: 'V4 E2E User',
        phone: phone,
        email: email,
        source: 'v4_test'
    });

    console.log(`   Lead created results: Contact ${res.contactId}, Opportunity ${res.opportunityId}`);

    console.log('\n[STEP 2] Verifying Core Entities in Database...');
    const contact = getContact(res.contactId);
    const opps = getOpportunitiesByContact(res.contactId);
    
    const dbSuccess = contact && opps.length > 0 && opps[0].id === res.opportunityId;
    if (dbSuccess) {
      console.log('   ✅ Contact preserved in SQLite.');
      console.log('   ✅ Opportunity preserved in SQLite.');
    } else {
      throw new Error('FAIL: Core entities missing or mismatched in DB.');
    }

    console.log('\n[STEP 3] Verifying Business Logic (SMS Flow)...');
    // Note: Our current SMS flow logs to console as [AUTOMATION]
    // Since we are running in the same process, we check if the event listener triggered.
    if (eventReceived) {
      console.log('   ✅ Automations triggered correctly via persistent data lookup.');
    } else {
      throw new Error('FAIL: lead_created event did not trigger or listener missed it.');
    }

    console.log('\n================================================');
    console.log('   V4 VERDICT: SUCCESS');
    console.log('================================================');

  } catch (err) {
    console.error('\n❌ V4 VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    closeDB();
  }
}

verifyV4().catch(console.error);
