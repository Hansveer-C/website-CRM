import { getUserByEmail, getUserById } from './users_repo';
import { verifyPassword } from './password_utils';
import { createSessionToken, decodeSessionToken } from './session_utils';
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
    const user = await getUserByEmail(normalizedEmail);
    
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
    
    // Set secure HTTP-only cookie
    // Note: HttpOnly is only strictly enforced when set via HTTP headers from a server.
    // In our development mock, we set it via document.cookie with safety flags.
    if (typeof document !== 'undefined') {
        const isSecure = typeof location !== 'undefined' && location.protocol === 'https:';
        const secureFlag = isSecure ? '; Secure' : '';
        document.cookie = `session=${token}; path=/; HttpOnly; SameSite=Lax${secureFlag}`;
    }

    await emitEvent('user_logged_in', { email: normalizedEmail, user_id: user.id });

    // Return success + user (no token in body for better security)
    return { 
        success: true, 
        user: { id: user.id, email: user.email } 
    };
}

/**
 * Resolves the current authenticated user from a request's cookies.
 */
export async function getCurrentUser(request?: { cookies?: Record<string, string> }) {
    let token: string | undefined;

    // 1. Try to read from request cookies (server-side context)
    if (request?.cookies?.session) {
        token = request.cookies.session;
    }
    // 2. Fallback to document.cookie (client-side simulation)
    else if (typeof document !== 'undefined') {
        const cookies = document.cookie.split(';').map(c => c.trim());
        const sessionCookie = cookies.find(c => c.startsWith('session='));
        if (sessionCookie) {
            token = sessionCookie.split('=')[1];
        }
    }

    if (!token) return null;

    // 3. Verify and decode token
    const decoded = decodeSessionToken(token);
    if (!decoded || !decoded.user_id) {
        return null;
    }

    // 4. Fetch user from repository
    return await getUserById(decoded.user_id);
}
