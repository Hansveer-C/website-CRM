import { describe, expect, it, vi } from 'vitest';
import { FormSubmissionIdempotency } from './form_submission_idempotency';

describe('FormSubmissionIdempotency', () => {
  it('reuses one key for transport retries of the same logical submission', () => {
    const createKey = vi.fn(() => '11111111-1111-4111-8111-111111111111');
    const attempts = new FormSubmissionIdempotency(createKey);
    expect(attempts.begin('builder:form-1', { name: 'Lead' }).key)
      .toBe(attempts.begin('builder:form-1', { name: 'Lead' }).key);
    expect(createKey).toHaveBeenCalledTimes(1);
  });

  it('uses a new key after acceptance for a new intentional submission', () => {
    const keys = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
    const attempts = new FormSubmissionIdempotency(() => keys.shift()!);
    const first = attempts.begin('preview:form-1', { name: 'Lead' });
    attempts.accept('preview:form-1', first.key);
    expect(attempts.begin('preview:form-1', { name: 'Lead' }).key).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('uses a new key when the payload changes before acceptance', () => {
    const keys = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
    const attempts = new FormSubmissionIdempotency(() => keys.shift()!);
    attempts.begin('builder:form-1', { message: 'one' });
    expect(attempts.begin('builder:form-1', { message: 'two' }).key).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('keeps Builder and Preview attempts independent', () => {
    let sequence = 0;
    const attempts = new FormSubmissionIdempotency(() => `key-${++sequence}`);
    expect(attempts.begin('builder:form-1', {}).key).not.toBe(attempts.begin('preview:form-1', {}).key);
  });
});
