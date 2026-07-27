import { GalleryItem, RepoResponse } from './types';
import { mockGalleryItems } from './db';
import { supabase, safeDbCall } from './utils/db/supabase';

const isBrowser = typeof window !== 'undefined';
const hasSupabase = isBrowser ? ((window as any).process?.env?.SUPABASE_URL || '').startsWith('https://') : !!process.env.SUPABASE_URL;

function generateId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID() as string;
    }
    return `gal-${Date.now()}-${Math.floor(Math.random() * 1000000).toString(16)}`;
}

// Helper to get SQLite DB instance dynamically (safe for browser environments during bundling)
async function getSQLiteDb() {
  if (typeof window !== 'undefined') return null;
  try {
    const { getDB } = await import(/* @vite-ignore */ './database');
    return getDB();
  } catch (e) {
    console.error('Failed to load SQLite DB:', e);
    return null;
  }
}

/**
 * Creates a new gallery item, scoped strictly to the user context.
 */
export async function createGalleryItem(userId: string, input: Partial<GalleryItem>): Promise<RepoResponse<GalleryItem>> {
  if (!userId) {
    return { success: false, error: 'MISSING_USER_CONTEXT' };
  }
  if (!input.before_image_url || !input.after_image_url) {
    return { success: false, error: 'MISSING_REQUIRED_FIELDS' };
  }

  const now = new Date().toISOString();
  const newItem: GalleryItem = {
    id: input.id || generateId(),
    user_id: userId,
    before_image_url: input.before_image_url,
    after_image_url: input.after_image_url,
    title: input.title || '',
    service_type: input.service_type || '',
    city: input.city || '',
    description: input.description || '',
    sort_order: typeof input.sort_order === 'number' ? input.sort_order : 0,
    is_featured: !!input.is_featured,
    created_at: input.created_at || now,
    updated_at: input.updated_at || now,
  };

  if (!hasSupabase) {
    console.log('[DB MOCK/SQLITE FALLBACK: CREATE_GALLERY_ITEM] Saving:', newItem);
    
    // SQLite Fallback
    const db = await getSQLiteDb();
    if (db) {
      try {
        // Prevent cross-tenant overwrites on SQLite
        const existing = db.prepare('SELECT user_id FROM gallery_items WHERE id = ?').get(newItem.id);
        if (existing && existing.user_id !== userId) {
          console.error(`[SECURITY ALERT] Cross-tenant overwrite blocked: User ${userId} attempted to overwrite item ${newItem.id}`);
          return { success: false, error: 'ACCESS_DENIED_CROSS_TENANT' };
        }

        db.prepare(`
          INSERT INTO gallery_items (id, user_id, before_image_url, after_image_url, title, service_type, city, description, sort_order, is_featured, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            before_image_url = excluded.before_image_url,
            after_image_url = excluded.after_image_url,
            title = excluded.title,
            service_type = excluded.service_type,
            city = excluded.city,
            description = excluded.description,
            sort_order = excluded.sort_order,
            is_featured = excluded.is_featured,
            updated_at = excluded.updated_at
        `).run(
          newItem.id,
          newItem.user_id,
          newItem.before_image_url,
          newItem.after_image_url,
          newItem.title,
          newItem.service_type,
          newItem.city,
          newItem.description,
          newItem.sort_order,
          newItem.is_featured ? 1 : 0,
          newItem.created_at,
          newItem.updated_at
        );
      } catch (err: any) {
        console.error('[SQLite CREATE_GALLERY_ITEM error]:', err.message);
        return { success: false, error: err.message };
      }
    }

    // Keep mock array in sync
    const idx = mockGalleryItems.findIndex(item => item.id === newItem.id);
    if (idx !== -1) {
      if (mockGalleryItems[idx].user_id !== userId) {
        console.error(`[SECURITY ALERT] Cross-tenant overwrite blocked: User ${userId} attempted to overwrite item ${newItem.id}`);
        return { success: false, error: 'ACCESS_DENIED_CROSS_TENANT' };
      }
      mockGalleryItems[idx] = newItem;
    } else {
      mockGalleryItems.push(newItem);
    }
    return { success: true, data: newItem };
  }

  // 🛡️ Prevent cross-tenant overwrites in Supabase
  const { data: existing } = await supabase.from('gallery_items').select('user_id').eq('id', newItem.id).maybeSingle();
  if (existing && existing.user_id !== userId) {
    console.error(`[SECURITY ALERT] Cross-tenant overwrite blocked: User ${userId} attempted to overwrite item ${newItem.id} owned by ${existing.user_id}`);
    return { success: false, error: 'ACCESS_DENIED_CROSS_TENANT' };
  }

  return safeDbCall('CREATE_GALLERY_ITEM', userId, supabase
    .from('gallery_items')
    .upsert(newItem)
    .select()
    .single()
  );
}

