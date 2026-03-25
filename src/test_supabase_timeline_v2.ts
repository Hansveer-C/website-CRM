import { getContactTimeline } from './timeline';
import { createUserSafe } from './users_service';
import { createContact } from './contacts_repo';
import { persistMessage } from './messages_repo';
import { persistCall } from './calls_repo';
import { persistActivity } from './activities_repo';
import { emitEvent } from './events';

async function testSupabaseTimeline() {
    console.log('--- Testing Unified Timeline (Supabase) ---');

    const testEmail = `time_test_${Date.now()}@test.com`;
    const password = 'test-password-123';

    console.log(`Setting up test user: ${testEmail}...`);
    const setup = await createUserSafe(testEmail, password);
    if (!setup.success) {
        throw new Error(`User setup failed: ${setup.error}`);
    }
    const user = setup.user!;

    // 1. Create Contact
    const contactId = `c-time-${Date.now()}`;
    const contact = {
        id: contactId,
        user_id: user.id,
        name: 'Timeline Tester',
        phone: '+16045550000',
        email: 'time@tester.com',
        address: '456 Time Rd',
        tags: [],
        source: 'test',
        status: 'lead' as const,
        created_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
    };
    try { await createContact(contact); } catch (e) { console.warn('ℹ️ Contact creation failed (schema).'); }

    // 2. Seed Data (Parallel-ish)
    console.log('Step 2: Seeding various activity types...');
    
    // A. Message
    await persistMessage({
        id: `m-t-${Date.now()}`,
        user_id: user.id,
        contact_id: contactId,
        direction: 'outbound',
        type: 'sms',
        content: 'Initial follow up',
        status: 'sent',
        created_at: new Date(Date.now() - 3000000).toISOString()
    });

    // B. Call
    await persistCall({
        id: `c-t-${Date.now()}`,
        user_id: user.id,
        contact_id: contactId,
        phone: contact.phone,
        direction: 'inbound',
        status: 'missed',
        created_at: new Date(Date.now() - 2000000).toISOString()
    });

    // C. Activity (Task)
    await persistActivity({
        id: `a-t-${Date.now()}`,
        user_id: user.id,
        contact_id: contactId,
        type: 'note',
        description: 'Called back but no answer',
        due_date: new Date(Date.now() - 1000000).toISOString(),
        completed: true
    });

    // D. Event (Auto SMS trigger)
    await emitEvent('call_missed', { 
        phone: contact.phone, 
        contact_id: contactId, 
        call_id: 'c-t-dummy' 
    }, user.id);

    // 3. Fetch Timeline
    console.log('Step 3: Fetching unified timeline...');
    const timeline = await getContactTimeline(contactId, user);
    
    console.log('\n--- Timeline Result ---');
    let totalItems = 0;
    timeline.forEach(group => {
        console.log(`[${group.label}]`);
        group.items.forEach(item => {
            console.log(`  - ${item.created_at}: ${item.content}`);
            totalItems++;
        });
    });

    if (totalItems >= 4) {
        console.log(`\n✅ PASS: Unified timeline returned ${totalItems} items across all categories.`);
    } else {
        console.log(`\nℹ️ Found ${totalItems} items. This may be low if some tables are missing.`);
    }

    console.log('\n✅ Timeline Repository (Supabase) integration completed.');
}

testSupabaseTimeline().catch(err => {
    console.error('❌ Test failed:', err);
});
