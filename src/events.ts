import { getWebsiteSettings } from './website_settings_repo';
import { getCall, persistCall } from './calls_repo';
import { checkDuplicateMessage, countRecentOutboundMessages } from './messages_repo';
import { getContact, findContact, persistContact } from './contacts_repo';
import { getOpportunity, persistOpportunity } from './opportunities_repo';
import { persistEventLog, getAllEventLogs, getRecentEventLogs } from './event_logs_repo';
import { Opportunity, User } from './types';
import { getDefaultLeadReply, sendMessageToContact, getMissedCallReply } from './sms';
import { normalizePhone } from './utils/normalization';

export interface AppEvent {
  user_id?: string;
  event_name: string;
  payload: Record<string, any>;
  status?: string;
  created_at: string; // ISO 8601 timestamp
}

export type EventListener = (payload: Record<string, any>, userId?: string) => Promise<void> | void;
const listeners: Record<string, EventListener[]> = {};

export function onEvent(name: string, callback: EventListener) {
  if (!listeners[name]) {
    listeners[name] = [];
  }
  listeners[name].push(callback);
}

/**
 * Creates a basic event object.
 */
export function createEvent(name: string, payload: Record<string, any> = {}): AppEvent {
  return {
    event_name: name,
    payload,
    created_at: new Date().toISOString(),
  };
}


/**
 * Emits an event, saves it to EventLogs collection and logs to console.
 */
export async function emitEvent(name: string, payload: Record<string, any> = {}, user_id?: string): Promise<AppEvent | null> {
  // Simple Validation
  if (name === 'form_submitted' || name === 'lead_created') {
    if (!payload.contact_id || !payload.opportunity_id) {
      console.error('Invalid event payload', { event_name: name, payload });
      return null;
    }
  }

  // 1. Resolve User Ownership for Event Log
  let finalUserId = user_id;
  
  if (!finalUserId) {
    if (payload.contact_id) {
       const contactRes = await getContact(payload.contact_id, 'INTERNAL_SYSTEM_BYPASS');
       if (contactRes.success && contactRes.data) finalUserId = contactRes.data.user_id;
    }
    else if (payload.opportunity_id) {
       const oppRes = await getOpportunity(payload.opportunity_id, 'INTERNAL_SYSTEM_BYPASS');
       if (oppRes.success && oppRes.data) finalUserId = oppRes.data.user_id;
    }
  }

  const event = createEvent(name, payload);

  // Persist to EventLogs table (Initial state: pending)
  const logEntry = {
    id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user_id: finalUserId || 'system',
    event_name: event.event_name,
    payload: event.payload,
    status: 'pending',
    created_at: event.created_at
  };
  await persistEventLog(logEntry);

  // Mark as processed (Synchronous update)
  logEntry.status = 'processed';
  await persistEventLog(logEntry);

  console.log('[Event Logged]:', event);
  
  // Trigger Listeners
  if (listeners[name]) {
    const payloadWithId = { ...payload, event_log_id: logEntry.id };
    for (const fn of listeners[name]) {
      try {
        await fn(payloadWithId, logEntry.user_id);
      } catch (e) {
        console.error(`[Event Listener Error] ${name}:`, e);
      }
    }
  }

  return event;
}


/**
 * Returns all logged events.
 */
export async function getEvents(user?: User | string | null): Promise<AppEvent[]> {
  const res = await getAllEventLogs(user);
  if (!res.success || !res.data) return [];
  return res.data as any[] as AppEvent[];
}

// --- Register Business Logic Listeners ---
onEvent('lead_created', async (payload, userId) => {
  // Global Toggle Check
  const settingsRes = await getWebsiteSettings();
  if (!settingsRes.success || !settingsRes.data) return;
  const settings = settingsRes.data;

  if (!settings.auto_lead_sms_enabled) {
    console.log('Automated lead SMS skipped: auto-response disabled globally');
    return;
  }

  const contact_id = payload.contact_id;
  let phone = payload.phone;

  // Fetch full contact object - System context for automation
  const contactRes = await getContact(contact_id, userId || 'system');
  if (!contactRes.success || !contactRes.data) {
    console.log('Contact not found for SMS');
    return;
  }
  const contact = contactRes.data;
  if (!phone) phone = contact.phone;

  if (!phone) {
    console.log('Automated lead SMS skipped: No phone available');
    return;
  }

  // Generate automated message
  const template = settings.auto_lead_sms_template;
  const message = getDefaultLeadReply(contact, template);
  
  // Prevent duplicate automated SMS (2 minute window)
  const sinceIso = new Date(Date.now() - 120000).toISOString();
  const alreadySentRes = await checkDuplicateMessage(contact_id, message, sinceIso, contact.user_id);

  if (alreadySentRes.success && alreadySentRes.data) {
    console.log('Automated lead SMS skipped: duplicate prevented');
    return;
  }

  // Trigger SMS
  console.log(`[AUTOMATION] Triggering automated SMS for lead: ${contact.name}`);
  try {
    const result = await sendMessageToContact(contact_id, message, 'automation', contact.user_id);
    
    if (result.success) {
      console.log('Automated lead SMS sent');
    } else {
      console.log(`Auto SMS failed: ${result.error}`);
      contact.follow_up_required = true;
      await persistContact(contact);
    }
  } catch (err: any) {
    console.error(`❌ [AUTOMATION ERROR] lead_created listener failed: ${err.message}`);
    contact.follow_up_required = true;
    await persistContact(contact);
  }
});

