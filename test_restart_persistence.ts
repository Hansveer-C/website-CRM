import { createLead } from './src/leads_logic';
import { getDB, closeDB } from './src/database';
import { getContact } from './src/contacts_repo';

async function testLeadPersistence() {
  console.log('--- Phase 1: Create a Lead (Persistently) ---');
  const uniqueId = `per-test-${Date.now()}`;
  
  try {
    const res = await createLead({
      name: 'Persistence John',
      phone: '1234567890',
      email: 'pjohn@test.com',
      address: '123 SQL St',
      source: 'test_script'
    });
    
    console.log('   Lead created. Contact ID:', res.contactId);
    
    console.log('--- Phase 2: Restart Simulation ---');
    console.log('   Closing connection...');
    closeDB();
    
    console.log('   Re-opening connection and querying...');
    const contact = getContact(res.contactId);
    
    if (contact && contact.name === 'Persistence John') {
      console.log('✅ PASS: Contact persisted through "restart" successfully.');
      console.log('   Verified Contact:', JSON.stringify(contact, null, 2));
    } else {
      throw new Error(`FAIL: Contact not found after restart. Found: ${JSON.stringify(contact)}`);
    }

  } catch (err) {
    console.error('❌ Persistence Test Failed:', err);
    process.exit(1);
  } finally {
    closeDB();
  }
}

testLeadPersistence().catch(console.error);
