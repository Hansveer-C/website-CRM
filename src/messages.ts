import { Message } from './types';
import { getContact } from './contacts_repo';
import { getOpportunitiesByContact } from './opportunities_repo';
import { persistMessage, getMessagesByContact } from './messages_repo';
import { getDB } from './database';

/**
 * Saves a new message to the database after validating the contact_id.
 * @param message - The message object to save.
 * @returns { boolean } - True if saved successfully, false otherwise.
 */
export function saveMessage(message: Partial<Message> & { contact_id: string }): boolean {
  // Validate contact_id exists
  const contact = getContact(message.contact_id);
  if (!contact) {
    console.error(`[Message Error] Invalid contact_id: ${message.contact_id}`);
    return false;
  }

  // OPTIONAL: Attach opportunity_id if one exists for the contact (Link to the latest open deal)
  if (!message.opportunity_id) {
    const opps = getOpportunitiesByContact(message.contact_id);
    const latestOpp = opps
      .filter(o => o.status === 'open')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    
    if (latestOpp) {
      message.opportunity_id = latestOpp.id;
    }
  }

  // Build the complete Message object with defaults
  const finalMessage: Message = {
    id: message.id || `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    contact_id: message.contact_id,
    opportunity_id: message.opportunity_id,
    direction: message.direction || 'outbound',
    type: (message.type as 'sms') || 'sms',
    content: message.content || '',
    status: message.status || 'pending', // Default to 'pending'
    source: message.source,
    created_at: message.created_at || new Date().toISOString()
  };

  persistMessage(finalMessage);
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
export function getConversation(contactId: string): Message[] {
  const messages = getMessagesByContact(contactId);
  return sortMessagesAsc(messages);
}

/**
 * Retrieves all messages in the entire system, sorted chronologically (ASC).
 * Useful for building global activity feeds or logs.
 */
export function getAllMessagesOrdered(): Message[] {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM messages ORDER BY created_at ASC').all() as any[];
  const messages = rows.map((row: any) => ({
      ...row,
      retryable: row.retryable === 1
  }));
  return messages;
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
export function getConversationSummary(contactId: string): ConversationSummary | null {
  const conversation = getConversation(contactId);
  if (conversation.length === 0) return null;

  const latest = conversation[conversation.length - 1]; // Already sorted ASC
  return {
    last_message_content: latest.content,
    last_message_timestamp: latest.created_at,
    last_message_direction: latest.direction
  };
}
