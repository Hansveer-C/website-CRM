import { createUserSafe } from './users_service';

async function testUsersService() {
    console.log('--- Testing Safe User Creation Service ---');
    
    const uniqueEmail = `service_test_${Date.now()}@test.com`;
    const password = 'valid-password-123';
    
    // 1. Success Case
    console.log('Case 1: Creating a fresh new user...');
    const result1 = await createUserSafe(uniqueEmail, password);
    if (result1.success && result1.user && result1.user.email === uniqueEmail) {
        console.log('✅ PASS: Fresh user created successfully.');
    } else {
        console.error('❌ FAIL: Failed to create fresh user.', result1.error);
        process.exit(1);
    }
    
    // 2. Duplicate Email Case
    console.log('Case 2: Attempting to create user with the same email...');
    const result2 = await createUserSafe(uniqueEmail, 'another-password');
    if (!result2.success && result2.error === 'A user with this email already exists') {
        console.log('✅ PASS: Duplicate email correctly blocked.');
    } else {
        console.error('❌ FAIL: Duplicate email was not blocked as expected.', result2.error);
        process.exit(1);
    }
    
    // 3. Invalid Email Case
    console.log('Case 3: Attempting with invalid email...');
    const result3 = await createUserSafe('not-an-email', password);
    if (!result3.success && result3.error && result3.error.includes('@')) {
        console.log('✅ PASS: Invalid email correctly blocked.');
    } else {
        console.error('❌ FAIL: Invalid email was not blocked.', result3.error);
        process.exit(1);
    }
    
    // 4. Invalid Password Case
    console.log('Case 4: Attempting with too short password...');
    const result4 = await createUserSafe('good@email.com', '123');
    if (!result4.success && result4.error && result4.error.includes('6 characters')) {
        console.log('✅ PASS: Weak password correctly blocked.');
    } else {
        console.error('❌ FAIL: Weak password was not blocked.', result4.error);
        process.exit(1);
    }

    // 5. Normalization Case
    console.log('Case 5: Attempting mixed-case email normalization...');
    const now = Date.now();
    const mixedEmail = `MixedCase_${now}@example.com`;
    const lowerEmail = `mixedcase_${now}@example.com`;
    
    console.log(`Creating user with: ${mixedEmail}`);
    const result5 = await createUserSafe(mixedEmail, password);
    if (result5.success && result5.user && result5.user.email === lowerEmail) {
        console.log(`✅ PASS: User created with normalized (lowercase) email.`);
    } else {
        console.error('❌ FAIL: User creation or normalization failed.', result5.error || 'Email mismatch');
        process.exit(1);
    }

    console.log(`Attempting duplicate check with: ${lowerEmail}`);
    const result6 = await createUserSafe(lowerEmail, password);
    if (!result6.success && result6.error === 'A user with this email already exists') {
        console.log('✅ PASS: Normalization correctly ensures uniqueness across cases.');
    } else {
        console.error('❌ FAIL: Normalization did not prevent case-insensitive duplicate.', result6.error);
        process.exit(1);
    }
    
    console.log('\n✅ ALL Users Service tests PASSED.');
}

testUsersService().catch(err => {
    console.error(err);
    process.exit(1);
});
