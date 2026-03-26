import { normalizePhone } from './utils/normalization';
import { emitEvent } from './events';
import { persistCall, getCall } from './calls_repo';
import { resolveContactOwnerByPhone } from './contacts_repo';
import { Call } from './types';

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
  const contactOwnerId = await resolveContactOwnerByPhone(phoneNorm.normalized);

  const callRecord: Call = {
    id: `call-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user_id: contactOwnerId || 'system',
    phone: phoneNorm.normalized,
    direction: 'inbound',
    status: 'received',
    created_at: timestamp
  };
  await persistCall(callRecord);


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
 */
export async function endCall(data: { call_id: string; answered: boolean }, user?: any) {
  if (!data || !data.call_id) {
    throw new Error('call_id is required to end a call.');
  }

  const res = await getCall(data.call_id, user);
  
  if (!res.success || !res.data) {
    const errorMsg = `Call with ID ${data.call_id} not found or access denied.`;
    console.error(`[API ERROR] ${errorMsg}`);
    throw new Error(errorMsg);
  }
  const call = res.data;

  // Prevent duplicate call end handling
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
  call.duration = data.answered ? 60 : 0; 
  await persistCall(call);

  console.log(`Call ended: ${call.status}`);

  if (!data.answered) {
    await emitEvent('call_missed', {
      phone: call.phone,
      call_id: call.id,
      timestamp: new Date().toISOString()
    });
  }

  return {
    status: 'updated',
    callId: call.id,
    newStatus: call.status,
    timestamp: new Date().toISOString()
  };
}
