export interface FormSubmissionAttempt {
  key: string;
  signature: string;
  accepted: boolean;
}

export class FormSubmissionIdempotency {
  private readonly attempts = new Map<string, FormSubmissionAttempt>();

  constructor(private readonly createKey: () => string = () => crypto.randomUUID()) {}

  begin(scope: string, payload: unknown): FormSubmissionAttempt {
    const signature = JSON.stringify(payload);
    const current = this.attempts.get(scope);
    if (current && !current.accepted && current.signature === signature) return current;
    const attempt = { key: this.createKey(), signature, accepted: false };
    this.attempts.set(scope, attempt);
    return attempt;
  }

  accept(scope: string, key: string): void {
    const current = this.attempts.get(scope);
    if (current?.key === key) current.accepted = true;
  }
}
