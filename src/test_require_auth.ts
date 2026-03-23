import { requireAuth, apiMiddleware } from './middleware';
import { createUserSafe } from './users_service';
import { createSessionToken } from './session_utils';
import { ApiRequest } from './types';

async function testAuthGuard() {
    console.log('--- Testing Authorization Guard Middleware ---');

    // 1. Unauthenticated Request -> Should return 401
    console.log('Case 1: Anonymous request attempting to access protected resource...');
    const req1: ApiRequest = {}; // Unauthenticated
    await apiMiddleware(req1); // Process context first
    
    const result1 = requireAuth(req1);
    
    if (result1 && result1.status === 401) {
        console.log(`✅ PASS: Correctly blocked anonymously request with status 401: ${result1.error}`);
    } else {
        console.error('❌ FAIL: Failed to block anonymous request.', result1);
        process.exit(1);
    }

    // 2. Authenticated Request -> Should pass (null result)
    console.log('\nCase 2: Authenticated request accessing protected resource...');
    const testEmail = `auth_guard_${Date.now()}@test.com`;
    const setup = await createUserSafe(testEmail, 'password123');
    const token = createSessionToken(setup.user!);
    
    const req2: ApiRequest = { cookies: { session: token } };
    await apiMiddleware(req2); // Populate context
    
    const result2 = requireAuth(req2);
    
    if (result2 === null) {
        console.log('✅ PASS: Allowed authenticated request to continue successfully.');
    } else {
        console.error('❌ FAIL: Blocked a valid authenticated request.', result2);
        process.exit(1);
    }

    console.log('\n✅ ALL Authentication Guard tests PASSED.');
}

testAuthGuard().catch(err => {
    console.error(err);
    process.exit(1);
});
