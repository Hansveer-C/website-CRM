import { escapeHtmlText } from '../../crm_html_output';
import type { Contact, Opportunity, Pipeline } from '../../types';
import { renderBadge, renderCard, renderEmptyState, renderStatusBadge } from '../primitives';

export interface OpportunitiesModel { userId: string; pipeline: Pipeline; opportunities: Opportunity[]; contacts: Contact[]; editable: boolean; }

export interface PipelineStageSummary { stage: string; opportunities: Opportunity[]; value: number; }

export function createPipelineStages(model: OpportunitiesModel): PipelineStageSummary[] {
  const owned = model.opportunities.filter(opportunity => opportunity.user_id === model.userId);
  return model.pipeline.stages.map(stage => {
    const opportunities = owned.filter(opportunity => opportunity.pipeline_stage === stage);
    return { stage, opportunities, value: opportunities.reduce((total, opportunity) => total + opportunity.value, 0) };
  });
}

function ownedContact(contacts: Contact[], userId: string, contactId: string): Contact | undefined {
  return contacts.find(contact => contact.user_id === userId && contact.id === contactId);
}

function renderOpportunityCard(opportunity: Opportunity, model: OpportunitiesModel): string {
  const contact = ownedContact(model.contacts, model.userId, opportunity.contact_id);
  const detail = [opportunity.service, opportunity.source, opportunity.city].find(Boolean);
  const value = `$${opportunity.value.toLocaleString()}`;
  const editableValue = model.editable
    ? `<label class="wo-sr-only" for="opportunity-value-${escapeHtmlText(opportunity.id)}">Estimated value</label><input id="opportunity-value-${escapeHtmlText(opportunity.id)}" class="wo-field-input wo-opportunity-value-input" type="number" value="${escapeHtmlText(opportunity.value)}" onclick="event.stopPropagation()" onchange="window.updateOpportunityField('${escapeHtmlText(opportunity.id)}', 'value', this.value)">`
    : `<strong class="wo-opportunity-value">${escapeHtmlText(value)}</strong>`;

  const handle = model.editable
    ? `<span class="wo-opportunity-card-handle" aria-hidden="true" title="Drag to move stage">⠿</span>`
    : '';

  const stageOptions = model.pipeline.stages.map(st => `<option value="${escapeHtmlText(st)}" ${st === opportunity.pipeline_stage ? 'selected' : ''}>${escapeHtmlText(st)}</option>`).join('');

  const stageControl = model.editable
    ? `<div class="wo-opportunity-card-stage-control"><label class="wo-sr-only" for="opportunity-stage-${escapeHtmlText(opportunity.id)}">Stage for ${escapeHtmlText(contact?.name ?? 'opportunity')}</label><select id="opportunity-stage-${escapeHtmlText(opportunity.id)}" class="wo-field-select wo-opportunity-stage-select" aria-label="Change stage for ${escapeHtmlText(contact?.name ?? 'opportunity')}" data-opportunity-id="${escapeHtmlText(opportunity.id)}" data-current-stage="${escapeHtmlText(opportunity.pipeline_stage)}">${stageOptions}</select></div>`
    : '';

  return `<article class="wo-opportunity-card" onclick="window.navigateTo('contact-detail', '${opportunity.contact_id}')" tabindex="0" role="link" aria-label="Open contact for ${escapeHtmlText(contact?.name ?? 'opportunity')}" onkeydown="if(event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')){event.preventDefault();window.navigateTo('contact-detail','${opportunity.contact_id}')}" data-opportunity-id="${escapeHtmlText(opportunity.id)}"><div class="wo-opportunity-card-heading"><strong>${escapeHtmlText(contact?.name ?? 'Contact unavailable')}</strong><div class="wo-opportunity-card-heading-actions">${handle}${renderStatusBadge(opportunity.status)}</div></div><div class="wo-opportunity-card-value"><span>Estimated value</span>${editableValue}</div>${detail ? `<p class="wo-opportunity-card-detail">${escapeHtmlText(detail)}</p>` : ''}${stageControl}${opportunity.notes ? `<p class="wo-opportunity-card-notes">${escapeHtmlText(opportunity.notes.replace(/\n/g, ' '))}</p>` : ''}</article>`;
}

export function renderOpportunitiesContent(model: OpportunitiesModel): string {
  const stages = createPipelineStages(model);
  const open = model.opportunities.filter(opportunity => opportunity.user_id === model.userId && opportunity.status === 'open');
  const openValue = open.reduce((total, opportunity) => total + opportunity.value, 0);
  const columns = stages.map(summary => {
    const stageCard = renderCard({ className: 'wo-pipeline-stage', bodyHtml: `<div class="wo-pipeline-stage-heading"><div><h2>${escapeHtmlText(summary.stage)}</h2><span>${summary.opportunities.length} ${summary.opportunities.length === 1 ? 'opportunity' : 'opportunities'}</span></div><strong>${escapeHtmlText(`$${summary.value.toLocaleString()}`)}</strong></div><div class="wo-pipeline-stage-cards" data-stage="${escapeHtmlText(summary.stage)}">${summary.opportunities.map(opportunity => renderOpportunityCard(opportunity, model)).join('') || renderEmptyState({ title: 'No opportunities', description: 'No records are currently in this stage.' })}</div>` , headerHtml: ''});
    return model.editable ? `<div class="wo-pipeline-stage-drop-target" data-stage="${escapeHtmlText(summary.stage)}">${stageCard}</div>` : stageCard;
  }).join('');
  return `<div class="wo-opportunities"><section class="wo-opportunities-context"><div><p class="wo-opportunities-eyebrow">${escapeHtmlText(model.pipeline.name)}</p><p>${open.length} open opportunities · ${escapeHtmlText(`$${openValue.toLocaleString()}`)} estimated</p></div>${model.editable ? '' : renderBadge({ label: 'Read-only in production', variant: 'neutral' })}</section><section class="wo-pipeline-board" aria-label="Sales pipeline">${columns}</section></div>`;
}
