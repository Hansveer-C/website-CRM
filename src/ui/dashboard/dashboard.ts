import { escapeHtmlText } from '../../crm_html_output';
import {
  renderBadge,
  renderButton,
  renderCard,
  renderEmptyState,
  renderErrorState
} from '../primitives';
import type { ApplicationShellOptions } from '../shell';
import type {
  DashboardActivityRow,
  DashboardAttentionItem,
  DashboardMetric,
  DashboardTone,
  DashboardViewModel
} from './dashboard_model';

const METRIC_ICONS: Record<DashboardMetric['id'], string> = {
  'new-leads': '<svg class="wo-dashboard-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>',
  'open-opportunities': '<svg class="wo-dashboard-glyph" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
  'pipeline-value': '<svg class="wo-dashboard-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>',
  'sent-quotes': '<svg class="wo-dashboard-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>',
  'overdue-activities': '<svg class="wo-dashboard-glyph" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>'
};

const ACTIVITY_ICONS: Record<DashboardActivityRow['type'], string> = {
  call: '<svg class="wo-dashboard-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92z"/></svg>',
  note: '<svg class="wo-dashboard-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></svg>',
  sms: '<svg class="wo-dashboard-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/></svg>',
  visit: '<svg class="wo-dashboard-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/></svg>'
};

