import twilio from 'twilio';
import { twilioConfig } from './config';

/**
 * Backend SMS Service using the Twilio Node.js SDK.
 * This module is intended for server-side use only.
 */
export const smsService = {
  /**
   * Sends an SMS message using the Twilio REST API via the SDK.
   * 
   * @param to The recipient's phone number
   * @param message The SMS body
   * @param user_id The ID of the user triggering the send (for auditing/logging)
   * @returns Promise resolving to the success status and provider message ID
   */
  async sendSMS({ to, message, user_id }: { to: string; message: string; user_id?: string }) {
    const { account_sid, auth_token, sending_phone_number } = twilioConfig;

    if (!account_sid || !auth_token || !sending_phone_number) {
      console.error('[SMS SERVICE BACKEND] Missing Twilio credentials or phone number.');
      return { 
        success: false, 
        error: 'Twilio credentials not configured' 
      };
    }

    try {
      console.log(`[SMS SERVICE BACKEND] Sending SMS to ${to} (User: ${user_id || 'system'})...`);
      
      const client = twilio(account_sid, auth_token);
      
      const result = await client.messages.create({
        body: message,
        from: sending_phone_number,
        to: to
      });

      console.log(`✅ [SMS SERVICE BACKEND] SMS dispatched. SID: ${result.sid}`);
      
      return {
        success: true,
        provider_message_id: result.sid
      };
    } catch (error: any) {
      console.error('❌ [SMS SERVICE BACKEND] Error sending SMS via Twilio SDK:', error.message);
      return {
        success: false,
        error: error.message || 'Unknown error dispatching SMS'
      };
    }
  }
};
