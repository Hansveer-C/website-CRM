/**
 * Frontend SMS API Client.
 * Routes all SMS requests through the secure backend API.
 * The frontend has zero knowledge of Twilio credentials or SDK.
 */

export async function sendMessageToContact(contactId: string, message: string, source: string = 'manual') {
  console.log(`[API] Routing SMS request to the backend for contact ${contactId}...`);
  
  try {
    const response = await fetch('/api/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contact_id: contactId,
        message: message,
        source: source
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
  try {
    const response = await fetch(`/api/messages/${messageId}/retry`, {
      method: 'POST'
    });
    return await response.json();
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// These logic helpers can still exist on the frontend if needed for UI previews,
// but they no longer involve Twilio directly.
export function getDefaultLeadReply(name: string, template?: string): string {
  if (template && template.trim()) {
    return template.replace(/{name}/g, name || 'there');
  }
  const greeting = name ? `Hey ${name}` : 'Hey there';
  return `${greeting}, thanks for reaching out! I got your request and will get back to you shortly.`;
}

export function getMissedCallReply(name: string, template?: string): string {
  if (template && template.trim()) {
    return template.replace(/{name}/g, name || 'there');
  }
  return `Hey ${name || 'there'}, sorry I missed your call. How can I help?`;
}
