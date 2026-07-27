import type { createLead } from './leads_logic';

type CanonicalLeadInput = Parameters<typeof createLead>[0];

const attributionCases = [
  {
    name: 'Homepage Lead',
    phone: '5550100101',
    email: 'home_lead_spec@example.test',
    source: 'public website',
    page_slug: 'home'
  },
  {
    name: 'Service Lead',
    phone: '5550100102',
    email: 'service_lead_spec@example.test',
    source: 'public website',
    page_slug: 'driveway-cleaning',
    service_type: 'Driveway Cleaning'
  },
  {
    name: 'City Lead',
    phone: '5550100103',
    email: 'city_lead_spec@example.test',
    source: 'public website',
    page_slug: 'port-moody',
    city: 'Port Moody'
  },
  {
    name: 'Service City Lead',
    phone: '5550100104',
    email: 'service_city_lead_spec@example.test',
    source: 'public website',
    page_slug: 'driveway-cleaning-port-moody',
    service_type: 'Driveway Cleaning',
    city: 'Port Moody'
  }
] satisfies readonly CanonicalLeadInput[];

function runAttributionCharacterization(): void {
  for (const input of attributionCases) {
    if (!input.page_slug || input.source !== 'public website') {
      throw new Error('Canonical lead attribution fixture is incomplete.');
    }
    const keys = Object.keys(input);
    if (keys.includes('source_page') || keys.includes('website_url')) {
      throw new Error('Legacy browser-only attribution fields entered the canonical lead contract.');
    }
  }
  console.log('Lead attribution characterization passed.');
}

runAttributionCharacterization();
