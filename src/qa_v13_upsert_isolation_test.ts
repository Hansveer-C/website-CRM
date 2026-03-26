import { createContact, getContact } from './contacts_repo';
import { createUserSafe } from './users_service';
import { Contact } from './types';

async function testUpsertIsolation() {
    console.log('--- QA V13: Upsert Isolation Test (MF.3) ---');

    // 1. Setup User A and Contact A
    const userA_res = await createUserSafe(`userA_upsert_${Date.now()}@test.com`, 'test-pass');
    const userA = userA_res.user!;
    
    const contactA: Contact = {
        id: `c-shared-${Date.now()}`,
        user_id: userA.id,
        name: 'Target Contact (User A)',
        phone: '555-0001',
        email: 'target@a.com',
        address: '123 A St',
        tags: [],
        source: 'test',
        status: 'lead',
        created_at: new Date().toISOString()
    };

    console.log('Step 1: Creating contact for User A...');
    await createContact(contactA);

    // 2. Setup User B
    const userB_res = await createUserSafe(`userB_upsert_${Date.now()}@test.com`, 'test-pass');
    const userB = userB_res.user!;

    // 3. ATTEMPT: User B tries to OVERWRITE Contact A by reusing ID
    const attackerContact: Contact = {
        ...contactA,
        user_id: userB.id, // User B tries to claim it
        name: 'STOLEN CONTACT'
    };

    console.log(`Step 2: User B (${userB.email}) attempting to overwrite User A's contact...`);
    const attackRes = await createContact(attackerContact);

    if (!attackRes.success && attackRes.error === 'ACCESS_DENIED') {
        console.log('✅ PASS: Cross-tenant overwrite blocked by repository check.');
    } else {
        console.error('❌ FAIL: User B was allowed to overwrite or returned wrong error:', attackRes.error);
        process.exit(1);
    }

    // 4. Verify User A's data remains untouched
    const verifyRes = await getContact(contactA.id, userA);
    if (verifyRes.success && verifyRes.data && verifyRes.data.name === 'Target Contact (User A)') {
        console.log('✅ PASS: User A data is intact.');
    } else {
        console.error('❌ FAIL: User A data was modified or lost!');
        process.exit(1);
    }

    console.log('\n✅ Upsert Isolation Test Completed Successfully.');
}

import { fileURLToPath } from 'url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    testUpsertIsolation().catch(err => {
        console.error('Test crashed:', err);
        process.exit(1);
    });
}
