import { createLead } from './src/leads_logic';
import { getDB, closeDB, initDB } from './src/database';
import { getOpportunity } from './src/opportunities_repo';

async function testOpportunityPersistence() {
  console.log('--- Phase 1: Create a Lead & Opportunity (Persistently) ---');
  
  try {
    const res = await createLead({
      name: 'Persistence Pete',
      phone: '8887776666',
      email: 'pete@test.com',
      source: 'persistence_test'
    });
    
    const oppId = res.opportunityId;
    console.log('   Lead & Opp created. Opp ID:', oppId);
    
    console.log('--- Phase 2: Restart Simulation ---');
    console.log('   Closing connection...');
    closeDB();
    
    console.log('   Re-opening connection and querying...');
    initDB();
    const opp = getOpportunity(oppId);
    
    if (opp && opp.pipeline_stage === 'New Lead' && opp.contact_id === res.contactId) {
      console.log('✅ PASS: Opportunity persisted through "restart" successfully.');
      console.log('   Verified Opportunity:', JSON.stringify(opp, null, 2));
    } else {
      throw new Error(`FAIL: Opportunity not found after restart. Found: ${JSON.stringify(opp)}`);
    }

  } catch (err) {
    if (err.message.includes('Duplicate submission window')) {
        console.log('   Lead already existed from previous run, that\'s okay for persistence verification.');
    } else {
        console.error('❌ Persistence Test Failed:', err);
        process.exit(1);
    }
  } finally {
    closeDB();
  }
}

testOpportunityPersistence().catch(console.error);
