import { Message, User } from './types';
/**
 * 🔒 SERVER-ONLY MODULE
 * This module contains administrative logic, database credentials, or Node.js internal utilities.
 * ⚠️ DO NOT IMPORT INTO FRONTEND CODE (main.ts, etc.)
 */
import { supabase } from './utils/db/supabase';

/**
 * Phase S3 - Batch 3: Messages Repository (Supabase).
 */
export const MessagesRepo = {
  /**
   * Persists a message to the Supabase database.
   */
  async createMessage(message: Message): Promise<Message> {
    console.log(`[DB: SUPABASE MESSAGE] Persisting ${message.id} for contact ${message.contact_id}. Status: ${message.status}`);
    
    const payload = {
      ...message,
      // Map correctly to Postgres types
      retryable: !!message.retryable
    };

    const { data, error } = await supabase
      .from('messages')
      .upsert(payload)
      .select()
      .single();

    if (error) {
        console.error('[DB: MESSAGE] Failed to persist message in Supabase:', error.message);
        throw new Error(`DB_PERSIST_MESSAGE_ERROR: ${error.message}`);
    }

    return data as Message;
  },

  /**
   * Alias for createMessage to maintain compatibility.
   */
  async persistMessage(message: Message): Promise<Message> {
    return this.createMessage(message);
  },

  /**
   * Retrieves a message by its ID, scoped to the user context.
   */
  async getMessage(id: string, user?: User | string | null): Promise<Message | null> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) {
        console.warn('[DB: MESSAGE] Get message attempted without user context.');
        return null;
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
        console.error('[DB: MESSAGE] Error retrieving message from Supabase:', error.message);
        throw new Error(`DB_GET_MESSAGE_ERROR: ${error.message}`);
    }

    return data as Message | null;
  },

  /**
   * Retrieves all messages for a specific contact, scoped to the user context.
   */
  async getMessagesByContact(contactId: string, user?: User | string | null): Promise<Message[]> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) {
        console.warn('[DB: MESSAGE] Get by contact attempted without user context.');
        return [];
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: true });

    if (error) {
        console.error('[DB: MESSAGE] Error listing messages in Supabase:', error.message);
        throw new Error(`DB_LIST_MESSAGES_CONTACT_ERROR: ${error.message}`);
    }

    return (data || []) as Message[];
  },

  /**
   * Updates a message's status and provider info.
   */
  async updateMessageStatus(id: string, status: string, providerMessageId?: string, retryable?: boolean): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({
        status,
        provider_message_id: providerMessageId || null,
        retryable: !!retryable
      })
      .eq('id', id);

    if (error) {
        console.error('[DB: MESSAGE] Failed to update message status in Supabase:', error.message);
        throw new Error(`DB_UPDATE_MESSAGE_STATUS_ERROR: ${error.message}`);
    }
  },

  /**
   * Counts recent outbound messages for rate limiting.
   */
  async countRecentOutboundMessages(contactId: string, sinceIso: string, user?: User | string | null): Promise<number> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) return 0;

    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('contact_id', contactId)
      .eq('direction', 'outbound')
      .gt('created_at', sinceIso);

    if (error) {
        console.error('[DB: MESSAGE] Error counting recent messages in Supabase:', error.message);
        return 0;
    }

    return count || 0;
  },

  /**
   * Counts the total outbound messages sent by a user across all contacts for global rate limiting.
   */
  async countUserTotalRecentMessages(user_id: string, sinceIso: string): Promise<number> {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('direction', 'outbound')
      .gt('created_at', sinceIso);

    if (error) {
        console.error('[DB: MESSAGE] Error counting user global messages in Supabase:', error.message);
        return 0;
    }

    return count || 0;
  },

  /**
   * Checks if a duplicate message was sent recently.
   */
  async checkDuplicateMessage(contactId: string, content: string, sinceIso: string, user?: User | string | null): Promise<boolean> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) return false;

    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('contact_id', contactId)
      .eq('direction', 'outbound')
      .eq('content', content)
      .gt('created_at', sinceIso);

    if (error) {
        console.error('[DB: MESSAGE] Error checking duplicate message in Supabase:', error.message);
        return false;
    }

    return (count || 0) > 0;
  },

  /**
   * Retrieves all messages in the entire system, sorted chronologically (ASC).
   */
  async getAllMessagesOrdered(user?: User | string | null): Promise<Message[]> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) return [];

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
        console.error('[DB: MESSAGE] Error listing all messages in Supabase:', error.message);
        throw new Error(`DB_LIST_ALL_MESSAGES_ERROR: ${error.message}`);
    }

    return (data || []) as Message[];
  }
};

// --- Standard Individual Exports ---
export const createMessage = MessagesRepo.createMessage;
export const persistMessage = MessagesRepo.createMessage;
export const getMessage = MessagesRepo.getMessage;
export const getMessagesByContact = MessagesRepo.getMessagesByContact;
export const updateMessageStatus = MessagesRepo.updateMessageStatus;
export const countRecentOutboundMessages = MessagesRepo.countRecentOutboundMessages;
export const countUserTotalRecentMessages = MessagesRepo.countUserTotalRecentMessages;
export const checkDuplicateMessage = MessagesRepo.checkDuplicateMessage;
export const getAllMessagesOrdered = MessagesRepo.getAllMessagesOrdered;
export const getMessages = MessagesRepo.getAllMessagesOrdered; // Alias as requested

