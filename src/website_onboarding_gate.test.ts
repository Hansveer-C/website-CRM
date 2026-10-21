import { describe, expect, it } from 'vitest';
import { shouldShowWebsiteOnboarding, websiteOnboardingDeferralKey } from './website_onboarding_gate';

describe('website onboarding eligibility', () => {
  it('honors a separate browser deferral without marking website setup complete', () => {
    expect(shouldShowWebsiteOnboarding({ alreadySeen: false, deferred: true, usesSupabase: true, durableWebsiteCount: 0 })).toBe(false);
    expect(shouldShowWebsiteOnboarding({ alreadySeen: false, deferred: true, usesSupabase: false, localFunnelCount: 0 })).toBe(false);
  });

  it('scopes deferral to the exact account', () => {
    expect(websiteOnboardingDeferralKey('owner-a')).not.toBe(websiteOnboardingDeferralKey('owner-b'));
    expect(websiteOnboardingDeferralKey('owner/a')).not.toBe(websiteOnboardingDeferralKey('owner%2Fa'));
  });
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
