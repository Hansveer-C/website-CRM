import { createLead } from './leads_logic';
import { mockMessages } from './db';
import { twilioConfig } from './config';
import { smsService } from './smsService';

async function testSMSFailure() {
  console.log('=== Testing SMS Failure Handling ===');

  // 1. Force Twilio credentials to be "configured"
  const oldConfig = { ...twilioConfig };
  twilioConfig.account_sid = 'test_sid';
  twilioConfig.auth_token = 'test_token';
  twilioConfig.sending_phone_number = '+15555555555';

  // Mock smsService to simulate a Twilio API failure
  const originalSend = smsService.sendSMS;
  smsService.sendSMS = async () => {
    return {
      success: false,
      error: 'Unauthorized'
    } as any;
  };

  const initialMsgCount = mockMessages.length;

  const testPayload = {
    name: "Failure John",
    phone: "+16040001111",
    email: "fail@test.com",
    source: "api"
  };

  console.log('--- Step 1: Submit lead (triggers automated SMS) ---');
  try {
    const result = await createLead(testPayload);
    console.log('Lead creation result:', result);

    // Give the event system a moment to run the automation
    await new Promise(resolve => setTimeout(resolve, 100));

    // 2. Verify Message records
    const latestMessage = mockMessages[mockMessages.length - 1];

    console.log('--- Step 2: Verifying message failure state ---');
    
    if (!latestMessage) throw new Error('No message was created in DB');
    
    console.log(`Latest Message: [${latestMessage.status}] ${latestMessage.content}`);
    
    if (latestMessage.status === 'failed') {
      console.log('✅ Message correctly marked as "failed"');
    } else {
      throw new Error(`FAILURE: Message status is "${latestMessage.status}", expected "failed"`);
    }

    if (latestMessage.retryable === true) {
      console.log('✅ Message correctly marked as "retryable"');
    } else {
      throw new Error(`FAILURE: Message retryable is "${latestMessage.retryable}", expected "true"`);
    }

    console.log('\n✅ FAILURE TEST PASSED: System handled SMS failure gracefully.');

  } catch (err: any) {
    console.error('\n❌ FAILURE TEST FAILED:', err.message);
    process.exit(1);
  } finally {
    global.fetch = originalFetch;
  }
}

testSMSFailure().catch(console.error);