/**
 * Retrieves all gallery items, scoped to the user context.
 */
export async function getGalleryItems(userId: string): Promise<RepoResponse<GalleryItem[]>> {
  if (!userId) {
    return { success: false, error: 'MISSING_USER_CONTEXT' };
  }

  if (!hasSupabase) {
    const db = await getSQLiteDb();
    if (db) {
      try {
        const rows = db.prepare('SELECT * FROM gallery_items WHERE user_id = ? ORDER BY sort_order ASC').all(userId);
        const mapped = rows.map((r: any) => ({
          ...r,
          is_featured: !!r.is_featured
        }));
        return { success: true, data: mapped };
      } catch (err: any) {
        console.error('[SQLite GET_GALLERY_ITEMS error]:', err.message);
        return { success: false, error: err.message };
      }
    }

    const list = mockGalleryItems.filter(item => item.user_id === userId);
    list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return { success: true, data: list };
  }

  return safeDbCall('GET_GALLERY_ITEMS', userId, supabase
    .from('gallery_items')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
  );
}

/**
 * Retrieves a single gallery item by its ID, scoped to the user context.
 */
export async function getGalleryItemById(userId: string, id: string): Promise<RepoResponse<GalleryItem | null>> {
  if (!userId) {
    return { success: false, error: 'MISSING_USER_CONTEXT' };
  }
  if (!id) {
    return { success: false, error: 'MISSING_ITEM_ID' };
  }

  if (!hasSupabase) {
    const db = await getSQLiteDb();
    if (db) {
      try {
        const row = db.prepare('SELECT * FROM gallery_items WHERE id = ? AND user_id = ?').get(id, userId);
        if (!row) return { success: true, data: null };
        const mapped: GalleryItem = {
          ...row,
          is_featured: !!row.is_featured
        };
        return { success: true, data: mapped };
      } catch (err: any) {
        console.error('[SQLite GET_GALLERY_ITEM_BY_ID error]:', err.message);
        return { success: false, error: err.message };
      }
    }

    const item = mockGalleryItems.find(item => item.id === id && item.user_id === userId);
    return { success: true, data: item || null };
  }

  return safeDbCall('GET_GALLERY_ITEM_BY_ID', userId, supabase
    .from('gallery_items')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  );
}

/**
 * Retrieves gallery items by service type, scoped to the user context.
 */
export async function getGalleryItemsByService(userId: string, serviceType: string): Promise<RepoResponse<GalleryItem[]>> {
  if (!userId) {
    return { success: false, error: 'MISSING_USER_CONTEXT' };
  }

  if (!hasSupabase) {
    const db = await getSQLiteDb();
    if (db) {
      try {
        const rows = db.prepare('SELECT * FROM gallery_items WHERE user_id = ? AND service_type = ? ORDER BY sort_order ASC').all(userId, serviceType);
        const mapped = rows.map((r: any) => ({
          ...r,
          is_featured: !!r.is_featured
        }));
        return { success: true, data: mapped };
      } catch (err: any) {
        console.error('[SQLite GET_GALLERY_ITEMS_BY_SERVICE error]:', err.message);
        return { success: false, error: err.message };
      }
    }

    const list = mockGalleryItems.filter(item => item.user_id === userId && item.service_type === serviceType);
    list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return { success: true, data: list };
  }

  return safeDbCall('GET_GALLERY_ITEMS_BY_SERVICE', userId, supabase
    .from('gallery_items')
    .select('*')
    .eq('user_id', userId)
    .eq('service_type', serviceType)
    .order('sort_order', { ascending: true })
  );
}

