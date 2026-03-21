import { emitEvent } from './events';
import { mockWebsiteSettings, mockMessages } from './db';

async function runDebug() {
    const contact_id = 'c2'; // Jane Smith
    console.log('--- DEBUG: Phase 1.5 Automation ---');

    // 1. Initial State
    console.log('Default settings:', { 
        enabled: mockWebsiteSettings.auto_lead_sms_enabled,
        template: mockWebsiteSettings.auto_lead_sms_template 
    });

    // 2. Trigger Event (Standard Default Case)
    console.log('\n- Triggering lead_created event for c2 (Standard Case)...');
    await emitEvent('lead_created', { contact_id, opportunity_id: 'o1' });

    // 3. Duplicate Prevention Test
    console.log('\n- Immediate duplicate trigger for c2...');
    await emitEvent('lead_created', { contact_id, opportunity_id: 'o1' });

    // 4. Global Toggle Test
    console.log('\n- Disabling global auto SMS...');
    mockWebsiteSettings.auto_lead_sms_enabled = false;
    await emitEvent('lead_created', { contact_id, opportunity_id: 'o1' });

    // 5. Custom Template Test
    console.log('\n- Re-enabling and setting custom template...');
    mockWebsiteSettings.auto_lead_sms_enabled = true;
    mockWebsiteSettings.auto_lead_sms_template = "Hello {name}, your personalized quote is ready!";
    
    // Using contact c1 for a fresh test
    const contact_id_2 = 'c1'; // John Doe
    console.log('\n- Triggering lead_created for c1 with custom template...');
    await emitEvent('lead_created', { contact_id: contact_id_2, opportunity_id: 'o2' });

    // 6. Inspect Messages
    console.log('\n--- Final Activity Feed Check ---');
    console.log('Recent messages count:', mockMessages.length);
    mockMessages.forEach(m => {
        console.log(`[To: ${m.contact_id}] [Source: ${m.source}] [Content: ${m.content}]`);
    });
}

runDebug();
