import { Message, Contact } from './types';
import { saveMessage } from './messages';
import { getContact } from './contacts_repo';
import { getMessage, updateMessageStatus, checkDuplicateMessage, countRecentOutboundMessages } from './messages_repo';
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
  user_id?: string
): Promise<{ internal_id: string; twilio_result: any }> {
  
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
    created_at: new Date().toISOString()
  };

  saveMessage(newMessage);

  // Use the Backend SDK Service
  const result = await smsService.sendSMS({ to: phone, message: messageText, user_id });
  
  if (result.success) {
    updateMessageStatus(newMessage.id, 'sent', result.provider_message_id, false);
  } else {
    updateMessageStatus(newMessage.id, 'failed', undefined, true);
  }
  
  return { 
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
  user_id?: string
): Promise<{ success: boolean; internal_id?: string; error?: string }> {
  
  const contact = getContact(contact_id);
  if (!contact) return { success: false, error: 'Contact lookup failed' };
  if (!contact.phone) return { success: false, error: 'Contact has no phone number' };

  // Anti-Spam
  const sinceIso = new Date(Date.now() - 60000).toISOString();
  if (checkDuplicateMessage(contact_id, messageText, sinceIso)) return { success: false, error: 'Duplicate SMS prevented' };
  if (countRecentOutboundMessages(contact_id, sinceIso) >= 3) return { success: false, error: 'Rate limit hit' };

  const result = await dispatchSMS(contact_id, contact.phone, messageText, undefined, source, user_id);
  
  return {
    success: result.twilio_result.success,
    internal_id: result.internal_id,
    error: result.twilio_result.error
  };
}

/**
 * Retries a failed message.
 */
export async function retryMessage(message_id: string): Promise<{ success: boolean; error?: string }> {
  const msg = getMessage(message_id);
  if (!msg || msg.status !== 'failed' || !msg.retryable) return { success: false, error: 'Retry not possible' };

  const contact = getContact(msg.contact_id);
  if (!contact || !contact.phone) return { success: false, error: 'Contact/phone missing' };

  const result = await smsService.sendSMS({ to: contact.phone, message: msg.content, user_id: msg.user_id });
  
  if (result.success) {
    updateMessageStatus(message_id, 'sent', result.provider_message_id, false);
  } else {
    updateMessageStatus(message_id, 'failed', undefined, true);
  }
  
  return result;
}
