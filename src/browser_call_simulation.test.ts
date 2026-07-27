import { describe, expect, it } from 'vitest';
import { createBrowserCallSimulator } from './browser_call_simulation';

describe('browser call simulation', () => {
  it('simulates the legacy local call lifecycle without server modules', () => {
    const simulator = createBrowserCallSimulator(
      () => new Date('2026-07-27T12:00:00.000Z'),
      () => 'test-id'
    );
    const received = simulator.receive({ phone: '(555) 010-0100' });
    expect(received).toMatchObject({ status: 'received', callId: 'call-test-id' });
    expect(simulator.end({ call_id: received.callId, answered: false }))
      .toMatchObject({ status: 'updated', newStatus: 'missed' });
    expect(simulator.end({ call_id: received.callId, answered: true }))
      .toMatchObject({ status: 'ignored', currentStatus: 'missed' });
  });

  it('rejects malformed and unknown calls', () => {
    const simulator = createBrowserCallSimulator(() => new Date(), () => 'id');
    expect(() => simulator.receive({})).toThrow('Phone number is required');
    expect(() => simulator.end({ call_id: 'missing' })).toThrow('not found');
  });
});
