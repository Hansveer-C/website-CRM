import type { Activity, Contact, Opportunity, Quote } from '../../types';

export type DashboardEntityKey = 'contacts' | 'opportunities' | 'activities' | 'quotes';
export type DashboardMetricFormat = 'number' | 'currency';
export type DashboardTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface DashboardDataAvailability {
  contacts: boolean;
  opportunities: boolean;
  activities: boolean;
  quotes: boolean;
}

export interface DashboardMetric {
  id: 'new-leads' | 'open-opportunities' | 'pipeline-value' | 'sent-quotes' | 'overdue-activities';
  label: string;
  value: number | null;
  format: DashboardMetricFormat;
  supportingText: string;
  tone: DashboardTone;
}

export interface DashboardAttentionItem {
  id: 'new-leads' | 'early-opportunities' | 'sent-quotes' | 'overdue-activities';
  label: string;
  description: string;
  count: number;
  route: 'clients' | 'opportunities' | 'quotes';
  actionLabel: string;
  tone: DashboardTone;
}

export interface DashboardPipelineStage {
  stage: string;
  count: number;
  value: number;
  percentage: number;
}

export interface DashboardQuoteSummary {
  available: boolean;
  totalCount: number;
  sentValue: number;
  statuses: Array<{
    status: Quote['status'];
    label: string;
    count: number;
    tone: DashboardTone;
  }>;
}

export interface DashboardActivityRow {
  id: string;
  type: Activity['type'];
  typeLabel: string;
  description: string;
  contactName: string;
  datedAt: string;
  status: 'Completed' | 'Overdue' | 'Open';
  tone: DashboardTone;
}

export interface DashboardLeadSource {
  source: string;
  count: number;
  percentage: number;
}

export interface DashboardViewModel {
  metrics: DashboardMetric[];
  attentionItems: DashboardAttentionItem[];
  pipeline: {
    available: boolean;
    openCount: number;
    openValue: number;
    stages: DashboardPipelineStage[];
  };
  quotes: DashboardQuoteSummary;
  activities: {
    available: boolean;
    rows: DashboardActivityRow[];
  };
  leadSources: {
    available: boolean;
    totalLeads: number;
    sources: DashboardLeadSource[];
  };
  unavailableEntities: Array<{ key: DashboardEntityKey; label: string }>;
}

export interface CreateDashboardViewModelInput {
  userId: string;
  now: Date;
  contacts: readonly Contact[];
  opportunities: readonly Opportunity[];
  activities: readonly Activity[];
  quotes: readonly Quote[];
  pipelineStages?: readonly string[];
  availability?: Partial<DashboardDataAvailability>;
  activityLimit?: number;
}

const ENTITY_LABELS: Record<DashboardEntityKey, string> = {
  contacts: 'contacts',
  opportunities: 'opportunities',
  activities: 'activities',
  quotes: 'quotes'
};

const QUOTE_STATUS_PRESENTATION: Array<{
  status: Quote['status'];
  label: string;
  tone: DashboardTone;
}> = [
  { status: 'draft', label: 'Draft', tone: 'neutral' },
  { status: 'sent', label: 'Sent', tone: 'info' },
  { status: 'approved', label: 'Approved', tone: 'success' },
  { status: 'rejected', label: 'Rejected', tone: 'danger' }
];

function ownedBy<T extends { user_id: string }>(rows: readonly T[], userId: string): T[] {
  return rows.filter(row => row.user_id === userId);
}

