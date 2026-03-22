import { mockEventLogs, mockContacts, mockMessages, mockWebsiteSettings, mockOpportunities, mockCalls } from './db';
import { getDefaultLeadReply, sendMessageToContact, getMissedCallReply } from './sms';

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
 * Simple in-memory storage for events.
 */
const eventLog: AppEvent[] = [];

/**
 * Emits an event, saves it to EventLogs collection and logs to console.
 */
export async function emitEvent(name: string, payload: Record<string, any> = {}): Promise<AppEvent | null> {
  // Simple Validation
  if (name === 'form_submitted' || name === 'lead_created') {
    if (!payload.contact_id || !payload.opportunity_id) {
      console.error('Invalid event payload', { event_name: name, payload });
      return null;
    }
  }

  const event = createEvent(name, payload);
  eventLog.push(event);

  // Persist to EventLogs collection (Initial state: pending)
  const logEntry = {
    id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    event_name: event.event_name,
    payload: event.payload,
    status: 'pending',
    created_at: event.created_at
  };
  mockEventLogs.push(logEntry);

  // Mark as processed (Synchronous for now)
  logEntry.status = 'processed';

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
  return [...eventLog];
}

// --- Register Business Logic Listeners ---
onEvent('lead_created', async (payload) => {
  // Global Toggle Check
  if (!mockWebsiteSettings.auto_lead_sms_enabled) {
    console.log('Automated lead SMS skipped: auto-response disabled globally');
    return;
  }

  console.log('Lead created event received');

  const contact_id = payload.contact_id;
  let phone = payload.phone;

  // If no phone in payload, fallback to DB
  if (!phone && contact_id) {
    const contact = mockContacts.find(c => c.id === contact_id);
    if (contact && contact.phone) {
      phone = contact.phone;
    }
  }

  if (!phone) {
    console.log('Automated lead SMS skipped: No phone available');
    return;
  }

  // Fetch full contact object
  const contact = mockContacts.find(c => c.id === contact_id);
  if (!contact) {
    console.log('Contact not found for SMS');
    return;
  }

  // Generate automated message
  const template = mockWebsiteSettings.auto_lead_sms_template;
  const message = getDefaultLeadReply(contact, template);
  
  // Prevent duplicate automated SMS (2 minute window)
  const now = Date.now();
  const twoMinutesAgo = now - (2 * 60 * 1000);
  
  const alreadySent = mockMessages.some(m => 
    m.contact_id === contact_id &&
    m.direction === 'outbound' &&
    new Date(m.created_at).getTime() >= twoMinutesAgo &&
    (m.content === message || m.content.includes("thanks for reaching out"))
  );

  if (alreadySent) {
    console.log('Automated lead SMS skipped: duplicate prevented');
    return;
  }

  // Trigger SMS
  console.log(`[AUTOMATION] Triggering automated SMS for lead: ${contact.name}`);
  const result = await sendMessageToContact(contact_id, message, 'automation');
  
  if (result.success) {
    console.log('Automated lead SMS sent');
  } else {
    console.log('Auto SMS failed');
    contact.follow_up_required = true;
  }
});

import { normalizePhone } from './leads_logic';

// --- Match Inbound Call to Contact (Phase 1.8.2) ---
onEvent('call_missed', async (payload) => {
  console.log('call_missed event received');
  
  // PROMPT 19: Global Toggle
  if (!mockWebsiteSettings.missed_call_sms_enabled) {
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
  const existingContact = mockContacts.find(c => c.phone === phoneNorm.normalized);

  let contactIdToUse: string;

  if (existingContact) {
    console.log(`Contact matched: ${existingContact.name} (${existingContact.id})`);
    contactIdToUse = existingContact.id;
  } else {
    const newContact = {
      id: `c-${Date.now()}`,
      name: 'Unknown Caller',
      phone: phoneNorm.normalized,
      email: null,
      address: 'New lead from missed call',
      tags: ['missed-call'],
      source: 'missed_call',
      status: 'lead' as const,
      created_at: new Date().toISOString()
    };
    mockContacts.push(newContact);
    console.log('New contact created from missed call');
    contactIdToUse = newContact.id;
  }

  const targetContact = mockContacts.find(c => c.id === contactIdToUse);
  if (!targetContact) {
    console.log('[SMS PREP] No contact resolved, exiting');
    return;
  }
  
  console.log(`[SMS PREP] Target contact resolved: ${targetContact.name} (${targetContact.id})`);

  // PROMPT 17: Extra Duplicate Protection (2-minute window)
  const now = Date.now();
  const recentAutomation = mockMessages.find(m => 
    m.contact_id === targetContact.id && 
    m.source === 'missed_call_automation' &&
    (now - new Date(m.created_at).getTime()) < 120000 // 2 minutes
  );

  if (recentAutomation) {
    console.log('Missed call SMS already sent');
    console.log(`[SMS SKIPPED] Prevented duplicate follow-up within 2-minute window for ${targetContact.name}`);
    return;
  }

  // PROMPT 18: 5-minute Rate Limit (Max 2 messages)
  const fiveMinutesAgo = now - 300000;
  const recentCount = mockMessages.filter(m => 
    m.contact_id === targetContact.id && 
    m.source === 'missed_call_automation' &&
    new Date(m.created_at).getTime() > fiveMinutesAgo
  ).length;

  if (recentCount >= 2) {
    console.log('Missed call SMS rate limited');
    console.warn(`[SMS SKIPPED] Rate limit of 2 messages reached within 5 minutes for ${targetContact.name}`);
    return;
  }

  // Send SMS (PROMPT 15)
  const smsMessage = getMissedCallReply(targetContact, mockWebsiteSettings.missed_call_sms_template);
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
  }

  // Create Opportunity (PROMPT 10)
  const newOpportunity = {
    id: `opp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    contact_id: contactIdToUse,
    pipeline_stage: 'New Lead',
    status: 'open' as const,
    value: 0,
    assigned_to: 'Unassigned',
    source: 'missed_call',
    created_at: new Date().toISOString()
  };
  mockOpportunities.push(newOpportunity);
  console.log(`Opportunity created for contact ${contactIdToUse}`);

  // Link Call record (PROMPT 11)
  if (call_id) {
    const callRecord = mockCalls.find(c => c.id === call_id);
    if (callRecord) {
      callRecord.contact_id = contactIdToUse;
      callRecord.opportunity_id = newOpportunity.id;
      console.log(`Call record ${call_id} linked to contact ${contactIdToUse} and opportunity ${newOpportunity.id}`);
    }
  }
});

