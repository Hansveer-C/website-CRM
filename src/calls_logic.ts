import { normalizePhone } from './leads_logic';
import { emitEvent } from './events';
import { mockCalls } from './db';

/**
 * Handle Inbound Call (Simulated POST /api/calls/inbound)
 * 
 * Instructions:
 * - Validate phone exists
 * - Normalize phone format (reuse Phase 1.1 logic)
 * - Log: "Inbound call received from [phone]"
 * 
 * PROMPT 2: Emit "call_received" event
 * PROMPT 3: Persist inbound call record
 */
export async function handleInboundCall(data: { phone: string }) {
  if (!data || !data.phone) {
    const errorMsg = 'Phone number is required for inbound call.';
    console.error(`[API ERROR] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const phoneNorm = normalizePhone(data.phone);
  const timestamp = new Date().toISOString();
  
  // Log message as exactly specified in prompt
  console.log(`Inbound call received from ${phoneNorm.normalized}`);

  // Create call record (PROMPT 3)
  const callRecord = {
    id: `call-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    phone: phoneNorm.normalized,
    status: 'received' as const,
    created_at: timestamp
  };
  mockCalls.push(callRecord);

  // Emit "call_received" event
  await emitEvent('call_received', {
    phone: phoneNorm.normalized,
    source: 'mock_call',
    timestamp
  });

  return {
    status: 'received',
    phone: phoneNorm.normalized,
    callId: callRecord.id, // Helpful to return the record ID
    timestamp
  };
}
