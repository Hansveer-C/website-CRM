// d:\Website-CRM\test_sms_template.ts
import { getMissedCallReply } from './src/sms';

function testTemplates() {
  console.log('=== Test: Missed Call SMS Template ===');

  // Case 1: Known Name
  const contact1 = { name: 'John Doe' };
  const res1 = getMissedCallReply(contact1);
  console.log(`Input: "John Doe" -> Output: "${res1}"`);
  if (res1 === 'Hey John Doe, sorry I missed your call. How can I help?') {
    console.log('✅ Case 1 Passed');
  } else {
    console.error('❌ Case 1 Failed');
  }

  // Case 2: Unknown Caller
  const contact2 = { name: 'Unknown Caller' };
  const res2 = getMissedCallReply(contact2);
  console.log(`Input: "Unknown Caller" -> Output: "${res2}"`);
  if (res2 === 'Hey, sorry I missed your call. How can I help?') {
    console.log('✅ Case 2 Passed');
  } else {
    console.error('❌ Case 2 Failed');
  }

  // Case 3: Empty Name
  const contact3 = { name: '' };
  const res3 = getMissedCallReply(contact3);
  console.log(`Input: "" -> Output: "${res3}"`);
  if (res3 === 'Hey, sorry I missed your call. How can I help?') {
    console.log('✅ Case 3 Passed');
  } else {
    console.error('❌ Case 3 Failed');
  }

  console.log('\n🌟 Template testing complete.');
}

testTemplates();