function finiteAmount(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function timestamp(value: string): number | null {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function isWithinPastHours(value: string, nowMs: number, hours: number): boolean {
  const parsed = timestamp(value);
  if (parsed === null || parsed > nowMs) return false;
  return nowMs - parsed <= hours * 60 * 60 * 1000;
}

function activityTypeLabel(type: Activity['type']): string {
  switch (type) {
    case 'call': return 'Call';
    case 'note': return 'Note';
    case 'sms': return 'SMS';
    case 'visit': return 'Visit';
  }
}

function uniqueStageNames(configuredStages: readonly string[], opportunities: readonly Opportunity[]): string[] {
  const stages: string[] = [];
  const seen = new Set<string>();
  const append = (value: string) => {
    const normalized = value.trim() || 'Unassigned';
    if (seen.has(normalized)) return;
    seen.add(normalized);
    stages.push(normalized);
  };

  configuredStages.forEach(append);
  opportunities.forEach(opportunity => append(opportunity.pipeline_stage));
  return stages;
}

export function createDashboardViewModel(input: CreateDashboardViewModelInput): DashboardViewModel {
  const availability: DashboardDataAvailability = {
    contacts: input.availability?.contacts ?? true,
    opportunities: input.availability?.opportunities ?? true,
    activities: input.availability?.activities ?? true,
    quotes: input.availability?.quotes ?? true
  };
  const nowMs = input.now.getTime();
  const userContacts = ownedBy(input.contacts, input.userId);
  const userOpportunities = ownedBy(input.opportunities, input.userId);
  const userActivities = ownedBy(input.activities, input.userId);
  const userQuotes = ownedBy(input.quotes, input.userId);
  const activeLeads = userContacts.filter(contact => contact.status === 'lead');
  const newLeads = activeLeads.filter(contact => isWithinPastHours(contact.created_at, nowMs, 24));
  const openOpportunities = userOpportunities.filter(opportunity => opportunity.status === 'open');
  const openPipelineValue = openOpportunities.reduce((sum, opportunity) => sum + finiteAmount(opportunity.value), 0);
  const sentQuotes = userQuotes.filter(quote => quote.status === 'sent');
  const overdueActivities = userActivities.filter(activity => {
    const dueAt = timestamp(activity.due_date);
    return !activity.completed && dueAt !== null && dueAt < nowMs;
  });

  const metrics: DashboardMetric[] = [
    {
      id: 'new-leads',
      label: 'New leads',
      value: availability.contacts ? newLeads.length : null,
      format: 'number',
      supportingText: availability.contacts ? 'Created in the past 24 hours' : 'Contact data unavailable',
      tone: 'info'
    },
    {
      id: 'open-opportunities',
      label: 'Open opportunities',
      value: availability.opportunities ? openOpportunities.length : null,
      format: 'number',
      supportingText: availability.opportunities ? 'Active opportunity records' : 'Opportunity data unavailable',
      tone: 'neutral'
    },
    {
      id: 'pipeline-value',
      label: 'Estimated pipeline',
      value: availability.opportunities ? openPipelineValue : null,
      format: 'currency',
      supportingText: availability.opportunities ? 'Open opportunity value' : 'Opportunity data unavailable',
      tone: 'success'
    },
    {
      id: 'sent-quotes',
      label: 'Quotes awaiting response',
      value: availability.quotes ? sentQuotes.length : null,
      format: 'number',
      supportingText: availability.quotes ? 'Quotes with sent status' : 'Quote data unavailable',
      tone: 'warning'
    },
    {
      id: 'overdue-activities',
      label: 'Overdue follow-ups',
      value: availability.activities ? overdueActivities.length : null,
      format: 'number',
      supportingText: availability.activities ? 'Incomplete activities past due' : 'Activity data unavailable',
      tone: overdueActivities.length > 0 ? 'danger' : 'neutral'
    }
  ];

  const attentionItems: DashboardAttentionItem[] = [];
  if (availability.contacts && newLeads.length > 0) {
    attentionItems.push({
      id: 'new-leads',
      label: newLeads.length === 1 ? 'new lead to review' : 'new leads to review',
      description: 'New active lead records were created in the past 24 hours.',
      count: newLeads.length,
      route: 'clients',
      actionLabel: 'View leads',
      tone: 'info'
    });
  }

  const firstStage = input.pipelineStages?.find(stage => stage.trim().length > 0)?.trim();
  const earlyStageOpportunities = firstStage
    ? openOpportunities.filter(opportunity => opportunity.pipeline_stage.trim() === firstStage)
    : [];
  if (availability.opportunities && firstStage && earlyStageOpportunities.length > 0) {
    attentionItems.push({
      id: 'early-opportunities',
      label: earlyStageOpportunities.length === 1
        ? `opportunity in ${firstStage}`
        : `opportunities in ${firstStage}`,
      description: 'Open opportunities are still at the first configured pipeline stage.',
      count: earlyStageOpportunities.length,
      route: 'opportunities',
      actionLabel: 'View pipeline',
      tone: 'warning'
    });
  }

  if (availability.quotes && sentQuotes.length > 0) {
    attentionItems.push({
      id: 'sent-quotes',
      label: sentQuotes.length === 1 ? 'sent quote' : 'sent quotes',
      description: 'These quotes remain in sent status and may need follow-up.',
      count: sentQuotes.length,
      route: 'quotes',
      actionLabel: 'View quotes',
      tone: 'warning'
    });
  }

  if (availability.activities && overdueActivities.length > 0) {
    attentionItems.push({
      id: 'overdue-activities',
      label: overdueActivities.length === 1 ? 'overdue follow-up' : 'overdue follow-ups',
      description: 'Incomplete activities have passed their recorded due date.',
      count: overdueActivities.length,
      route: 'clients',
      actionLabel: 'Review clients',
      tone: 'danger'
    });
  }

  const stageNames = uniqueStageNames(input.pipelineStages ?? [], openOpportunities);
  const pipelineStages = availability.opportunities
    ? stageNames.map(stage => {
      const matches = openOpportunities.filter(opportunity => (opportunity.pipeline_stage.trim() || 'Unassigned') === stage);
      return {
        stage,
        count: matches.length,
        value: matches.reduce((sum, opportunity) => sum + finiteAmount(opportunity.value), 0),
        percentage: openOpportunities.length > 0 ? (matches.length / openOpportunities.length) * 100 : 0
      };
    }).filter(stage => stage.count > 0)
    : [];

  const quoteStatuses = QUOTE_STATUS_PRESENTATION.map(item => ({
    ...item,
    count: availability.quotes ? userQuotes.filter(quote => quote.status === item.status).length : 0
  }));

  const contactNames = new Map(userContacts.map(contact => [contact.id, contact.name]));
  const activityRows = availability.activities
    ? userActivities
      .map(activity => {
        const dueAt = timestamp(activity.due_date);
        const status: DashboardActivityRow['status'] = activity.completed
          ? 'Completed'
          : dueAt !== null && dueAt < nowMs
            ? 'Overdue'
            : 'Open';
        const tone: DashboardTone = status === 'Completed' ? 'success' : status === 'Overdue' ? 'danger' : 'info';
        return {
          id: activity.id,
          type: activity.type,
          typeLabel: activityTypeLabel(activity.type),
          description: activity.description,
          contactName: availability.contacts
            ? contactNames.get(activity.contact_id) ?? 'Unknown contact'
            : 'Contact data unavailable',
          datedAt: activity.due_date,
          status,
          tone
        };
      })
      .sort((a, b) => {
        const priority: Record<DashboardActivityRow['status'], number> = { Completed: 0, Overdue: 1, Open: 2 };
        const priorityDifference = priority[a.status] - priority[b.status];
        if (priorityDifference !== 0) return priorityDifference;
        const aTime = timestamp(a.datedAt) ?? (a.status === 'Open' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
        const bTime = timestamp(b.datedAt) ?? (b.status === 'Open' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
        return a.status === 'Open' ? aTime - bTime : bTime - aTime;
      })
      .slice(0, Math.max(0, input.activityLimit ?? 6))
    : [];

  const sourceCounts = new Map<string, number>();
  if (availability.contacts) {
    for (const contact of activeLeads) {
      const source = contact.source.trim() || 'Unknown source';
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    }
  }
  const leadSources = [...sourceCounts.entries()]
    .map(([source, count]) => ({
      source,
      count,
      percentage: activeLeads.length > 0 ? (count / activeLeads.length) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));

  return {
    metrics,
    attentionItems,
    pipeline: {
      available: availability.opportunities,
      openCount: availability.opportunities ? openOpportunities.length : 0,
      openValue: availability.opportunities ? openPipelineValue : 0,
      stages: pipelineStages
    },
    quotes: {
      available: availability.quotes,
      totalCount: availability.quotes ? userQuotes.length : 0,
      sentValue: availability.quotes
        ? sentQuotes.reduce((sum, quote) => sum + finiteAmount(quote.total_amount), 0)
        : 0,
      statuses: quoteStatuses
    },
    activities: {
      available: availability.activities,
      rows: activityRows
    },
    leadSources: {
      available: availability.contacts,
      totalLeads: availability.contacts ? activeLeads.length : 0,
      sources: leadSources
    },
    unavailableEntities: (Object.keys(availability) as DashboardEntityKey[])
      .filter(key => !availability[key])
      .map(key => ({ key, label: ENTITY_LABELS[key] }))
  };
}
