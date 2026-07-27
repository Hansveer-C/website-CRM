import { normalizePhone } from './utils/validators';

interface BrowserCallRecord {
  id: string;
  phone: string;
  status: 'received' | 'answered' | 'missed';
  createdAt: string;
}

export interface BrowserCallSimulator {
  receive(input: { phone?: unknown }): Record<string, unknown>;
  end(input: { call_id?: unknown; answered?: unknown }): Record<string, unknown>;
}

export function createBrowserCallSimulator(
  now: () => Date = () => new Date(),
  id: () => string = () => crypto.randomUUID()
): BrowserCallSimulator {
  const calls = new Map<string, BrowserCallRecord>();
  return {
    receive(input) {
      if (typeof input.phone !== 'string' || input.phone.trim() === '') {
        throw new Error('Phone number is required for inbound call.');
      }
      const phone = normalizePhone(input.phone).normalized;
      const createdAt = now().toISOString();
      const call: BrowserCallRecord = { id: `call-${id()}`, phone, status: 'received', createdAt };
      calls.set(call.id, call);
      return { status: call.status, phone, callId: call.id, timestamp: createdAt };
    },
    end(input) {
      if (typeof input.call_id !== 'string' || input.call_id.trim() === '') {
        throw new Error('call_id is required to end a call.');
      }
      const call = calls.get(input.call_id);
      if (!call) throw new Error(`Call with ID ${input.call_id} not found.`);
      if (call.status !== 'received') {
        return {
          status: 'ignored', callId: call.id, currentStatus: call.status,
          message: 'Call already processed'
        };
      }
      call.status = input.answered === true ? 'answered' : 'missed';
      return {
        status: 'updated', callId: call.id, newStatus: call.status,
        timestamp: now().toISOString()
      };
    }
  };
}
