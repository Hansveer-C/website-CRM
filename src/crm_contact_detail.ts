import type { Activity, Contact } from './types';
import { escapeHtmlText } from './crm_html_output';

/** Resolve only data already loaded by the authenticated CRM hydrator. */
export function resolveHydratedContact(userId: string, loadedUserId: string | undefined, ready: boolean, contacts: Contact[], id: string) {
  if (!userId || loadedUserId !== userId || !ready) return { status: 'unavailable' as const };
  const contact = contacts.find(item => item.user_id === userId && item.id === id);
  return contact ? { status: 'ready' as const, contact } : { status: 'missing' as const };
}

/** Activity records only: this does not imply live call/SMS history support. */
export function renderHydratedContactActivity(userId: string, contactId: string, ready: boolean, activities: Activity[]): string {
  if (!userId || !ready) return '<p role="status">Activity could not be loaded. Retry CRM data loading.</p>';
  const owned = activities.filter(item => item.user_id === userId && item.contact_id === contactId)
    .sort((a,b) => (b.due_date ?? '').localeCompare(a.due_date ?? '') || a.id.localeCompare(b.id));
  return owned.map(item => `<div class="wo-contact-detail-timeline-item"><div>${escapeHtmlText(item.description)}</div><span>${item.due_date ? `Due: ${escapeHtmlText(item.due_date)}` : 'No due date'}</span></div>`).join('')
    || '<p class="wo-contact-detail-empty">No activities recorded.</p>';
}
