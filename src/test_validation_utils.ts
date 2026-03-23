import { validateEmail } from './validation_utils';

async function testValidationUtils() {
    console.log('--- Testing Email Validation Utility ---');
    
    const cases = [
        { email: 'valid@example.com', shouldPass: true },
        { email: ' valid@example.com  ', shouldPass: true },
        { email: 'invalidemail', shouldPass: false, expectedError: 'Email must contain "@" character' },
        { email: '@nodomain.com', shouldPass: false, expectedError: 'Email must have a part before "@"' },
        { email: 'test@', shouldPass: false, expectedError: 'Email must have a domain part after "@"' },
        { email: 'test@nodot', shouldPass: false, expectedError: 'Email must have a valid domain (e.g., domain.com)' },
        { email: '', shouldPass: false, expectedError: 'Email cannot be empty' },
        { email: '  ', shouldPass: false, expectedError: 'Email cannot be just whitespace' }
    ];
    
    let allPassed = true;
    
    for (const testCase of cases) {
        const result = validateEmail(testCase.email);
        const pass = result.valid === testCase.shouldPass;
        
        if (pass) {
            console.log(`✅ ${testCase.email.trim() || '(empty)'} -> ${result.valid ? 'PASS' : 'FAIL (as expected)'}`);
        } else {
            console.error(`❌ ${testCase.email.trim() || '(empty)'} -> Got ${result.valid}, Expected ${testCase.shouldPass} - Error: ${result.error}`);
            allPassed = false;
        }
        
        if (!result.valid && testCase.expectedError && result.error !== testCase.expectedError) {
            console.error(`  - Unexpected error message: Got "${result.error}", Expected "${testCase.expectedError}"`);
            allPassed = false;
        }
    }
    
    if (allPassed) {
        console.log('\n✅ ALL Email Validation tests PASSED.');
    } else {
        process.exit(1);
    }

    console.log('\n--- Testing Password Validation Utility ---');
    const passCases = [
        { password: '123456', shouldPass: true },
        { password: '  password123  ', shouldPass: true },
        { password: 'short', shouldPass: false, expectedError: 'Password must be at least 6 characters long' },
        { password: '', shouldPass: false, expectedError: 'Password cannot be empty' },
        { password: '   ', shouldPass: false, expectedError: 'Password cannot be just whitespace' }
    ];

    allPassed = true;
    for (const testCase of passCases) {
        const result = validatePassword(testCase.password);
        const pass = result.valid === testCase.shouldPass;
        
        if (pass) {
            console.log(`✅ ${testCase.password.trim() || '(empty/ws)'} -> ${result.valid ? 'PASS' : 'FAIL (as expected)'}`);
        } else {
            console.log(`❌ ${testCase.password.trim() || '(empty/ws)'} -> Got ${result.valid}, Expected ${testCase.shouldPass}`);
            allPassed = false;
        }

        if (!result.valid && testCase.expectedError && result.error !== testCase.expectedError) {
            console.log(`  - Unexpected error message: Got "${result.error}", Expected "${testCase.expectedError}"`);
            allPassed = false;
        }
    }

    if (allPassed) {
        console.log('\n✅ ALL Password Validation tests PASSED.');
    } else {
        process.exit(1);
    }
}

import { validatePassword } from './validation_utils';
testValidationUtils().catch(console.error);
