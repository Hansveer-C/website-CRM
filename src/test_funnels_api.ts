import { UsersRepo } from './users_repo_supabase';
import { getFunnelsApi, getFunnelByIdApi, createFunnelApi, updateFunnelApi } from './funnels_api';
import { ApiRequest, User } from './types';
import { createSessionToken } from './session_utils';

/**
 * Verification Script for WB.1.4 - Funnel API.
 * Tests the API controllers directly with mocked requests and valid sessions.
 */
async function verifyWB1_4() {
  console.log('--- PHASE WB1.4 VERIFICATION: Funnel API ---');
  
  const emailA = `user_a_${Date.now()}@test.com`;
  const emailB = `user_b_${Date.now()}@test.com`;

  try {
    // 1. Setup Users
    console.log('\n[TEST 1] Setup Users');
    const userA = await UsersRepo.createUser(emailA, 'pass-a');
    const userB = await UsersRepo.createUser(emailB, 'pass-b');
    
    // Generate valid session tokens for both users
    const tokenA = createSessionToken(userA);
    const tokenB = createSessionToken(userB);
    
    console.log(`✅ User A ID: ${userA.id}\n✅ User B ID: ${userB.id}`);

    // Helper to create authed requests
    const createAuthedReq = (method: string, user: User, token: string, body?: any): ApiRequest => ({
        method,
        url: '/api/funnels',
        user,
        cookies: { session: token },
        body
    });

    // 2. Test POST /api/funnels (User A)
    console.log('\n[TEST 2] POST /api/funnels (User A)');
    const createReq = createAuthedReq('POST', userA, tokenA, { name: 'User A Funnel' });
    const createRes = await createFunnelApi(createReq);
    
    if (createRes.status !== 201 || !createRes.success) {
        throw new Error(`Create failed: ${JSON.stringify(createRes)}`);
    }
    const funnelA = createRes.data;
    console.log(`✅ Created funnel for A: ${funnelA.id}`);

    // 3. Test GET /api/funnels (Isolation)
    console.log('\n[TEST 3] GET /api/funnels (Isolation Check)');
    const listResA = await getFunnelsApi(createAuthedReq('GET', userA, tokenA));
    const listResB = await getFunnelsApi(createAuthedReq('GET', userB, tokenB));

    if (!listResA.data || listResA.data.length === 0) throw new Error('User A list empty');
    if (listResB.data && listResB.data.length !== 0) throw new Error('User B saw unowned funnels!');
    console.log(`✅ User A found ${listResA.data.length} funnels. User B found 0. Perfect.`);

    // 4. Test GET /api/funnels/:id (Cross-tenant check)
    console.log('\n[TEST 4] GET /api/funnels/:id (Security)');
    const fetchResA = await getFunnelByIdApi(createAuthedReq('GET', userA, tokenA), funnelA.id);
    if (!fetchResA.success) throw new Error('A failed to fetch own funnel');

    const fetchResB = await getFunnelByIdApi(createAuthedReq('GET', userB, tokenB), funnelA.id);
    if (fetchResB.status !== 404) {
        throw new Error(`SECURITY_FAIL: User B accessed User A's funnel (Status: ${fetchResB.status})`);
    }
    console.log('✅ Access denied for User B to User A\'s funnel. SECURE.');

    // 5. Test PATCH /api/funnels/:id
    console.log('\n[TEST 5] PATCH /api/funnels/:id');
    const updateRes = await updateFunnelApi(createAuthedReq('PATCH', userA, tokenA, { status: 'published' }), funnelA.id);
    if (updateRes.data.status !== 'published') throw new Error('Update failed');
    console.log('✅ Update successful.');

    console.log('\n--- ALL WB.1.4 API VERIFICATIONS PASSED ---');

  } catch (err: any) {
    console.error('\n❌ VERIFICATION FAILED:', err.message);
    if (typeof process !== 'undefined') process.exit(1);
  }
}

verifyWB1_4();
