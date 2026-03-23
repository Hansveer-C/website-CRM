import { hashPassword, verifyPassword } from './password_utils';

async function testPasswordUtils() {
    const rawPass = 'super-secret-password';
    console.log(`--- Testing Password Utilities ---`);
    console.log(`Raw Password: ${rawPass}`);
    
    try {
        // Test hashing
        console.log('Hashing password...');
        const hash = await hashPassword(rawPass);
        console.log(`✅ Hashed Password: ${hash}`);
        
        if (hash === rawPass) {
            throw new Error('Failed: Hash should not be equal to raw password.');
        }
        
        // Test matching
        console.log('Verifying matching password...');
        const isMatch = await verifyPassword(rawPass, hash);
        if (isMatch) {
            console.log('✅ Success: Correct password verified.');
        } else {
            throw new Error('Failed: Correct password rejected.');
        }
        
        // Test mismatch
        console.log('Verifying wrong password...');
        const isWrongMatch = await verifyPassword('wrong-password', hash);
        if (!isWrongMatch) {
            console.log('✅ Success: Incorrect password rejected.');
        } else {
            throw new Error('Failed: Incorrect password erroneously accepted.');
        }
        
        console.log('✅ ALL Password Utility tests PASSED.');
        
    } catch (err) {
        console.error('❌ Password Utility Test FAILED:', err);
        process.exit(1);
    }
}

testPasswordUtils().catch(err => {
    console.error(err);
    process.exit(1);
});
