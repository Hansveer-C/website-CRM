import { supabase, safeDbCall } from './utils/db/supabase';
import { Asset, RepoResponse, User } from './types';

/**
 * 🔒 SERVER-ONLY REPOSITORY
 * Handles database operations for Media Assets (Images, Videos).
 */
export const MediaRepo = {
  /**
   * Persists a media asset to Supabase.
   */
  async persistAsset(asset: Asset, user: User | string): Promise<RepoResponse<Asset>> {
    const userId = typeof user === 'string' ? user : user.id;
    const payload = { ...asset, user_id: userId };

    return safeDbCall('PERSIST_ASSET', userId, supabase
      .from('media')
      .upsert(payload)
      .select()
      .single()
    );
  },

  /**
   * Retrieves all media assets for a user.
   */
  async getAllAssets(user: User | string): Promise<RepoResponse<Asset[]>> {
    const userId = typeof user === 'string' ? user : user.id;

    return safeDbCall('GET_ALL_ASSETS', userId, supabase
      .from('media')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    );
  },

  /**
   * Retrieves assets filtered by tags.
   */
  async getAssetsByTag(tag: string, user: User | string): Promise<RepoResponse<Asset[]>> {
    const userId = typeof user === 'string' ? user : user.id;

    return safeDbCall('GET_ASSETS_BY_TAG', userId, supabase
      .from('media')
      .select('*')
      .eq('user_id', userId)
      .contains('tags', [tag])
      .order('created_at', { ascending: false })
    );
  },

  /**
   * Deletes a media asset.
   */
  async deleteAsset(id: string, user: User | string): Promise<RepoResponse<any>> {
    const userId = typeof user === 'string' ? user : user.id;

    return safeDbCall('DELETE_ASSET', userId, supabase
      .from('media')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    );
  }
};
