import { Message, User, RepoResponse, MessageStatus } from './types';
/**
 * 🔒 SERVER-ONLY MODULE
 * This module contains administrative logic, database credentials, or Node.js internal utilities.
 * ⚠️ DO NOT IMPORT INTO FRONTEND CODE (main.ts, etc.)
 */
import { supabase, safeDbCall, safeDbCount } from './utils/db/supabase';

export const mockMessages: Message[] = [];

/**
 * Phase S3 - Batch 3: Messages Repository (Supabase).
 */
export const MessagesRepo = {
  /**
   * Persists a message to the Supabase database.
   */
  async createMessage(message: Message): Promise<RepoResponse<Message>> {
    console.log(`[DB: SUPABASE MESSAGE] Persisting ${message.id} for contact ${message.contact_id}.`);
    
    const isBrowser = typeof window !== 'undefined';
    const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
    if (!hasSupabase) {
        console.log('[DB MOCK FALLBACK: CREATE_MESSAGE] Saving to mockMessages:', message);
        const idx = mockMessages.findIndex(m => m.id === message.id);
        if (idx !== -1) {
            mockMessages[idx] = message;
        } else {
            mockMessages.push(message);
        }
        return { success: true, data: message };
    }

    // 🛡️ MF.3: PREVENT CROSS-TENANT OVERWRITES
    const { data: existing } = await supabase.from('messages').select('user_id').eq('id', message.id).maybeSingle();
    if (existing && existing.user_id !== message.user_id) {
        return { success: false, error: 'ACCESS_DENIED_CROSS_TENANT' };
    }

    const payload = {
      ...message,
      retryable: !!message.retryable
    };

    return safeDbCall('CREATE_MESSAGE', message.user_id, supabase
      .from('messages')
      .upsert(payload)
      .select()
      .single()
    );
  },

  /**
   * Alias for createMessage to maintain compatibility.
   */
  async persistMessage(message: Message): Promise<RepoResponse<Message>> {
    return this.createMessage(message);
  },

  /**
   * Retrieves a message by its ID, scoped to the user context.
   */
  async getMessage(id: string, user?: User | string | null): Promise<RepoResponse<Message | null>> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) {
        return { success: false, error: 'MISSING_USER_CONTEXT' };
    }

    const isBrowser = typeof window !== 'undefined';
    const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
    if (!hasSupabase) {
        const msg = mockMessages.find(m => m.id === id && m.user_id === userId);
        return { success: true, data: msg || null };
    }

    return safeDbCall('GET_MESSAGE', userId, supabase
      .from('messages')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    );
  },

  /**
   * Retrieves all messages for a specific contact, scoped to the user context.
   */
  async getMessagesByContact(contactId: string, user?: User | string | null, limit = 50): Promise<RepoResponse<Message[]>> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) {
        return { success: false, error: 'MISSING_USER_CONTEXT' };
    }

    const isBrowser = typeof window !== 'undefined';
    const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
    if (!hasSupabase) {
        const list = mockMessages.filter(m => m.contact_id === contactId && m.user_id === userId);
        return { success: true, data: list.slice(0, limit) };
    }

    return safeDbCall('GET_MESSAGES_BY_CONTACT', userId, supabase
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(limit)
    );
  },

  /**
   * Updates a message's status and provider info.
   */
  async updateMessageStatus(id: string, status: MessageStatus, providerMessageId?: string, retryable?: boolean, user?: User | string | null): Promise<RepoResponse<void>> {
    const userId = typeof user === 'string' ? user : (user?.id);
    if (!userId) {
        return { success: false, error: 'MISSING_USER_CONTEXT' };
    }

    const isBrowser = typeof window !== 'undefined';
    const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
    if (!hasSupabase) {
        const msg = mockMessages.find(m => m.id === id && m.user_id === userId);
        if (!msg) return { success: false, error: 'MESSAGE_NOT_FOUND' };
        msg.status = status;
        msg.provider_message_id = providerMessageId || undefined;
        msg.retryable = !!retryable;
        return { success: true };
    }

    // Resolve owner
    const { data: existing } = await supabase.from('messages').select('user_id').eq('id', id).maybeSingle();
    if (!existing) return { success: false, error: 'MESSAGE_NOT_FOUND' };
    if (existing.user_id !== userId) return { success: false, error: 'ACCESS_DENIED_CROSS_TENANT' };

    const res = await supabase
      .from('messages')
      .update({
        status,
        provider_message_id: providerMessageId || null,
        retryable: !!retryable
      })
      .eq('id', id)
      .eq('user_id', userId); // Extra safety

    if (res.error) {
        console.error('[DB: UPDATE_MESSAGE_STATUS] Error:', res.error.message);
        return { success: false, error: res.error.message };
    }
    return { success: true };
  },

  /**
   * Deletes a message, scoped strictly to the user. (MF.4)
   */
  async deleteMessage(id: string, user: User | string): Promise<RepoResponse<void>> {
    const userId = typeof user === 'string' ? user : user.id;

    const isBrowser = typeof window !== 'undefined';
    const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
    if (!hasSupabase) {
        const idx = mockMessages.findIndex(m => m.id === id && m.user_id === userId);
        if (idx !== -1) {
            mockMessages.splice(idx, 1);
        }
        return { success: true };
    }

    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  /**
   * Counts recent outbound messages for rate limiting.
   */
  async countRecentOutboundMessages(contactId: string, sinceIso: string, user?: User | string | null): Promise<RepoResponse<number>> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) return { success: true, data: 0 };

    const isBrowser = typeof window !== 'undefined';
    const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
    if (!hasSupabase) {
        const count = mockMessages.filter(m => m.user_id === userId && m.contact_id === contactId && m.direction === 'outbound' && m.created_at > sinceIso).length;
        return { success: true, data: count };
    }

    return safeDbCount('COUNT_RECENT_SMS_CONTACT', userId, supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('contact_id', contactId)
      .eq('direction', 'outbound')
      .gt('created_at', sinceIso)
    );
  },

  /**
   * Counts the total outbound messages sent by a user across all contacts for global rate limiting.
   */
  async countUserTotalRecentMessages(user_id: string, sinceIso: string): Promise<RepoResponse<number>> {
    const isBrowser = typeof window !== 'undefined';
    const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
    if (!hasSupabase) {
        const count = mockMessages.filter(m => m.user_id === user_id && m.direction === 'outbound' && m.created_at > sinceIso).length;
        return { success: true, data: count };
    }

    return safeDbCount('COUNT_USER_TOTAL_SMS', user_id, supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('direction', 'outbound')
      .gt('created_at', sinceIso)
    );
  },

  /**
   * Checks if a duplicate message was sent recently.
   */
  async checkDuplicateMessage(contactId: string, content: string, sinceIso: string, user?: User | string | null): Promise<RepoResponse<boolean>> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) return { success: true, data: false };

    const isBrowser = typeof window !== 'undefined';
    const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
    if (!hasSupabase) {
        const count = mockMessages.filter(m => m.user_id === userId && m.contact_id === contactId && m.direction === 'outbound' && m.content === content && m.created_at > sinceIso).length;
        return { success: true, data: count > 0 };
    }

    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('contact_id', contactId)
      .eq('direction', 'outbound')
      .eq('content', content)
      .gt('created_at', sinceIso);

    if (error) {
        console.error('[DB: CHECK_DUPLICATE_MESSAGE] Error:', error.message);
        return { success: false, error: error.message };
    }

    return { success: true, data: (count || 0) > 0 };
  },

  /**
   * Retrieves all messages in the entire system, sorted chronologically (ASC).
   */
  async getAllMessagesOrdered(user?: User | string | null, limit = 200): Promise<RepoResponse<Message[]>> {
    const userId = typeof user === 'string' ? user : (user?.id);
    
    if (!userId) return { success: false, error: 'MISSING_USER_CONTEXT' };
 
    const isBrowser = typeof window !== 'undefined';
    const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;
    if (!hasSupabase) {
        const list = mockMessages.filter(m => m.user_id === userId).sort((a, b) => a.created_at.localeCompare(b.created_at));
        return { success: true, data: list.slice(0, limit) };
    }

    return safeDbCall('GET_ALL_MESSAGES', userId, supabase
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(limit)
    );
  }
};

// --- Standard Individual Exports ---
export const createMessage = MessagesRepo.createMessage;
export const persistMessage = MessagesRepo.createMessage;
export const getMessage = MessagesRepo.getMessage;
export const getMessagesByContact = MessagesRepo.getMessagesByContact;
export const updateMessageStatus = MessagesRepo.updateMessageStatus;
export const deleteMessage = MessagesRepo.deleteMessage;
export const countRecentOutboundMessages = MessagesRepo.countRecentOutboundMessages;
export const countUserTotalRecentMessages = MessagesRepo.countUserTotalRecentMessages;
export const checkDuplicateMessage = MessagesRepo.checkDuplicateMessage;
export const getAllMessagesOrdered = MessagesRepo.getAllMessagesOrdered;
export const getMessages = MessagesRepo.getAllMessagesOrdered; 

// Backward compatibility or direct access
export async function countRecentOutboundMessagesRaw(contactId: string, sinceIso: string, user?: User | string | null): Promise<number> {
    const res = await MessagesRepo.countRecentOutboundMessages(contactId, sinceIso, user);
    return res.data || 0;
}

