import { createUserSafe } from './users_service';
import { apiMiddleware } from './middleware';
import { createSessionToken } from './session_utils';
import { ApiRequest } from './types';

async function testMiddlewareContext() {
    console.log('--- Testing API Middleware Context ---');

    const testEmail = `middleware_test_${Date.now()}@test.com`;
    console.log(`Setting up test user: ${testEmail}...`);
    const createUserResult = await createUserSafe(testEmail, 'test-pass-123');
    if (!createUserResult.success) {
        console.error('❌ FAIL: User setup failed.');
        process.exit(1);
    }
    const testUser = createUserResult.user!;

    // 1. Simulating an Authenticated Request
    console.log('Case 1: Simulating an authenticated request (resolving context)...');
    const token = createSessionToken(testUser);
    
    // Creating a mock request object
    const req1: ApiRequest = { 
        cookies: { session: token } 
    };
    
    // Pass through middleware
    await apiMiddleware(req1);
    
    if (req1.user && req1.user.id === testUser.id) {
        console.log(`✅ PASS: request.user populated correctly for user: ${req1.user.email}`);
    } else {
        console.error('❌ FAIL: request.user was not populated correctly.', req1.user);
        process.exit(1);
    }

    // 2. Simulating an Unauthenticated Request
    console.log('Case 2: Simulating an unauthenticated request...');
    const req2: ApiRequest = {};
    
    await apiMiddleware(req2);
    
    if (req2.user === null) {
        console.log('✅ PASS: request.user correctly set to null for unauthenticated request.');
    } else {
        console.error('❌ FAIL: request.user should be null.', req2.user);
        process.exit(1);
    }

    console.log('\n✅ ALL Middleware Context tests PASSED.');
}

testMiddlewareContext().catch(err => {
    console.error(err);
    process.exit(1);
});
