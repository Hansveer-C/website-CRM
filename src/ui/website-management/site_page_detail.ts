import { escapeHtmlText } from '../../crm_html_output';
import { renderCard, renderEmptyState, renderErrorState, renderSpinner, renderStatusBadge } from '../primitives';

export interface SitePageDetailRoute { id: string; path: string; publicUrl: string | null; }
export interface SitePageDetailStep { id: string; step_type: string; name: string; slug: string; }
export interface SitePageDetailActivity { id: string; eventName: string; contactName: string; createdAt: string; }
export interface SitePageDetailModel {
  funnelId: string; name: string; status: string; routes: SitePageDetailRoute[];
  metrics: { totalLeads: number; leadsToday: number; leadsThisWeek: number; responseTime: string };
  steps: SitePageDetailStep[]; activities: SitePageDetailActivity[];
}
export interface SitePageDetailRenderInput { model: SitePageDetailModel; renderAttachAction: (funnelId: string) => string; renderEditAction: (stepId: string, funnelId: string) => string; }

function activityPresentation(eventName: string): { icon: string; label: string } {
  const normalized = eventName.toLowerCase();
  if (normalized.includes('lead')) return { icon: '◉', label: 'Lead Captured' };
  if (normalized.includes('sms')) return { icon: '↗', label: 'SMS Sent' };
  if (normalized.includes('call')) return { icon: '☎', label: 'Missed Call' };
  return { icon: '•', label: eventName.replace(/_/g, ' ') || 'Activity' };
}
function formatActivityTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}
export function renderSitePageDetailLoading(): string {
  return `<section class="wo-site-page-detail wo-site-page-detail--state">${renderCard({ className: 'wo-site-page-detail-state', bodyHtml: `<div class="wo-site-page-detail-loading" role="status" aria-live="polite">${renderSpinner({ ariaLabel: 'Loading Site Page details…' })}<span>Loading Site Page details…</span></div>` })}</section>`;
}
export function renderSitePageDetailError(message: string, retryActionHtml: string): string {
  return `<section class="wo-site-page-detail wo-site-page-detail--state">${renderErrorState({ title: 'Site Page unavailable', message, retryActionHtml, className: 'wo-site-page-detail-state' })}</section>`;
}
export function renderSitePageDetail(input: SitePageDetailRenderInput): string {
  const { model } = input;
  const connected = model.routes.length > 0;
  const connectionDetail = connected ? `<ul class="wo-site-page-detail-routes">${model.routes.map(route => `<li>${route.publicUrl ? `<a href="${escapeHtmlText(route.publicUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtmlText(route.publicUrl)}</a>` : `<code>${escapeHtmlText(route.path)}</code>`}</li>`).join('')}</ul>` : '<p>This page is not attached to an owned website route yet.</p>';
  const connection = renderCard({ className: `wo-site-page-detail-connection ${connected ? 'wo-site-page-detail-connection--connected' : 'wo-site-page-detail-connection--disconnected'}`, headerHtml: `<div class="wo-site-page-detail-card-heading"><div><span class="wo-site-page-detail-eyebrow">${connected ? 'Connected to Website' : 'Not Connected to Website'}</span><h2>${connected ? 'Website connection' : 'Attach this page'}</h2></div>${renderStatusBadge(model.status)}</div>`, bodyHtml: `<div class="wo-site-page-detail-connection-body">${connectionDetail}${input.renderAttachAction(model.funnelId)}</div>` });
  const metrics = [[String(model.metrics.totalLeads), 'Total Leads'], [String(model.metrics.leadsToday), 'Leads Today'], [String(model.metrics.leadsThisWeek), 'Leads This Week'], [model.metrics.responseTime, 'Avg. response time']].map(([value, label]) => renderCard({ className: 'wo-site-page-detail-metric', bodyHtml: `<strong>${escapeHtmlText(value)}</strong><span>${escapeHtmlText(label)}</span>` })).join('');
  const steps = model.steps.length ? `<ol class="wo-site-page-detail-steps">${model.steps.map((step, index) => `<li class="wo-site-page-detail-step"><span class="wo-site-page-detail-step-number" aria-hidden="true">${index + 1}</span><div class="wo-site-page-detail-step-card">${renderCard({ bodyHtml: `<div><span class="wo-site-page-detail-eyebrow">${escapeHtmlText(step.step_type)}</span><h3>${escapeHtmlText(step.name)}</h3><code>/${escapeHtmlText(step.slug)}</code></div>${input.renderEditAction(step.id, model.funnelId)}` })}</div></li>`).join('')}</ol>` : renderEmptyState({ title: 'No Page Sections yet', description: 'This Site Page has no editable sections yet.' });
  const activities = model.activities.length ? `<div class="wo-site-page-detail-activity-list">${model.activities.map(activity => { const presentation = activityPresentation(activity.eventName); return `<div class="wo-site-page-detail-activity"><span class="wo-site-page-detail-activity-icon" aria-hidden="true">${presentation.icon}</span><div><strong>${escapeHtmlText(activity.contactName || 'Lead')}</strong><span>${escapeHtmlText(presentation.label)}</span></div><time datetime="${escapeHtmlText(activity.createdAt)}">${escapeHtmlText(formatActivityTime(activity.createdAt))}</time></div>`; }).join('')}</div>` : renderEmptyState({ title: 'No activity yet', description: 'Activity for leads captured by this page will appear here.' });
  return `<section class="wo-site-page-detail" aria-label="Site Page detail">${connection}<section class="wo-site-page-detail-metrics" aria-label="Page metrics">${metrics}</section><div class="wo-site-page-detail-grid"><section aria-labelledby="site-page-sections-heading"><h2 id="site-page-sections-heading">Page Sections</h2>${steps}</section><section aria-labelledby="site-page-activity-heading">${renderCard({ className: 'wo-site-page-detail-activity-card', headerHtml: '<h2 id="site-page-activity-heading">Recent Activity</h2>', bodyHtml: activities })}</section></div></section>`;
}
