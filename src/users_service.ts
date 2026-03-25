import { createUser, getUserByEmail } from './users_repo';
import { validateEmail, validatePassword } from './validation_utils';
import { User } from './types';
import { emitEvent } from './events';

export interface UserResult {
    success: boolean;
    user?: User;
    error?: string;
}

/**
 * Service to safely create a new user.
 * Coordinates validation, duplicate checking, and final creation.
 */
export async function createUserSafe(email: string, password: string): Promise<UserResult> {
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

        
        // 4 & 5. hash password & create via repository 
        const newUser = await createUser(normalizedEmail, password);
        
        await emitEvent('user_created', { email: normalizedEmail, user_id: newUser.id });
        
        return { success: true, user: newUser };
        
    } catch (err: any) {
        console.error('❌ CRITICAL: createUserSafe failed with unexpected error:', err);
        await emitEvent('user_creation_failed', { email: normalizedEmail, reason: 'Internal error' });
        return { success: false, error: 'An unexpected internal error occurred' };
    }
}
