import { login } from './auth_logic';
import { createUserSafe } from './users_service';

async function testLoginAPI() {
    console.log('=== Testing Login API Endpoint (Simulated) ===');
    
    const testEmail = `login_test_${Date.now()}@test.com`;
    const password = 'mypassword123';
    
    // Preparation: Create a user to test valid login
    console.log(`Setting up test user: ${testEmail}...`);
    await createUserSafe(testEmail, password);
    
    // 1. Test Valid Email + Correct Password -> Success (with token)
    console.log('Testing login with valid credentials...');
    const result1 = await login({ email: testEmail, password });
    if (result1.success && result1.token && typeof result1.token === 'string') {
        console.log('✅ PASS: Login succeeded and returned a session token.');
        console.log(`Token Snippet: ${result1.token.substring(0, 20)}...`);
    } else {
        console.error('❌ FAIL: Valid login was rejected or token is missing.', result1.error || 'Token missing');
        process.exit(1);
    }

    // 2. Test Valid Email + Wrong Password -> Rejected
    console.log('Testing login with WRONG password...');
    const resultWrongPass = await login({ email: testEmail, password: 'not-the-right-password' });
    if (!resultWrongPass.success && resultWrongPass.error === 'Invalid credentials') {
        console.log('✅ PASS: Wrong password correctly returned "Invalid credentials".');
    } else {
        console.error('❌ FAIL: Wrong password was not rejected correctly.', resultWrongPass.error);
        process.exit(1);
    }
    
    // 3. Test Normalization (Mixed Case)
    console.log('Testing login with mixed-case email + correct password...');
    const resultNorm = await login({ email: testEmail.toUpperCase(), password });
    if (resultNorm.success) {
        console.log('✅ PASS: Normalization worked (found mixed-case email with correct password).');
    } else {
        console.error('❌ FAIL: Normalization or password match did not work for login.', resultNorm.error);
        process.exit(1);
    }
    
    // 4. Test Invalid Email -> Not Found
    console.log('Testing login with non-existent email...');
    const result2 = await login({ email: 'nonexistent@nowhere.com', password });
    if (!result2.success && result2.error === 'Invalid credentials') {
        console.log('✅ PASS: Non-existent email correctly returned "Invalid credentials".');
    } else {
        console.error('❌ FAIL: Incorrect response for non-existent email.', result2.error);
        process.exit(1);
    }
    
    console.log('\n✅ ALL Login API tests PASSED.');
}

testLoginAPI().catch(err => {
    console.error(err);
    process.exit(1);
});
