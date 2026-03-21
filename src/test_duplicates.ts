import { createLead } from './leads_logic';
import { mockContacts, mockOpportunities, mockMessages } from './db';

async function testDuplicates() {
  console.log('=== Testing Duplicate Lead Submission ===');

  const testPayload = {
    name: "John Duplicate",
    phone: "+16041112222",
    email: "john_dup@test.com",
    source: "website"
  };

  const initialContacts = mockContacts.length;
  const initialOpps = mockOpportunities.length;
  const initialMsgs = mockMessages.length;

  console.log('--- Step 1: Submit first lead (Success) ---');
  try {
    const res1 = await createLead(testPayload);
    console.log('Submission 1 success:', res1.contactId);

    console.log('--- Step 2: Submit same lead immediately (Expect failure/block) ---');
    try {
      await createLead(testPayload);
      console.error('❌ FAILURE: Second submission should have been blocked');
    } catch (err: any) {
      console.log('✅ Correctly blocked second submission:', err.message);
    }

    console.log('--- Step 3: Submit same lead again (Expect failure/block) ---');
    try {
      await createLead(testPayload);
      console.error('❌ FAILURE: Third submission should have been blocked');
    } catch (err: any) {
      console.log('✅ Correctly blocked third submission:', err.message);
    }

    // Give the event system a moment for the SMS automation
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('--- Step 4: Final Verification ---');
    
    const contactCount = mockContacts.length - initialContacts;
    const oppCount = mockOpportunities.length - initialOpps;
    const msgCount = mockMessages.length - initialMsgs;

    console.log(`Contacts Created: ${contactCount}`);
    console.log(`Opportunities Created: ${oppCount}`);
    console.log(`SMS Sent: ${msgCount}`);

    if (contactCount === 1 && oppCount === 1 && msgCount === 1) {
      console.log('\n✅ DUPLICATE TEST PASSED: No duplicate records or spam SMS.');
    } else {
      throw new Error(`FAILURE: Stats incorrect. C:${contactCount}, O:${oppCount}, M:${msgCount}`);
    }

  } catch (err: any) {
    console.error('\n❌ DUPLICATE TEST FAILED:', err.message);
    process.exit(1);
  }
}

testDuplicates().catch(console.error);
