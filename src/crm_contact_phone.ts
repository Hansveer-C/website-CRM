import type { Contact } from './types';

export const CONTACT_PHONE_UNAVAILABLE = '—';

export function contactMatchesClientSearch(
  contact: Pick<Contact, 'name' | 'phone'>,
  query: string
): boolean {
  const normalizedQuery = query.toLowerCase();
  return contact.name.toLowerCase().includes(normalizedQuery) ||
    (contact.phone?.includes(query) ?? false);
}

export function formatContactPhone(phone: Contact['phone']): string {
  return phone?.trim() ? phone : CONTACT_PHONE_UNAVAILABLE;
}

export function hasContactPhone(phone: Contact['phone']): phone is string {
  return typeof phone === 'string' && phone.trim().length > 0;
}
