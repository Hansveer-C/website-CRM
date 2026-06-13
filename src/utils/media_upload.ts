import { supabase } from './db/supabase';

export interface UploadResult {
  success: boolean;
  public_url?: string;
  storage_path?: string;
  mime_type?: string;
  size?: number;
  error?: string;
}

async function fileToDataUrl(file: any, mimeType: string): Promise<string> {
  let bytes: ArrayBuffer | Uint8Array | string | undefined;

  if (file && typeof file.arrayBuffer === 'function') {
    bytes = await file.arrayBuffer();
  } else if (file instanceof ArrayBuffer || typeof file === 'string') {
    bytes = file;
  } else if (ArrayBuffer.isView(file)) {
    bytes = new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
  }

  if (bytes === undefined) {
    throw new Error('MISSING_FILE_BYTES');
  }

  const toBase64 = (value: Uint8Array | string): string => {
    const maybeBuffer = (globalThis as any).Buffer;
    if (maybeBuffer) {
      return maybeBuffer.from(value).toString('base64');
    }
    if (typeof value === 'string') {
      return btoa(value);
    }

    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < value.length; i += chunkSize) {
      const chunk = value.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  };

  if (typeof bytes === 'string') {
    return `data:${mimeType};base64,${toBase64(bytes)}`;
  }

  const byteArray = bytes instanceof ArrayBuffer
    ? new Uint8Array(bytes)
    : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  return `data:${mimeType};base64,${toBase64(byteArray)}`;
}

/**
 * Validates and uploads a file to Supabase Storage, or returns a mock CDN URL.
 * Strictly scopes target paths to [user_id] to enforce multi-tenant isolation.
 */
export async function uploadMediaAsset(
  userId: string,
  file: any, // Browser File, Buffer, or ArrayBuffer
  filename: string,
  mimeType: string,
  size: number,
  purpose: 'logo' | 'gallery_before' | 'gallery_after' | 'builder_image',
  galleryItemId?: string,
  sectionId?: string,
  hasSupabase: boolean = false
): Promise<UploadResult> {
  if (!userId) {
    return { success: false, error: 'MISSING_USER_CONTEXT' };
  }

  // 1. MIME Type Validation
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimeTypes.includes(mimeType)) {
    return { success: false, error: 'INVALID_FILE_TYPE' };
  }

  // 2. File Size Validation (Max 5MB)
  const maxSize = 5 * 1024 * 1024;
  if (size > maxSize) {
    return { success: false, error: 'FILE_TOO_LARGE' };
  }

  // 3. Purpose Validation
  const allowedPurposes = ['logo', 'gallery_before', 'gallery_after', 'builder_image'];
  if (!allowedPurposes.includes(purpose)) {
    return { success: false, error: 'INVALID_PURPOSE' };
  }

  // 4. Purpose-specific Metadata Validation
  if ((purpose === 'gallery_before' || purpose === 'gallery_after') && !galleryItemId) {
    return { success: false, error: 'MISSING_GALLERY_ITEM_ID' };
  }

  if (purpose === 'builder_image' && !sectionId) {
    return { success: false, error: 'MISSING_SECTION_ID' };
  }

  // 5. Generate safe, tenant-scoped storage path
  const ext = filename.split('.').pop() || 'png';
  const timestamp = Date.now();
  let storagePath = '';

  if (purpose === 'logo') {
    storagePath = `${userId}/logos/logo-${timestamp}.${ext}`;
  } else if (purpose === 'gallery_before') {
    storagePath = `${userId}/gallery/${galleryItemId}/before-${timestamp}.${ext}`;
  } else if (purpose === 'gallery_after') {
    storagePath = `${userId}/gallery/${galleryItemId}/after-${timestamp}.${ext}`;
  } else if (purpose === 'builder_image') {
    storagePath = `${userId}/builder/${sectionId}/image-${timestamp}.${ext}`;
  }

  // 6. Local/Mock Fallback Mode
  if (!hasSupabase) {
    console.log(`[STORAGE MOCK UPLOAD] Simulating upload for user ${userId}. Path: ${storagePath}`);
    if (purpose === 'logo') {
      try {
        const publicUrl = await fileToDataUrl(file, mimeType);
        return {
          success: true,
          public_url: publicUrl,
          storage_path: storagePath,
          mime_type: mimeType,
          size
        };
      } catch (err: any) {
        console.error('[STORAGE MOCK UPLOAD ERROR] failed to create renderable logo data URL:', err.message);
        return { success: false, error: 'MOCK_LOGO_DATA_URL_FAILED' };
      }
    }

    const publicUrl = `https://cdn.pressurepro.io/mock-media/${storagePath}`;
    return {
      success: true,
      public_url: publicUrl,
      storage_path: storagePath,
      mime_type: mimeType,
      size
    };
  }

  // 7. Supabase Real Upload
  try {
    const { error } = await supabase.storage
      .from('media')
      .upload(storagePath, file, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      console.error(`[STORAGE UPLOAD ERROR] failed for user ${userId}:`, error.message);
      return { success: false, error: error.message };
    }

    const { data: publicUrlData } = supabase.storage
      .from('media')
      .getPublicUrl(storagePath);

    return {
      success: true,
      public_url: publicUrlData.publicUrl,
      storage_path: storagePath,
      mime_type: mimeType,
      size
    };
  } catch (err: any) {
    console.error(`[STORAGE UPLOAD CRASH] failed for user ${userId}:`, err.message);
    return { success: false, error: 'INTERNAL_UPLOAD_ERROR' };
  }
}
