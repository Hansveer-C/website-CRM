import { createUserSafe } from './users_service';
import { getContacts } from './contacts_api';
import { createSessionToken } from './session_utils';
import { ApiRequest } from './types';

async function testEndpointProtection() {
    console.log('--- Testing API Endpoint Protection (Auth Enforcement) ---');

    // 1. Unauthenticated Call -> Should fail with 401
    console.log('Case 1: Calling guarded endpoint WITHOUT login...');
    const req1: ApiRequest = {}; // No tokens, no context
    
    const result1 = await getContacts(req1);
    
    if (result1 && result1.status === 401) {
        console.log('✅ PASS: Request correctly blocked with status 401.');
    } else {
        console.error('❌ FAIL: Request was NOT blocked correctly! Status:', result1.status);
        process.exit(1);
    }

    // 2. Authenticated Call -> Should succeed with 200
    console.log('\nCase 2: Logging in and calling guarded endpoint again...');
    const testEmail = `auth_test_api_${Date.now()}@test.com`;
    const setup = await createUserSafe(testEmail, 'strong-password');
    const token = createSessionToken(setup.user!);
    
    // Simulate browser sending the cookie
    const req2: ApiRequest = { cookies: { session: token } };
    
    const result2 = await getContacts(req2);
    
    if (result2 && result2.status === 200 && Array.isArray(result2.data)) {
        console.log(`✅ PASS: Request allowed after valid login for user: ${result2.user}`);
        console.log(`Data count: ${result2.data.length} contacts retrieved.`);
    } else {
        console.error('❌ FAIL: Valid authenticated request was rejected or failed.', result2);
        process.exit(1);
    }

    console.log('\n✅ ALL Endpoint Protection tests PASSED.');
}

testEndpointProtection().catch(err => {
    console.error(err);
    process.exit(1);
});
