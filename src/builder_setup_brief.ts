export const BUILDER_SETUP_BRIEF_SCHEMA_VERSION = 1 as const;

export const BUILDER_SETUP_TEMPLATE_IDS = [
  'residential-lead-generation',
  'commercial-strata',
  'balanced-services',
  'compact-quote-page'
] as const;

export type BuilderSetupTemplateId = typeof BUILDER_SETUP_TEMPLATE_IDS[number];
export type BuilderSetupCustomerType = 'residential' | 'commercial-strata' | 'both';
export type BuilderSetupPrimaryGoal = 'request-quote' | 'call-business' | 'learn-services';
export type BuilderSetupStylePreset = 'clean-professional' | 'bold-high-contrast' | 'friendly-local';

export const BUILDER_SETUP_SERVICE_CATALOG = Object.freeze([
  { id: 'driveway-cleaning', label: 'Driveway cleaning' },
  { id: 'patio-cleaning', label: 'Patio cleaning' },
  { id: 'sidewalk-cleaning', label: 'Sidewalk cleaning' },
  { id: 'house-washing', label: 'House washing' },
  { id: 'building-exterior-cleaning', label: 'Building exterior cleaning' },
  { id: 'roof-moss-treatment', label: 'Roof moss treatment' },
  { id: 'gutter-cleaning', label: 'Gutter cleaning' },
  { id: 'deck-fence-cleaning', label: 'Deck and fence cleaning' },
  { id: 'commercial-storefront-cleaning', label: 'Commercial storefront cleaning' },
  { id: 'strata-property-maintenance', label: 'Strata and property maintenance' },
  { id: 'paver-cleaning', label: 'Paver cleaning' }
] as const);

export interface BuilderSetupService {
  id: string;
  label: string;
  custom?: boolean;
}

export interface BuilderSetupTrustSignals {
  insured: boolean;
  workplaceCoverage: boolean;
  locallyOwned: boolean;
  freeEstimates: boolean;
  satisfactionGuarantee: boolean;
  ecoConsciousOptions: boolean;
  commerciallyEquipped: boolean;
}

export interface BuilderSetupAssetReference {
  id: string;
  websiteId: string;
  publicUrl: string;
  altText: string;
}

export interface BuilderSetupActivePageContext {
  pageId: string;
  websiteId: string;
  pageName: string;
  slug: string;
  isHomepage: boolean;
}

export interface BuilderSetupBriefV1 {
  schemaVersion: 1;
  templateId: BuilderSetupTemplateId;
  businessName: string;
  serviceArea: string;
  publicPhone?: string;
  publicEmail?: string;
  customerType: BuilderSetupCustomerType;
  primaryGoal: BuilderSetupPrimaryGoal;
  positioningStatement?: string;
  services: BuilderSetupService[];
  primaryServiceId: string;
  trustSignals: BuilderSetupTrustSignals;
  yearsInBusiness?: number;
  reviewRating?: number;
  reviewCount?: number;
  customTrustStatement?: string;
  stylePreset: BuilderSetupStylePreset;
  primaryColor?: string;
  accentColor?: string;
  heroAsset?: BuilderSetupAssetReference;
  galleryAssets: BuilderSetupAssetReference[];
  activePageContext: BuilderSetupActivePageContext;
}

export type BuilderSetupBriefField = keyof BuilderSetupBriefV1 | 'colors' | 'assets';

