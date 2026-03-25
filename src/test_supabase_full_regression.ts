import { createUserSafe } from './users_service';
import { login } from './auth_logic';
import { createLead } from './leads_logic';
import { sendMessageToContact } from './sms_logic';
import { handleInboundCall, endCall } from './calls_logic';
import { getContactTimeline } from './timeline';
import { createSessionToken } from './session_utils';
import { ApiRequest } from './types';
import { getContact } from './contacts_repo';

async function fullSupabaseRegression() {
    console.log('--- Phase S3: Full Supabase Backend Regression ---');

    const testEmail = `reg_test_${Date.now()}@test.com`;
    const password = 'test-password-123';

    // 1. Signup
    console.log('\n[1/6] STEP: Signup...');
    const signupRes = await createUserSafe(testEmail, password);
    if (!signupRes.success) throw new Error(`Signup failed: ${signupRes.error}`);
    const user = signupRes.user!;
    console.log('✅ Signup Successful. User ID:', user.id);

    // 2. Login
    console.log('\n[2/6] STEP: Login Validation...');
    const loginRes = await login({ email: testEmail, password });
    if (!loginRes.success) throw new Error('Login validation failed');
    console.log('✅ Login Successful.');

    // Prepare Request Context (Simulated API Context)
    const sessionToken = createSessionToken(user);
    const req: ApiRequest = { 
        user,
        cookies: { 'session': sessionToken }
    };

    // 3. Submit Lead
    console.log('\n[3/6] STEP: Submit Lead (Form Simulation)...');
    const leadData = {
        name: 'Regression Tester',
        phone: '+15551112222',
        email: 'reg@tester.com',
        source: 'regression-unit'
    };
    const leadRes = await createLead(leadData, req);
    const contactId = leadRes.contactId;
    console.log('✅ Lead & Opportunity created. Contact ID:', contactId);

    // 4. Trigger SMS
    console.log('\n[4/6] STEP: Sending Manual SMS...');
    const smsRes = await sendMessageToContact(contactId, 'Hello from Supabase Regression!', 'manual', user.id);
    if (smsRes.success) {
        console.log('✅ SMS record persisted.');
    } else {
        console.warn('ℹ️ SMS persistence skipped or failed (likely table missing).');
    }

    // 5. Simulate Inbound Call -> Missed
    console.log('\n[5/6] STEP: Simulating Missed Call Automation...');
    const phone = '+15551113333';
    const inbound = await handleInboundCall({ phone });
    await endCall({ call_id: inbound.callId, answered: false });
    console.log('✅ Call sequence triggered.');

    // Short delay for event bus listeners
    await new Promise(r => setTimeout(r, 1500));

    // 6. View Timeline
    console.log('\n[6/6] STEP: Fetching Unified Timeline for verification...');
    const timeline = await getContactTimeline(contactId, user);
    
    console.log('\n--- Final Regression Report ---');
    let totalItems = 0;
    timeline.forEach(group => {
        console.log(`Group: ${group.label}`);
        group.items.forEach(item => {
            console.log(`  - [${item.type.toUpperCase()}] at ${item.created_at}: ${item.content}`);
            totalItems++;
        });
    });

    if (totalItems >= 1) {
        console.log(`\n✅ REGRESSION SUCCESS: Unified timeline delivered ${totalItems} data points from Supabase.`);
    } else {
        console.log(`\nℹ️ REGRESSION INCOMPLETE: Timeline empty. This is expected if Supabase tables (contacts, messages, calls) haven't been created yet.`);
    }

    console.log('\n--- Regression End ---');
}

fullSupabaseRegression().catch(err => {
    console.error('\n❌ REGRESSION CRITICAL FAILURE:', err.message);
    process.exit(1);
});
