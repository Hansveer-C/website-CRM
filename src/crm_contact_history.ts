import { escapeHtmlText } from './crm_html_output';
import type { MessageStatus } from './types';

export type ContactHistoryEntry = {
  id: string;
  kind: 'message' | 'call';
  direction: 'inbound' | 'outbound';
  createdAt: string;
  summary: string;
  detail: string;
};

type QueryResult = { data: unknown[] | null; error: unknown | null };
type HistoryQuery = PromiseLike<QueryResult> & {
  eq(column: string, value: string): HistoryQuery;
  order(column: string, options: { ascending: boolean }): HistoryQuery;
  limit(value: number): HistoryQuery;
};
export interface ContactHistoryClient {
  from(table: string): { select(columns: string): HistoryQuery };
}

function row(value: unknown, table: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Malformed ${table} history row`);
  return value as Record<string, unknown>;
}

function required(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Malformed history ${field}`);
  return value;
}

function direction(value: unknown): 'inbound' | 'outbound' {
  if (value !== 'inbound' && value !== 'outbound') throw new Error('Malformed history direction');
  return value;
}

function timestamp(value: unknown): string {
  const result = required(value, 'created_at');
  if (Number.isNaN(Date.parse(result))) throw new Error('Malformed history created_at');
  return result;
}

function outboundMessageSummary(value: unknown): string {
  const status = required(value, 'status') as MessageStatus;
  if (status === 'pending') return 'SMS pending';
  if (status === 'sent') return 'SMS sent';
  if (status === 'failed') return 'SMS failed';
  return `Outbound SMS (${status})`;
}

function query(client: ContactHistoryClient, table: string, columns: string, userId: string, contactId: string, limit: number) {
  return client.from(table).select(columns).eq('user_id', userId).eq('contact_id', contactId)
    .order('created_at', { ascending: false }).limit(limit);
}

export async function loadContactCommunicationHistory(
  client: ContactHistoryClient,
  userIdInput: string,
  contactIdInput: string,
  limit = 50
): Promise<ContactHistoryEntry[]> {
  const userId = userIdInput.trim();
  const contactId = contactIdInput.trim();
  const safeIdentifier = /^[A-Za-z0-9_-]{1,200}$/;
  if (!safeIdentifier.test(userId) || !safeIdentifier.test(contactId) || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Invalid history request');
  }

  const [messages, calls] = await Promise.all([
    query(client, 'messages', 'id,user_id,contact_id,direction,content,status,created_at', userId, contactId, limit),
    query(client, 'calls', 'id,user_id,contact_id,direction,status,duration,created_at', userId, contactId, limit)
  ]);
  if (messages.error || calls.error) throw new Error('Communication history could not be loaded');

  const messageEntries = (messages.data ?? []).map(value => {
    const item = row(value, 'message');
    if (required(item.user_id, 'user_id') !== userId || required(item.contact_id, 'contact_id') !== contactId) {
      throw new Error('Communication history ownership mismatch');
    }
    const itemDirection = direction(item.direction);
    return {
      id: required(item.id, 'id'), kind: 'message' as const, direction: itemDirection,
      createdAt: timestamp(item.created_at), summary: itemDirection === 'inbound' ? 'Received SMS' : outboundMessageSummary(item.status),
      detail: typeof item.content === 'string' ? item.content : '',
    };
  });
  const callEntries = (calls.data ?? []).map(value => {
    const item = row(value, 'call');
    if (required(item.user_id, 'user_id') !== userId || required(item.contact_id, 'contact_id') !== contactId) {
      throw new Error('Communication history ownership mismatch');
    }
    const itemDirection = direction(item.direction);
    const duration = typeof item.duration === 'number' && Number.isFinite(item.duration) && item.duration > 0
      ? ` · ${Math.floor(item.duration)}s` : '';
    return {
      id: required(item.id, 'id'), kind: 'call' as const, direction: itemDirection,
      createdAt: timestamp(item.created_at), summary: itemDirection === 'inbound' ? 'Inbound call' : 'Outbound call',
      detail: `${typeof item.status === 'string' ? item.status : 'unknown'}${duration}`,
    };
  });
  return [...messageEntries, ...callEntries]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function renderContactCommunicationHistory(entries: ContactHistoryEntry[]): string {
  if (!entries.length) return '<p class="wo-contact-detail-empty" role="status">No communication history recorded.</p>';
  return `<ol class="wo-contact-detail-timeline-items" aria-label="Customer communication history">${entries.map(entry => `
    <li class="wo-contact-detail-timeline-item" data-history-kind="${entry.kind}">
      <div><strong>${escapeHtmlText(entry.summary)}</strong> <span>${escapeHtmlText(entry.detail)}</span></div>
      <time datetime="${escapeHtmlText(entry.createdAt)}">${escapeHtmlText(new Date(entry.createdAt).toLocaleString())}</time>
    </li>`).join('')}</ol>`;
}

export function renderContactCommunicationHistoryError(contactId: string): string {
  return `<div role="alert"><p>Communication history could not be loaded.</p><button type="button" class="wo-button wo-button--secondary wo-button--sm" onclick="window.loadTimeline('${escapeHtmlText(contactId)}')">Retry</button></div>`;
}

export function renderContactHistoryTimeline(activityHtml: string, communicationHtml: string): string {
  return `<section aria-label="Contact activities">${activityHtml}</section><section aria-label="Communications">${communicationHtml}</section>`;
}
