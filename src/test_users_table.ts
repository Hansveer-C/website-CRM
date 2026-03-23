import { getDB } from './database';
import { User } from './types';
import { randomUUID } from 'node:crypto';

async function testUsersTable() {
    const db = getDB();
    
    console.log('--- Testing Users Table ---');
    
    // Insert a sample user
    const sampleUser = {
        id: randomUUID(),
        email: `testuser_${Date.now()}@example.com`,
        password_hash: 'hashedpassword123'
    };
    
    console.log(`Inserting user: ${sampleUser.email}...`);
    
    try {
        const stmt = db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)');
        stmt.run(sampleUser.id, sampleUser.email, sampleUser.password_hash);
        
        console.log('✅ User inserted successfully.');
        
        // Fetch the user back
        const result = db.prepare('SELECT * FROM users WHERE id = ?').get(sampleUser.id) as User;
        console.log('Fetched user:', result);
        
        if (result && result.email === sampleUser.email && result.created_at) {
            console.log('✅ Verification passed: User persisted with automated created_at.');
        } else {
            console.log('❌ Verification failed: User not found or data mismatch.');
        }
        
        // Test UNIQUE constraint
        console.log('\n--- Testing UNIQUE constraint (inserting same email again) ---');
        try {
            const stmt = db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)');
            stmt.run(randomUUID(), sampleUser.email, 'anotherpassword');
            console.log('❌ Error: UNIQUE constraint failed to prevent duplicate email.');
        } catch (err: any) {
            if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                console.log('✅ Success: SQLite blocked duplicate email as expected.');
            } else {
                console.error('❌ Unexpected error during UNIQUE test:', err);
            }
        }
        
    } catch (err) {
        console.error('❌ Error testing users table:', err);
    }
}

testUsersTable().catch(console.error);
