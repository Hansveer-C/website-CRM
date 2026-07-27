import { createLead } from './leads_logic';
import { mockContacts, mockOpportunities } from './db';
import { mockEventLogs } from './event_logs_repo';

async function testLeadCreationE2E() {
  console.log('=== End-to-End Lead Creation Test ===');

  const testPayload = {
    name: "John Test",
    phone: "+16041234567",
    email: "john@test.com",
    source: "api"
  };

  console.log('--- Step 1: Call createLead (Simulating POST /api/leads) ---');
  try {
    const result = await createLead(testPayload);
    console.log('Result:', result);

    // Verify DB side effects
    const contact = mockContacts.find(c => c.id === result.contactId);
    const opportunity = mockOpportunities.find(o => o.id === result.opportunityId);
    const event = mockEventLogs.find(e => e.event_name === 'lead_created' && e.payload.contact_id === result.contactId);

    console.log('--- Step 2: Verifying records ---');
    
    if (!contact) throw new Error('Contact was not created in DB');
    console.log('✅ Contact found:', contact.name);

    if (!opportunity) throw new Error('Opportunity was not created in DB');
    console.log('✅ Opportunity found:', opportunity.id);

    if (opportunity.contact_id !== contact.id) throw new Error('contact_id mismatch');
    console.log('✅ contact_id matches successfully');

    if (!event) throw new Error('lead_created event was not logged');
    console.log('✅ lead_created event logged successfully');

    console.log('\n✅ E2E TEST PASSED: Full pipeline executed correctly.');

  } catch (err: any) {
    console.error('\n❌ E2E TEST FAILED:', err.message);
    process.exit(1);
  }
}

testLeadCreationE2E().catch(console.error);
