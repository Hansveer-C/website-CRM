import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(fileURLToPath(new URL('./main.ts', import.meta.url)), 'utf8');

describe('application authentication UI characterization', () => {
  it('renders both authentication modes with explicit password controls', () => {
    expect(mainSource).toContain("type ApplicationAuthViewMode = 'sign-in' | 'create-account'");
    expect(mainSource).toContain('Create an account');
    expect(mainSource).toContain('Already have an account?');
    expect(mainSource).toContain('autocomplete="new-password"');
    expect(mainSource).toContain('Confirm password');
  });

  it('clears password controls on mode changes and after signup submission', () => {
    expect(mainSource).toContain("renderApplicationLogin(safeReturnTo, undefined, creatingAccount ? 'sign-in' : 'create-account')");
    expect(mainSource).toContain("if (passwordInput) passwordInput.value = ''");
    expect(mainSource).toContain("if (confirmPasswordInput) confirmPasswordInput.value = ''");
  });

  it('uses a restrained confirmation state without browser dialogs', () => {
    expect(mainSource).toContain('Check your email to confirm your account.');
    expect(mainSource).toContain('aria-live="polite"');
    const loginSource = mainSource.slice(
      mainSource.indexOf('type ApplicationAuthViewMode'),
      mainSource.indexOf('(window as any).retryApplicationBootstrap')
    );
    expect(loginSource).not.toMatch(/\b(?:alert|prompt|confirm)\s*\(/);
  });

  it('distinguishes credential rejection, unconfirmed email, and transient service failure', () => {
    expect(mainSource).toContain('The email or password is incorrect.');
    expect(mainSource).toContain('Confirm your email address before signing in.');
    expect(mainSource).toContain('Sign-in is temporarily unavailable. Please try again.');
  });
});