export interface BuilderSetupBriefValidationIssue {
  field: BuilderSetupBriefField;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface BuilderSetupBriefValidationContext {
  activeWebsiteId?: string;
  activePageId?: string;
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const TEMPORARY_URL = /^(?:blob:|data:|filesystem:)/i;
const TEMPORARY_QUERY = /[?&](?:token|apikey|signature|x-amz-signature|expires)=/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function cleanLine(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeBuilderSetupEmail(value: string): string {
  const trimmed = value.trim();
  const index = trimmed.lastIndexOf('@');
  return index < 0 ? trimmed : `${trimmed.slice(0, index)}@${trimmed.slice(index + 1).toLowerCase()}`;
}

export function normalizeBuilderSetupHexColor(value: string): string {
  return value.trim().toLowerCase();
}

export function isDurableBuilderSetupAssetUrl(value: string): boolean {
  if (!value || TEMPORARY_URL.test(value) || TEMPORARY_QUERY.test(value) || /['"()\\\s]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function getBuilderSetupContrastRatio(left: string, right: string): number {
  if (!HEX_COLOR.test(left) || !HEX_COLOR.test(right)) return 0;
  const [lighter, darker] = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

export function readableBuilderSetupForeground(background: string): '#000000' | '#ffffff' {
  return getBuilderSetupContrastRatio(background, '#ffffff') >= 4.5 ? '#ffffff' : '#000000';
}

function defaultsTrust(value: Partial<BuilderSetupTrustSignals> | undefined): BuilderSetupTrustSignals {
  return {
    insured: value?.insured === true,
    workplaceCoverage: value?.workplaceCoverage === true,
    locallyOwned: value?.locallyOwned === true,
    freeEstimates: value?.freeEstimates === true,
    satisfactionGuarantee: value?.satisfactionGuarantee === true,
    ecoConsciousOptions: value?.ecoConsciousOptions === true,
    commerciallyEquipped: value?.commerciallyEquipped === true
  };
}

export function normalizeBuilderSetupBrief(input: BuilderSetupBriefV1): BuilderSetupBriefV1 {
  const normalizeAsset = (asset: BuilderSetupAssetReference): BuilderSetupAssetReference => ({
    id: cleanLine(asset.id),
    websiteId: cleanLine(asset.websiteId),
    publicUrl: asset.publicUrl.trim(),
    altText: cleanLine(asset.altText)
  });
  const services = input.services.map(service => ({
    id: cleanLine(service.id).toLowerCase(),
    label: cleanLine(service.label),
    ...(service.custom === true ? { custom: true } : {})
  }));
  return {
    schemaVersion: 1,
    templateId: input.templateId,
    businessName: cleanLine(input.businessName),
    serviceArea: cleanLine(input.serviceArea),
    ...(input.publicPhone?.trim() ? { publicPhone: cleanLine(input.publicPhone) } : {}),
    ...(input.publicEmail?.trim() ? { publicEmail: normalizeBuilderSetupEmail(input.publicEmail) } : {}),
    customerType: input.customerType,
    primaryGoal: input.primaryGoal,
    ...(input.positioningStatement?.trim() ? { positioningStatement: cleanLine(input.positioningStatement) } : {}),
    services,
    primaryServiceId: cleanLine(input.primaryServiceId).toLowerCase(),
    trustSignals: defaultsTrust(input.trustSignals),
    ...(input.yearsInBusiness !== undefined ? { yearsInBusiness: input.yearsInBusiness } : {}),
    ...(input.reviewRating !== undefined ? { reviewRating: input.reviewRating } : {}),
    ...(input.reviewCount !== undefined ? { reviewCount: input.reviewCount } : {}),
    ...(input.customTrustStatement?.trim() ? { customTrustStatement: cleanLine(input.customTrustStatement) } : {}),
    stylePreset: input.stylePreset,
    ...(input.primaryColor?.trim() ? { primaryColor: normalizeBuilderSetupHexColor(input.primaryColor) } : {}),
    ...(input.accentColor?.trim() ? { accentColor: normalizeBuilderSetupHexColor(input.accentColor) } : {}),
    ...(input.heroAsset ? { heroAsset: normalizeAsset(input.heroAsset) } : {}),
    galleryAssets: input.galleryAssets.map(normalizeAsset),
    activePageContext: {
      pageId: cleanLine(input.activePageContext.pageId),
      websiteId: cleanLine(input.activePageContext.websiteId),
      pageName: cleanLine(input.activePageContext.pageName),
      slug: cleanLine(input.activePageContext.slug),
      isHomepage: input.activePageContext.isHomepage === true
    }
  };
}

function error(field: BuilderSetupBriefField, code: string, message: string): BuilderSetupBriefValidationIssue {
  return { field, code, message, severity: 'error' };
}

export function validateBuilderSetupBrief(
  input: BuilderSetupBriefV1,
  context: BuilderSetupBriefValidationContext = {}
): BuilderSetupBriefValidationIssue[] {
  const issues: BuilderSetupBriefValidationIssue[] = [];
  const candidate = input as BuilderSetupBriefV1;
  if (candidate.schemaVersion !== 1) issues.push(error('schemaVersion', 'unsupported-version', 'This saved setup version is not supported.'));
  if (!(BUILDER_SETUP_TEMPLATE_IDS as readonly string[]).includes(candidate.templateId)) issues.push(error('templateId', 'unsupported-template', 'Choose an available page template.'));
  const text = (field: BuilderSetupBriefField, value: unknown, required: boolean, max: number) => {
    if (typeof value !== 'string' || (required && !value.trim())) issues.push(error(field, 'required', `${String(field)} is required.`));
    else if (CONTROL_CHARACTERS.test(value)) issues.push(error(field, 'control-character', 'Control characters are not allowed.'));
    else if (cleanLine(value).length > max) issues.push(error(field, 'too-long', `Use ${max} characters or fewer.`));
  };
  text('businessName', candidate.businessName, true, 120);
  text('serviceArea', candidate.serviceArea, true, 150);
  if (candidate.publicPhone !== undefined) {
    text('publicPhone', candidate.publicPhone, false, 50);
    if (!/^[+()\-.\s\dextEXT#]+$/.test(candidate.publicPhone) || candidate.publicPhone.split(/(?:ext\.?|x|#)/i, 1)[0].replace(/\D/g, '').length < 7 || candidate.publicPhone.split(/(?:ext\.?|x|#)/i, 1)[0].replace(/\D/g, '').length > 15) issues.push(error('publicPhone', 'invalid-phone', 'Enter a practical public phone number.'));
  }
  if (candidate.publicEmail !== undefined && (!EMAIL.test(normalizeBuilderSetupEmail(candidate.publicEmail)) || candidate.publicEmail.length > 254)) issues.push(error('publicEmail', 'invalid-email', 'Enter a valid public email address.'));
  if (candidate.positioningStatement !== undefined) text('positioningStatement', candidate.positioningStatement, false, 220);
  if (!['residential', 'commercial-strata', 'both'].includes(candidate.customerType)) issues.push(error('customerType', 'invalid-option', 'Choose a supported customer type.'));
  if (!['request-quote', 'call-business', 'learn-services'].includes(candidate.primaryGoal)) issues.push(error('primaryGoal', 'invalid-option', 'Choose a supported page goal.'));
  if ((candidate.primaryGoal === 'call-business' || candidate.primaryGoal === 'request-quote') && !candidate.publicPhone?.trim() && !candidate.publicEmail?.trim() && candidate.primaryGoal === 'call-business') issues.push(error('publicPhone', 'missing-contact-path', 'Add a public phone number for a call-focused page.'));
  if (!Array.isArray(candidate.services) || candidate.services.length === 0) issues.push(error('services', 'required', 'Select at least one service.'));
  if (candidate.services.length > 12) issues.push(error('services', 'too-many', 'Select no more than 12 services.'));
  const normalizedLabels = new Set<string>();
  candidate.services.forEach(service => {
    text('services', service.label, true, 80);
    const comparison = cleanLine(service.label).toLocaleLowerCase();
    if (normalizedLabels.has(comparison)) issues.push(error('services', 'duplicate-service', 'Each selected service must be unique.'));
    normalizedLabels.add(comparison);
    if (!service.id.trim()) issues.push(error('services', 'missing-service-id', 'Each service requires a stable ID.'));
  });
  if (!candidate.services.some(service => service.id === candidate.primaryServiceId)) issues.push(error('primaryServiceId', 'not-selected', 'The primary service must be selected.'));
  if (candidate.yearsInBusiness !== undefined && (!Number.isInteger(candidate.yearsInBusiness) || candidate.yearsInBusiness < 1 || candidate.yearsInBusiness > 200)) issues.push(error('yearsInBusiness', 'invalid-years', 'Years in business must be a whole number from 1 to 200.'));
  const hasRating = candidate.reviewRating !== undefined || candidate.reviewCount !== undefined;
  if (hasRating && (typeof candidate.reviewRating !== 'number' || !Number.isFinite(candidate.reviewRating) || candidate.reviewRating < 1 || candidate.reviewRating > 5)) issues.push(error('reviewRating', 'invalid-rating', 'Rating must be from 1 to 5.'));
  if (hasRating && (!Number.isInteger(candidate.reviewCount) || (candidate.reviewCount ?? 0) < 1 || (candidate.reviewCount ?? 0) > 10_000_000)) issues.push(error('reviewCount', 'invalid-review-count', 'Review count must be a positive whole number.'));
  if (candidate.customTrustStatement !== undefined) text('customTrustStatement', candidate.customTrustStatement, false, 140);
  if (!['clean-professional', 'bold-high-contrast', 'friendly-local'].includes(candidate.stylePreset)) issues.push(error('stylePreset', 'invalid-option', 'Choose an available visual style.'));
  for (const field of ['primaryColor', 'accentColor'] as const) if (candidate[field] !== undefined && !HEX_COLOR.test(candidate[field]!)) issues.push(error(field, 'invalid-color', 'Use a six-digit hex colour such as #2563eb.'));
  if (candidate.primaryColor && candidate.accentColor && getBuilderSetupContrastRatio(candidate.primaryColor, candidate.accentColor) < 1.25) issues.push(error('colors', 'insufficient-distinction', 'Choose primary and accent colours that are visibly distinct.'));
  const assets = [...(candidate.heroAsset ? [candidate.heroAsset] : []), ...candidate.galleryAssets];
  if (candidate.galleryAssets.length > 6) issues.push(error('assets', 'too-many-gallery-assets', 'Choose no more than six gallery images.'));
  assets.forEach(asset => {
    if (!asset.id.trim()) issues.push(error('assets', 'missing-asset-id', 'Selected images require stable IDs.'));
    if (asset.altText.length > 200 || CONTROL_CHARACTERS.test(asset.altText)) issues.push(error('assets', 'invalid-alt-text', 'Image alt text must be plain text up to 200 characters.'));
    if (!isDurableBuilderSetupAssetUrl(asset.publicUrl)) issues.push(error('assets', 'temporary-asset-url', 'Upload this image to remote media before using it in a publishable page.'));
    const expectedWebsite = context.activeWebsiteId ?? candidate.activePageContext.websiteId;
    if (asset.websiteId !== expectedWebsite) issues.push(error('assets', 'foreign-asset', 'The selected image does not belong to this website.'));
  });
  if (context.activeWebsiteId && candidate.activePageContext.websiteId !== context.activeWebsiteId) issues.push(error('activePageContext', 'website-mismatch', 'The setup belongs to a different website.'));
  if (context.activePageId && candidate.activePageContext.pageId !== context.activePageId) issues.push(error('activePageContext', 'page-mismatch', 'The setup belongs to a different page.'));
  return issues;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseBuilderSetupBrief(
  value: unknown,
  context: BuilderSetupBriefValidationContext = {}
): BuilderSetupBriefV1 | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null;
  try {
    const normalized = normalizeBuilderSetupBrief(structuredClone(value) as unknown as BuilderSetupBriefV1);
    return validateBuilderSetupBrief(normalized, context).some(issue => issue.severity === 'error') ? null : normalized;
  } catch {
    return null;
  }
}

export function sanitizeBuilderSetupBrief(input: BuilderSetupBriefV1): BuilderSetupBriefV1 {
  const normalized = normalizeBuilderSetupBrief(structuredClone(input));
  const issues = validateBuilderSetupBrief(normalized);
  if (issues.some(issue => issue.severity === 'error')) throw new Error('Builder setup brief is invalid.');
  return normalized;
}
