import { supabase } from './utils/db/supabase.js';


async function probeSupabase() {
    console.log('--- Probing Supabase schema for "contacts" table ---');
    
    try {
        // Try selecting ONE existing row OR limiting to 0
        const { data, error, status } = await supabase.from('contacts').select('*').limit(0);
        
        if (error) {
            console.error('❌ Error probing table:', error.message);
            console.error('Status:', status);
        } else {
            console.log('✅ Found "contacts" table.');
            console.log('Metadata (columns might be empty if 0 rows):', data);
        }
    } catch (err) {
        console.error('❌ Exception:', err);
    }
}

probeSupabase();
