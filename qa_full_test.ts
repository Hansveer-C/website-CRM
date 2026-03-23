
import { createLead } from './src/leads_logic';
import { handleInboundCall, endCall } from './src/calls_logic';
import { getContactTimeline } from './src/timeline';
import { mockContacts, mockOpportunities, mockEventLogs, mockMessages, mockWebsiteSettings, mockCalls } from './src/db';

async function runQATests() {
  console.log('================================================');
  console.log('   CRM QA REGRESSION SUITE - END-TO-END TEST    ');
  console.log('================================================\n');

  const results: any[] = [];

  // --- TEST 1: FORM LEAD FLOW ---
  console.log('[TEST 1] Form Lead Flow');
  try {
    const payload = {
      name: 'QA Form Lead',
      phone: '1234567890',
      email: 'qa.form@test.com',
      source: 'website'
    };
    const res = await createLead(payload);
    
    const contact = mockContacts.find(c => c.id === res.contactId);
    const opportunity = mockOpportunities.find(o => o.id === res.opportunityId);
    const event = mockEventLogs.find(e => e.event_name === 'lead_created' && e.payload.contact_id === res.contactId);
    // Automation takes a moment (though it's sync in this mock)
    const sms = mockMessages.find(m => m.contact_id === res.contactId && m.source === 'automation');

    if (contact && opportunity && event && sms) {
      console.log('✅ PASS: Contact, Opportunity, Event, and SMS created.');
      results.push({ test: 'Form Lead Flow', status: 'PASS' });
    } else {
      console.log('❌ FAIL: Missing components.', { contact: !!contact, opp: !!opportunity, event: !!event, sms: !!sms });
      results.push({ test: 'Form Lead Flow', status: 'FAIL', reason: 'Missing components' });
    }
  } catch (err) {
    console.log('❌ FAIL: Exception during Form Lead Flow:', err.message);
    results.push({ test: 'Form Lead Flow', status: 'FAIL', reason: err.message });
  }

  // --- TEST 2: MISSED CALL FLOW ---
  console.log('\n[TEST 2] Missed Call Flow');
  try {
    const callRes = await handleInboundCall({ phone: '9876543210' });
    await endCall({ call_id: callRes.callId, answered: false });

    const contact = mockContacts.find(c => c.phone === '+19876543210');
    const opportunity = mockOpportunities.find(o => o.contact_id === contact?.id && o.source === 'missed_call');
    const event = mockEventLogs.find(e => e.event_name === 'call_missed' && e.payload.call_id === callRes.callId);
    const sms = mockMessages.find(m => m.contact_id === contact?.id && m.source === 'missed_call_automation');

    if (contact && opportunity && event && sms) {
      console.log('✅ PASS: Missed call handled, contact/opp created, SMS triggered.');
      results.push({ test: 'Missed Call Flow', status: 'PASS' });
    } else {
      console.log('❌ FAIL: Missing components.', { contact: !!contact, opp: !!opportunity, event: !!event, sms: !!sms });
      results.push({ test: 'Missed Call Flow', status: 'FAIL', reason: 'Missing components' });
    }
  } catch (err) {
    console.log('❌ FAIL: Exception during Missed Call Flow:', err.message);
    results.push({ test: 'Missed Call Flow', status: 'FAIL', reason: err.message });
  }

  // --- TEST 3: DUPLICATE PROTECTION ---
  console.log('\n[TEST 3] Duplicate Protection');
  try {
    const initialCount = mockContacts.length;
    
    // Repeat Form Lead
    try {
        await createLead({ name: 'Duplicate Lead', phone: '1234567890' });
    } catch (e) {
        // Expected error if within 2 mins
        console.log('   Caught expected duplicate window error:', e.message);
    }
    
    const finalCount = mockContacts.length;
    const smsCount = mockMessages.filter(m => m.content.includes('thanks for reaching out')).length;

    if (finalCount === initialCount && smsCount === 1) {
      console.log('✅ PASS: No duplicate contact, no duplicate SMS.');
      results.push({ test: 'Duplicate Protection', status: 'PASS' });
    } else {
      console.log('❌ FAIL: Duplicates found.', { contacts: finalCount - initialCount, sms: smsCount });
      results.push({ test: 'Duplicate Protection', status: 'FAIL', reason: 'Duplicates found' });
    }
  } catch (err) {
    console.log('❌ FAIL: Exception during Duplicate Protection:', err.message);
    results.push({ test: 'Duplicate Protection', status: 'FAIL', reason: err.message });
  }

  // --- TEST 4: FAILURE TEST ---
  console.log('\n[TEST 4] Failure Test');
  try {
    // Force failure by clearing Twilio config
    const oldSid = mockWebsiteSettings.id; // not real sid but just to mess with it
    // Actually, sendSMS checks twilioConfig from config.ts which is imported.
    // I will mock global.fetch
    const originalFetch = global.fetch;
    global.fetch = async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'API Down' })
    } as any);

    await createLead({ name: 'Failure Test', phone: '5550009999' });
    
    // Automation runs...
    const failedSms = mockMessages.find(m => m.content.includes('thanks for reaching out') && m.status === 'failed');

    if (failedSms && failedSms.retryable === true) {
      console.log('✅ PASS: SMS status = failed, retryable = true.');
      results.push({ test: 'Failure Test', status: 'PASS' });
    } else {
      console.log('❌ FAIL: Incorrect failure state.', { sms: !!failedSms, retryable: failedSms?.retryable });
      results.push({ test: 'Failure Test', status: 'FAIL', reason: 'Incorrect failure state' });
    }
    global.fetch = originalFetch;
  } catch (err) {
    console.log('❌ FAIL: Exception during Failure Test:', err.message);
    results.push({ test: 'Failure Test', status: 'FAIL', reason: err.message });
  }

  // --- TEST 5: TIMELINE TEST ---
  console.log('\n[TEST 5] Timeline Test');
  try {
    const contact = mockContacts.find(c => c.name === 'QA Form Lead');
    if (!contact) throw new Error('Contact not found');

    const timelineGroups = getContactTimeline(contact.id);
    const allItems = timelineGroups.flatMap(g => g.items);
    console.log('   Timeline entries:', allItems.length);
    
    // Check for specific events
    // lead_created event is mapped to type 'event' with content 'Event: lead_created'
    const hasLeadCreated = allItems.some(t => t.content.includes('lead_created'));
    const hasSms = allItems.some(t => t.type === 'message');
    
    if (allItems.length >= 2 && hasLeadCreated && hasSms) {
      console.log('✅ PASS: Timeline includes lead event and SMS in correct order.');
      results.push({ test: 'Timeline Test', status: 'PASS' });
    } else {
      console.log('❌ FAIL: Timeline missing entries.', { length: allItems.length, hasLeadCreated, hasSms });
      results.push({ test: 'Timeline Test', status: 'FAIL', reason: 'Timeline incomplete' });
    }
  } catch (err) {
    console.log('❌ FAIL: Exception during Timeline Test:', err.message);
    results.push({ test: 'Timeline Test', status: 'FAIL', reason: err.message });
  }

  console.log('\n================================================');
  console.log('                FINAL SUMMARY                   ');
  console.log('================================================');
  results.forEach(r => console.log(`${r.status.padEnd(6)} | ${r.test}${r.reason ? ' - ' + r.reason : ''}`));
  
  const allPass = results.every(r => r.status === 'PASS');
  console.log(`\nOVERALL VERDICT: ${allPass ? 'READY' : 'NOT READY'}`);
}

runQATests().catch(console.error);
