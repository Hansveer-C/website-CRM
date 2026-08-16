export function escapeHtmlText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeTelHref(value: unknown): string | null {
  const input = String(value ?? '').trim();
  if (!/^\+?[0-9](?:[0-9().\-\s]{1,30}[0-9])?$/.test(input)) return null;
  const compact = input.replace(/[().\-\s]/g, '');
  return /^\+?\d{3,32}$/.test(compact) ? `tel:${compact}` : null;
}
