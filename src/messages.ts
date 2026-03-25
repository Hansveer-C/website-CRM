import { Message, User } from './types';
import * as repo from './messages_repo';
import { getContact } from './contacts_repo';
import { getOpportunitiesByContact } from './opportunities_repo';
import { persistMessage, getMessagesByContact } from './messages_repo';


/**
 * Saves a new message to the database after validating the contact_id.
 * @param message - The message object to save.
 * @returns { boolean } - True if saved successfully, false otherwise.
 */
export async function saveMessage(message: Partial<Message> & { contact_id: string }): Promise<boolean> {
  // Validate contact_id exists
  const contactRes = await getContact(message.contact_id, 'INTERNAL_SYSTEM_BYPASS');
  if (!contactRes.success || !contactRes.data) {
    console.error(`[Message Error] Invalid contact_id: ${message.contact_id}`);
    return false;
  }
  const contact = contactRes.data;

  // OPTIONAL: Attach opportunity_id if one exists for the contact (Link to the latest open deal)
  if (!message.opportunity_id) {
    const oppsRes = await getOpportunitiesByContact(message.contact_id, 'INTERNAL_SYSTEM_BYPASS');
    if (oppsRes.success && oppsRes.data) {
        const latestOpp = oppsRes.data
          .filter(o => o.status === 'open')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        
        if (latestOpp) {
          message.opportunity_id = latestOpp.id;
        }
    }
  }

  // 3. Build the complete Message object with defaults
  const finalMessage: Message = {
    id: message.id || `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user_id: message.user_id || contact.user_id || 'system',
    contact_id: message.contact_id,
    opportunity_id: message.opportunity_id,
    direction: message.direction || 'outbound',
    type: (message.type as 'sms') || 'sms',
    content: message.content || '',
    status: message.status || 'pending',
    source: message.source,
    created_at: message.created_at || new Date().toISOString()
  };

  const saveRes = await persistMessage(finalMessage);
  if (!saveRes.success) {
      console.error(`[Message Error] Failed to persist: ${saveRes.error}`);
      return false;
  }
  console.log(`[Message Saved]: ${finalMessage.id} with status "${finalMessage.status}" for contact ${finalMessage.contact_id}`);
  return true;
}

/**
 * Helper to sort any array of messages chronologically (ASC).
 */
export function sortMessagesAsc(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

/**
 * Retrieves the full message history (conversation) for a specific contact,
 * strictly ordered from oldest to newest (ASC).
 * @param contactId - The ID of the contact.
 * @returns { Message[] } - Chronologically sorted message list.
 */
export async function getConversation(contactId: string, user?: User | string | null): Promise<Message[]> {
  const res = await getMessagesByContact(contactId, user);
  if (!res.success || !res.data) return [];
  return sortMessagesAsc(res.data);
}

/**
 * Retrieves all messages in the entire system, sorted chronologically (ASC).
 * Useful for building global activity feeds or logs.
 */
export async function getAllMessagesOrdered(user?: User | string | null): Promise<Message[]> {
  const res = await repo.getAllMessagesOrdered(user);
  if (!res.success || !res.data) return [];
  return res.data;
}

export interface ConversationSummary {
  last_message_content: string;
  last_message_timestamp: string;
  last_message_direction: string;
}

/**
 * Returns a summary of the most recent activity for a contact's conversation.
 * @param contactId - The ID of the contact.
 * @returns { ConversationSummary | null } - The summary or null if no messages exist.
 */
export async function getConversationSummary(contactId: string, user?: User | string | null): Promise<ConversationSummary | null> {
  const conversation = await getConversation(contactId, user);
  if (conversation.length === 0) return null;

  const latest = conversation[conversation.length - 1]; // Already sorted ASC
  return {
    last_message_content: latest.content,
    last_message_timestamp: latest.created_at,
    last_message_direction: latest.direction
  };
}

