import { getUserByEmail } from './users_repo';
import { verifyPassword } from './password_utils';
import { createSessionToken } from './session_utils';
import { emitEvent } from './events';

/**
 * Simulated POST /api/auth/login endpoint.
 */
export async function login(data: { email: string, password?: string }) {
    const { email, password } = data;
    
    // Normalize email: trim and lowercase
    const normalizedEmail = email?.trim()?.toLowerCase();
    
    if (!normalizedEmail) {
        return { success: false, error: 'Email is required' };
    }

    if (!password) {
        return { success: false, error: 'Password is required' };
    }
    
    // Fetch user by email
    const user = getUserByEmail(normalizedEmail);
    
    if (!user) {
        // Return "Invalid credentials" if not found
        await emitEvent('user_login_failed', { email: normalizedEmail, reason: 'User not found' });
        return { success: false, error: 'Invalid credentials' };
    }

    // Verify password securely
    const isMatch = await verifyPassword(password, user.password_hash);
    if (!isMatch) {
        await emitEvent('user_login_failed', { email: normalizedEmail, reason: 'Wrong password' });
        return { success: false, error: 'Invalid credentials' };
    }

    // Generate session identifier
    const token = createSessionToken(user);
    
    await emitEvent('user_logged_in', { email: normalizedEmail, user_id: user.id });

    // Return success + user (no sensitive info) + session token
    return { 
        success: true, 
        token,
        user: { id: user.id, email: user.email } 
    };
}
