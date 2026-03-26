import { UsersRepo } from './users_repo_supabase';
import { FunnelsRepo } from './funnels_repo_supabase';
import { Funnel } from './types';

/**
 * Verification Script for WB.1.1 - Funnel Entity.
 */
async function verifyWB1_1() {
  console.log('--- PHASE WB1.1 VERIFICATION: Funnel Entity ---');
  
  const testEmail = `funnel_test_${Date.now()}@test.com`;

  try {
    // 1. User Setup
    console.log('\n[TEST 1] User Setup');
    const user = await UsersRepo.createUser(testEmail, 'test-password-funnel');
    console.log(`✅ User created: ${user.id}`);

    // 2. Create Funnel
    console.log('\n[TEST 2] Create Funnel');
    const funnelName = 'Master Funnel Strategy';
    const createRes = await FunnelsRepo.createFunnel(user.id, funnelName);
    if (!createRes.success || !createRes.data) {
      throw new Error(`Funnel creation failed: ${createRes.error}`);
    }
    const funnel = createRes.data;
    console.log(`✅ Funnel created: ${funnel.id} (${funnel.name})`);
    if (funnel.name !== funnelName) throw new Error('Funnel name mismatch');

    // 3. Fetch Funnels
    console.log('\n[TEST 3] Fetch Funnels (List)');
    const listRes = await FunnelsRepo.getFunnels(user.id);
    if (!listRes.success || !listRes.data) {
      throw new Error(`Funnels lookup failed: ${listRes.error}`);
    }
    console.log(`✅ Retrieved ${listRes.data.length} funnels.`);
    if (listRes.data.length === 0) throw new Error('List was empty');

    // 4. Update Funnel
    console.log('\n[TEST 4] Update Funnel status');
    const updateRes = await FunnelsRepo.updateFunnel(user.id, funnel.id, { status: 'published' });
    if (!updateRes.success || !updateRes.data) {
      throw new Error(`Funnel update failed: ${updateRes.error}`);
    }
    console.log(`✅ Funnel updated: Status is now ${updateRes.data.status}`);
    if (updateRes.data.status !== 'published') throw new Error('Status was not updated');

    // 5. Fetch by ID
    console.log('\n[TEST 5] Fetch by ID & Ownership');
    const byIdRes = await FunnelsRepo.getFunnelById(user.id, funnel.id);
    if (!byIdRes.success || !byIdRes.data) {
        throw new Error(`Funnel retrieval by ID failed: ${byIdRes.error}`);
    }
    console.log(`✅ Correctly fetched own funnel.`);

    const otherUserId = 'unauthorized_user_id';
    const unauthorizedRes = await FunnelsRepo.getFunnelById(otherUserId, funnel.id);
    if (unauthorizedRes.data) {
        throw new Error('SECURITY_FAIL: Funnel was accessible to a non-owner!');
    }
    console.log('✅ Ownership correctly enforced (Access denied to unauthorized user).');

    console.log('\n--- ALL WB.1.1 FUNNEL VERIFICATIONS PASSED ---');

  } catch (err: any) {
    console.error('\n❌ VERIFICATION FAILED:', err.message);
    if (err.details) console.error('Details:', err.details);
    // @ts-ignore
    if (typeof process !== 'undefined') process.exit(1);
  }
}

verifyWB1_1();
