export const BUILDER_MEDIA_BUCKET = 'media';
export const BUILDER_MEDIA_MAX_BYTES = 8 * 1024 * 1024;
export const BUILDER_MEDIA_MAX_DIMENSION = 8_000;
export const BUILDER_MEDIA_MAX_PIXELS = 40_000_000;

export type BuilderMediaMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface BuilderMediaAsset {
  id: string;
  userId: string;
  websiteId: string;
  bucketId: string;
  objectPath: string;
  publicUrl: string;
  displayName: string;
  mimeType: BuilderMediaMimeType;
  sizeBytes: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}

export interface BuilderMediaUploadInput {
  websiteId: string;
  file: Blob;
  displayName: string;
}

export interface BuilderMediaListOptions {
  search?: string;
  limit?: number;
  cursor?: string;
}

export interface BuilderMediaAssetPage {
  items: readonly BuilderMediaAsset[];
  nextCursor?: string;
}

export type BuilderMediaValidationCode =
  | 'EMPTY_FILE'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'MEDIA_SIGNATURE_MISMATCH'
  | 'IMAGE_DECODE_FAILED'
  | 'IMAGE_DIMENSIONS_INVALID'
  | 'IMAGE_TOO_LARGE';

export interface BuilderMediaValidationIssue {
  code: BuilderMediaValidationCode;
  message: string;
}

export interface BuilderMediaDimensions {
  width: number;
  height: number;
}

export type BuilderMediaDimensionDecoder = (
  file: Blob
) => Promise<BuilderMediaDimensions>;

export interface ValidatedBuilderMediaFile extends BuilderMediaDimensions {
  mimeType: BuilderMediaMimeType;
  extension: 'jpg' | 'png' | 'webp';
  sizeBytes: number;
}

export class BuilderMediaValidationError extends Error {
  readonly issue: BuilderMediaValidationIssue;

  constructor(issue: BuilderMediaValidationIssue) {
    super(issue.message);
    this.name = 'BuilderMediaValidationError';
    this.issue = issue;
  }
}

export function sanitizeBuilderMediaDisplayName(value: string): string {
  const leaf = value.replace(/\\/g, '/').split('/').pop() ?? '';
  const sanitized = leaf.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255);
  return sanitized || 'Untitled image';
}

export function freezeBuilderMediaAsset(asset: BuilderMediaAsset): BuilderMediaAsset {
  return Object.freeze(structuredClone(asset));
}

function issue(code: BuilderMediaValidationCode, message: string): BuilderMediaValidationError {
  return new BuilderMediaValidationError({ code, message });
}

function detectMimeType(bytes: Uint8Array): BuilderMediaMimeType | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return undefined;
}

export async function decodeBuilderMediaDimensions(file: Blob): Promise<BuilderMediaDimensions> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  }

  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('No browser image decoder is available.');
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<BuilderMediaDimensions>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error('Image decode failed.'));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function validateBuilderMediaFile(
  file: Blob,
  decodeDimensions: BuilderMediaDimensionDecoder = decodeBuilderMediaDimensions
): Promise<ValidatedBuilderMediaFile> {
  if (!(file instanceof Blob) || file.size <= 0) {
    throw issue('EMPTY_FILE', 'Choose a non-empty image file.');
  }
  if (file.size > BUILDER_MEDIA_MAX_BYTES) {
    throw issue('FILE_TOO_LARGE', 'Images must be 8 MB or smaller.');
  }

  const declaredType = file.type.trim().toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(declaredType)) {
    throw issue('UNSUPPORTED_MEDIA_TYPE', 'Only JPEG, PNG, and WebP images are supported.');
  }
  const detectedType = detectMimeType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!detectedType || detectedType !== declaredType) {
    throw issue('MEDIA_SIGNATURE_MISMATCH', 'The image contents do not match its reported file type.');
  }

  let dimensions: BuilderMediaDimensions;
  try {
    dimensions = await decodeDimensions(file);
  } catch {
    throw issue('IMAGE_DECODE_FAILED', 'The image could not be decoded.');
  }
  if (
    !Number.isInteger(dimensions.width)
    || !Number.isInteger(dimensions.height)
    || dimensions.width <= 0
    || dimensions.height <= 0
  ) {
    throw issue('IMAGE_DIMENSIONS_INVALID', 'The image has invalid dimensions.');
  }
  if (
    dimensions.width > BUILDER_MEDIA_MAX_DIMENSION
    || dimensions.height > BUILDER_MEDIA_MAX_DIMENSION
    || dimensions.width * dimensions.height > BUILDER_MEDIA_MAX_PIXELS
  ) {
    throw issue('IMAGE_TOO_LARGE', 'Images may be at most 8000×8000 and 40 megapixels.');
  }

  const mimeType = detectedType;
  return {
    mimeType,
    extension: mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp',
    sizeBytes: file.size,
    ...dimensions
  };
}

export function createBuilderMediaObjectPath(
  userId: string,
  websiteId: string,
  assetId: string,
  extension: ValidatedBuilderMediaFile['extension']
): string {
  return `${userId}/${websiteId}/${assetId}.${extension}`;
}
