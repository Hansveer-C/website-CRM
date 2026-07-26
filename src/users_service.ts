import { createUser, getUserByEmail } from './users_repo';
import { validateEmail, validatePassword } from './validation_utils';
import { User } from './types';
import { emitEvent } from './events';
import { WebsitesRepo } from './websites_repo_supabase';
import { FunnelsRepo } from './funnels_repo_supabase';
import { WebsiteRoutesRepo } from './website_routes_repo_supabase';

export interface UserResult {
    success: boolean;
    user?: User;
    error?: string;
}

/**
 * Service to safely create a new user and initialize their website container.
 * Coordinates validation, duplicate checking, and multi-tenant setup.
 */
export async function createUserSafe(email: string, password: string, businessName: string): Promise<UserResult> {
    const normalizedEmail = email?.trim()?.toLowerCase();
    
    try {
        // 1. Validate Email
        const emailValidation = validateEmail(normalizedEmail);
        if (!emailValidation.valid) {
            await emitEvent('user_creation_failed', { email: normalizedEmail, reason: emailValidation.error });
            return { success: false, error: emailValidation.error };
        }
        
        // 2. Validate Password
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            await emitEvent('user_creation_failed', { email: normalizedEmail, reason: passwordValidation.error });
            return { success: false, error: passwordValidation.error };
        }
        
        // 3. Check if user already exists
        const existingUser = await getUserByEmail(normalizedEmail);
        if (existingUser) {
            await emitEvent('user_creation_failed', { email: normalizedEmail, reason: 'Duplicate email' });
            return { success: false, error: 'A user with this email already exists' };
        }

        // 4. Create User
        const newUser = await createUser(normalizedEmail, password);
        
        // 5. Phase W1.6: Automatically Provision Website Container
        console.log(`[SIGNUP] Provisioning website for ${businessName} (User: ${newUser.id})`);
        
        // 5a. Create Website Container
        const website = await WebsitesRepo.createWebsite(newUser.id, businessName);
        
        // 5b. Create Default Homepage Funnel
        const funnelResponse = await FunnelsRepo.createFunnel(newUser.id, 'Home Page');
        if (funnelResponse.success && funnelResponse.data) {
            const funnelId = funnelResponse.data.id;
            
            // 5c. Map root route "/" to the homepage funnel
            await WebsiteRoutesRepo.addRoute(website.id, '/', funnelId);
            
            // 5d. Update website with its homepage reference
            await WebsitesRepo.updateWebsite({
                id: website.id,
                homepage_funnel_id: funnelId
            });
        }
        
        await emitEvent('user_created', { email: normalizedEmail, user_id: newUser.id });
        await emitEvent('website_provisioned', { user_id: newUser.id, website_id: website.id });
        
        return { success: true, user: newUser };
        
    } catch (err: any) {
        console.error('❌ CRITICAL: createUserSafe failed with unexpected error:', err);
        await emitEvent('user_creation_failed', { email: normalizedEmail, reason: 'Internal error' });
        return { success: false, error: 'An unexpected internal error occurred' };
    }
}
