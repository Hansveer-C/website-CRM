import { createLead } from './leads_logic';
import { mockContacts, mockOpportunities, mockMessages } from './db';

async function testMissingPhone() {
  console.log('=== Testing Missing Phone Edge Case ===');

  const initialMsgCount = mockMessages.length;

  const testPayload = {
    name: "John No-Phone",
    email: "john_no_phone@test.com",
    source: "api"
    // phone is intentionally omitted
  };

  console.log('--- Step 1: Submit lead without phone ---');
  try {
    const result = await createLead(testPayload);
    console.log('Result:', result);

    // 1. Verify Contact Creation
    const contact = mockContacts.find(c => c.id === result.contactId);
    if (contact) {
      console.log('✅ Contact created successfully:', contact.name);
    } else {
      throw new Error('Contact not created');
    }

    // 2. Verify Opportunity Creation
    const opportunity = mockOpportunities.find(o => o.id === result.opportunityId);
    if (opportunity) {
      console.log('✅ Opportunity created successfully:', opportunity.id);
    } else {
      throw new Error('Opportunity not created');
    }

    // 3. Verify No SMS sent
    // Wait for event system (synchronous in events.ts but safety first)
    const smsSentCount = mockMessages.length - initialMsgCount;

    if (smsSentCount === 0) {
      console.log('✅ No SMS was sent as expected.');
    } else {
      throw new Error(`FAILURE: ${smsSentCount} SMS messages were sent when none were expected.`);
    }

    console.log('\n✅ EDGE CASE TEST PASSED: System handled missing phone safely.');

  } catch (err: any) {
    console.error('\n❌ EDGE CASE TEST FAILED:', err.message);
    process.exit(1);
  }
}

testMissingPhone().catch(console.error);
