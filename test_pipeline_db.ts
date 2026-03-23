import { getOpportunitiesByContact, persistOpportunity } from './src/opportunities_repo';
import { getDB, closeDB, initDB } from './src/database';
import { Opportunity } from './src/types';

async function testPipelinePersistence() {
  console.log('--- DB-Backed Pipeline Lookup Test ---');
  const contactId = 'c-pipe-test';
  
  try {
    const db = initDB();
    
    // Ensure contact exists
    db.prepare('DELETE FROM contacts WHERE id = ?').run(contactId);
    db.prepare("INSERT INTO contacts (id, name, created_at) VALUES (?, ?, ?)").run(contactId, 'Pipeline User', new Date().toISOString());

    // 1. Create multiple opportunities
    console.log('   Creating 2 opportunities for the same contact...');
    const opp1: Opportunity = {
        id: 'o-pipe-1',
        contact_id: contactId,
        pipeline_stage: 'New Lead',
        status: 'open',
        value: 100,
        created_at: new Date().toISOString()
    };
    const opp2: Opportunity = {
        id: 'o-pipe-2',
        contact_id: contactId,
        pipeline_stage: 'Quote Sent',
        status: 'open',
        value: 500,
        created_at: new Date().toISOString()
    };
    persistOpportunity(opp1);
    persistOpportunity(opp2);

    console.log('--- Restarting DB Simulation ---');
    closeDB();
    initDB();

    console.log('   Querying pipeline (opportunities for contact)...');
    const pipeline = getOpportunitiesByContact(contactId);
    
    if (pipeline.length === 2) {
      console.log('✅ PASS: Pipeline lookup correctly returned 2 persistent opportunities.');
      console.log('   Items found:', pipeline.map(o => `${o.id}: ${o.pipeline_stage}`));
    } else {
      throw new Error(`FAIL: Expected 2 opportunities, found ${pipeline.length}`);
    }

  } catch (err) {
    console.error('❌ Pipeline Test Failed:', err);
    process.exit(1);
  } finally {
    closeDB();
  }
}

testPipelinePersistence().catch(console.error);