// --- Match Inbound Call to Contact (Phase 1.8.2) ---
onEvent('call_missed', async (payload, userId) => {
  console.log('call_missed event received');
  
  // 1. Global Toggle
  const settingsRes = await getWebsiteSettings();
  if (!settingsRes.success || !settingsRes.data || !settingsRes.data.missed_call_sms_enabled) {
    console.log('Missed call SMS disabled');
    return;
  }
  const settings = settingsRes.data;

  const { phone, call_id } = payload;
  if (!phone) return;

  const phoneNorm = normalizePhone(phone);
  const finalUserId = userId || 'system';
  
  // 2. DEDUP: Check for identical events in the last 5 minutes
  const fiveMinAgoStr = new Date(Date.now() - 300000).toISOString();
  const recentLogsRes = await getRecentEventLogs('call_missed', finalUserId, fiveMinAgoStr);
  
  if (recentLogsRes.success && recentLogsRes.data) {
      const alreadyProcessed = recentLogsRes.data.some(log => 
          log.payload.phone === phone &&
          log.status === 'processed' &&
          log.id !== (payload as any).event_log_id
      );
      if (alreadyProcessed) {
          console.log('[DEDUP] Skipping duplicate missed call trigger.');
          return;
      }
  }

  // 3. Match Contacts
  const contactRes = await findContact(phoneNorm.normalized, null, finalUserId);
  const existingContact = contactRes.data;

  let contactIdToUseValue: string;

  if (existingContact) {
    console.log(`Contact matched: ${existingContact.name} (${existingContact.id})`);
    contactIdToUseValue = existingContact.id;
  } else {
    contactIdToUseValue = `c-${Date.now()}`;
    const newContact = {
      id: contactIdToUseValue,
      user_id: finalUserId,
      name: 'Unknown Caller',
      phone: phoneNorm.normalized,
      email: null,
      address: 'New lead from missed call',
      tags: ['missed-call'],
      source: 'missed_call',
      status: 'lead' as const,
      created_at: new Date().toISOString()
    };
    const contactResult = await persistContact(newContact);
    if (!contactResult.success) {
      console.error('Failed to create contact for missed call:', contactResult.error);
      return;
    }
    console.log('New contact created from missed call');
  }

  const contactRes2 = await getContact(contactIdToUseValue, finalUserId);
  const targetContact = contactRes2.data;
  if (!targetContact) return;
  
  // 4. Duplicate Check for SMS
  const smsMessage = getMissedCallReply(targetContact, settings.missed_call_sms_template);
  const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
  const alreadySentMC = await checkDuplicateMessage(targetContact.id, smsMessage, twoMinutesAgo, targetContact.user_id);

  if (alreadySentMC.success && alreadySentMC.data) {
    console.log('Missed call SMS already sent (dedup window)');
    return;
  }

  // 5. Rate Limit
  const rateLimitSince = new Date(Date.now() - 300000).toISOString();
  const recentCountRes = await countRecentOutboundMessages(targetContact.id, rateLimitSince, targetContact.user_id);

  if (recentCountRes.success && (recentCountRes.data || 0) >= 2) {
    console.log('Missed call SMS rate limited');
    return;
  }

  // 6. Send SMS
  const smsResult = await sendMessageToContact(targetContact.id, smsMessage, 'missed_call_automation', targetContact.user_id);
  
  if (!smsResult.success && smsResult.error !== 'Duplicate SMS prevented') {
    targetContact.follow_up_required = true;
    await persistContact(targetContact);
  }

  // 7. Create Opportunity
  const newOpportunity: Opportunity = {
    id: `opp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user_id: targetContact.user_id || 'system',
    contact_id: contactIdToUseValue,
    pipeline_stage: 'New Lead',
    status: 'open',
    value: 0,
    source: 'missed_call',
    created_at: new Date().toISOString()
  };
  await persistOpportunity(newOpportunity);

  // 8. Link Call
  if (call_id) {
    const callRes = await getCall(call_id);
    if (callRes.success && callRes.data) {
        const callRecord = callRes.data;
        callRecord.contact_id = contactIdToUseValue;
        callRecord.opportunity_id = newOpportunity.id;
        callRecord.user_id = targetContact.user_id || 'system';
        await persistCall(callRecord);
    }
  }
});
