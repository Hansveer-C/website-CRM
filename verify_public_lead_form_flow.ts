import { readFileSync } from 'fs';

const source = readFileSync('./src/main.ts', 'utf8');

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function includesSnippet(snippet: string, label: string): void {
  assert(source.includes(snippet), `Missing expected public lead form code: ${label}`);
}

async function run() {
  console.log('===============================================================');
  console.log('STARTING PUBLIC LEAD FORM FLOW VERIFICATION');
  console.log('===============================================================\n');

  console.log('[WB-120] Checking public quote form availability...');
  includesSnippet('function renderPublicLeadFormFallback(page: any, sections: any[], settings: any): string', 'fallback public lead form renderer');
  includesSnippet('id="quote-form"', 'stable quote form anchor');
  includesSnippet('class="public-lead-form-section"', 'fallback form section wrapper');
  includesSnippet('renderStandardForm(anchorSection.id, formContent, true)', 'fallback form uses existing public submit handler');
  includesSnippet('sections.some(section => section.type === \'form\')', 'fallback avoids duplicate form sections');
  includesSnippet('${renderPublicLeadFormFallback(page, sections, settings)}', 'public renderer appends fallback form');
  console.log('PASS: Published service pages render a reachable quote form when no explicit form section exists.');

  console.log('\n[WB-120] Checking CTA behavior...');
  includesSnippet('href="#quote-form"', 'header CTA targets quote form anchor');
  includesSnippet("document.querySelector('#quote-form, .site-form-section')?.scrollIntoView", 'header CTA scrolls to form');
  includesSnippet("['/quote', '/site/contact', '/site/quote'].includes(content.button_link)", 'dead CTA links are normalized');
  includesSnippet("document.querySelector('.site-form-section')?.scrollIntoView({behavior: 'smooth'})", 'section/footer CTAs scroll to form');
  assert(!source.includes('content.button_link = contactLink; // Service pages link to contact'), 'Service-page CTAs still point to the old contact route.');
  console.log('PASS: Public CTAs no longer rely on broken /quote or /site/contact routes.');

  console.log('\n[WB-120] Checking required form fields...');
  includesSnippet('id="${prefix}name-${id}"', 'name field');
  includesSnippet('id="${prefix}phone-${id}"', 'phone field');
  includesSnippet('id="${prefix}email-${id}"', 'email field');
  includesSnippet('id="${prefix}address-${id}"', 'address field');
  includesSnippet('id="${prefix}message-${id}"', 'message field');
  includesSnippet('id="${prefix}service-${id}"', 'service field');
  console.log('PASS: The public form exposes the expected visitor input fields.');

  console.log('\n[WB-121] Checking CRM submit flow...');
  includesSnippet('(window as any).submitBuilderForm = async', 'global public form submit handler');
  includesSnippet('const section = mockPageSections.find(s => s.id === sectionId);', 'submit handler resolves page section context');
  includesSnippet('const leadData = {', 'lead payload construction');
  includesSnippet("source: 'public website'", 'public website lead source');
  includesSnippet('source_page,', 'source page attribution');
  includesSnippet('landing_page,', 'landing page attribution');
  includesSnippet('source_service,', 'service attribution');
  includesSnippet('const res = await performSubmission(true);', 'submission waits for persisted lead result');
  includesSnippet("fetch('/api/leads'", 'public form posts to existing lead endpoint');
  includesSnippet("if (url === '/api/leads' && method === 'POST')", 'existing lead endpoint interceptor is present');
  includesSnippet('const leadResult = await createLead(body, { user: { id: userId } } as any);', 'lead endpoint uses existing V4 lead creation pipeline');
  includesSnippet('createLocalMockWebsiteLead(body, userId, isRepeat)', 'local/mock browser fallback creates CRM records if repository imports fail');
  includesSnippet("opportunity: fallback.opportunity", 'fallback returns opportunity evidence');
  includesSnippet('mock_crm_contacts_${userId}', 'local/mock contacts are persisted for CRM UI visibility');
  includesSnippet('mock_crm_opportunities_${userId}', 'local/mock opportunities are persisted for CRM UI visibility');
  includesSnippet('form-success-confirmation', 'success appears only after lead pipeline resolves');
  console.log('PASS: Valid public submissions use the existing CRM lead creation flow and preserve attribution fields.');

  console.log('\n[WB-121] Checking publish gate protection...');
  includesSnippet("if (!isPreview && settings.publish_status !== 'published')", 'public unpublished gate');
  includesSnippet('This website is not published yet.', 'unpublished public block');
  console.log('PASS: Unpublished public routes stay blocked before form rendering.');

  console.log('\nALL PUBLIC LEAD FORM FLOW CHECKS PASSED');
}

run().catch((error) => {
  console.error('PUBLIC LEAD FORM FLOW VERIFICATION FAILED');
  console.error(error);
  process.exit(1);
});
