import { RepoResponse } from '../types';

/**
 * 🛡️ F3: Clean handling of DB constraint violations.
 * Maps repository responses to standardized API response objects.
 */
export function mapRepoToApi<T>(res: RepoResponse<T>, options?: {
  resourceName?: string;
  onConflict?: '409' | 'reuse';
}) {
    if (res.success) {
        return {
            status: 200,
            data: res.data
        };
    }

    // Handle DB Constraint Violations
    switch (res.code) {
        case '23505': // unique_violation
            return {
                status: 409,
                error: `A ${options?.resourceName || 'record'} with those details already exists.`
            };
        
        case '23503': // foreign_key_violation
            return {
                status: 400,
                error: `Provided reference (ID) is invalid or does not exist.`
            };
        
        case 'INTERNAL_ERROR':
        case 'DATABASE_CRASH':
            return {
                status: 500,
                error: 'An internal database error occurred.'
            };

        default:
            return {
                status: 400,
                error: res.error || 'Request failed due to data constraints.'
            };
    }
}
