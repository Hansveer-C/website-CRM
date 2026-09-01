import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mockContacts } from './db';
import {
  CONTACT_PHONE_UNAVAILABLE,
  contactMatchesClientSearch,
  formatContactPhone,
  hasContactPhone
} from './crm_contact_phone';
import { safeTelHref } from './crm_html_output';
import { CrmProductionHydrator, type CrmProductionCollections } from './crm_production_hydration';
import type { Contact } from './types';

const emailOnlyContact: Contact = {
  id: 'email-only',
  user_id: 'user-1',
  name: 'Email Only Lead',
  phone: null,
  email: 'email-only@example.test',
  address: '123 Test Street',
  tags: [],
  source: 'public website',
  status: 'lead',
  created_at: '2026-08-15T00:00:00.000Z'
};

const validPhoneContact: Contact = {
  ...emailOnlyContact,
  id: 'phone-lead',
  name: 'Phone Lead',
  phone: '+1 (604) 555-0198'
};

function emptyCollections(): CrmProductionCollections {
  return { contacts: [], opportunities: [], activities: [], quotes: [], quote_items: [], invoices: [], invoice_items: [] };
}

function hydrationClient(contact: Contact) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: async () => ({ data: table === 'contacts' ? [contact] : [], error: null })
      })
    })
  };
}

describe('nullable CRM contact phone behavior', () => {
  it('Clients renders email-only contacts with null phone without crashing', () => {
    expect(() => contactMatchesClientSearch(emailOnlyContact, '')).not.toThrow();
    expect(contactMatchesClientSearch(emailOnlyContact, '')).toBe(true);
    expect(formatContactPhone(emailOnlyContact.phone)).toBe(CONTACT_PHONE_UNAVAILABLE);
    expect(hasContactPhone(emailOnlyContact.phone)).toBe(false);
  });

  it('keeps null-phone contacts searchable by name and safely ignores phone searches', () => {
    expect(contactMatchesClientSearch(emailOnlyContact, 'email only')).toBe(true);
    expect(contactMatchesClientSearch(emailOnlyContact, '604')).toBe(false);
    expect(contactMatchesClientSearch(validPhoneContact, '604')).toBe(true);
    expect(contactMatchesClientSearch(validPhoneContact, 'phone lead')).toBe(true);
  });

  it('keeps telephone and SMS availability null-safe', () => {
    expect(safeTelHref(null)).toBeNull();
    expect(hasContactPhone(null)).toBe(false);
    expect(hasContactPhone('+1 (604) 555-0198')).toBe(true);
  });

  it('preserves a canonical null phone across hydration and rehydration', async () => {
    const first = emptyCollections();
    await new CrmProductionHydrator(async () => hydrationClient(emailOnlyContact), first)
      .hydrateAuthenticatedUser('user-1');
    expect(first.contacts[0]?.phone).toBeNull();

    const reloaded = emptyCollections();
    await new CrmProductionHydrator(async () => hydrationClient(emailOnlyContact), reloaded)
      .hydrateAuthenticatedUser('user-1');
    expect(reloaded.contacts).toEqual(first.contacts);
    expect(reloaded.contacts[0]?.phone).toBeNull();
  });

  it('leaves valid local fixture phones unchanged', () => {
    expect(mockContacts.map(contact => contact.phone)).toEqual(['555-0101', '555-0202']);
  });
});

describe('nullable phone UI and hydration wiring', () => {
  const main = readFileSync(fileURLToPath(new URL('./main.ts', import.meta.url)), 'utf8');
  const contactsRenderer = readFileSync(fileURLToPath(new URL('./ui/contacts/contacts.ts', import.meta.url)), 'utf8');
  const hydrator = readFileSync(fileURLToPath(new URL('./crm_production_hydration.ts', import.meta.url)), 'utf8');
  const smsLogic = readFileSync(fileURLToPath(new URL('./sms_logic.ts', import.meta.url)), 'utf8');
  const timeline = readFileSync(fileURLToPath(new URL('./timeline.ts', import.meta.url)), 'utf8');
  const types = readFileSync(fileURLToPath(new URL('./types.ts', import.meta.url)), 'utf8');

  it('uses the nullable domain type without normalizing production hydration', () => {
    expect(types).toContain('phone: string | null;');
    expect(hydrator).not.toContain("phone ?? ''");
    expect(hydrator).not.toContain('formatContactPhone');
  });

  it('wires Clients search, neutral display, and unavailable actions through null-safe helpers', () => {
    expect(contactsRenderer).toContain('[contact.name, contact.phone, contact.email, contact.source]');
    expect(contactsRenderer).not.toContain('contact.phone.includes(clientSearchQuery)');
    expect(contactsRenderer).toContain('escapeHtmlText(formatContactPhone(contact.phone))');
    expect(contactsRenderer).toContain('const canText = hasContactPhone(contact.phone);');
    expect(contactsRenderer).toContain('disabled title="No phone number available"');
    expect(contactsRenderer).toContain('const telHref = safeTelHref(contact.phone);');
  });

  it('renders contact detail safely and refuses false-success SMS UI', () => {
    expect(contactsRenderer).toContain("escapeHtmlText(contact.phone ?? '')");
    expect(contactsRenderer).toContain('placeholder="Add phone"');
    expect(main).toContain('const hasPhone = hasContactPhone(contact.phone);');
    expect(main).toContain('const sendResult = await sendMessageToContact(contactId, content);');
    expect(main).toContain('if (!sendResult.success)');
    expect(smsLogic).toContain('const phone = contact.phone;');
    expect(smsLogic).toContain("if (!phone) return { success: false, error: 'Contact/phone missing' };");
    expect(smsLogic).toContain('sendSMS({ to: phone, message: msg.content');
    expect(timeline).toContain('getCallsForContact(contact_id, phone ?? undefined, user, limit)');
  });
});
