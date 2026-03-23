import { createUser, getUserByEmail, getUserById } from './users_repo';

async function testUsersRepo() {
    const testEmail = `repo_test_${Date.now()}@example.com`;
    const testHash = 'password123-unhashed-for-now';
    
    console.log(`--- Testing Users Repository ---`);
    console.log(`Email: ${testEmail}`);
    
    try {
        // Test createUser
        console.log('Testing createUser...');
        const user = await createUser(testEmail, testHash);
        console.log('✅ createUser succeeded (returned user):', user);
        
        if (!user.id || !user.created_at || user.email !== testEmail) {
            throw new Error('User data mismatch after creation.');
        }

        // CONFIRM NO RAW PASSWORD IN RETURNED USER
        if (user.password_hash === testHash) {
            throw new Error('❌ FAIL: Returned user record contains raw password!');
        }
        console.log('✅ Returned user correctly contains a hash, not raw password.');
        
        // Test getUserByEmail
        console.log('Testing getUserByEmail...');
        const fetchedByEmail = getUserByEmail(testEmail);
        console.log('✅ getUserByEmail result:', fetchedByEmail);
        
        if (!fetchedByEmail || fetchedByEmail.id !== user.id) {
            throw new Error('Failed to fetch user by email or ID mismatch.');
        }
        
        // Test getUserById
        console.log('Testing getUserById...');
        const fetchedById = getUserById(user.id);
        console.log('✅ getUserById result:', fetchedById);
        
        if (!fetchedById || fetchedById.email !== testEmail) {
            throw new Error('Failed to fetch user by ID or email mismatch.');
        }
        
        console.log('✅ ALL Repository tests PASSED.');
        
    } catch (err) {
        console.error('❌ Repository Test FAILED:', err);
        process.exit(1);
    }
}

testUsersRepo().catch(err => {
    console.error(err);
    process.exit(1);
});
