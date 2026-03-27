import 'dotenv/config';
import { createUserSafe } from './users_service';
import { WebsitesRepo } from './websites_repo_supabase';
import { WebsiteRoutesRepo } from './website_routes_repo_supabase';

async function testUsersService() {
    console.log('--- Testing Safe User Creation Service (with Auto-Websites) ---');
    
    const uniqueEmail = `service_test_${Date.now()}@test.com`;
    const password = 'valid-password-123';
    const businessName = 'Hansveer Cleaning Pro';
    
    // 1. Success Case
    console.log('Case 1: Creating a fresh new user with automatic website...');
    const result1 = await createUserSafe(uniqueEmail, password, businessName);
    if (result1.success && result1.user && result1.user.email === uniqueEmail) {
        console.log('✅ PASS: Fresh user created successfully.');
        
        // Phase W1.6 Verification: Check if website exists
        const website = await WebsitesRepo.getWebsiteByUser(result1.user.id);
        if (website && website.name === businessName) {
            console.log(`✅ PASS: Website "${website.name}" (subdomain: ${website.subdomain}) automatically provisioned.`);
            
            if (website.homepage_funnel_id) {
                console.log(`✅ PASS: Homepage funnel ID set: ${website.homepage_funnel_id}`);
                
                // Verify Route existence
                const route = await WebsiteRoutesRepo.getRouteByPath(website.id, '/');
                if (route && route.funnel_id === website.homepage_funnel_id) {
                    console.log('✅ PASS: Root route "/" correctly mapped to homepage funnel.');
                } else {
                    console.error('❌ FAIL: Root route mapping verification failed.');
                    process.exit(1);
                }
            } else {
                console.error('❌ FAIL: Website missing homepage_funnel_id.');
                process.exit(1);
            }
        } else {
            console.error('❌ FAIL: Website not found for new user.');
            process.exit(1);
        }
    } else {
        console.error('❌ FAIL: Failed to create fresh user.', result1.error);
        process.exit(1);
    }
    
    // 2. Duplicate Email Case
    console.log('Case 2: Attempting to create user with the same email...');
    const result2 = await createUserSafe(uniqueEmail, 'another-password', 'Another Business');
    if (!result2.success && result2.error === 'A user with this email already exists') {
        console.log('✅ PASS: Duplicate email correctly blocked.');
    } else {
        console.error('❌ FAIL: Duplicate email was not blocked as expected.', result2.error);
        process.exit(1);
    }
    
    // 3. Invalid Email Case
    console.log('Case 3: Attempting with invalid email...');
    const result3 = await createUserSafe('not-an-email', password, 'Invalid Biz');
    if (!result3.success && result3.error && result3.error.includes('@')) {
        console.log('✅ PASS: Invalid email correctly blocked.');
    } else {
        console.error('❌ FAIL: Invalid email was not blocked.', result3.error);
        process.exit(1);
    }
    
    // 4. Invalid Password Case
    console.log('Case 4: Attempting with too short password...');
    const result4 = await createUserSafe('good@email.com', '123', 'Weak Pass Biz');
    if (!result4.success && result4.error && result4.error.includes('6 characters')) {
        console.log('✅ PASS: Weak password correctly blocked.');
    } else {
        console.error('❌ FAIL: Weak password was not blocked.', result4.error);
        process.exit(1);
    }
    
    console.log('\n✅ ALL Users Service (with Auto-Provisioning) tests PASSED.');
}

testUsersService().catch(err => {
    console.error(err);
    process.exit(1);
});
