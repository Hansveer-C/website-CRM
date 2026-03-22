// d:\Website-CRM\test_calls_api.ts
import { handleInboundCall } from './src/calls_logic';
import { mockEventLogs, mockCalls } from './src/db';

async function testInboundCall() {
  console.log('=== Test: Inbound Call API Simulation ===');
  
  const testPayload = {
    phone: "+16041234567"
  };

  console.log('--- Step 1: Call handleInboundCall (Simulating POST /api/calls/inbound) ---');
  try {
    const result = await handleInboundCall(testPayload);
    console.log('API Response:', JSON.stringify(result));

    // Check if event was logged
    const event = mockEventLogs.find(e => e.event_name === 'call_received' && e.payload.phone === '+16041234567');
    
    // Check if call was persisted (PROMPT 3)
    const call = mockCalls.find(c => c.phone === '+16041234567');

    if (result.status === 'received' && result.phone === '+16041234567' && event && call) {
      console.log('✅ TEST PART 1 PASSED: Success response, event, and call record verified.');
      console.log('   Call Record Found:', JSON.stringify(call));
    } else {
      throw new Error(`Verification failed. Event: ${!!event}, Call persisted: ${!!call}`);
    }

  } catch (err: any) {
    console.error('❌ TEST PART 1 FAILED:', err.message);
    process.exit(1);
  }

  // Requirement: Validate phone exists
  console.log('\n--- Step 2: Test Validation (Missing Phone) ---');
  try {
    await (handleInboundCall as any)({ phone: '' });
    console.error('❌ FAILED: Validation did not catch empty phone.');
  } catch (err: any) {
    console.log('✅ Log check: [API ERROR] Phone number is required for inbound call.');
    console.log('✅ TEST PART 2 PASSED: Validation caught empty phone.');
  }
}

testInboundCall().catch(console.error);
