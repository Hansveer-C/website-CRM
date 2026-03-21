import { twilioConfig } from './config';

/**
 * Sends an SMS message using the Twilio REST API.
 * 
 * Note: If called from a browser environment, this request may trigger 
 * a CORS error as Twilio discourages client-side API calls to prevent 
 * credential exposure. In a production environment, this should ideally 
 * be handled by a secure backend proxy.
 * 
 * @param phone The recipient's phone number in normalized format (e.g., +1XXXXXXXXXX)
 * @param message The message body to send
 * @returns Object indicating success status and provider message ID
 */
export async function sendSMS(phone: string, message: string): Promise<{ success: boolean; provider_message_id?: string; error?: string }> {
  const { account_sid, auth_token, sending_phone_number } = twilioConfig;

  // Validate presence of credentials
  if (!account_sid || !auth_token || !sending_phone_number) {
    const errorMsg = 'Twilio credentials not fully configured in environment variables.';
    console.error(`[SMS SERVICE] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  // Twilio API Endpoint
  const url = `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`;
  
  // Basic Auth Header (Base64 SID:TOKEN)
  const auth = btoa(`${account_sid}:${auth_token}`);

  // URLSearchParams for form-encoded delivery
  const params = new URLSearchParams();
  params.append('To', phone);
  params.append('From', sending_phone_number);
  params.append('Body', message);

  try {
    console.log(`[SMS SERVICE] Attempting to send message to ${phone}...`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`✅ [SMS SERVICE] Message successfully dispatched. Twilio SID: ${data.sid}`);
      return { 
        success: true, 
        provider_message_id: data.sid 
      };
    } else {
      const errorDetail = data.message || response.statusText;
      console.error(`❌ [SMS SERVICE] Dispatch failed: ${errorDetail}`);
      return { 
        success: false, 
        error: errorDetail 
      };
    }
  } catch (error) {
    console.error(`❌ [SMS SERVICE] Network or Runtime Error:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}
