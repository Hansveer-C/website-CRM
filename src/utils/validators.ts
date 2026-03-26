/**
 * 🔒 SERVER/FRONTEND-SAFE UTILITIES
 * Pure functions for data normalization and validation.
 */

export function normalizePhone(phone: string): { normalized: string; invalid: boolean } {
  if (!phone) return { normalized: '', invalid: true };
  const cleaned = phone.replace(/[\s\-\(\)\[\]\{\}\.\,\/]/g, '').replace(/\D/g, '');
  if (cleaned.length === 10) return { normalized: `+1${cleaned}`, invalid: false };
  if (cleaned.length === 11 && cleaned.startsWith('1')) return { normalized: `+${cleaned}`, invalid: false };
  return { normalized: cleaned || phone, invalid: true };
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email || !email.trim()) return null;
  return email.trim().toLowerCase();
}

export function normalizeName(name: string): string {
  if (!name) return '';
  return name.trim().replace(/\s\s+/g, ' ');
}

/**
 * 🛡️ C4: Standardized Validation Errors
 */
export class ValidationError extends Error {
    constructor(
        public field: string,
        public reason: string,
        public error: string = 'invalid_input'
    ) {
        super(reason);
        this.name = 'ValidationError';
    }

    serialize() {
        return {
            success: false,
            error: this.error,
            field: this.field,
            reason: this.reason
        };
    }
}

/**
 * 🛡️ C3: Centralized Input Validation
 * Single source of truth for data integrity across the CRM.
 */

/**
 * Validates and normalizes a phone number.
 */
export function validatePhone(phone: string): { normalized: string; invalid: boolean } {
    return normalizePhone(phone);
}

/**
 * Validates core contact identity fields.
 * Incorporates PT.10 length constraints.
 */
export function validateContactInput(data: { 
    name: string; 
    phone?: string; 
    email?: string 
}) {
    const normalizedName = normalizeName(data.name);
    
    if (!normalizedName) {
        throw new ValidationError('name', 'Name is required.');
    }
    if (normalizedName.length > 200) {
        throw new ValidationError('name', 'Name too long. Please use less than 200 characters.');
    }
    if (data.phone && data.phone.length > 50) {
        throw new ValidationError('phone', 'Phone number is too long.');
    }
    if (data.email && data.email.length > 200) {
        throw new ValidationError('email', 'Email address is too long.');
    }

    const phoneNorm = normalizePhone(data.phone || '');
    const emailNorm = normalizeEmail(data.email);

    return {
        name: normalizedName,
        phone: phoneNorm.normalized,
        invalid_phone: phoneNorm.invalid,
        email: emailNorm
    };
}

/**
 * Validates message content for SMS or notes.
 */
export function validateMessage(content: string): string {
    if (!content || content.trim().length === 0) {
        throw new ValidationError('content', 'Message content cannot be empty.');
    }
    if (content.length > 2000) {
        throw new ValidationError('content', 'Message too long. Please use less than 2000 characters.');
    }
    return content.trim();
}
