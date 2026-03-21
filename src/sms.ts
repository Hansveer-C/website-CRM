import { twilioConfig } from './config';
import { Message, Contact } from './types';
import { saveMessage } from './messages';
import { mockContacts, mockMessages } from './db';

/**
 * Generates a default welcome SMS message for a newly created lead.
 * Includes a fallback if the contact name is missing.
 * 
 * @param contact The contact object (can be partial)
 * @returns Formatted SMS message string
 */
export function getDefaultLeadReply(contact: Partial<Contact> | undefined | null): string {
  const name = contact?.name?.trim();
  const greeting = name ? `Hey ${name}` : 'Hey there';
  return `${greeting}, thanks for reaching out! I got your request and will get back to you shortly.`;
}

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

/**
 * Orchestrates the full SMS sending workflow.
 * 
 * Step 1: Create a record of the message in the "Message" table with status "pending".
 * Step 2: Trigger the actual API call to Twilio via sendSMS().
 * 
 * @returns The created internal message ID and the Twilio API result
 */
export async function dispatchSMS(
  contact_id: string, 
  phone: string, 
  messageText: string, 
  opportunity_id?: string
): Promise<{ internal_id: string; twilio_result: any }> {
  
  // Step 1: Create Message record using shared saveMessage utility
  // This automatically handles opportunity linking and contact validation.
  const newMessage: Message = {
    id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    contact_id,
    opportunity_id,
    direction: 'outbound',
    type: 'sms',
    content: messageText,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  saveMessage(newMessage);
  console.log(`[DISPATCH] Message record created with status "pending": ${newMessage.id}`);

  // Step 2: Call sendSMS()
  const result = await sendSMS(phone, messageText);
  
  // Locate the actual saved record in the mock database to apply mutations
  const dbRecord = mockMessages.find(m => m.id === newMessage.id);
  
  if (dbRecord) {
    // Update status based on result
    if (result.success) {
      dbRecord.status = 'sent';
      dbRecord.retryable = false;
      dbRecord.provider_message_id = result.provider_message_id;
      console.log(`✅ [DISPATCH] Message ${dbRecord.id} marked as 'sent'. Provider ID: ${result.provider_message_id}`);
    } else {
      dbRecord.status = 'failed';
      dbRecord.retryable = true;
      console.error(`❌ [DISPATCH] Message ${dbRecord.id} marked as 'failed'. Error: ${result.error}`);
    }
  }
  
  return { 
    internal_id: newMessage.id, 
    twilio_result: result 
  };
}

/**
 * Convenience helper to send an SMS directly to a CRM Contact by their ID.
 * Handles the full lifecycle: Contact Lookup -> Phone Validation -> Dispatch -> State Update.
 * 
 * @param contact_id Unique ID of the contact in the CRM
 * @param messageText SMS body text
 * @returns Result of the dispatch, or failure if contact/phone is missing
 */
export async function sendMessageToContact(
  contact_id: string, 
  messageText: string
): Promise<{ success: boolean; internal_id?: string; error?: string }> {
  
  // Locate the contact
  const contact = mockContacts.find(c => c.id === contact_id);
  
  if (!contact) {
    const errorMsg = `Contact lookup failed: ID ${contact_id} not found in database.`;
    console.error(`[CONTACT HELPER] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  // Validate phone existence
  if (!contact.phone) {
    const errorMsg = `SMS Aborted: Contact ${contact.name} (${contact_id}) has no phone number recorded.`;
    console.error(`[CONTACT HELPER] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  // Prevent duplicate SMS sends
  const now = new Date().getTime();
  const isDuplicate = mockMessages.some(m => 
    m.contact_id === contact_id &&
    m.direction === 'outbound' &&
    m.content === messageText &&
    (now - new Date(m.created_at).getTime()) < 60000
  );

  if (isDuplicate) {
    const errorMsg = `Duplicate SMS prevented`;
    console.warn(`[CONTACT HELPER] ${errorMsg}: '${messageText}' was already sent to ${contact.name} within the last 60 seconds.`);
    return { success: false, error: errorMsg };
  }

  // Rate limiting: Max 3 messages per contact per minute
  const recentMessagesCount = mockMessages.filter(m =>
    m.contact_id === contact_id &&
    m.direction === 'outbound' &&
    (now - new Date(m.created_at).getTime()) < 60000
  ).length;

  if (recentMessagesCount >= 3) {
    const errorMsg = `Rate limit hit`;
    console.warn(`[CONTACT HELPER] ${errorMsg}: Contact ${contact.name} has already received 3 messages in the last minute.`);
    return { success: false, error: errorMsg };
  }

  console.log(`[CONTACT HELPER] Initializing SMS lifecycle for ${contact.name}...`);
  
  // Call the core dispatcher to handle Step 1 (Message Record) and Step 2 (Twilio Send)
  const result = await dispatchSMS(contact_id, contact.phone, messageText);
  
  return {
    success: result.twilio_result.success,
    internal_id: result.internal_id,
    error: result.twilio_result.error
  };
}

/**
 * Manually retries sending a failed SMS message.
 * 
 * @param message_id The internal ID of the failed message
 * @returns Result of the retry attempt
 */
export async function retryMessage(message_id: string): Promise<{ success: boolean; error?: string }> {
  // Locate the message
  const msg = mockMessages.find(m => m.id === message_id);
  
  if (!msg) {
    const errorMsg = `Retry aborted: Message ID ${message_id} not found.`;
    console.error(`[RETRY HELPER] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  // Validate state
  if (msg.status !== 'failed' || !msg.retryable) {
    const errorMsg = `Retry aborted: Message ${message_id} is not marked as failed/retryable (Status: ${msg.status}).`;
    console.warn(`[RETRY HELPER] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  // Locate the contact to get the current phone number
  const contact = mockContacts.find(c => c.id === msg.contact_id);
  
  if (!contact || !contact.phone) {
    const errorMsg = `Retry aborted: Contact ${msg.contact_id} not found or missing a phone number.`;
    console.error(`[RETRY HELPER] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  console.log(`[RETRY HELPER] Retrying message ${message_id} to ${contact.name}...`);
  
  // Call sendSMS again
  const result = await sendSMS(contact.phone, msg.content);
  
  // Update state
  if (result.success) {
    msg.status = 'sent';
    msg.retryable = false;
    msg.provider_message_id = result.provider_message_id;
    console.log(`✅ [RETRY HELPER] Message ${message_id} successfully retried and marked as 'sent'. Provider ID: ${result.provider_message_id}`);
  } else {
    // Keep it failed and retryable
    msg.status = 'failed';
    msg.retryable = true;
    console.error(`❌ [RETRY HELPER] Retry for message ${message_id} failed. Error: ${result.error}`);
  }
  
  return {
    success: result.success,
    error: result.error
  };
}
