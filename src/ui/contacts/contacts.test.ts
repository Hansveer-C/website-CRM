import { describe, expect, it } from 'vitest';
import { renderApplicationShell } from '../shell';
import { filterContacts, renderClientsContent, renderContactDetailContent } from './contacts';

const owner = 'owner-1';
const contact = { id: 'c-1', user_id: owner, name: 'Avery Exterior', phone: '6045550100', email: 'avery@example.test', address: '10 Clean Way', tags: ['Priority'], source: 'Website', service: 'House wash', status: 'lead' as const, created_at: '2026-08-21T10:00:00.000Z' };
const foreign = { ...contact, id: 'c-foreign', user_id: 'other-user', name: 'Foreign contact' };
const base = { userId: owner, contacts: [contact, foreign], activities: [{ id: 'a-1', user_id: owner, contact_id: 'c-1', type: 'note' as const, description: 'Requested an estimate', due_date: '2026-08-21T12:00:00.000Z', completed: true }], query: '', filter: 'all' as const, now: new Date('2026-08-21T12:30:00.000Z') };

describe('WashOps contacts interiors', () => {
  it('keeps the Clients list tenant scoped and preserves status filtering', () => {
    expect(filterContacts(base).map(item => item.id)).toEqual(['c-1']);
    expect(filterContacts({ ...base, filter: 'customer' })).toEqual([]);
    expect(renderClientsContent(base)).toContain('Requested an estimate');
    expect(renderClientsContent(base)).not.toContain('Foreign contact');
  });

  it('escapes contact and activity-controlled values in the Clients list', () => {
    const html = renderClientsContent({ ...base, contacts: [{ ...contact, name: '<img src=x onerror=alert(1)>', source: '<script>x</script>' }], activities: [{ ...base.activities[0], description: '<svg onload=alert(1)>' }] });
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;svg onload=alert(1)&gt;');
    expect(html).not.toContain('<script>');
  });

  it('uses a deliberate empty state without fabricated contacts', () => {
    const html = renderClientsContent({ ...base, contacts: [], activities: [] });
    expect(html).toContain('No contacts found');
    expect(html).toContain('wo-empty-state');
    expect(html).not.toContain('Foreign contact');
  });

  it('renders the contact detail with only its supplied relationships and escaped data', () => {
    const html = renderContactDetailContent({ contact: { ...contact, name: '<b>Avery</b>', tags: ['<script>x</script>'] }, opportunities: [{ id: 'o-1', user_id: owner, contact_id: 'c-1', pipeline_stage: '<img>', value: 2500, status: 'open', created_at: '2026-08-21T10:00:00.000Z' }], quotes: [] });
    expect(html).toContain('&lt;img&gt;');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('$2,500');
    expect(html).not.toContain('No phone number');
  });

  it('composes Clients content inside one permanent shell and main landmark', () => {
    const html = renderApplicationShell({ activeView: 'clients', title: 'Clients & Leads', contentHtml: renderClientsContent(base), contentVariant: 'wide' });
    expect((html.match(/class="wo-shell"/g) ?? []).length).toBe(1);
    expect((html.match(/<main\b/g) ?? []).length).toBe(1);
    expect(html).not.toContain('class="sidebar"');
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
  });
});
