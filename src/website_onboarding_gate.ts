export function websiteOnboardingDeferralKey(userId: string): string {
  return `washops:website-onboarding-deferred:${encodeURIComponent(userId)}`;
}

export function shouldShowWebsiteOnboarding(input: {
  alreadySeen: boolean;
  deferred?: boolean;
  usesSupabase: boolean;
  durableWebsiteCount?: number;
  localFunnelCount?: number;
}): boolean {
  if (input.alreadySeen || input.deferred) return false;
  if (input.usesSupabase) {
    return Number.isInteger(input.durableWebsiteCount) && input.durableWebsiteCount === 0;
  }
  return input.localFunnelCount === 0;
}
