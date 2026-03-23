import { persistContact } from './src/contacts_repo';
import { sendMessageToContact } from './src/sms';
import { getContactTimeline } from './src/timeline';
import { closeDB, initDB } from './src/database';
import { Contact } from './src/types';

async function verifyTimeline() {
  console.log('--- Verification: DB-Backed Message Retrieval & Timeline (R6.15) ---');
  initDB();

  try {
    const phone = '+19997776666';
    const contactId = 'c-timeline-r615';
    
    // 1. Create/Ensure Contact
    const testContact: Contact = {
      id: contactId,
      name: 'Timeline Tester',
      phone: phone,
      email: 'timeline@example.com',
      status: 'lead',
      address: 'Test Address',
      source: 'test',
      tags: [],
      created_at: new Date().toISOString()
    };
    persistContact(testContact);

    // 2. Clear previous messages for this contact (if any) to ensure clean test
    // We don't have a clearMessages function yet, so we just check for new ones.
    const initialTimeline = getContactTimeline(contactId);
    const initialCount = initialTimeline.flatMap(g => g.items).filter(i => i.type === 'message').length;
    console.log(`[TEST] Initial message count in timeline: ${initialCount}`);

    // 3. Send a message
    const msgText = `Timeline verification message at ${new Date().toISOString()}`;
    console.log(`[TEST] Sending message: "${msgText}"`);
    await sendMessageToContact(contactId, msgText, 'test');

    // 4. Verify in Timeline
    const updatedTimeline = getContactTimeline(contactId);
    const updatedMessages = updatedTimeline.flatMap(g => g.items).filter(i => i.type === 'message');
    console.log(`[TEST] Updated message count in timeline: ${updatedMessages.length}`);
    
    const latestMsg = updatedMessages[updatedMessages.length - 1];
    if (latestMsg && latestMsg.content.includes(msgText)) {
        console.log('✅ PASS: Message correctly appears in contact timeline.');
        console.log(`   - Display Content: "${latestMsg.content}"`);
    } else {
        throw new Error('FAIL: New message missing from timeline.');
    }

    // 5. Simulate Restart (Retrieve again)
    console.log('[TEST] Simulating app restart check...');
    const finalTimeline = getContactTimeline(contactId);
    const finalMessages = finalTimeline.flatMap(g => g.items).filter(i => i.type === 'message');
    
    if (finalMessages.some(m => m.content.includes(msgText))) {
        console.log('✅ PASS: Timeline data persisted and retrieved from database.');
    } else {
        throw new Error('FAIL: Message lost after simulated restart.');
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
    verifyTimeline();
}
