import type { BuilderDocument } from './builder_document';
import { validateBuilderDocument } from './builder_document';
import { createBuilderDocumentFingerprint } from './builder_publication';
import { createBuilderSection, getBuilderSectionDefinition } from './builder_section_registry';
import type { BuilderPageSettingsPatch } from './builder_page_settings';
import {
  readableBuilderSetupForeground,
  sanitizeBuilderSetupBrief,
  type BuilderSetupBriefV1,
  type BuilderSetupStylePreset,
  type BuilderSetupTemplateId
} from './builder_setup_brief';

export type BuilderSetupApplyMode = 'replace' | 'append';

export interface BuilderSetupWebsiteSettingsPatch {
  build_brief: BuilderSetupBriefV1;
}

export interface BuilderGeneratedSetupPlanSummary {
  templateName: string;
  sectionTypes: string[];
  services: string[];
  trustSignals: string[];
  assetIds: string[];
  currentSectionCount: number;
  generatedSectionCount: number;
}

export interface BuilderGeneratedSetupPlan {
  schemaVersion: 1;
  planId: string;
  templateId: BuilderSetupTemplateId;
  briefSchemaVersion: 1;
  targetPageId: string;
  targetWebsiteId: string;
  actingUserId: string;
  mode: BuilderSetupApplyMode;
  sourceDocumentFingerprint: string;
  generatedDocument: BuilderDocument;
  pageSettingsPatch?: BuilderPageSettingsPatch;
  websiteSettingsPatch: BuilderSetupWebsiteSettingsPatch;
  sanitizedBuildBrief: BuilderSetupBriefV1;
  summary: BuilderGeneratedSetupPlanSummary;
}

export interface GenerateBuilderSetupPlanOptions {
  brief: BuilderSetupBriefV1;
  currentDocument: BuilderDocument;
  targetWebsiteId: string;
  actingUserId: string;
  mode: BuilderSetupApplyMode;
  applySeoMetadata?: boolean;
  planId?: string;
  createId?: () => string;
}

export const BUILDER_SETUP_TEMPLATES = Object.freeze([
  { id: 'residential-lead-generation', name: 'Residential lead generation', description: 'A complete homeowner-focused service and quote page.' },
  { id: 'commercial-strata', name: 'Commercial and strata', description: 'A professional page for property managers and commercial clients.' },
  { id: 'balanced-services', name: 'Balanced services', description: 'A flexible page for residential and commercial work.' },
  { id: 'compact-quote-page', name: 'Compact quote page', description: 'A concise page for one service or campaign.' }
] as const);

const TEMPLATE_SEQUENCES: Record<BuilderSetupTemplateId, readonly string[]> = {
  'residential-lead-generation': ['hero', 'proof', 'offer', 'gallery', 'faq', 'form'],
  'commercial-strata': ['hero', 'proof', 'offer', 'gallery', 'faq', 'form'],
  'balanced-services': ['hero', 'proof', 'offer', 'gallery', 'faq', 'form'],
  'compact-quote-page': ['hero', 'offer', 'proof', 'form', 'faq']
};

function selectedTrustSignals(brief: BuilderSetupBriefV1): string[] {
  const signals: string[] = [];
  if (brief.trustSignals.insured) signals.push('Insured');
  if (brief.trustSignals.workplaceCoverage) signals.push('WorkSafe or equivalent workplace coverage');
  if (brief.trustSignals.locallyOwned) signals.push('Locally owned');
  if (brief.trustSignals.freeEstimates) signals.push('Free estimates');
  if (brief.trustSignals.satisfactionGuarantee) signals.push('Satisfaction guarantee');
  if (brief.trustSignals.ecoConsciousOptions) signals.push('Eco-conscious options');
  if (brief.trustSignals.commerciallyEquipped) signals.push('Commercially equipped');
  if (brief.yearsInBusiness !== undefined) signals.push(`${brief.yearsInBusiness} years in business`);
  if (brief.reviewRating !== undefined && brief.reviewCount !== undefined) signals.push(`${brief.reviewRating.toFixed(1)} rating from ${brief.reviewCount.toLocaleString('en-US')} reviews`);
  if (brief.customTrustStatement) signals.push(brief.customTrustStatement);
  return signals;
}

