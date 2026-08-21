import type { Contact, Opportunity, Quote } from '../../types';

export interface ReportsAvailability { contacts: boolean; opportunities: boolean; quotes: boolean; }
export interface Distribution { label: string; count: number; value: number; percentage: number; }
export interface ReportsViewModel {
  leadSources: { available: boolean; total: number; rows: Distribution[] };
  pipeline: { available: boolean; total: number; value: number; rows: Distribution[] };
  quotes: { available: boolean; total: number; quotedValue: number; statuses: Array<{ label: string; count: number }> };
}

const finite = (value: number) => Number.isFinite(value) ? value : 0;
const owned = <T extends { user_id: string }>(rows: readonly T[], userId: string) => rows.filter(row => row.user_id === userId);
const label = (value: string) => value.trim() || 'Unspecified';
const grouped = (rows: Array<{ label: string; value: number }>, denominator: number): Distribution[] => {
  const groups = new Map<string, { count: number; value: number }>();
  rows.forEach(row => { const current = groups.get(row.label) ?? { count: 0, value: 0 }; groups.set(row.label, { count: current.count + 1, value: current.value + row.value }); });
  return [...groups.entries()].map(([groupLabel, group]) => ({ label: groupLabel, ...group, percentage: denominator ? group.count / denominator * 100 : 0 })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
};

export function createReportsViewModel(input: { userId: string; contacts: readonly Contact[]; opportunities: readonly Opportunity[]; quotes: readonly Quote[]; availability?: Partial<ReportsAvailability> }): ReportsViewModel {
  const availability = { contacts: input.availability?.contacts ?? true, opportunities: input.availability?.opportunities ?? true, quotes: input.availability?.quotes ?? true };
  const leads = owned(input.contacts, input.userId).filter(contact => contact.status === 'lead');
  const open = owned(input.opportunities, input.userId).filter(opportunity => opportunity.status === 'open');
  const userQuotes = owned(input.quotes, input.userId);
  return {
    leadSources: { available: availability.contacts, total: leads.length, rows: grouped(leads.map(contact => ({ label: label(contact.source), value: 0 })), leads.length) },
    pipeline: { available: availability.opportunities, total: open.length, value: open.reduce((sum, opportunity) => sum + finite(opportunity.value), 0), rows: grouped(open.map(opportunity => ({ label: label(opportunity.pipeline_stage), value: finite(opportunity.value) })), open.length) },
    quotes: { available: availability.quotes, total: userQuotes.length, quotedValue: userQuotes.reduce((sum, quote) => sum + finite(quote.total_amount), 0), statuses: ['draft', 'sent', 'approved', 'rejected'].map(status => ({ label: status[0].toUpperCase() + status.slice(1), count: userQuotes.filter(quote => quote.status === status).length })) }
  };
}
