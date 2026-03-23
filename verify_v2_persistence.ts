import { createLead } from './src/leads_logic';
import { getContact } from './src/contacts_repo';
import { getOpportunity } from './src/opportunities_repo';
import { getDB, closeDB, initDB } from './src/database';

async function verifyV2() {
  console.log('================================================');
  console.log('   V2 VERIFICATION: OPPORTUNITY PERSISTENCE      ');
  console.log('================================================\n');

  try {
    const db = initDB();
    const phone = '5552221111';
    const email = 'v2@test.com';

    // Cleanup previous runs
    db.prepare("DELETE FROM contacts WHERE email = ?").run(email);

    console.log('[STEP 1] Creating a new lead & opportunity...');
    const res = await createLead({
        name: 'V2 Opportunity User',
        phone: phone,
        email: email,
        source: 'v2_test'
    });

    const contactId = res.contactId;
    const oppId = res.opportunityId;
    console.log(`   Lead created. Contact: ${contactId}, Opportunity: ${oppId}`);

    // Fetch original state
    const originalOpp = getOpportunity(oppId);
    if (!originalOpp) throw new Error('Original opportunity not found');
    const originalStage = originalOpp.pipeline_stage;

    console.log('\n[STEP 2] Restarting App Simulation...');
    closeDB();
    
    // Simulating reboot
    initDB();

    console.log('\n[STEP 3] Fetching data back and verifying linkage...');
    const reFetchedOpp = getOpportunity(oppId);
    const reFetchedContact = getContact(contactId);

    if (reFetchedOpp && 
        reFetchedOpp.contact_id === contactId && 
        reFetchedOpp.pipeline_stage === originalStage &&
        reFetchedContact && reFetchedContact.id === contactId) {
      
      console.log('✅ PASS: Opportunity persists and maintains relational linkage.');
      console.log('   Verified Data:');
      console.log(`   - Opp ID: ${reFetchedOpp.id} (Matches)`);
      console.log(`   - Linkage: Points to Contact ${reFetchedOpp.contact_id} (Correct)`);
      console.log(`   - Stage: ${reFetchedOpp.pipeline_stage} (Preserved: ${originalStage})`);
    } else {
      throw new Error(`FAIL: Opportunity mission or linkage broken. Found Opp: ${JSON.stringify(reFetchedOpp)}`);
    }

    console.log('\n================================================');
    console.log('   V2 VERDICT: SUCCESS');
    console.log('================================================');

  } catch (err) {
    console.error('\n❌ V2 VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    closeDB();
  }
}

verifyV2().catch(console.error);
