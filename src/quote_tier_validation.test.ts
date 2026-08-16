import { describe, expect, it } from 'vitest';
import { validateSelectedQuoteTier } from './quote_tier_validation';

const item = (tier: 'basic' | 'standard' | 'premium', price = 100) => ({
  service: `${tier} wash`, quantity: 1, price, tier
});

describe('selected quote tier validation', () => {
  it('allows one valid Basic item', () => {
    expect(validateSelectedQuoteTier([item('basic', 125)], 'basic')).toEqual({
      success: true, selectedTier: 'basic', selectedTotal: 125
    });
  });

  it.each([
    [[item('standard')], 'standard-only'],
    [[item('premium')], 'premium-only'],
    [[item('standard'), item('premium')], 'standard and premium only']
  ])('rejects %s when Basic remains selected (%s)', items => {
    expect(validateSelectedQuoteTier(items, 'basic')).toMatchObject({
      success: false,
      code: 'SELECTED_TIER_EMPTY',
      message: 'Add at least one Basic-tier item before saving this quote.'
    });
  });

  it('rejects an invalid Basic item', () => {
    expect(validateSelectedQuoteTier([{ ...item('basic'), service: '' }], 'basic')).toMatchObject({
      success: false, code: 'INVALID_ITEM'
    });
  });

  it.each([
    [[item('basic', 125), item('standard', 300)], 125],
    [[item('basic', 150), item('premium', 500)], 150],
    [[item('basic', 175), item('standard', 325), item('premium', 700)], 175]
  ])('uses only the explicitly selected Basic total for %j', (items, total) => {
    expect(validateSelectedQuoteTier(items, 'basic')).toMatchObject({
      success: true, selectedTier: 'basic', selectedTotal: total
    });
  });

  it('supports another explicit tier only when that tier has items', () => {
    expect(validateSelectedQuoteTier([item('standard', 275)], 'standard')).toMatchObject({
      success: true, selectedTotal: 275
    });
    expect(validateSelectedQuoteTier([item('basic')], 'standard')).toMatchObject({
      success: false, code: 'SELECTED_TIER_EMPTY'
    });
  });

  it('rejects malformed selected-tier state', () => {
    expect(validateSelectedQuoteTier([item('basic')], 'enterprise')).toMatchObject({
      success: false, code: 'INVALID_SELECTED_TIER'
    });
  });
});
