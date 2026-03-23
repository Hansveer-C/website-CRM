/**
 * Result of the email validation.
 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validates an email address.
 * Requirements:
 * - no empty strings
 * - trimmed whitespace
 * - must include "@"
 * - must include a domain part (something after "@")
 */
export function validateEmail(email: string): ValidationResult {
    if (!email) {
        return { valid: false, error: 'Email cannot be empty' };
    }

    const trimmed = email.trim();
    if (trimmed === '') {
        return { valid: false, error: 'Email cannot be just whitespace' };
    }

    const atIndex = trimmed.indexOf('@');
    if (atIndex === -1) {
        return { valid: false, error: 'Email must contain "@" character' };
    }

    if (atIndex === 0) {
        return { valid: false, error: 'Email must have a part before "@"' };
    }

    const domainPart = trimmed.substring(atIndex + 1);
    if (!domainPart || domainPart.trim() === '') {
        return { valid: false, error: 'Email must have a domain part after "@"' };
    }

    // Basic domain check: should have at least one dot
    if (!domainPart.includes('.')) {
        return { valid: false, error: 'Email must have a valid domain (e.g., domain.com)' };
    }

    return { valid: true };
}

/**
 * Validates a password.
 * Rules:
 * - not empty
 * - trimmed (no leading/trailing whitespace only passwords)
 * - minimum length: 6
 */
export function validatePassword(password: string): ValidationResult {
    if (!password) {
        return { valid: false, error: 'Password cannot be empty' };
    }

    const trimmed = password.trim();
    if (trimmed === '') {
        return { valid: false, error: 'Password cannot be just whitespace' };
    }

    if (trimmed.length < 6) {
        return { valid: false, error: 'Password must be at least 6 characters long' };
    }

    return { valid: true };
}
