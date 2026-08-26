import { escapeHtmlText } from '../../crm_html_output';
import type { Website } from '../../types';
import { createLocalSeoRoutePath, type LocalSeoInventoryItem } from '../../local_seo_generation_contract';
import { renderButton, renderCard, renderEmptyState, renderField, renderTextarea } from '../primitives';

export interface LocalSeoWizardState {
  mode: 'list' | 'wizard';
  step: 1 | 2 | 3;
  services: string[];
  cities: string[];
  websiteId: string | null;
  error?: string;
  isSubmitting?: boolean;
}

export function createLocalSeoPreviews(services: readonly string[], cities: readonly string[]): string[] {
  return services.flatMap(service => cities.map(city => createLocalSeoRoutePath(service, city)));
}

export function withLocalSeoWizardDraft(state: LocalSeoWizardState, nextStep: 1 | 2 | 3, values: { services?: string; cities?: string }): LocalSeoWizardState {
  const split = (value: string | undefined) => (value || '').split(',').map(entry => entry.trim()).filter(Boolean);
  if (state.step === 1 && nextStep === 2) return { ...state, services: split(values.services) };
  if (state.step === 2 && (nextStep === 1 || nextStep === 3)) return { ...state, cities: split(values.cities) };
  return state;
}

export function createLocalSeoPublicUrl(website: Website, path: string): string | null {
  const host = website.domain || `${website.subdomain}.pressurepro.io`;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(host)) return null;
  if (path.startsWith('//') || !/^\/[A-Za-z0-9._~!$&'()*+,;=:@/%-]*$/.test(path)) return null;
  return `https://${host}${path}`;
}

export function createLocalSeoViewModel(input: { userId: string; activeWebsiteId: string | null; websites: readonly Website[]; pages: readonly LocalSeoInventoryItem[] }) {
  const website = input.websites.find(site => site.user_id === input.userId && site.id === input.activeWebsiteId);
  return { website, pages: website ? input.pages.filter(page => page.website_id === website.id) : [] };
}

export function renderLocalSeoList(input: { website: Website; pages: readonly LocalSeoInventoryItem[]; batchAction: string; viewAction: (page: LocalSeoInventoryItem) => string; deleteAction: (page: LocalSeoInventoryItem) => string }): string {
  const rows = input.pages.map(page => `<tr class="wo-local-seo-row"><td data-label="Service"><strong>${escapeHtmlText(page.service || 'Service page')}</strong><span>${escapeHtmlText(page.city || 'Location not specified')}</span></td><td data-label="Route"><code>${escapeHtmlText(page.path)}</code><span>${page.publication_state === 'draft' ? 'Draft' : 'Live'}</span></td><td data-label="Actions"><div class="wo-local-seo-actions">${input.viewAction(page)}${input.deleteAction(page)}</div></td></tr>`).join('');
  const inventory = rows ? `<div class="wo-local-seo-table-wrap"><table class="wo-local-seo-table"><thead><tr><th>Service &amp; location</th><th>Route</th><th><span class="wo-sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>` : renderEmptyState({ title: 'No Local SEO pages yet', description: 'Add service and location combinations to create focused local landing pages.' });
  return `<section class="wo-local-seo" aria-label="Local SEO Hub"><div class="wo-local-seo-heading"><div><span class="wo-local-seo-eyebrow">${escapeHtmlText(input.website.name)}</span><h2>Local SEO pages</h2><p>${input.pages.length} generated ${input.pages.length === 1 ? 'page' : 'pages'} for this website.</p></div>${renderButton({ label: 'Batch Generate Pages', variant: 'primary', attributes: { onclick: input.batchAction } })}</div>${renderCard({ className: 'wo-local-seo-card', bodyHtml: inventory })}</section>`;
}

function progress(step: number): string {
  return `<div class="wo-local-seo-progress" role="progressbar" aria-label="SEO generation progress" aria-valuemin="1" aria-valuemax="3" aria-valuenow="${step}"><span>Step ${step} of 3</span><div class="wo-local-seo-progress-track" aria-hidden="true"><span style="width:${(step / 3) * 100}%"></span></div></div>`;
}

export function renderLocalSeoWizard(input: { state: LocalSeoWizardState; website: Website; nextAction: (step: 1 | 2 | 3) => string; generateAction: string }): string {
  const { state } = input;
  const error = state.error || undefined;
  let body = '';
  if (state.step === 1) {
    body = `${renderField({ id: 'wizard-services', label: 'Services', required: true, helperText: 'Separate each service with a comma.', errorMessage: error, controlHtml: renderTextarea({ id: 'wizard-services', name: 'services', value: state.services.join(', '), rows: 5, placeholder: 'e.g. Driveway Cleaning, Roof Cleaning, House Washing', describedBy: 'wizard-services-helper wizard-services-error' }) })}<div class="wo-local-seo-wizard-actions wo-local-seo-wizard-actions--end">${renderButton({ label: 'Next: Locations', variant: 'primary', attributes: { onclick: input.nextAction(2) } })}</div>`;
  } else if (state.step === 2) {
    body = `${renderField({ id: 'wizard-cities', label: 'Cities, neighborhoods, or service areas', required: true, helperText: 'Separate each location with a comma.', errorMessage: error, controlHtml: renderTextarea({ id: 'wizard-cities', name: 'cities', value: state.cities.join(', '), rows: 5, placeholder: 'e.g. Port Moody, Coquitlam, Burnaby', describedBy: 'wizard-cities-helper wizard-cities-error' }) })}<div class="wo-local-seo-wizard-actions">${renderButton({ label: 'Back', variant: 'secondary', attributes: { onclick: input.nextAction(1) } })}${renderButton({ label: 'Next: Preview', variant: 'primary', attributes: { onclick: input.nextAction(3) } })}</div>`;
  } else {
    const previews = createLocalSeoPreviews(state.services, state.cities);
    body = `<div class="wo-local-seo-preview-summary"><div><strong>${state.services.length}</strong><span>services</span></div><div><strong>${state.cities.length}</strong><span>locations</span></div><div><strong>${previews.length}</strong><span>draft pages to create</span></div></div><div class="wo-local-seo-preview-list" aria-label="Generated route previews">${previews.slice(0, 10).map(preview => `<code>${escapeHtmlText(preview)}</code>`).join('')}${previews.length > 10 ? `<span>…and ${previews.length - 10} more</span>` : ''}</div>${error ? `<p class="wo-local-seo-error" role="alert">${escapeHtmlText(error)}</p>` : ''}<div class="wo-local-seo-wizard-actions">${renderButton({ label: 'Back', variant: 'secondary', attributes: { onclick: input.nextAction(2) } })}${renderButton({ label: 'Generate draft pages', variant: 'primary', loading: Boolean(state.isSubmitting), disabled: Boolean(state.isSubmitting), attributes: { id: 'local-seo-generate', onclick: input.generateAction } })}</div>`;
  }
  return `<section class="wo-local-seo wo-local-seo-wizard" aria-label="Local SEO page generator"><div class="wo-local-seo-heading"><div><span class="wo-local-seo-eyebrow">${escapeHtmlText(input.website.name)}</span><h2>Generate Local SEO drafts</h2><p>Create draft service and location pages, then publish your website to make them live.</p></div>${progress(state.step)}</div>${renderCard({ className: 'wo-local-seo-card wo-local-seo-wizard-card', bodyHtml: `<h3>Step ${state.step}: ${state.step === 1 ? 'Services' : state.step === 2 ? 'Locations' : 'Preview generation'}</h3><div class="wo-local-seo-wizard-body">${body}</div>` })}</section>`;
}
