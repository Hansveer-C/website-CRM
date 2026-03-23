import { loadTimelineTestData } from './test_scenarios';
import { getContactTimeline } from './timeline';

/**
 * Quick runner to verify the test scenario correctly populates all buckets.
 */
function verifyScenario() {
    const contactId = 'c-runner-123';
    
    // 1. Populate data
    loadTimelineTestData(contactId);
    
    // 2. Fetch grouped timeline
    const timeline = getContactTimeline(contactId);
    
    console.log('\n--- VERIFICATION: Cross-Day Scenario ---');
    timeline.forEach(group => {
        console.log(`BUCKET: ${group.label} | Items: ${group.items.length}`);
        group.items.forEach(item => {
            console.log(`  - [${item.created_at}] ${item.type}: ${item.content}`);
        });
    });

    // 3. Simple Assertions
    const earlierGroup = timeline.find(g => g.label === 'Earlier');
    const yesterdayGroup = timeline.find(g => g.label === 'Yesterday');
    const todayGroup = timeline.find(g => g.label === 'Today');

    if (earlierGroup?.items.length === 1 && 
        yesterdayGroup?.items.length === 1 && 
        todayGroup?.items.length === 2) {
        console.log('\n✅ TEST SYNCED: All three buckets are correctly populated and mapped.');
    } else {
        console.error('\n❌ FAILURE: Missing items in expected buckets.');
        throw new Error('Test failed: missing items in expected buckets');
    }
}

verifyScenario();
