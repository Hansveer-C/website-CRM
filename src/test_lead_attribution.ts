import { createLead } from './leads_logic';
import { getContact } from './contacts_repo';
import { getOpportunitiesByContact } from './opportunities_repo';
import { initDB, closeDB } from './database';

async function runAttributionVerification() {
  console.log('================================================');
  console.log('   LEAD SOURCE ATTRIBUTION VERIFICATION SUITE   ');
  console.log('================================================\n');

  let db;
  try {
    db = initDB();
  } catch (e) {
    console.error('Failed to init DB:', e);
    process.exit(1);
  }

  // Helper to cleanup specific tests
  const cleanup = (email: string) => {
    db.prepare('DELETE FROM contacts WHERE email = ?').run(email);
  };

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Homepage Lead
    // -------------------------------------------------------------------------
    console.log('[TEST 1] Homepage Lead...');
    const email1 = 'home_lead_spec@test.com';
    cleanup(email1);

    const res1 = await createLead({
      name: 'Home Lead User Spec',
      phone: '1112223330',
      email: email1,
      source_page: '/',
      source_page_type: 'homepage',
      landing_page: '/',
      referrer: 'https://google.com'
    });

    const contact1 = (await getContact(res1.contactId, 'system')).data;
    const opp1 = (await getOpportunitiesByContact(res1.contactId, 'system')).data?.[0];

    if (!contact1 || !opp1) throw new Error('Test 1 failed: Contact or opportunity not persisted.');

    console.log('Contact Notes:\n', contact1.notes);
    console.log('Opportunity Notes:\n', opp1.notes);

    const expectedBlock1 = 
      `Lead Attribution:\n` +
      `- Source Page: /\n` +
      `- Page Type: homepage\n` +
      `- Service: N/A\n` +
      `- City: N/A\n` +
      `- Referrer: https://google.com`;

    if (!contact1.notes?.includes(expectedBlock1)) {
      throw new Error(`Test 1 failed: Contact notes attribution block is incorrect.\nExpected:\n${expectedBlock1}\nActual:\n${contact1.notes}`);
    }
    if (!opp1.notes?.includes(expectedBlock1)) {
      throw new Error(`Test 1 failed: Opportunity notes attribution block is incorrect.\nExpected:\n${expectedBlock1}\nActual:\n${opp1.notes}`);
    }
    console.log('✅ TEST 1 PASSED: Homepage lead attribution verified.\n');

    // -------------------------------------------------------------------------
    // TEST 2: Service Page Lead
    // -------------------------------------------------------------------------
    console.log('[TEST 2] Service Page Lead...');
    const email2 = 'service_lead_spec@test.com';
    cleanup(email2);

    const res2 = await createLead({
      name: 'Service Lead User Spec',
      phone: '1112224440',
      email: email2,
      source_page: '/driveway-cleaning',
      source_page_type: 'service',
      source_service: 'Driveway Cleaning',
      landing_page: '/driveway-cleaning',
      referrer: 'https://bing.com'
    });

    const contact2 = (await getContact(res2.contactId, 'system')).data;
    const opp2 = (await getOpportunitiesByContact(res2.contactId, 'system')).data?.[0];

    if (!contact2 || !opp2) throw new Error('Test 2 failed: Contact or opportunity not persisted.');

    const expectedBlock2 = 
      `Lead Attribution:\n` +
      `- Source Page: /driveway-cleaning\n` +
      `- Page Type: service\n` +
      `- Service: Driveway Cleaning\n` +
      `- City: N/A\n` +
      `- Referrer: https://bing.com`;

    if (!contact2.notes?.includes(expectedBlock2)) {
      throw new Error(`Test 2 failed: Contact notes attribution is incorrect.\nExpected:\n${expectedBlock2}\nActual:\n${contact2.notes}`);
    }
    if (opp2.service !== 'Driveway Cleaning') {
      throw new Error(`Test 2 failed: Opportunity service field was not populated. Value: ${opp2.service}`);
    }
    console.log('✅ TEST 2 PASSED: Service Page lead attribution verified.\n');

    // -------------------------------------------------------------------------
    // TEST 3: City Page Lead
    // -------------------------------------------------------------------------
    console.log('[TEST 3] City Page Lead...');
    const email3 = 'city_lead_spec@test.com';
    cleanup(email3);

    const res3 = await createLead({
      name: 'City Lead User Spec',
      phone: '1112225550',
      email: email3,
      source_page: '/port-moody',
      source_page_type: 'city',
      source_city: 'Port Moody',
      landing_page: '/port-moody',
      referrer: 'https://duckduckgo.com'
    });

    const contact3 = (await getContact(res3.contactId, 'system')).data;
    const opp3 = (await getOpportunitiesByContact(res3.contactId, 'system')).data?.[0];

    if (!contact3 || !opp3) throw new Error('Test 3 failed: Contact or opportunity not persisted.');

    const expectedBlock3 = 
      `Lead Attribution:\n` +
      `- Source Page: /port-moody\n` +
      `- Page Type: city\n` +
      `- Service: N/A\n` +
      `- City: Port Moody\n` +
      `- Referrer: https://duckduckgo.com`;

    if (!contact3.notes?.includes(expectedBlock3)) {
      throw new Error(`Test 3 failed: Contact notes attribution is incorrect.\nExpected:\n${expectedBlock3}\nActual:\n${contact3.notes}`);
    }
    if (opp3.city !== 'Port Moody') {
      throw new Error(`Test 3 failed: Opportunity city field was not populated. Value: ${opp3.city}`);
    }
    console.log('✅ TEST 3 PASSED: City Page lead attribution verified.\n');

    // -------------------------------------------------------------------------
    // TEST 4: Service + City Page Lead
    // -------------------------------------------------------------------------
    console.log('[TEST 4] Service + City Page Lead...');
    const email4 = 'service_city_lead_spec@test.com';
    cleanup(email4);

    const res4 = await createLead({
      name: 'Service + City Lead User Spec',
      phone: '1112226660',
      email: email4,
      source_page: '/driveway-cleaning-port-moody',
      source_page_type: 'service_city',
      source_service: 'Driveway Cleaning',
      source_city: 'Port Moody',
      landing_page: '/driveway-cleaning-port-moody',
      referrer: ''
    });

    const contact4 = (await getContact(res4.contactId, 'system')).data;
    const opp4 = (await getOpportunitiesByContact(res4.contactId, 'system')).data?.[0];

    if (!contact4 || !opp4) throw new Error('Test 4 failed: Contact or opportunity not persisted.');

    const expectedBlock4 = 
      `Lead Attribution:\n` +
      `- Source Page: /driveway-cleaning-port-moody\n` +
      `- Page Type: service_city\n` +
      `- Service: Driveway Cleaning\n` +
      `- City: Port Moody\n` +
      `- Referrer: `;

    if (!contact4.notes?.includes(expectedBlock4)) {
      throw new Error(`Test 4 failed: Contact notes attribution is incorrect.\nExpected:\n${expectedBlock4}\nActual:\n${contact4.notes}`);
    }
    if (opp4.service !== 'Driveway Cleaning' || opp4.city !== 'Port Moody') {
      throw new Error(`Test 4 failed: Opportunity service/city fields incorrect. Service: ${opp4.service}, City: ${opp4.city}`);
    }
    console.log('✅ TEST 4 PASSED: Service + City Page lead attribution verified.\n');

    // -------------------------------------------------------------------------
    // TEST 5: Duplicate Lead Notes Appending
    // -------------------------------------------------------------------------
    console.log('[TEST 5] Duplicate Lead (Note Appending Verification)...');
    const email5 = 'duplicate_lead_spec@test.com';
    cleanup(email5);

    // Initial lead capture
    const res5a = await createLead({
      name: 'Duplicate Lead User Spec',
      phone: '1112227770',
      email: email5,
      source_page: '/',
      source_page_type: 'homepage',
      landing_page: '/'
    });

    // Same lead submits again from a different source
    const res5b = await createLead({
      name: 'Duplicate Lead User Spec',
      phone: '1112227770',
      email: email5,
      source_page: '/driveway-cleaning',
      source_page_type: 'service',
      source_service: 'Driveway Cleaning',
      landing_page: '/driveway-cleaning'
    });

    if (res5a.contactId !== res5b.contactId) {
      throw new Error(`Test 5 failed: Duplicate lead created a new contact ID instead of reusing: ${res5a.contactId} vs ${res5b.contactId}`);
    }

    const contact5 = (await getContact(res5a.contactId, 'system')).data;
    const opp5 = (await getOpportunitiesByContact(res5a.contactId, 'system')).data?.[0];

    if (!contact5 || !opp5) throw new Error('Test 5 failed: Contact or opportunity is missing.');

    console.log('Aggregated Contact Notes:\n', contact5.notes);

    // Check that BOTH attribution blocks exist in the notes
    if (!contact5.notes?.includes('Page Type: homepage') || !contact5.notes?.includes('Page Type: service')) {
      throw new Error('Test 5 failed: Contact notes did not aggregate both attribution blocks.');
    }

    if (!opp5.notes?.includes('Page Type: homepage') || !opp5.notes?.includes('Page Type: service')) {
      throw new Error('Test 5 failed: Opportunity notes did not aggregate both attribution blocks.');
    }

    // Opportunity should also have service updated
    if (opp5.service !== 'Driveway Cleaning') {
      throw new Error(`Test 5 failed: Opportunity service was not updated upon duplicate lead ingestion. Service: ${opp5.service}`);
    }

    console.log('✅ TEST 5 PASSED: Duplicate lead note concatenation verified.\n');

    // -------------------------------------------------------------------------
    // TEST 6: Honeypot Spam Protection
    // -------------------------------------------------------------------------
    console.log('[TEST 6] Honeypot Spam Protection...');
    const email6 = 'spam_bot_spec@test.com';
    cleanup(email6);

    const res6 = await createLead({
      name: 'Spam Bot Spec',
      phone: '9999999990',
      email: email6,
      website_url: 'http://spam-link-bot.com',
      source_page: '/',
      landing_page: '/'
    });

    if (res6.contactId !== 'spam-blocked' || res6.opportunityId !== 'spam-blocked') {
      throw new Error(`Test 6 failed: Spam was not correctly blocked. Returned keys: ${res6.contactId}, ${res6.opportunityId}`);
    }

    // Verify nothing got persisted in DB for spam_bot_spec@test.com
    const findSpamQuery = db.prepare('SELECT id FROM contacts WHERE email = ?').get(email6);
    if (findSpamQuery) {
      throw new Error('Test 6 failed: Spam lead contact was persisted in SQLite database.');
    }

    console.log('✅ TEST 6 PASSED: Honeypot successfully blocked and ignored spam.\n');

    console.log('================================================');
    console.log('   ALL ATTRIBUTION TESTS PASSED SUCCESSFULLY!    ');
    console.log('================================================');

  } catch (err) {
    console.error('\n❌ ATTRIBUTION VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    closeDB();
  }
}

runAttributionVerification().catch(console.error);
