export type SelectedQuoteTier = 'basic' | 'standard' | 'premium';

export interface QuoteTierItemInput {
  service?: unknown;
  serviceName?: unknown;
  quantity?: unknown;
  price?: unknown;
  unitPrice?: unknown;
  tier?: unknown;
}

export type QuoteTierValidationResult =
  | { success: true; selectedTier: SelectedQuoteTier; selectedTotal: number }
  | { success: false; code: 'INVALID_SELECTED_TIER' | 'INVALID_ITEM' | 'SELECTED_TIER_EMPTY'; message: string };

const TIERS = new Set<SelectedQuoteTier>(['basic', 'standard', 'premium']);

function itemService(item: QuoteTierItemInput): string {
  return String(item.serviceName ?? item.service ?? '').trim();
}

function itemQuantity(item: QuoteTierItemInput): number {
  return Number(item.quantity);
}

function itemUnitPrice(item: QuoteTierItemInput): number {
  return Number(item.unitPrice ?? item.price);
}

export function validateSelectedQuoteTier(
  items: readonly QuoteTierItemInput[],
  selectedTier: unknown
): QuoteTierValidationResult {
  if (!TIERS.has(selectedTier as SelectedQuoteTier)) {
    return { success: false, code: 'INVALID_SELECTED_TIER', message: 'Select a valid quote tier.' };
  }

  if (!Array.isArray(items) || items.length === 0 || items.some(item => {
    const quantity = itemQuantity(item);
    const unitPrice = itemUnitPrice(item);
    return !itemService(item)
      || !Number.isFinite(quantity)
      || quantity <= 0
      || !Number.isFinite(unitPrice)
      || unitPrice < 0
      || !TIERS.has(item.tier as SelectedQuoteTier);
  })) {
    return {
      success: false,
      code: 'INVALID_ITEM',
      message: 'Add at least one valid quote item with a service name, quantity, and price.'
    };
  }

  const selectedItems = items.filter(item => item.tier === selectedTier);
  if (selectedItems.length === 0) {
    const label = `${String(selectedTier).charAt(0).toUpperCase()}${String(selectedTier).slice(1)}`;
    return {
      success: false,
      code: 'SELECTED_TIER_EMPTY',
      message: `Add at least one ${label}-tier item before saving this quote.`
    };
  }

  const selectedTotal = selectedItems.reduce(
    (total, item) => total + itemQuantity(item) * itemUnitPrice(item),
    0
  );
  return { success: true, selectedTier: selectedTier as SelectedQuoteTier, selectedTotal };
}
