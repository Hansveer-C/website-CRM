import { createUserSafe } from './users_service';
import { getCurrentUser } from './auth_logic';
import { createSessionToken } from './session_utils';

async function testGetCurrentUser() {
    console.log('--- Testing getCurrentUser() Helper ---');

    const testEmail = `auth_test_${Date.now()}@test.com`;
    const password = 'test-password-123';

    console.log(`Setting up test user: ${testEmail}...`);
    const createUserResult = await createUserSafe(testEmail, password);
    if (!createUserResult.success) {
        console.error('❌ FAIL: User setup failed.', createUserResult.error);
        process.exit(1);
    }
    const testUser = createUserResult.user!;

    // 1. Test with valid cookie in request object
    console.log('Case 1: Valid session cookie in request object...');
    const token = createSessionToken(testUser);
    const mockRequest = { cookies: { session: token } };
    
    const resolvedUser = await getCurrentUser(mockRequest);
    if (resolvedUser && resolvedUser.id === testUser.id) {
        console.log('✅ PASS: Successfully resolved user from request cookies.');
    } else {
        console.error('❌ FAIL: Failed to resolve user from request cookies.', { testUser, resolvedUser });
        process.exit(1);
    }

    // 2. Test without any cookie
    console.log('Case 2: No cookies provided...');
    const resolvedNone = await getCurrentUser({});
    if (resolvedNone === null) {
        console.log('✅ PASS: Correctly returned null for missing cookies.');
    } else {
        console.error('❌ FAIL: Should have returned null for missing cookies.', resolvedNone);
        process.exit(1);
    }

    // 3. Test with invalid/expired token simulation
    console.log('Case 3: Invalid session token...');
    const resultInvalid = await getCurrentUser({ cookies: { session: 'invalid-token-here' } });
    if (resultInvalid === null) {
        console.log('✅ PASS: Correctly returned null for invalid session token.');
    } else {
        console.error('❌ FAIL: Should have returned null for invalid session.', resultInvalid);
        process.exit(1);
    }

    // 4. Test document.cookie fallback (Simulation)
    console.log('Case 4: Resolving from document.cookie (Simulation)...');
    (global as any).document = {
        cookie: `other=ignore; session=${token}`
    };
    
    const resolvedDoc = await getCurrentUser(); // Call without arguments
    if (resolvedDoc && resolvedDoc.id === testUser.id) {
        console.log('✅ PASS: Successfully resolved user from document.cookie fallback.');
    } else {
        console.error('❌ FAIL: Failed to resolve user from document.cookie.', resolvedDoc);
        process.exit(1);
    }

    console.log('\n✅ ALL getCurrentUser tests PASSED.');
}

testGetCurrentUser().catch(err => {
    console.error(err);
    process.exit(1);
});
