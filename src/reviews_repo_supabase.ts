import { DB } from './utils/db/db_module';
import { Review } from './types';

/**
 * Reviews Repository (Supabase Version).
 * Manage social proof and testimonials.
 */
export const ReviewsRepo = {
  /**
   * Adds a new review.
   */
  async addReview(review: Partial<Review>): Promise<Review> {
    console.log(`[DB: REVIEWS] Adding review for user ${review.user_id}`);
    
    const payload: Partial<Review> = {
      ...review,
      created_at: review.created_at || new Date().toISOString()
    };

    try {
      return await DB.upsert<Review>('reviews', payload);
    } catch (e: any) {
      console.error('[DB: REVIEWS] Error adding review:', e.message);
      throw new Error(`DB_UPSERT_ERROR: ${e.message}`);
    }
  },

  /**
   * Retrieves all reviews for a specific user.
   */
  async getReviewsByUser(user_id: string): Promise<Review[]> {
    if (!user_id) return [];
    
    try {
      const { data, error } = await DB.query('reviews')
        .select('*')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []) as Review[];
    } catch (e: any) {
      console.error('[DB: REVIEWS] Error fetching reviews by user:', e.message);
      throw new Error(`DB_GET_ERROR: ${e.message}`);
    }
  },

  /**
   * Deletes a review.
   */
  async deleteReview(id: string): Promise<boolean> {
    try {
      const { error } = await DB.query('reviews')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      return true;
    } catch (e: any) {
      console.error('[DB: REVIEWS] Error deleting review:', e.message);
      throw new Error(`DB_DELETE_ERROR: ${e.message}`);
    }
  }
};
