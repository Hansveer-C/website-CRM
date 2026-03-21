import { sendMessageToContact, retryMessage, dispatchSMS } from './src/sms';
import { mockMessages, mockContacts } from './src/db';
import { twilioConfig } from './src/config';

async function runTests() {
  console.log("=== Debugging Phase 1.4 ===");
  
  // Set up a mock contact
  mockContacts.push({
    id: 'test-c1',
    name: 'Test Contact',
    phone: '+15550001111',
    email: 'test@example.com',
    source: 'test',
    status: 'lead',
    created_at: new Date().toISOString()
  } as any);

  // Mock fetch to avoid real Twilio calls
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    return {
      ok: true,
      json: async () => ({ sid: 'SM' + Math.random().toString(36).substring(7) })
    } as any;
  };

  // Ensure twilio config doesn't block
  twilioConfig.account_sid = 'test_sid';
  twilioConfig.auth_token = 'test_token';
  twilioConfig.sending_phone_number = '+15550002222';

  console.log("\n--- Testing Basic Send ---");
  const res1 = await sendMessageToContact('test-c1', 'Hello World 1');
  console.log("Result:", res1.success ? '✅ Success' : '❌ Failed', res1);

  // Test Duplicate Check
  console.log("\n--- Testing Duplicate Check ---");
  const res2 = await sendMessageToContact('test-c1', 'Hello World 1');
  console.log("Duplicate Result (Should Fail):", !res2.success ? '✅ Success' : '❌ Failed', res2.error);

  // Test Rate Limiting
  console.log("\n--- Testing Rate Limiting ---");
  await sendMessageToContact('test-c1', 'Hello World 2');
  await sendMessageToContact('test-c1', 'Hello World 3');
  const res5 = await sendMessageToContact('test-c1', 'Hello World 4');
  console.log("Rate Limit Result (Should Fail):", !res5.success ? '✅ Success' : '❌ Failed', res5.error);

  // Test Retry Logic
  console.log("\n--- Testing Retry Logic ---");
  
  // Create a failed message manually
  mockMessages.push({
    id: 'msg-failed-test',
    contact_id: 'test-c1',
    direction: 'outbound',
    type: 'sms',
    content: 'Retry this message',
    status: 'failed',
    retryable: true,
    created_at: new Date().toISOString()
  });

  const retryRes = await retryMessage('msg-failed-test');
  console.log("Retry Result (Should Succeed):", retryRes.success ? '✅ Success' : '❌ Failed', retryRes);
  const updatedMsg = mockMessages.find(m => m.id === 'msg-failed-test');
  console.log("Updated Message State:", updatedMsg?.status === 'sent' && updatedMsg?.retryable === false ? '✅ Correct' : '❌ Incorrect', updatedMsg);

  // Restore
  global.fetch = originalFetch;
}

runTests().catch(console.error);