/**
 * Retrieves gallery items by city, scoped to the user context.
 */
export async function getGalleryItemsByCity(userId: string, city: string): Promise<RepoResponse<GalleryItem[]>> {
  if (!userId) {
    return { success: false, error: 'MISSING_USER_CONTEXT' };
  }

  if (!hasSupabase) {
    const db = await getSQLiteDb();
    if (db) {
      try {
        const rows = db.prepare('SELECT * FROM gallery_items WHERE user_id = ? AND city = ? ORDER BY sort_order ASC').all(userId, city);
        const mapped = rows.map((r: any) => ({
          ...r,
          is_featured: !!r.is_featured
        }));
        return { success: true, data: mapped };
      } catch (err: any) {
        console.error('[SQLite GET_GALLERY_ITEMS_BY_CITY error]:', err.message);
        return { success: false, error: err.message };
      }
    }

    const list = mockGalleryItems.filter(item => item.user_id === userId && item.city === city);
    list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return { success: true, data: list };
  }

  return safeDbCall('GET_GALLERY_ITEMS_BY_CITY', userId, supabase
    .from('gallery_items')
    .select('*')
    .eq('user_id', userId)
    .eq('city', city)
    .order('sort_order', { ascending: true })
  );
}

/**
 * Updates a gallery item, scoped strictly to the user context.
 */
export async function updateGalleryItem(userId: string, id: string, updates: Partial<GalleryItem>): Promise<RepoResponse<GalleryItem>> {
  if (!userId) {
    return { success: false, error: 'MISSING_USER_CONTEXT' };
  }
  if (!id) {
    return { success: false, error: 'MISSING_ITEM_ID' };
  }

  if (!hasSupabase) {
    const db = await getSQLiteDb();
    if (db) {
      try {
        const existing = db.prepare('SELECT user_id FROM gallery_items WHERE id = ?').get(id);
        if (!existing) {
          return { success: false, error: 'NOT_FOUND' };
        }
        if (existing.user_id !== userId) {
          console.error(`[SECURITY ALERT] Cross-tenant update blocked: User ${userId} attempted to update item ${id}`);
          return { success: false, error: 'ACCESS_DENIED_CROSS_TENANT' };
        }

        const validFields = ['before_image_url', 'after_image_url', 'title', 'service_type', 'city', 'description', 'sort_order', 'is_featured'];
        const keys = Object.keys(updates).filter(k => validFields.includes(k));
        
        if (keys.length > 0) {
          const setClause = keys.map(k => `${k} = ?`).join(', ');
          const values = keys.map(k => {
            const val = (updates as any)[k];
            if (k === 'is_featured') return val ? 1 : 0;
            return val;
          });
          db.prepare(`UPDATE gallery_items SET ${setClause}, updated_at = ? WHERE id = ? AND user_id = ?`).run(...values, new Date().toISOString(), id, userId);
        }

        const row = db.prepare('SELECT * FROM gallery_items WHERE id = ?').get(id);
        const mapped = {
          ...row,
          is_featured: !!row.is_featured
        };
        
        // Also sync mock array
        const mockIdx = mockGalleryItems.findIndex(item => item.id === id);
        if (mockIdx !== -1) {
          mockGalleryItems[mockIdx] = mapped;
        }

        return { success: true, data: mapped };
      } catch (err: any) {
        console.error('[SQLite UPDATE_GALLERY_ITEM error]:', err.message);
        return { success: false, error: err.message };
      }
    }

    const idx = mockGalleryItems.findIndex(item => item.id === id);
    if (idx === -1) {
      return { success: false, error: 'NOT_FOUND' };
    }
    if (mockGalleryItems[idx].user_id !== userId) {
      console.error(`[SECURITY ALERT] Cross-tenant update blocked: User ${userId} attempted to update item ${id}`);
      return { success: false, error: 'ACCESS_DENIED_CROSS_TENANT' };
    }

    const updatedItem = {
      ...mockGalleryItems[idx],
      ...updates,
      id: mockGalleryItems[idx].id,
      user_id: userId,
      updated_at: new Date().toISOString()
    };
    mockGalleryItems[idx] = updatedItem;
    return { success: true, data: updatedItem };
  }

  // 🛡️ Prevent cross-tenant updates in Supabase
  const { data: existing } = await supabase.from('gallery_items').select('user_id').eq('id', id).maybeSingle();
  if (!existing) {
    return { success: false, error: 'NOT_FOUND' };
  }
  if (existing.user_id !== userId) {
    console.error(`[SECURITY ALERT] Cross-tenant update blocked: User ${userId} attempted to update item ${id} owned by ${existing.user_id}`);
    return { success: false, error: 'ACCESS_DENIED_CROSS_TENANT' };
  }

  const payload = {
    ...updates,
    id,
    user_id: userId,
    updated_at: new Date().toISOString()
  };

  return safeDbCall('UPDATE_GALLERY_ITEM', userId, supabase
    .from('gallery_items')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  );
}

