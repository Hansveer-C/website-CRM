/**
 * 🔒 SERVER-ONLY MODULE
 * This module contains administrative logic, database credentials, or Node.js internal utilities.
 * ⚠️ DO NOT IMPORT INTO FRONTEND CODE (main.ts, etc.)
 */
import { Message, Contact } from './types';
import { saveMessage } from './messages';
import { getContact } from './contacts_repo';
import { getMessage, updateMessageStatus, checkDuplicateMessage, countRecentOutboundMessages, countUserTotalRecentMessages } from './messages_repo';
import { emitEvent } from './events';
import { smsService } from './smsService';

/**
 * Backend Message Logic Layer.
 * Handles the business rules for sending SMS:
 * - Template generation
 * - Duplicate prevention
 * - Rate limiting
 * - Dispatching via smsService (Twilio SDK)
 */

export function getDefaultLeadReply(contact: Partial<Contact> | undefined | null, template?: string): string {
  const name = contact?.name?.trim() || '';
  if (template && template.trim()) {
    return template.replace(/{name}/g, name || 'there');
  }
  const greeting = name ? `Hey ${name}` : 'Hey there';
  return `${greeting}, thanks for reaching out! I got your request and will get back to you shortly.`;
}

export function getMissedCallReply(contact: Partial<Contact> | undefined | null, template?: string): string {
  const name = (contact?.name?.trim() || '').replace('Unknown Caller', '');
  if (template && template.trim()) {
    return template.replace(/{name}/g, name || 'there');
  }
  if (!name) return 'Hey, sorry I missed your call. How can I help?';
  return `Hey ${name}, sorry I missed your call. How can I help?`;
}

/**
 * Orchestrates the full SMS sending workflow.
 */
export async function dispatchSMS(
  contact_id: string, 
  phone: string, 
  messageText: string, 
  opportunity_id?: string,
  source?: string,
  user_id?: string,
  trigger_event_id?: string
): Promise<{ success: boolean; internal_id?: string; skipped?: boolean; reason?: string; twilio_result?: any }> {
  
  const newMessage: Message = {
    id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user_id: user_id as any,
    contact_id,
    opportunity_id,
    direction: 'outbound',
    type: 'sms',
    content: messageText,
    status: 'pending',
    source,
    trigger_event_id,
    created_at: new Date().toISOString()
  };

  const saveRes = await saveMessage(newMessage);
  if (!saveRes.success) {
    return { 
      success: false,
      internal_id: newMessage.id, 
      twilio_result: { success: false, error: saveRes.error || 'Database persistence failed' } 
    };
  }

  if (saveRes.skipped) {
    console.log('[SMS Skip] SMS skipped due to idempotency (duplicate_event)');
    return {
      success: true,
      skipped: true,
      reason: 'duplicate_event',
      internal_id: 'skipped'
    };
  }

  // Use the Backend SDK Service
  const result = await smsService.sendSMS({ to: phone, message: messageText, user_id });
  
  if (result.success) {
    await updateMessageStatus(newMessage.id, 'sent', result.provider_message_id, false);

    emitEvent('sms_attempt_result', { 
      message_id: newMessage.id, contact_id, user_id, status: 'sent', source 
    }, user_id);
  } else {
    await updateMessageStatus(newMessage.id, 'failed', undefined, true);

    emitEvent('sms_attempt_result', { 
      message_id: newMessage.id, contact_id, user_id, status: 'failed', reason: result.error, source 
    }, user_id);
  }
  
  return { 
    success: result.success,
    internal_id: newMessage.id, 
    twilio_result: result 
  };
}

/**
 * Convenience helper for contacts.
 */
export async function sendMessageToContact(
  contact_id: string, 
  messageText: string,
  source?: string,
  user_id?: string,
  trigger_event_id?: string
): Promise<{ success: boolean; internal_id?: string; error?: string }> {
  
  const contactRes = await getContact(contact_id, user_id);
  if (!contactRes.success || !contactRes.data) return { success: false, error: contactRes.error || 'Contact lookup failed' };
  const contact = contactRes.data;

  if (!contact.phone) return { success: false, error: 'Contact has no phone number' };

  // Basic format check (must look like +1XXXXXXXXXX or standard E.164)
  const phoneRegex = /^\+\d{10,15}$/;
  if (!phoneRegex.test(contact.phone)) {
    return { success: false, error: `Invalid phone format: ${contact.phone}` };
  }

  // Anti-Spam (Duplicates)
  const sinceIso = new Date(Date.now() - 60000).toISOString();
  const dupRes = await checkDuplicateMessage(contact_id, messageText, sinceIso, user_id);
  if (dupRes.success && dupRes.data) {
    emitEvent('sms_attempt_skipped', { contact_id, user_id, status: 'skipped', reason: 'duplicate', content: messageText.substring(0, 50) }, user_id);
    return { success: false, error: 'Duplicate SMS prevented' };
  }

  // Anti-Spam (Rate Limit per Contact: Max 3 per minute)
  const contactCountRes = await countRecentOutboundMessages(contact_id, sinceIso, user_id);
  if (contactCountRes.success && (contactCountRes.data || 0) >= 3) {
    emitEvent('sms_attempt_skipped', { contact_id, user_id, status: 'skipped', reason: 'contact_rate_limit' }, user_id);
    return { success: false, error: 'Rate limit hit' };
  }

  // Global Anti-Spam (Rate Limit per User: Max 5 per minute)
  if (user_id) {
    const userCountRes = await countUserTotalRecentMessages(user_id, sinceIso);
    if (userCountRes.success && (userCountRes.data || 0) >= 5) {
      console.warn(`[SMS SECURITY] User ${user_id} hit global rate limit (5 msgs/min). Blocking send.`);
      emitEvent('sms_attempt_skipped', { user_id, contact_id, status: 'skipped', reason: 'user_global_rate_limit', limit: 5 }, user_id);
      return { success: false, error: 'Global rate limit hit. Please wait a minute before sending more messages.' };
    }
  }

  const result = await dispatchSMS(contact_id, contact.phone, messageText, undefined, source, user_id, trigger_event_id);
  
  return {
    success: !!result.success,
    internal_id: result.internal_id,
    error: result.twilio_result?.error
  };
}

/**
 * Retries a failed message.
 */
export async function retryMessage(message_id: string, user_id?: string): Promise<{ success: boolean; error?: string }> {
  const msgRes = await getMessage(message_id, user_id);
  if (!msgRes.success || !msgRes.data) return { success: false, error: 'Message lookup failed' };
  const msg = msgRes.data;

  if (msg.status !== 'failed' || !msg.retryable) return { success: false, error: 'Retry not possible' };

  const contactRes = await getContact(msg.contact_id, user_id);
  if (!contactRes.success || !contactRes.data || !contactRes.data.phone) {
      return { success: false, error: 'Contact/phone missing' };
  }
  const contact = contactRes.data;

  const result = await smsService.sendSMS({ to: contact.phone, message: msg.content, user_id: msg.user_id });
  
  if (result.success) {
    await updateMessageStatus(message_id, 'sent', result.provider_message_id, false);
    emitEvent('sms_retry_attempt', { message_id, contact_id: msg.contact_id, user_id: msg.user_id, status: 'sent' }, msg.user_id);
  } else {
    await updateMessageStatus(message_id, 'failed', undefined, true);
    emitEvent('sms_retry_attempt', { message_id, contact_id: msg.contact_id, user_id: msg.user_id, status: 'failed', reason: result.error }, msg.user_id);
  }

  return result;
}
