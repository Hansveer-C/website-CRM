import { getWebsiteSettings } from './website_settings_repo';
import { getCall, persistCall } from './calls_repo';
import { checkDuplicateMessage, countRecentOutboundMessages } from './messages_repo';
import { getContact, findContact, persistContact } from './contacts_repo';
import { getOpportunity, persistOpportunity } from './opportunities_repo';
import { persistEventLog, getAllEventLogs } from './event_logs_repo';
import { Opportunity } from './types';
import { getDefaultLeadReply, sendMessageToContact, getMissedCallReply } from './sms';
import { normalizePhone } from './leads_logic';

export interface AppEvent {
  event_name: string;
  payload: Record<string, any>;
  created_at: string; // ISO 8601 timestamp
}

export type EventListener = (payload: Record<string, any>) => Promise<void> | void;
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
    // If contact_id in payload, inherit owner
    if (payload.contact_id) {
       const contact = getContact(payload.contact_id);
       if (contact) finalUserId = contact.user_id;
    }
    // Else try opportunity_id
    else if (payload.opportunity_id) {
       const opp = getOpportunity(payload.opportunity_id);
       if (opp) finalUserId = opp.user_id;
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
  persistEventLog(logEntry);

  // Mark as processed (Synchronous update)
  logEntry.status = 'processed';
  persistEventLog(logEntry);

  console.log('[Event Logged]:', event);
  
  // Trigger Listeners (Synchronously awaiting to prevent race conditions in tests)
  if (listeners[name]) {
    for (const fn of listeners[name]) {
      try {
        await fn(payload);
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
export function getEvents(): AppEvent[] {
  return getAllEventLogs() as AppEvent[];
}

// --- Register Business Logic Listeners ---
onEvent('lead_created', async (payload) => {
  // Global Toggle Check
  const settings = getWebsiteSettings();
  if (!settings.auto_lead_sms_enabled) {
    console.log('Automated lead SMS skipped: auto-response disabled globally');
    return;
  }

  console.log('Lead created event received');

  const contact_id = payload.contact_id;
  let phone = payload.phone;

  // If no phone in payload, fallback to DB
  if (!phone && contact_id) {
    const contact = getContact(contact_id);
    if (contact && contact.phone) {
      phone = contact.phone;
    }
  }

  if (!phone) {
    console.log('Automated lead SMS skipped: No phone available');
    return;
  }

  // Fetch full contact object
  const contact = getContact(contact_id);
  if (!contact) {
    console.log('Contact not found for SMS');
    return;
  }

  // Generate automated message
  const template = settings.auto_lead_sms_template;
  const message = getDefaultLeadReply(contact, template);
  
  // Prevent duplicate automated SMS (2 minute window)
  const sinceIso = new Date(Date.now() - 120000).toISOString();
  const alreadySent = checkDuplicateMessage(contact_id, message, sinceIso);

  if (alreadySent) {
    console.log('Automated lead SMS skipped: duplicate prevented');
    return;
  }

  // Trigger SMS
  console.log(`[AUTOMATION] Triggering automated SMS for lead: ${contact.name}`);
  try {
    const result = await sendMessageToContact(contact_id, message, 'automation');
    
    if (result.success) {
      console.log('Automated lead SMS sent');
    } else {
      console.log(`Auto SMS failed: ${result.error}`);
      contact.follow_up_required = true;
      persistContact(contact);
    }
  } catch (err: any) {
    console.error(`❌ [AUTOMATION ERROR] lead_created listener failed: ${err.message}`);
    contact.follow_up_required = true;
    persistContact(contact);
  }
});

// --- Match Inbound Call to Contact (Phase 1.8.2) ---
onEvent('call_missed', async (payload) => {
  console.log('call_missed event received');
  
  // PROMPT 19: Global Toggle
  const settings = getWebsiteSettings();
  if (!settings.missed_call_sms_enabled) {
    console.log('Missed call SMS disabled');
    return;
  }

  const { phone, call_id } = payload;
  
  if (!phone) {
    console.log('[SMS PREP] No phone provided, exiting');
    return;
  }

  const phoneNorm = normalizePhone(phone);
  
  // Search Contacts: match by phone
  const existingContact = findContact(phoneNorm.normalized, null);

  let contactIdToUse: string;

  if (existingContact) {
    console.log(`Contact matched: ${existingContact.name} (${existingContact.id})`);
    contactIdToUse = existingContact.id;
  } else {
    const newContact = {
      id: `c-${Date.now()}`,
      user_id: 'system',
      name: 'Unknown Caller',
      phone: phoneNorm.normalized,
      email: null,
      address: 'New lead from missed call',
      tags: ['missed-call'],
      source: 'missed_call',
      status: 'lead' as const,
      created_at: new Date().toISOString()
    };
    persistContact(newContact);
    console.log('New contact created from missed call');
    contactIdToUse = newContact.id;
  }

  const targetContact = getContact(contactIdToUse);
  if (!targetContact) {
    console.log('[SMS PREP] No contact resolved, exiting');
    return;
  }
  
  console.log(`[SMS PREP] Target contact resolved: ${targetContact.name} (${targetContact.id})`);

  // Prepare SMS message first so we can check for duplicates against the content
  const smsMessage = getMissedCallReply(targetContact, settings.missed_call_sms_template);

  // PROMPT 17: Extra Duplicate Protection (2-minute window)
  const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
  const alreadySentMC = checkDuplicateMessage(targetContact.id, smsMessage, twoMinutesAgo);

  if (alreadySentMC) {
    console.log('Missed call SMS already sent');
    console.log(`[SMS SKIPPED] Prevented duplicate follow-up within 2-minute window for ${targetContact.name}`);
    return;
  }

  // PROMPT 18: 5-minute Rate Limit (Max 2 messages)
  const fiveMinAgo = new Date(Date.now() - 300000).toISOString();
  const recentCount = countRecentOutboundMessages(targetContact.id, fiveMinAgo);

  if (recentCount >= 2) {
    console.log('Missed call SMS rate limited');
    console.warn(`[SMS SKIPPED] Rate limit of 2 messages reached within 5 minutes for ${targetContact.name}`);
    return;
  }

  // Send SMS (PROMPT 15)
  console.log(`[SMS PREP] Message prepared: "${smsMessage}"`);
  const smsResult = await sendMessageToContact(targetContact.id, smsMessage, 'missed_call_automation');
  
  if (smsResult.success) {
    console.log('Missed call SMS sent');
    console.log(`[SMS SUCCESS] Automated reply sent to ${targetContact.name}: "${smsMessage}"`);
  } else if (smsResult.error === 'Duplicate SMS prevented' || smsResult.error === 'Rate limit hit') {
    console.log('Missed call SMS skipped');
    console.warn(`[SMS SKIPPED] ${smsResult.error} for ${targetContact.name}`);
  } else {
    console.log('Missed call SMS failed');
    console.error(`[SMS FAILURE] Could not send reply to ${targetContact.name}: ${smsResult.error}`);
    targetContact.follow_up_required = true;
    persistContact(targetContact);
  }

  // Create Opportunity (PROMPT 10)
  const newOpportunity: Opportunity = {
    id: `opp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user_id: targetContact?.user_id || 'system',
    contact_id: contactIdToUse,
    pipeline_stage: 'New Lead',
    status: 'open',
    value: 0,
    source: 'missed_call',
    created_at: new Date().toISOString()
  };
  persistOpportunity(newOpportunity);
  console.log(`Opportunity created for contact ${contactIdToUse}`);

  // Link Call record (PROMPT 11)
  if (call_id) {
    const callRecord = getCall(call_id);
    if (callRecord) {
      callRecord.contact_id = contactIdToUse;
      callRecord.opportunity_id = newOpportunity.id;
      callRecord.user_id = targetContact?.user_id || 'system';
      persistCall(callRecord);
      console.log(`Call record ${call_id} linked to contact ${contactIdToUse} and opportunity ${newOpportunity.id}`);
    }
  }
});
