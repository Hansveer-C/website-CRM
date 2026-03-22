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
    direction: 'inbound' as const,
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

/**
 * End Call (Simulated POST /api/calls/end)
 * 
 * Instructions:
 * - Fetch call by ID
 * - Update status based on answered flag
 * - Log result
 */
export async function endCall(data: { call_id: string; answered: boolean }) {
  if (!data || !data.call_id) {
    throw new Error('call_id is required to end a call.');
  }

  const call = mockCalls.find(c => c.id === data.call_id);
  
  if (!call) {
    const errorMsg = `Call with ID ${data.call_id} not found.`;
    console.error(`[API ERROR] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // PROMPT 7: Prevent duplicate call end handling
  if (call.status === 'answered' || call.status === 'missed') {
    console.log(`Call already processed: ${call.status}`);
    return {
      status: 'ignored',
      callId: call.id,
      currentStatus: call.status,
      message: 'Call already processed'
    };
  }

  // Update status
  call.status = data.answered ? 'answered' : 'missed';
  const timestamp = new Date().toISOString();
  
  // Requirement: Log: "Call ended: answered/missed"
  console.log(`Call ended: ${call.status}`);

  // PROMPT 6: Emit "call_missed" if not answered
  if (!data.answered) {
    await emitEvent('call_missed', {
      phone: call.phone,
      call_id: call.id,
      timestamp
    });
  }

  return {
    status: 'updated',
    callId: call.id,
    newStatus: call.status,
    timestamp
  };
}