/**
 * Deletes a gallery item, scoped strictly to the user context.
 */
export async function deleteGalleryItem(userId: string, id: string): Promise<RepoResponse<void>> {
  if (!userId) {
    return { success: false, error: 'MISSING_USER_CONTEXT' };
  }
  if (!id) {
    return { success: false, error: 'MISSING_ITEM_ID' };
  }

  if (!hasSupabase) {
    const db = await getSQLiteDb();
    if (db) {
      try {
        const existing = db.prepare('SELECT user_id FROM gallery_items WHERE id = ?').get(id);
        if (!existing) {
          return { success: false, error: 'NOT_FOUND' };
        }
        if (existing.user_id !== userId) {
          console.error(`[SECURITY ALERT] Cross-tenant deletion blocked: User ${userId} attempted to delete item ${id}`);
          return { success: false, error: 'ACCESS_DENIED_CROSS_TENANT' };
        }
        db.prepare('DELETE FROM gallery_items WHERE id = ? AND user_id = ?').run(id, userId);
      } catch (err: any) {
        console.error('[SQLite DELETE_GALLERY_ITEM error]:', err.message);
        return { success: false, error: err.message };
      }
    }

    const idx = mockGalleryItems.findIndex(item => item.id === id);
    if (idx === -1) {
      return { success: false, error: 'NOT_FOUND' };
    }
    if (mockGalleryItems[idx].user_id !== userId) {
      console.error(`[SECURITY ALERT] Cross-tenant deletion blocked: User ${userId} attempted to delete item ${id}`);
      return { success: false, error: 'ACCESS_DENIED_CROSS_TENANT' };
    }
    mockGalleryItems.splice(idx, 1);
    return { success: true };
  }

  // 🛡️ Prevent cross-tenant deletions by checking ownership in Supabase
  const { data: existing } = await supabase.from('gallery_items').select('user_id').eq('id', id).maybeSingle();
  if (!existing) {
    return { success: false, error: 'NOT_FOUND' };
  }
  if (existing.user_id !== userId) {
    console.error(`[SECURITY ALERT] Cross-tenant deletion blocked: User ${userId} attempted to delete item ${id} owned by ${existing.user_id}`);
    return { success: false, error: 'ACCESS_DENIED_CROSS_TENANT' };
  }

  const { error } = await supabase
    .from('gallery_items')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

// Namespace export to follow existing repository pattern
export const GalleryRepo = {
  createGalleryItem,
  getGalleryItems,
  getGalleryItemById,
  getGalleryItemsByService,
  getGalleryItemsByCity,
  updateGalleryItem,
  deleteGalleryItem
};
