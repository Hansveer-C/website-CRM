import { escapeHtmlText } from '../../crm_html_output';
import type { WebsiteDashboardModel } from '../../website_dashboard_model';
import type { Website } from '../../types';
import { renderBadge, renderCard } from '../primitives';

type ActionKey = 'edit' | 'pages' | 'settings' | 'assets' | 'guidedSetup' | 'preview' | 'publish';

export interface WebsiteDashboardReadyInput {
  model: WebsiteDashboardModel;
  websites: readonly Website[];
  selectedSubdomain?: string | null;
  warning?: string;
  publicationLabel: string;
  renderAction: (key: ActionKey, label: string, pageId?: string | null) => string;
}

const formatPublishedAt = (value: string | null) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Not available';
};

export function renderWebsiteDashboardReady(input: WebsiteDashboardReadyInput): string {
  const { model } = input;
  const host = model.website.publicHost ?? input.selectedSubdomain ?? 'Public domain not configured';
  const warning = input.warning ? `<div class="wo-website-dashboard-warning" role="alert">${escapeHtmlText(input.warning)} <button type="button" class="wo-button wo-button--secondary wo-button--sm" onclick="window.refreshWebsiteDashboard()">Retry</button></div>` : '';
  const switcher = input.websites.length > 1 ? `<div class="wo-website-dashboard-switcher"><label class="wo-label" for="dashboard-website-select">Active website</label><select class="wo-select" id="dashboard-website-select" onchange="window.selectDashboardWebsite(this.value)">${input.websites.map(site => `<option value="${escapeHtmlText(site.id)}" ${site.id === model.website.id ? 'selected' : ''}>${escapeHtmlText(site.name)}${site.domain ? ` — ${escapeHtmlText(site.domain)}` : ''}</option>`).join('')}</select></div>` : '';
  const liveAction = model.publicUrl ? `<a class="wo-button wo-button--primary" href="${escapeHtmlText(model.publicUrl)}" target="_blank" rel="noopener noreferrer">View Live Site <span aria-hidden="true">↗</span><span class="wo-sr-only"> (opens in a new tab)</span></a>` : `<button type="button" class="wo-button wo-button--secondary" disabled title="${escapeHtmlText(model.actions.viewLive.reason ?? '')}">View Live Site</button>`;
  const homepageFacts = model.homepage.name ? `<dl class="wo-website-dashboard-facts"><div><dt>Path</dt><dd>${escapeHtmlText(model.homepage.path ?? 'Not available')}</dd></div><div><dt>Page row status</dt><dd>${escapeHtmlText(model.homepage.legacyPageStatus ?? 'Not available')}</dd></div><div><dt>Last published</dt><dd>${escapeHtmlText(formatPublishedAt(model.homepage.lastPublishedAt))}</dd></div></dl>` : '<p>No editable homepage was found for this website. Open Pages to review the website structure.</p>';
  const identity = renderCard({ className: 'wo-website-dashboard-identity', bodyHtml: `<div><span class="wo-website-dashboard-eyebrow">Active website</span><h2 id="dashboard-site-heading">${escapeHtmlText(model.website.name)}</h2><p>${escapeHtmlText(host)}</p></div>${liveAction}` });
  const home = renderCard({ className: 'wo-website-dashboard-home', headerHtml: `<div class="wo-website-dashboard-card-heading"><div><span class="wo-website-dashboard-eyebrow">Homepage</span><h2 id="dashboard-home-heading">${escapeHtmlText(model.homepage.name ?? 'No editable homepage found')}</h2></div>${renderBadge({ label: input.publicationLabel, variant: model.homepage.publicationState === 'published' ? 'success' : model.homepage.publicationState === 'unavailable' ? 'danger' : 'warning' })}</div>`, bodyHtml: `${homepageFacts}<div class="wo-website-dashboard-primary-actions">${input.renderAction('edit', 'Edit Home Page', model.homepage.id)}${input.renderAction('preview', 'Preview Draft', model.homepage.id)}${input.renderAction('publish', 'Publish', model.homepage.id)}</div>` });
  const quick = renderCard({ className: 'wo-website-dashboard-quick', headerHtml: '<h2 id="dashboard-quick-heading">Quick actions</h2>', bodyHtml: `<div class="wo-website-dashboard-quick-actions">${input.renderAction('pages', 'Manage Pages')}${input.renderAction('guidedSetup', 'Guided Setup')}${input.renderAction('assets', 'Assets')}${input.renderAction('settings', 'Page Settings')}</div>` });
  const media = model.counts.mediaAssets === null ? ['—', 'Media count unavailable'] : [String(model.counts.mediaAssets), 'Media assets'];
  const summary = `<section class="wo-website-dashboard-summary" aria-label="Website summary">${[[String(model.counts.pages), 'Website pages'], [String(model.counts.draftPages), 'Draft page rows'], media, [model.readiness.setupBriefVersion ? `v${model.readiness.setupBriefVersion}` : '—', 'Guided setup brief']].map(([value, label]) => renderCard({ className: 'wo-website-dashboard-summary-card', bodyHtml: `<strong>${escapeHtmlText(value)}</strong><span>${escapeHtmlText(label)}</span>` })).join('')}</section>`;
  return `<section class="wo-website-dashboard" aria-labelledby="dashboard-site-heading">${warning}${switcher}${identity}<div class="wo-website-dashboard-grid">${home}${quick}</div>${summary}</section>`;
}
