import type { BuilderSetupBriefV1 } from './builder_setup_brief';

export function validBuilderSetupBrief(): BuilderSetupBriefV1 {
  return {
    schemaVersion: 1,
    templateId: 'residential-lead-generation',
    businessName: 'Lavé & Sons',
    serviceArea: 'Tri-Cities and Burnaby',
    publicPhone: '(604) 555-0100',
    publicEmail: 'Hello@EXAMPLE.COM',
    customerType: 'residential',
    primaryGoal: 'request-quote',
    services: [{ id: 'driveway-cleaning', label: 'Driveway cleaning' }],
    primaryServiceId: 'driveway-cleaning',
    trustSignals: {
      insured: false, workplaceCoverage: false, locallyOwned: false,
      freeEstimates: false, satisfactionGuarantee: false,
      ecoConsciousOptions: false, commerciallyEquipped: false
    },
    stylePreset: 'clean-professional',
    primaryColor: '#2563EB',
    accentColor: '#F59E0B',
    galleryAssets: [],
    activePageContext: { pageId: 'page-1', websiteId: 'site-1', pageName: 'Home', slug: 'home', isHomepage: true }
  };
}
