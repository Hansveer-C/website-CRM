/**
 * 🌐 FRONTEND-SAFE UTILITIES
 * Pure functions for data normalization. No backend context or side effects.
 */

export function normalizePhone(phone: string): { normalized: string; invalid: boolean } {
  if (!phone) return { normalized: '', invalid: true };
  
  const cleaned = phone.replace(/[\s\-\(\)\[\]\{\}\.\,\/]/g, '').replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return { normalized: `+1${cleaned}`, invalid: false };
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return { normalized: `+${cleaned}`, invalid: false };
  }
  
  return { normalized: cleaned || phone, invalid: true };
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email || !email.trim()) return null;
  return email.trim().toLowerCase();
}

export function normalizeName(name: string): string {
  if (!name) return '';
  return name.trim().replace(/\s\s+/g, ' ');
}
