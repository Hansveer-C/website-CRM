import 'dotenv/config'; // Loads .env
import { supabase } from './utils/db/supabase.js';

async function probeSupabaseRoutes() {
    console.log('--- Probing Supabase schema for "website_routes" table ---');
    
    try {
        const { data, error, status } = await supabase.from('website_routes').select('*').limit(1);
        
        if (error) {
            console.error('❌ Error probing table:', error.message);
            console.error('Status:', status);
        } else {
            console.log('✅ Found "website_routes" table.');
            if (data && data.length > 0) {
              console.log('Row sample:', data[0]);
              console.log('Columns:', Object.keys(data[0]));
            } else {
              console.log('Table exists but is empty.');
            }
        }
    } catch (err) {
        console.error('❌ Exception:', err);
    }
}

probeSupabaseRoutes();
