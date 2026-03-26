import { Message, Contact } from './types';

/**
 * Universal SMS Bridge.
 * Automatically switches between direct backend logic (Node.js) 
 * and API routing (Browser) to prevent SDK leakage into the frontend.
 */

export async function sendMessageToContact(contactId: string, message: string, source: string = 'manual', user_id?: string, trigger_event_id?: string) {
  // Environment Check
  const isBrowser = typeof window !== 'undefined';

  if (!isBrowser) {
    // Backend Logic (Node.js) - Uses Dynamic Import to hide Twilio from Vite
    const { sendMessageToContact: backendSend } = await import('./sms_logic');
    return backendSend(contactId, message, source, user_id, trigger_event_id);
  }

  // Frontend Bridge (Browser) - Zero knowledge of Twilio
  console.log(`[API BRIDGE] Routing SMS request to the backend for contact ${contactId}...`);
  
  try {
    const response = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: contactId,
        message: message,
        source: source,
        user_id: user_id,
        trigger_event_id: trigger_event_id
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`❌ [API ERROR] Failed to send SMS via backend:`, error.message);
    return { success: false, error: error.message };
  }
}

export async function retryMessage(messageId: string) {
  if (typeof window === 'undefined') {
    const { retryMessage: backendRetry } = await import('./sms_logic');
    return backendRetry(messageId);
  }

  try {
    const response = await fetch(`/api/messages/${messageId}/retry`, {
      method: 'POST'
    });
    return await response.json();
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Shared message generators (Safe for both frontend and backend)
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
  return `Hey ${name || 'there'}, sorry I missed your call. How can I help?`;
}
