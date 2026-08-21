import { escapeHtmlText, safeTelHref } from '../../crm_html_output';
import { formatContactPhone, hasContactPhone } from '../../crm_contact_phone';
import type { Activity, Contact, Opportunity, Quote } from '../../types';
import { renderBadge, renderCard, renderEmptyState, renderSpinner, renderStatusBadge } from '../primitives';

export type ContactFilter = 'all' | 'lead' | 'customer' | 'lost';

export interface ContactsScreenModel {
  userId: string;
  contacts: Contact[];
  activities: Activity[];
  query: string;
  filter: ContactFilter;
  now: Date;
}

function isNew(createdAt: string, now: Date): boolean {
  const created = new Date(createdAt).getTime();
  return Number.isFinite(created) && now.getTime() - created < 24 * 60 * 60 * 1000;
}

function attentionRequired(contact: Contact): boolean {
  return Boolean(contact.follow_up_required || contact.lead_status === 'urgent');
}

function activityForContact(activities: Activity[], contactId: string): Activity | undefined {
  return activities
    .filter(activity => activity.contact_id === contactId)
    .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())[0];
}

export function filterContacts(model: ContactsScreenModel): Contact[] {
  const query = model.query.trim().toLowerCase();
  return model.contacts.filter(contact => {
    if (contact.user_id !== model.userId) return false;
    const matchesQuery = !query || [contact.name, contact.phone, contact.email, contact.source]
      .some(value => String(value ?? '').toLowerCase().includes(query));
    return matchesQuery && (model.filter === 'all' || contact.status === model.filter);
  });
}

function renderContactFlag(contact: Contact, now: Date): string {
  if (attentionRequired(contact)) return renderBadge({ label: 'Follow-up needed', variant: 'danger' });
  if (isNew(contact.created_at, now)) return renderBadge({ label: 'New lead', variant: 'warning' });
  return '';
}

function renderContactRow(contact: Contact, activities: Activity[], now: Date): string {
  const latest = activityForContact(activities, contact.id);
  const telHref = safeTelHref(contact.phone);
  const canText = hasContactPhone(contact.phone);
  const activityText = latest ? escapeHtmlText(latest.description) : 'No activity yet';
  const activityClass = latest ? '' : ' wo-contacts-muted';
  const callAction = contact.status === 'lead' && isNew(contact.created_at, now) && telHref
    ? `<a class="wo-button wo-button--secondary wo-button--sm" href="${escapeHtmlText(telHref)}" onclick="event.stopPropagation()">Call</a>`
    : '';

  return `
    <tr class="wo-contacts-table-row" data-contact-id="${escapeHtmlText(contact.id)}" tabindex="0" role="link" aria-label="Open ${escapeHtmlText(contact.name)}" onclick="window.navigateTo('contact-detail', '${contact.id}')" onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); window.navigateTo('contact-detail', '${contact.id}'); }">
      <td class="wo-contacts-person-cell" data-label="Contact">
        <strong>${escapeHtmlText(contact.name)}</strong>
        <span class="wo-contacts-email">${escapeHtmlText(contact.email || 'No email')}</span>
        <span class="wo-contacts-row-flags">${renderContactFlag(contact, now)}</span>
      </td>
      <td data-label="Phone">${escapeHtmlText(formatContactPhone(contact.phone))}</td>
      <td data-label="Status">${renderStatusBadge(contact.status)}</td>
      <td data-label="Source">${escapeHtmlText(contact.source || 'Not recorded')}</td>
      <td data-label="Latest activity"><span class="${activityClass.trim()}">${activityText}</span></td>
      <td class="wo-contacts-actions-cell" data-label="Actions">
        <div class="wo-contacts-row-actions">
          <button type="button" class="wo-button wo-button--secondary wo-button--sm" onclick="event.stopPropagation(); window.navigateTo('contact-detail', '${contact.id}')">View<span class="wo-sr-only"> ${escapeHtmlText(contact.name)}</span></button>
          <button type="button" class="wo-button wo-button--ghost wo-button--sm" ${canText ? '' : 'disabled title="No phone number available"'} onclick="event.stopPropagation(); ${canText ? `window.textContact('${contact.id}')` : ''}">Text</button>
          ${callAction}
        </div>
      </td>
    </tr>
  `.trim();
}

export function renderClientsLoading(): string {
  return `<section class="wo-contacts wo-contacts--loading" aria-label="Loading contacts">${renderCard({
    className: 'wo-contacts-loading-card',
    bodyHtml: `<div class="wo-contacts-loading" role="status">${renderSpinner({ ariaLabel: 'Loading contacts' })}<span>Loading contacts…</span></div>`
  })}</section>`;
}

