export function shouldShowWebsiteOnboarding(input: {
  alreadySeen: boolean;
  usesSupabase: boolean;
  durableWebsiteCount?: number;
  localFunnelCount?: number;
}): boolean {
  if (input.alreadySeen) return false;
  if (input.usesSupabase) {
    return Number.isInteger(input.durableWebsiteCount) && input.durableWebsiteCount === 0;
  }
  return input.localFunnelCount === 0;
}
