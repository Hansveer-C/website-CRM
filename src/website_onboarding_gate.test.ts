import { describe, expect, it } from 'vitest';
import { shouldShowWebsiteOnboarding } from './website_onboarding_gate';

describe('website onboarding eligibility', () => {
  it('does not show onboarding for an account with a durable website', () => {
    expect(shouldShowWebsiteOnboarding({ alreadySeen: false, usesSupabase: true, durableWebsiteCount: 1 })).toBe(false);
  });

  it('shows onboarding for a production account with no durable website', () => {
    expect(shouldShowWebsiteOnboarding({ alreadySeen: false, usesSupabase: true, durableWebsiteCount: 0 })).toBe(true);
  });

  it('fails closed while the durable repository is unavailable', () => {
    expect(shouldShowWebsiteOnboarding({ alreadySeen: false, usesSupabase: true })).toBe(false);
  });

  it('preserves local funnel onboarding behavior and the completion flag', () => {
    expect(shouldShowWebsiteOnboarding({ alreadySeen: false, usesSupabase: false, localFunnelCount: 0 })).toBe(true);
    expect(shouldShowWebsiteOnboarding({ alreadySeen: true, usesSupabase: false, localFunnelCount: 0 })).toBe(false);
  });
});