export function renderClientsContent(model: ContactsScreenModel): string {
  const contacts = filterContacts(model);
  const ownedContacts = model.contacts.filter(contact => contact.user_id === model.userId);
  const total = ownedContacts.length;
  const leadCount = ownedContacts.filter(contact => contact.status === 'lead').length;
  const filterButtons: Array<[ContactFilter, string]> = [['all', 'All'], ['lead', 'Leads'], ['customer', 'Customers'], ['lost', 'Lost']];
  const rows = contacts.map(contact => renderContactRow(contact, model.activities, model.now)).join('');

  const controls = `
    <section class="wo-contacts-controls" aria-label="Contact search and filters">
      <label class="wo-sr-only" for="client-search">Search contacts</label>
      <input class="wo-field-input wo-contacts-search" type="search" id="client-search" placeholder="Search contacts" value="${escapeHtmlText(model.query)}">
      <div class="wo-contacts-filter-list" role="group" aria-label="Filter contacts by status">
        ${filterButtons.map(([filter, label]) => `<button type="button" class="wo-button wo-button--sm ${model.filter === filter ? 'wo-button--primary' : 'wo-button--ghost'}" aria-pressed="${model.filter === filter}" onclick="window.filterClients('${filter}')">${label}</button>`).join('')}
      </div>
    </section>`;

  const list = contacts.length
    ? `<div class="wo-contacts-table-wrap"><table class="wo-table wo-contacts-table"><thead><tr><th>Contact</th><th>Phone</th><th>Status</th><th>Source</th><th>Latest activity</th><th><span class="wo-sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>`
    : renderEmptyState({ title: 'No contacts found', description: model.query || model.filter !== 'all' ? 'Try another search or status filter.' : 'Add a lead to begin managing your customer relationships.', icon: '◌' });

  return `
    <div class="wo-contacts">
      <section class="wo-contacts-summary" aria-label="Contact overview">
        <div><p class="wo-contacts-eyebrow">Contact management</p><p class="wo-contacts-context">${total} ${total === 1 ? 'contact' : 'contacts'} · ${leadCount} ${leadCount === 1 ? 'lead' : 'leads'}</p></div>
      </section>
      ${controls}
      ${renderCard({ className: 'wo-contacts-list-card', bodyHtml: list })}
    </div>`;
}

export interface ContactDetailModel {
  contact: Contact;
  opportunities: Opportunity[];
  quotes: Quote[];
}

export function renderContactDetailLoading(): string {
  return `<section class="wo-contact-detail wo-contact-detail--loading" aria-label="Loading contact details">${renderCard({ bodyHtml: `<div class="wo-contacts-loading" role="status">${renderSpinner({ ariaLabel: 'Loading contact details' })}<span>Loading contact details…</span></div>` })}</section>`;
}

export function renderContactDetailContent(model: ContactDetailModel): string {
  const { contact, opportunities, quotes } = model;
  const telHref = safeTelHref(contact.phone);
  const opportunitiesHtml = opportunities.length ? opportunities.map(opportunity => `
    <li class="wo-contact-detail-opportunity"><div><strong>${escapeHtmlText(opportunity.pipeline_stage)}</strong><span>${escapeHtmlText(opportunity.status)}</span></div><strong>$${escapeHtmlText(opportunity.value.toLocaleString())}</strong></li>`).join('') : '<li class="wo-contact-detail-empty">No opportunities for this contact.</li>';
  const quickActions = telHref
    ? `<div class="wo-contact-detail-actions"><a class="wo-button wo-button--primary" href="${escapeHtmlText(telHref)}">Call</a><button type="button" class="wo-button wo-button--secondary" onclick="window.sendQuickSMS('${contact.id}')">Text</button></div>`
    : `<div class="wo-contact-detail-no-phone">No phone number is available for call or text actions.</div>`;

  return `
    <div class="wo-contact-detail">
      <section class="wo-contact-detail-identity">
        <div><p class="wo-contacts-eyebrow">Contact record</p><div class="wo-contact-detail-status">${renderStatusBadge(contact.status)}${contact.tags.map(tag => renderBadge({ label: tag, variant: 'neutral' })).join('')}</div></div>
        ${quickActions}
      </section>
      <div class="wo-contact-detail-layout">
        <div class="wo-contact-detail-primary">
          ${renderCard({ className: 'wo-contact-detail-info', headerHtml: '<h2 class="wo-contact-detail-section-title">Contact information</h2>', bodyHtml: `
            <div class="wo-contact-detail-info-grid">
              <label><span>Phone</span><input class="wo-field-input" type="tel" value="${escapeHtmlText(contact.phone ?? '')}" placeholder="Add phone" onchange="window.updateContactField('${contact.id}', 'phone', this.value)"></label>
              <label><span>Email</span><input class="wo-field-input" type="email" value="${escapeHtmlText(contact.email ?? '')}" placeholder="Add email" onchange="window.updateContactField('${contact.id}', 'email', this.value)"></label>
              <div><span>Source</span><strong>${escapeHtmlText(contact.source || 'Not recorded')}</strong></div>
              <div><span>Address</span><strong>${escapeHtmlText(contact.address || 'Not recorded')}</strong></div>
              ${contact.service ? `<div><span>Service</span><strong>${escapeHtmlText(contact.service)}</strong></div>` : ''}
            </div>` })}
          <section class="wo-contact-detail-timeline-section"><div class="wo-contact-detail-section-heading"><h2 class="wo-contact-detail-section-title">Activity and follow-ups</h2><button type="button" class="wo-button wo-button--ghost wo-button--sm" onclick="window.logCall('${contact.id}')">Log activity</button></div>${renderCard({ className: 'wo-contact-detail-timeline-card', bodyHtml: '<div id="api-timeline-list" class="wo-contact-detail-timeline" aria-live="polite"><div class="wo-contacts-loading" role="status">Loading activity…</div></div>' })}</section>
        </div>
        <aside class="wo-contact-detail-side">
          ${renderCard({ className: 'wo-contact-detail-opportunities', headerHtml: '<h2 class="wo-contact-detail-section-title">Opportunities</h2>', bodyHtml: `<ul>${opportunitiesHtml}</ul>` })}
          ${renderCard({ className: 'wo-contact-detail-quotes', headerHtml: '<h2 class="wo-contact-detail-section-title">Quotes</h2>', bodyHtml: `<strong class="wo-contact-detail-quote-count">${quotes.length}</strong><p>${quotes.length === 1 ? 'quote linked to this contact' : 'quotes linked to this contact'}</p>` })}
        </aside>
      </div>
    </div>`;
}
