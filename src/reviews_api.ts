import { ApiRequest } from './types';
import { apiMiddleware, requireAuth } from './middleware';
import { ReviewsRepo } from './reviews_repo_supabase';

/**
 * Backend Controller for Reviews/Social Proof APIs.
 * Securely handles CRUD for customer reviews.
 */

/**
 * GET /api/reviews
 * Retrieves reviews for the current user.
 */
export async function getReviewsApi(req: ApiRequest) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    try {
        const userId = req.user?.id || 'system';
        const reviews = await ReviewsRepo.getReviewsByUser(userId);
        return {
            status: 200,
            data: { success: true, data: reviews }
        };
    } catch (err: any) {
        return { status: 500, error: err.message };
    }
}

/**
 * POST /api/reviews
 * Adds or updates a review.
 */
export async function upsertReviewApi(req: ApiRequest) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    const { id, name, rating, text, location } = req.body || {};

    if (!name || !rating || !text) {
        return { status: 400, error: 'Name, rating, and text are required.' };
    }

    try {
        const userId = req.user?.id || 'system';
        const review = await ReviewsRepo.addReview({
            id,
            user_id: userId,
            name,
            rating: Number(rating),
            text,
            location
        });

        return {
            status: 200,
            data: { success: true, data: review }
        };
    } catch (err: any) {
        return { status: 500, error: err.message };
    }
}

/**
 * DELETE /api/reviews/:id
 */
export async function deleteReviewApi(req: ApiRequest, reviewId: string) {
    await apiMiddleware(req);
    const authError = requireAuth(req);
    if (authError) return authError;

    if (!reviewId) {
        return { status: 400, error: 'Missing review id.' };
    }

    try {
        const success = await ReviewsRepo.deleteReview(reviewId);
        return {
            status: 200,
            data: { success }
        };
    } catch (err: any) {
        return { status: 500, error: err.message };
    }
}
