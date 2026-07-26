import { WebsiteBuildBrief } from '../types';

/**
 * Deterministic Natural Language Prompt Parser for MVP Website Builder.
 * Converts plain text requests into structured WebsiteBuildBrief specifications.
 */
export function parseWebsitePrompt(prompt: string): WebsiteBuildBrief {
  const p = prompt || '';

  // 1. Detect focus mode / business type
  const isRes = /residential|homeowner|driveway|patio|deck/i.test(p);
  const isSoft = /soft\s*washing|house\s*washing|siding|gutter|roof\s*moss|moss/i.test(p);
  const isComm = /commercial|storefront|dumpster\s*pad|property\s*manager|strata|parking\s*lot/i.test(p);

  let focus: 'residential' | 'soft_washing' | 'commercial' | 'mixed' = 'residential';
  const categoriesCount = [isRes, isSoft, isComm].filter(Boolean).length;
  if (categoriesCount > 1) {
    focus = 'mixed';
  } else if (isSoft) {
    focus = 'soft_washing';
  } else if (isComm) {
    focus = 'commercial';
  } else if (isRes) {
    focus = 'residential';
  }

  // 2. Identify services offered
  const servicesMap: { name: string; pattern: RegExp }[] = [
    { name: 'Pressure Washing', pattern: /pressure\s*washing/i },
    { name: 'Driveway Cleaning', pattern: /driveway/i },
    { name: 'Sidewalk Cleaning', pattern: /sidewalk/i },
    { name: 'Patio Cleaning', pattern: /patio/i },
    { name: 'Deck Cleaning', pattern: /deck/i },
    { name: 'House Washing', pattern: /house\s*washing/i },
    { name: 'Gutter Cleaning', pattern: /gutter/i },
    { name: 'Roof Moss Treatment', pattern: /roof\s*moss|moss/i },
    { name: 'Soft Washing', pattern: /soft\s*washing/i },
    { name: 'Commercial Pressure Washing', pattern: /commercial\s*pressure|commercial\s*washing/i },
    { name: 'Storefront Cleaning', pattern: /storefront/i },
    { name: 'Dumpster Pad Cleaning', pattern: /dumpster/i },
    { name: 'Graffiti Removal', pattern: /graffiti/i }
  ];

  const services_offered: string[] = [];
  for (const item of servicesMap) {
    if (item.pattern.test(p)) {
      services_offered.push(item.name);
    }
  }

  // If no services were matched, populate standard defaults based on business focus
  if (services_offered.length === 0) {
    const defaults = {
      residential: ['Pressure Washing', 'Driveway Cleaning', 'Sidewalk Cleaning', 'Patio Cleaning', 'Deck Cleaning'],
      soft_washing: ['House Washing', 'Roof Moss Treatment', 'Gutter Cleaning', 'Soft Washing', 'Siding Cleaning'],
      commercial: ['Commercial Pressure Washing', 'Concrete Cleaning', 'Parking Lot Cleaning', 'Dumpster Pad Cleaning', 'Graffiti Removal'],
      mixed: ['Pressure Washing', 'Driveway Cleaning', 'House Washing', 'Commercial Pressure Washing', 'Gutter Cleaning']
    };
    services_offered.push(...defaults[focus]);
  }

  // 3. Identify cities served
  const citiesList = [
    'Port Moody',
    'Coquitlam',
    'Port Coquitlam',
    'Burnaby',
    'Vancouver',
    'North Vancouver',
    'West Vancouver'
  ];
  const cities_served: string[] = [];
  for (const city of citiesList) {
    if (new RegExp(city.replace(/\s+/g, '\\s*'), 'i').test(p)) {
      cities_served.push(city);
    }
  }

  // Default to all cities if none matched
  if (cities_served.length === 0) {
    cities_served.push(...citiesList);
  }

  // 4. Identify tone
  let tone: 'professional' | 'friendly' | 'bold' | 'modern' = 'professional';
  if (/friendly|approachable|community|local/i.test(p)) {
    tone = 'friendly';
  } else if (/bold|high\s*energy|concrete\s*specialist|impact/i.test(p)) {
    tone = 'bold';
  } else if (/modern|sleek|tech|accent/i.test(p)) {
    tone = 'modern';
  } else if (/professional|corporate|slate|trust/i.test(p)) {
    tone = 'professional';
  }

  // 5. Extract main offer
  let main_offer = 'Text photos for a fast quote';
  if (/10%\s*off/i.test(p)) {
    main_offer = '10% off first service';
  } else if (/15%\s*off/i.test(p)) {
    main_offer = '15% off first service';
  } else if (/20%\s*off/i.test(p)) {
    main_offer = '20% off first service';
  } else if (/free\s*estimate/i.test(p)) {
    main_offer = 'Free driveway cleaning estimate';
  } else if (/free\s*quote/i.test(p)) {
    main_offer = 'Free quote estimate';
  } else if (/site\s*visit/i.test(p)) {
    main_offer = 'Commercial site visit quote';
  } else if (/fast\s*quote/i.test(p)) {
    main_offer = 'Fast online estimate quote';
  }

  return {
    business_type: focus,
    services_offered,
    cities_served,
    tone,
    main_offer,
    focus_mode: focus,
    generate_service_pages: true,
    generate_city_pages: true,
    generate_service_city_pages: true
  };
}
