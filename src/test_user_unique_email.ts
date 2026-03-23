import { getDB } from './database';
import { randomUUID } from 'node:crypto';

async function testUniqueEmail() {
    const db = getDB();
    const testEmail = `duplicate_${Date.now()}@example.com`;
    
    console.log(`--- Testing Email Uniqueness for: ${testEmail} ---`);
    
    try {
        // First insertion should succeed
        console.log('Inserting first user with email...');
        const stmt1 = db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)');
        stmt1.run(randomUUID(), testEmail, 'password123');
        console.log('✅ First user inserted successfully.');
        
        // Second insertion with the same email should fail
        console.log('Inserting second user with the SAME email...');
        try {
            const stmt2 = db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)');
            stmt2.run(randomUUID(), testEmail, 'anotherpassword');
            console.log('❌ FAIL: Database allowed a duplicate email!');
            process.exit(1);
        } catch (err: any) {
            if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message.includes('UNIQUE constraint failed')) {
                console.log('✅ PASS: Database correctly blocked duplicate email.');
            } else {
                console.error('❌ Unexpected error during second insertion:', err);
                process.exit(1);
            }
        }
        
    } catch (err) {
        console.error('❌ Error during test setup:', err);
        process.exit(1);
    }
}

testUniqueEmail().catch(err => {
    console.error(err);
    process.exit(1);
});
