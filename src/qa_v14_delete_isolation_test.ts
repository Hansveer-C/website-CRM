import { createContact, deleteContact, getContact } from './contacts_repo';
import { createUserSafe } from './users_service';
import { Contact } from './types';

async function testDeleteIsolation() {
    console.log('--- QA V14: Delete Isolation Test (MF.4) ---');

    // 1. Setup User A and Contact A
    const userA_res = await createUserSafe(`userA_del_${Date.now()}@test.com`, 'test-pass');
    const userA = userA_res.user!;
    
    const contactA: Contact = {
        id: `c-del-${Date.now()}`,
        user_id: userA.id,
        name: 'Delete Target (User A)',
        phone: '555-9000',
        email: 'del@a.com',
        address: '123 Del St',
        tags: [],
        source: 'test',
        status: 'lead',
        created_at: new Date().toISOString()
    };

    console.log('Step 1: Creating contact for User A...');
    await createContact(contactA);

    // 2. Setup User B
    const userB_res = await createUserSafe(`userB_del_${Date.now()}@test.com`, 'test-pass');
    const userB = userB_res.user!;

    // 3. ATTEMPT: User B tries to DELETE User A's contact
    console.log(`Step 2: User B (${userB.email}) attempting to delete User A's contact...`);
    const deleteRes = await deleteContact(contactA.id, userB);

    // In Supabase/safeDbCall, if no rows matched, it might still return success: true but with 0 count
    // The key is that the record should STILL EXIST in User A's context.
    console.log('Delete result:', deleteRes);

    // 4. Verify User A's record STILL EXISTS
    const verifyRes = await getContact(contactA.id, userA);
    if (verifyRes.success && verifyRes.data) {
        console.log('✅ PASS: Record was NOT deleted by unauthorized user.');
    } else {
        console.error('❌ FAIL: Record was deleted or is inaccessible to User A!');
        process.exit(1);
    }

    console.log('\n✅ Delete Isolation Test Completed Successfully.');
}

import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    testDeleteIsolation().catch(err => {
        console.error('Test crashed:', err);
        process.exit(1);
    });
}
