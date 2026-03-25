/**
 * 🔒 SERVER-ONLY MODULE
 * This module contains administrative logic, database credentials, or Node.js internal utilities.
 * ⚠️ DO NOT IMPORT INTO FRONTEND CODE (main.ts, etc.)
 */
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
      
      // Node.js environment check
      const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

      if (!isNode) {
        // We are likely in a Dev Browser Mock (client-side simulation)
        console.warn('⚠️ [SMS SERVICE] Running in browser mock mode. No real SMS will be sent.');
        return {
          success: true,
          provider_message_id: `SM_MOCK_${Math.floor(Math.random() * 1000)}`
        };
      }

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
