import { initDB, getDB, closeDB } from './src/database';

async function verifyDB() {
  console.log('--- Verifying SQLite Infrastructure ---');
  try {
    const db = initDB();
    console.log('   Testing query (SELECT 1)...');
    const result = db.prepare('SELECT 1 as val').get();
    
    if (result && (result as any).val === 1) {
      console.log('✅ SQLite Infrastructure Verified: SELECT 1 succeeded.');
    } else {
      throw new Error('Query result mismatch');
    }
  } catch (err) {
    console.error('❌ Infrastructure Test Failed:', err);
    process.exit(1);
  } finally {
    closeDB();
  }
}

verifyDB().catch(console.error);