function badgeVariant(tone: DashboardTone): DashboardTone {
  return tone;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function formatMetricValue(metric: DashboardMetric): string {
  if (metric.value === null) return '—';
  return metric.format === 'currency' ? formatCurrency(metric.value) : metric.value.toLocaleString('en-US');
}

function formatActivityDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function renderDashboardSectionHeader(id: string, title: string, description: string): string {
  return `
    <div class="wo-dashboard-section-header">
      <div>
        <h2 id="${escapeHtmlText(id)}" class="wo-dashboard-section-title">${escapeHtmlText(title)}</h2>
        <p class="wo-dashboard-section-description">${escapeHtmlText(description)}</p>
      </div>
    </div>
  `.trim();
}

function renderDashboardPanelHeader(title: string, description: string, accessoryHtml = ''): string {
  return `
    <div class="wo-dashboard-panel-heading">
      <div class="wo-dashboard-panel-heading-copy">
        <h3 class="wo-dashboard-panel-title">${escapeHtmlText(title)}</h3>
        <p class="wo-dashboard-panel-description">${escapeHtmlText(description)}</p>
      </div>
      ${accessoryHtml}
    </div>
  `.trim();
}

function renderRouteButton(label: string, route: string, variant: 'primary' | 'secondary' | 'ghost' = 'ghost'): string {
  return renderButton({
    label,
    variant,
    size: 'md',
    className: 'wo-dashboard-action',
    attributes: { onclick: `window.navigateTo('${route}')` }
  });
}

function renderDashboardMetric(metric: DashboardMetric): string {
  const unavailable = metric.value === null;
  const card = renderCard({
    className: `wo-dashboard-metric wo-dashboard-metric--${metric.tone}${unavailable ? ' wo-dashboard-metric--unavailable' : ''}`,
    bodyHtml: `
      <div class="wo-dashboard-metric-topline">
        <span class="wo-dashboard-metric-icon" aria-hidden="true">${METRIC_ICONS[metric.id]}</span>
        <span class="wo-dashboard-metric-label">${escapeHtmlText(metric.label)}</span>
      </div>
      <strong class="wo-dashboard-metric-value" data-dashboard-metric="${metric.id}">${escapeHtmlText(formatMetricValue(metric))}</strong>
      <p class="wo-dashboard-metric-support">${escapeHtmlText(metric.supportingText)}</p>
    `
  });
  return `<div role="listitem" class="wo-dashboard-metric-item">${card}</div>`;
}

function renderAttentionItem(item: DashboardAttentionItem): string {
  return `
    <li class="wo-dashboard-attention-item" data-dashboard-attention-item="${item.id}">
      <div class="wo-dashboard-attention-copy">
        ${renderBadge({ label: `${item.count} ${item.label}`, variant: badgeVariant(item.tone) })}
        <p>${escapeHtmlText(item.description)}</p>
      </div>
      ${renderRouteButton(item.actionLabel, item.route)}
    </li>
  `.trim();
}

function renderAttentionPanel(model: DashboardViewModel): string {
  let bodyHtml: string;
  if (model.attentionItems.length > 0) {
    bodyHtml = `<ul class="wo-dashboard-attention-list">${model.attentionItems.map(renderAttentionItem).join('')}</ul>`;
  } else if (model.unavailableEntities.length > 0) {
    bodyHtml = renderErrorState({
      title: 'Attention data is incomplete',
      message: 'No action items can be confirmed until the unavailable CRM data is restored.'
    });
  } else {
    bodyHtml = renderEmptyState({
      title: 'Nothing needs immediate attention',
      description: 'No new leads, first-stage opportunities, sent quotes, or overdue follow-ups are present in the current records.'
    });
  }

  return renderCard({
    className: 'wo-dashboard-panel wo-dashboard-attention',
    headerHtml: renderDashboardPanelHeader(
      'Needs attention',
      'Actionable states derived from current CRM records.'
    ),
    bodyHtml
  });
}

function renderPipelinePanel(model: DashboardViewModel): string {
  const accessory = model.pipeline.available
    ? renderBadge({ label: `${model.pipeline.openCount} open`, variant: 'info' })
    : renderBadge({ label: 'Unavailable', variant: 'danger' });
  let bodyHtml: string;

  if (!model.pipeline.available) {
    bodyHtml = renderErrorState({
      title: 'Pipeline unavailable',
      message: 'Opportunity data could not be loaded. Retry before relying on pipeline totals.'
    });
  } else if (model.pipeline.stages.length === 0) {
    bodyHtml = renderEmptyState({
      title: 'No open opportunities',
      description: 'Open opportunities will appear here grouped by their current pipeline stage.'
    });
  } else {
    bodyHtml = `
      <div class="wo-dashboard-pipeline-summary">
        <span>Estimated open value</span>
        <strong>${escapeHtmlText(formatCurrency(model.pipeline.openValue))}</strong>
      </div>
      <ul class="wo-dashboard-distribution-list">
        ${model.pipeline.stages.map(stage => {
          const percentage = Math.max(0, Math.min(100, stage.percentage));
          return `
            <li class="wo-dashboard-distribution-row" data-dashboard-pipeline-stage>
              <div class="wo-dashboard-distribution-labels">
                <span>${escapeHtmlText(stage.stage)}</span>
                <span>${stage.count.toLocaleString('en-US')} · ${escapeHtmlText(formatCurrency(stage.value))}</span>
              </div>
              <div class="wo-dashboard-bar" role="img" aria-label="${escapeHtmlText(`${stage.stage}: ${stage.count} open opportunities, ${formatCurrency(stage.value)} estimated value`)}">
                <span class="wo-dashboard-bar-fill" style="width: ${percentage}%"></span>
              </div>
            </li>
          `;
        }).join('')}
      </ul>
    `;
  }

  return renderCard({
    className: 'wo-dashboard-panel wo-dashboard-pipeline',
    headerHtml: renderDashboardPanelHeader(
      'Open pipeline',
      'Opportunity count and estimated value by stage.',
      accessory
    ),
    bodyHtml,
    footerHtml: renderRouteButton('View opportunities', 'opportunities', 'secondary')
  });
}

function renderQuotePanel(model: DashboardViewModel): string {
  const accessory = model.quotes.available
    ? renderBadge({ label: `${model.quotes.totalCount} total`, variant: 'neutral' })
    : renderBadge({ label: 'Unavailable', variant: 'danger' });
  let bodyHtml: string;

  if (!model.quotes.available) {
    bodyHtml = renderErrorState({
      title: 'Quotes unavailable',
      message: 'Quote data could not be loaded. Retry before relying on quote counts.'
    });
  } else if (model.quotes.totalCount === 0) {
    bodyHtml = renderEmptyState({
      title: 'No quotes yet',
      description: 'Draft, sent, approved, and rejected quote records will be summarized here.'
    });
  } else {
    bodyHtml = `
      <div class="wo-dashboard-quote-value">
        <span>Sent quote value</span>
        <strong>${escapeHtmlText(formatCurrency(model.quotes.sentValue))}</strong>
        <small>Quoted value only — not earned revenue or invoice balance.</small>
      </div>
      <ul class="wo-dashboard-quote-statuses">
        ${model.quotes.statuses.map(status => `
          <li>
            ${renderBadge({ label: status.label, variant: badgeVariant(status.tone) })}
            <strong>${status.count.toLocaleString('en-US')}</strong>
          </li>
        `).join('')}
      </ul>
    `;
  }

  return renderCard({
    className: 'wo-dashboard-panel wo-dashboard-quotes',
    headerHtml: renderDashboardPanelHeader(
      'Quote workflow',
      'Current quote records, kept distinct from opportunities and invoices.',
      accessory
    ),
    bodyHtml,
    footerHtml: renderRouteButton('View quotes', 'quotes', 'secondary')
  });
}

function renderActivityRow(row: DashboardActivityRow): string {
  const dateLabel = row.status === 'Completed' ? 'Date' : row.status === 'Overdue' ? 'Was due' : 'Due';
  const dateText = formatActivityDate(row.datedAt);
  const timeHtml = dateText === 'Date unavailable'
    ? `<span>${dateText}</span>`
    : `<time datetime="${escapeHtmlText(row.datedAt)}">${escapeHtmlText(dateText)}</time>`;
  return `
    <li class="wo-dashboard-activity-row" data-dashboard-activity-row="${escapeHtmlText(row.id)}">
      <span class="wo-dashboard-activity-icon" aria-hidden="true">${ACTIVITY_ICONS[row.type]}</span>
      <div class="wo-dashboard-activity-copy">
        <div class="wo-dashboard-activity-heading">
          <strong>${escapeHtmlText(row.contactName)}</strong>
          ${renderBadge({ label: row.typeLabel, variant: 'neutral' })}
        </div>
        <p>${escapeHtmlText(row.description)}</p>
        <span class="wo-dashboard-activity-date">${escapeHtmlText(dateLabel)} ${timeHtml}</span>
      </div>
      ${renderBadge({ label: row.status, variant: badgeVariant(row.tone) })}
    </li>
  `.trim();
}

function renderActivityPanel(model: DashboardViewModel): string {
  let bodyHtml: string;
  if (!model.activities.available) {
    bodyHtml = renderErrorState({
      title: 'Activity unavailable',
      message: 'Activity data could not be loaded. Retry to restore the follow-up view.'
    });
  } else if (model.activities.rows.length === 0) {
    bodyHtml = renderEmptyState({
      title: 'No activity yet',
      description: 'Calls, notes, messages, and visits will appear here when dated records are available.'
    });
  } else {
    bodyHtml = `<ol class="wo-dashboard-activity-list">${model.activities.rows.map(renderActivityRow).join('')}</ol>`;
  }

  return renderCard({
    className: 'wo-dashboard-panel wo-dashboard-activity',
    headerHtml: renderDashboardPanelHeader(
      'Activity and follow-ups',
      'CRM records using the activity source\'s available occurrence or due date.'
    ),
    bodyHtml,
    footerHtml: renderRouteButton('View clients', 'clients', 'secondary')
  });
}

function renderLeadSourcesPanel(model: DashboardViewModel): string {
  const accessory = model.leadSources.available
    ? renderBadge({
      label: `${model.leadSources.totalLeads} active ${model.leadSources.totalLeads === 1 ? 'lead' : 'leads'}`,
      variant: 'info'
    })
    : renderBadge({ label: 'Unavailable', variant: 'danger' });
  let bodyHtml: string;

  if (!model.leadSources.available) {
    bodyHtml = renderErrorState({
      title: 'Lead sources unavailable',
      message: 'Contact data could not be loaded. Retry before relying on source counts.'
    });
  } else if (model.leadSources.sources.length === 0) {
    bodyHtml = renderEmptyState({
      title: 'No active lead sources',
      description: 'Sources will appear when active lead records are available.'
    });
  } else {
    bodyHtml = `
      <ul class="wo-dashboard-distribution-list wo-dashboard-source-list">
        ${model.leadSources.sources.map(source => {
          const percentage = Math.max(0, Math.min(100, source.percentage));
          return `
            <li class="wo-dashboard-distribution-row" data-dashboard-lead-source>
              <div class="wo-dashboard-distribution-labels">
                <span>${escapeHtmlText(source.source)}</span>
                <span>${source.count.toLocaleString('en-US')}</span>
              </div>
              <div class="wo-dashboard-bar" role="img" aria-label="${escapeHtmlText(`${source.source}: ${source.count} active leads`)}">
                <span class="wo-dashboard-bar-fill wo-dashboard-bar-fill--source" style="width: ${percentage}%"></span>
              </div>
            </li>
          `;
        }).join('')}
      </ul>
    `;
  }

  return renderCard({
    className: 'wo-dashboard-panel wo-dashboard-sources',
    headerHtml: renderDashboardPanelHeader(
      'Lead sources',
      'Where current active lead records originated.',
      accessory
    ),
    bodyHtml,
    footerHtml: renderRouteButton('View leads', 'clients', 'secondary')
  });
}

function renderPartialDataNotice(model: DashboardViewModel): string {
  if (model.unavailableEntities.length === 0) return '';
  const labels = model.unavailableEntities.map(entity => entity.label).join(', ');
  return `
    <section class="wo-dashboard-data-notice" data-crm-hydration-error role="alert" aria-labelledby="dashboard-data-notice-title">
      <span class="wo-dashboard-data-notice-icon" aria-hidden="true">
        <svg class="wo-dashboard-glyph" viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0z"/></svg>
      </span>
      <div>
        <strong id="dashboard-data-notice-title">Some Dashboard data is unavailable</strong>
        <p>${escapeHtmlText(labels)} could not be loaded. Affected metrics show unavailable instead of zero.</p>
      </div>
      ${renderButton({
        label: 'Retry data load',
        variant: 'secondary',
        size: 'md',
        attributes: { onclick: 'window.retryCrmDataLoad()' }
      })}
    </section>
  `.trim();
}

export function renderDashboardContent(model: DashboardViewModel): string {
  return `
    <div class="wo-dashboard" data-dashboard-state="ready">
      ${renderPartialDataNotice(model)}
      <section class="wo-dashboard-section" aria-labelledby="dashboard-overview-heading">
        ${renderDashboardSectionHeader(
          'dashboard-overview-heading',
          'Today at a glance',
          'The highest-signal lead, pipeline, quote, and follow-up states.'
        )}
        <div class="wo-dashboard-kpi-grid" role="list" aria-label="Business overview metrics">
          ${model.metrics.map(renderDashboardMetric).join('')}
        </div>
        ${renderAttentionPanel(model)}
      </section>

      <section class="wo-dashboard-section" aria-labelledby="dashboard-workflow-heading">
        ${renderDashboardSectionHeader(
          'dashboard-workflow-heading',
          'Sales workflow',
          'Opportunity movement and quote status without treating estimates as earned revenue.'
        )}
        <div class="wo-dashboard-workflow-grid">
          ${renderPipelinePanel(model)}
          ${renderQuotePanel(model)}
        </div>
      </section>

      <section class="wo-dashboard-section" data-dashboard-region="activity-lead-flow" aria-labelledby="dashboard-activity-heading">
        ${renderDashboardSectionHeader(
          'dashboard-activity-heading',
          'Activity and lead flow',
          'Dated CRM activity and follow-ups alongside the current active-lead source mix.'
        )}
        <div class="wo-dashboard-detail-grid">
          ${renderActivityPanel(model)}
          ${renderLeadSourcesPanel(model)}
        </div>
      </section>
    </div>
  `.trim();
}

function renderSkeletonCard(className: string): string {
  return renderCard({
    className,
    bodyHtml: `
      <span class="wo-dashboard-skeleton wo-dashboard-skeleton--label"></span>
      <span class="wo-dashboard-skeleton wo-dashboard-skeleton--value"></span>
      <span class="wo-dashboard-skeleton wo-dashboard-skeleton--copy"></span>
    `
  });
}

export function renderDashboardLoadingContent(): string {
  return `
    <div class="wo-dashboard wo-dashboard--loading" data-dashboard-state="loading" role="status" aria-live="polite" aria-busy="true">
      <span class="wo-sr-only">Loading Dashboard data.</span>
      <section class="wo-dashboard-section" aria-labelledby="dashboard-loading-overview-heading">
        ${renderDashboardSectionHeader(
          'dashboard-loading-overview-heading',
          'Today at a glance',
          'Loading lead, pipeline, quote, and follow-up data.'
        )}
        <div class="wo-dashboard-kpi-grid" aria-hidden="true">
          ${Array.from({ length: 5 }, () => renderSkeletonCard('wo-dashboard-metric wo-dashboard-skeleton-card')).join('')}
        </div>
        ${renderSkeletonCard('wo-dashboard-panel wo-dashboard-skeleton-panel')}
      </section>
      <section class="wo-dashboard-section" aria-hidden="true">
        <div class="wo-dashboard-workflow-grid">
          ${renderSkeletonCard('wo-dashboard-panel wo-dashboard-skeleton-panel')}
          ${renderSkeletonCard('wo-dashboard-panel wo-dashboard-skeleton-panel')}
        </div>
      </section>
    </div>
  `.trim();
}

export function createDashboardShellOptions(model: DashboardViewModel): ApplicationShellOptions {
  return {
    activeView: 'dashboard',
    title: 'Dashboard',
    subtitle: 'Operational overview',
    contentVariant: 'standard',
    headerActionsHtml: renderRouteButton('Add lead', 'lead-capture', 'primary'),
    contentHtml: renderDashboardContent(model)
  };
}

export function createDashboardLoadingShellOptions(): ApplicationShellOptions {
  return {
    activeView: 'dashboard',
    title: 'Dashboard',
    subtitle: 'Operational overview',
    contentVariant: 'standard',
    headerActionsHtml: renderRouteButton('Add lead', 'lead-capture', 'primary'),
    contentHtml: renderDashboardLoadingContent()
  };
}