function styleValues(preset: BuilderSetupStylePreset, primaryColor: string, accentColor: string) {
  if (preset === 'bold-high-contrast') return { padding: '96px 24px', primaryColor, accentColor };
  if (preset === 'friendly-local') return { padding: '80px 24px', primaryColor, accentColor };
  return { padding: '80px 24px', primaryColor, accentColor };
}

function serviceDescription(label: string): string {
  return `Request an assessment for ${label.toLocaleLowerCase()} at your property.`;
}

function safeDisplayCopy(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function applyGeneratedContent(
  type: string,
  section: ReturnType<typeof createBuilderSection>,
  brief: BuilderSetupBriefV1,
  trust: readonly string[],
  createId: () => string
) {
  const primaryService = brief.services.find(service => service.id === brief.primaryServiceId)!;
  const serviceNames = brief.services.map(service => service.label);
  const contactAction = brief.primaryGoal === 'call-business' && brief.publicPhone
    ? `Call ${brief.publicPhone}`
    : brief.primaryGoal === 'learn-services' ? 'Explore services' : 'Request a quote';
  const context = brief.activePageContext.isHomepage
    ? `${brief.businessName} serves ${brief.serviceArea}`
    : `${primaryService.label} in ${brief.serviceArea}`;

  if (type === 'hero') section.content = {
    heading: safeDisplayCopy(brief.positioningStatement || `${primaryService.label} in ${brief.serviceArea}`),
    subheading: safeDisplayCopy(`${context}. ${serviceDescription(primaryService.label)}`),
    button_text: safeDisplayCopy(contactAction),
    ...(brief.heroAsset ? {
      background_image: brief.heroAsset.publicUrl,
      background_image_alt: brief.heroAsset.altText
    } : {})
  };
  if (type === 'proof') section.content = {
    title: safeDisplayCopy(trust.join(' • ')),
    testimonials: []
  };
  if (type === 'offer') section.content = {
    headline: safeDisplayCopy(`${brief.activePageContext.isHomepage ? 'Pressure-washing services' : primaryService.label} for your property`),
    description: safeDisplayCopy(serviceNames.map(serviceDescription).join(' ')),
    button_text: safeDisplayCopy(contactAction),
    expiry: 'Request details for your property'
  };
  if (type === 'gallery') section.content = {
    title: 'Project gallery',
    items: brief.galleryAssets.map(asset => ({
      id: createId(),
      after: asset.publicUrl,
      alt: asset.altText
    }))
  };
  if (type === 'faq') section.content = {
    heading: 'Frequently asked questions',
    items: [
      { question: 'How do I request a quote?', answer: safeDisplayCopy(`Share the property details and the ${primaryService.label.toLocaleLowerCase()} service you need. ${brief.businessName} can then follow up about the next step.`) },
      { question: 'What should I include with my request?', answer: 'Include the service needed, property location, preferred contact details, and any access information that may help with planning.' },
      { question: 'How is scheduling arranged?', answer: 'Scheduling is confirmed after the business reviews the property details and service request.' }
    ]
  };
  if (type === 'form') section.content = {
    title: 'Request a quote',
    submit_label: 'Send quote request',
    fields: [
      { name: 'name', type: 'text', required: true, maxLength: 120 },
      { name: 'email', type: 'email', required: !brief.publicPhone, maxLength: 254 },
      { name: 'phone', type: 'phone', required: true, maxLength: 50 },
      { name: 'service_type', type: 'select', required: true, options: serviceNames },
      { name: 'message', type: 'textarea', required: false, maxLength: 2000 }
    ]
  };
  return section;
}

function generatedSeo(brief: BuilderSetupBriefV1): BuilderPageSettingsPatch {
  const primary = brief.services.find(service => service.id === brief.primaryServiceId)!;
  const title = `${primary.label} in ${brief.serviceArea} | ${brief.businessName}`.slice(0, 70);
  const description = `${brief.businessName} provides ${brief.services.map(service => service.label.toLocaleLowerCase()).join(', ')} in ${brief.serviceArea}. Request details for your property.`.slice(0, 320);
  return { seo_title: title, seo_description: description };
}

function normalizeOrders(document: BuilderDocument): BuilderDocument {
  return { ...document, sections: document.sections.map((section, order) => ({ ...section, order })) };
}

export function generateBuilderSetupPlan(options: GenerateBuilderSetupPlanOptions): BuilderGeneratedSetupPlan {
  const brief = sanitizeBuilderSetupBrief(options.brief);
  if (brief.activePageContext.pageId !== options.currentDocument.page.id || brief.activePageContext.websiteId !== options.targetWebsiteId) throw new Error('Builder setup target does not match the active page.');
  if (!options.actingUserId.trim()) throw new Error('Builder setup requires an acting user.');
  const createId = options.createId ?? (() => crypto.randomUUID());
  const planId = options.planId ?? createId();
  const trust = selectedTrustSignals(brief);
  const hasVisibleForm = options.currentDocument.sections.some(section => section.type === 'form' && section.styles?.visible !== false);
  const sequence = TEMPLATE_SEQUENCES[brief.templateId].filter(type => (
    (type !== 'proof' || trust.length > 0)
    && (type !== 'gallery' || brief.galleryAssets.length > 0)
    && !(options.mode === 'append' && type === 'form' && hasVisibleForm)
  ));
  const primaryColor = brief.primaryColor ?? '#2563eb';
  const accentColor = brief.accentColor ?? '#0f766e';
  const style = styleValues(brief.stylePreset, primaryColor, accentColor);
  const generated = sequence.map((type, index) => {
    if (!getBuilderSectionDefinition(type)) throw new Error(`Builder template requires unavailable section type: ${type}`);
    const section = applyGeneratedContent(type, createBuilderSection(type, {
      id: createId(),
      pageId: options.currentDocument.page.id,
      order: index,
      funnelId: options.currentDocument.page.funnel_id
    }), brief, trust, createId);
    section.styles = {
      ...section.styles,
      padding: style.padding,
      visible: true,
      ...(type === 'hero' ? { background: primaryColor, color: readableBuilderSetupForeground(primaryColor), text_alignment: brief.stylePreset === 'friendly-local' ? 'left' : 'center' } : {}),
      ...(type === 'offer' ? { background: accentColor, color: readableBuilderSetupForeground(accentColor) } : {})
    };
    if (type === 'gallery') section.variant = 'grid';
    return section;
  });
  const sections = options.mode === 'append'
    ? [...structuredClone(options.currentDocument.sections), ...generated]
    : generated;
  const generatedDocument = normalizeOrders({
    ...structuredClone(options.currentDocument),
    sections
  });
  const issues = validateBuilderDocument(generatedDocument);
  if (issues.length) throw new Error(`Generated BuilderDocument is invalid: ${issues[0].code}`);
  const template = BUILDER_SETUP_TEMPLATES.find(item => item.id === brief.templateId)!;
  const plan: BuilderGeneratedSetupPlan = {
    schemaVersion: 1,
    planId,
    templateId: brief.templateId,
    briefSchemaVersion: 1,
    targetPageId: brief.activePageContext.pageId,
    targetWebsiteId: options.targetWebsiteId,
    actingUserId: options.actingUserId,
    mode: options.mode,
    sourceDocumentFingerprint: createBuilderDocumentFingerprint(options.currentDocument),
    generatedDocument,
    ...(options.applySeoMetadata ? { pageSettingsPatch: generatedSeo(brief) } : {}),
    websiteSettingsPatch: { build_brief: structuredClone(brief) },
    sanitizedBuildBrief: structuredClone(brief),
    summary: {
      templateName: template.name,
      sectionTypes: generated.map(section => section.type),
      services: brief.services.map(service => service.label),
      trustSignals: trust,
      assetIds: [...(brief.heroAsset ? [brief.heroAsset.id] : []), ...brief.galleryAssets.map(asset => asset.id)],
      currentSectionCount: options.currentDocument.sections.length,
      generatedSectionCount: generated.length
    }
  };
  return structuredClone(plan);
}

export function isBuilderSetupPlanCurrent(
  plan: BuilderGeneratedSetupPlan,
  context: { document: BuilderDocument; websiteId: string; pageId: string; actingUserId: string; availableAssetIds?: readonly string[] }
): boolean {
  if (plan.targetWebsiteId !== context.websiteId || plan.targetPageId !== context.pageId || plan.actingUserId !== context.actingUserId) return false;
  if (plan.sourceDocumentFingerprint !== createBuilderDocumentFingerprint(context.document)) return false;
  if (context.availableAssetIds) {
    const available = new Set(context.availableAssetIds);
    if (plan.summary.assetIds.some(id => !available.has(id))) return false;
  }
  return true;
}
