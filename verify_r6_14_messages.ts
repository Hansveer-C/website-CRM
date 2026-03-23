import { persistContact } from './src/contacts_repo';
import { sendMessageToContact } from './src/sms';
import { getMessagesByContact, getAllMessagesOrdered } from './src/messages_repo';
import { closeDB, initDB } from './src/database';
import { Contact, Message } from './src/types';

async function verifyMessages() {
  console.log('--- Verification: DB-Backed Message Creation (R6.14) ---');
  initDB();

  try {
    const phone = '+19998881234';
    const contactId = 'c-msg-r614-v2';
    
    // 1. Create/Ensure Contact
    const testContact: Contact = {
      id: contactId,
      name: 'R6.14 Tester V2',
      phone: phone,
      email: 'testerv2@example.com',
      status: 'lead',
      address: 'Test Address',
      source: 'test',
      tags: [],
      created_at: new Date().toISOString()
    };
    persistContact(testContact);

    console.log(`[TEST] Sending manual SMS to ${phone} (Twilio call will fail due to config)...`);
    const sentResult = await sendMessageToContact(contactId, 'Manual test message V2 from R6.14 verification script', 'manual');
    
    console.log(`[TEST] Dispatch finished. Success: ${sentResult.success}, Error: ${sentResult.error}`);
    console.log(`[TEST] Internal ID: ${sentResult.internal_id}`);

    // 2. Verify in DB
    const messages = getMessagesByContact(contactId);
    console.log(`[DB] Found ${messages.length} messages for contact ${contactId}`);
    
    const found = messages.find((m: Message) => m.id === sentResult.internal_id);
    if (found) {
        console.log('✅ PASS: Message found in persistent storage.');
        console.log(`   - ID: ${found.id}`);
        console.log(`   - Content: "${found.content}"`);
        console.log(`   - Status: "${found.status}"`);
        console.log(`   - Source: "${found.source}"`);
    } else {
        throw new Error('FAIL: Message NOT found in database after dispatch.');
    }

    // 3. Test Deduplication
    console.log('[TEST] Attempting duplicate message send...');
    const dupResult = await sendMessageToContact(contactId, 'Manual test message V2 from R6.14 verification script', 'manual');
    if (!dupResult.success && dupResult.error === 'Duplicate SMS prevented') {
        console.log('✅ PASS: Database-backed deduplication prevented duplicate send.');
    } else {
        throw new Error(`FAIL: Deduplication check failed. Result: ${JSON.stringify(dupResult)}`);
    }

    // 4. Test Global Feed (getAllMessagesOrdered)
    const all = getAllMessagesOrdered();
    if (all.some((m: Message) => m.id === sentResult.internal_id)) {
        console.log('✅ PASS: Message correctly appears in global chronological feed.');
    } else {
        throw new Error('FAIL: Message missing from global feed.');
    }

  } catch (err) {
    console.error('❌ VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    closeDB();
  }
}

// @ts-ignore
if (typeof process !== 'undefined') {
    verifyMessages();
}
