import { createLead } from './src/leads_logic';
import { getContact } from './src/contacts_repo';
import { getOpportunitiesByContact } from './src/opportunities_repo';
import { getDB, closeDB, initDB } from './src/database';

async function testE2EDBFlow() {
  console.log('================================================');
  console.log('   CRM DB MIGRATION VERIFICATION - E2E TEST     ');
  console.log('================================================\n');

  try {
    const db = initDB();
    const uniqueEmail = `e2e-${Date.now()}@test.com`;
    const uniquePhone = `999${Math.floor(Math.random() * 899999 + 100000)}`;

    console.log('[STEP 1] Running createLead()...');
    const res = await createLead({
        name: 'E2E Persistence User',
        phone: uniquePhone,
        email: uniqueEmail,
        address: '456 DB Lane',
        source: 'e2e_verification'
    });

    console.log(`   Contact Created: ${res.contactId}`);
    console.log(`   Opportunity Created: ${res.opportunityId}`);

    console.log('\n[STEP 2] Verifying Contact in SQLite...');
    const contact = getContact(res.contactId);
    console.log('   Fetched Contact:', JSON.stringify(contact));
    if (contact && contact.email === uniqueEmail) {
        console.log('✅ PASS: Contact found in database with correct email.');
    } else {
        throw new Error(`FAIL: Contact not found in DB or email mismatch. Expected: ${uniqueEmail}, Got: ${contact?.email}`);
    }

    console.log('\n[STEP 3] Verifying Opportunity in SQLite...');
    const opps = getOpportunitiesByContact(res.contactId);
    const mainOpp = opps.find(o => o.id === res.opportunityId);
    if (mainOpp && mainOpp.contact_id === res.contactId) {
        console.log('✅ PASS: Opportunity found in database and correctly linked.');
    } else {
        throw new Error(`FAIL: Opportunity not found or linkage broken.`);
    }

    console.log('\n[STEP 4] Restarting DB Simulation...');
    closeDB();
    initDB();
    
    const reFetchedContact = getContact(res.contactId);
    if (reFetchedContact) {
        console.log('✅ PASS: Persistence surviving "restart".');
    } else {
        throw new Error(`FAIL: Persistence lost after restart.`);
    }

    console.log('\n================================================');
    console.log('   OVERALL RESULT: SUCCESS');
    console.log('================================================');

  } catch (err) {
    console.error('\n❌ E2E FLOW TEST FAILED:', err);
    process.exit(1);
  } finally {
    closeDB();
  }
}

testE2EDBFlow().catch(console.error);
