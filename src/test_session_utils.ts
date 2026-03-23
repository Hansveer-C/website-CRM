import { createSessionToken, decodeSessionToken } from './session_utils';

async function testSessionToken() {
    console.log('--- Testing Session Token Generation ---');
    
    const mockUser = {
        id: 'u-123-abc',
        email: 'test@example.com'
    };
    
    // 1. Generate Token
    console.log(`Generating token for user: ${mockUser.id}...`);
    const token = createSessionToken(mockUser);
    
    if (token && typeof token === 'string' && token.length > 20) {
        console.log('✅ PASS: System generated a non-empty session identifier.');
    } else {
        console.error('❌ FAIL: Failed to generate session token.');
        process.exit(1);
    }
    
    // 2. Inspect Contents
    console.log('Verifying token contents (decoding)...');
    const decoded = decodeSessionToken(token);
    
    if (decoded && decoded.user_id === mockUser.id) {
        console.log(`✅ PASS: Token successfully decoded and contains correct user_id: ${decoded.user_id}`);
    } else {
        console.error('❌ FAIL: Token contents are incorrect or decoding failed.', decoded);
        process.exit(1);
    }
    
    if (decoded && decoded.email === mockUser.email) {
        console.log('✅ PASS: Token contains correct email.');
    } else {
        console.error('❌ FAIL: Token email mismatch.');
        process.exit(1);
    }
    
    console.log('\n✅ ALL Session Utility tests PASSED.');
}

testSessionToken().catch(err => {
    console.error(err);
    process.exit(1);
});
