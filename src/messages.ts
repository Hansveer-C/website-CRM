import { mockMessages, mockContacts } from './db';
import { Message } from './types';

/**
 * Saves a new message to the database after validating the contact_id.
 * @param message - The message object to save.
 * @returns { boolean } - True if saved successfully, false otherwise.
 */
export function saveMessage(message: Partial<Message> & { contact_id: string }): boolean {
  // Validate contact_id exists
  const contactExists = mockContacts.some(c => c.id === message.contact_id);

  if (!contactExists) {
    console.error(`[Message Error] Invalid contact_id: ${message.contact_id}`);
    return false;
  }

  // Build the complete Message object with defaults
  const finalMessage: Message = {
    id: message.id || `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    contact_id: message.contact_id,
    direction: message.direction || 'outbound',
    type: (message.type as 'sms') || 'sms',
    content: message.content || '',
    status: message.status || 'pending', // Default to 'pending'
    created_at: message.created_at || new Date().toISOString()
  };

  mockMessages.push(finalMessage);
  console.log(`[Message Saved]: ${finalMessage.id} with status "${finalMessage.status}" for contact ${finalMessage.contact_id}`);
  return true;
}

/**
 * Retrieves all messages for a specific contact.
 * @param contactId - The ID of the contact to fetch messages for.
 */
export function getMessagesByContact(contactId: string): Message[] {
  return mockMessages.filter(m => m.contact_id === contactId);
}
