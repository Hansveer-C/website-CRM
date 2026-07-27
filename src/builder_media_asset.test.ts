import { describe, expect, it } from 'vitest';
import {
  BUILDER_MEDIA_MAX_BYTES,
  BuilderMediaValidationError,
  createBuilderMediaObjectPath,
  freezeBuilderMediaAsset,
  sanitizeBuilderMediaDisplayName,
  validateBuilderMediaFile
} from './builder_media_asset';

const png = () => new Blob([
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
], { type: 'image/png' });

describe('builder media validation', () => {
  it.each([
    ['image/jpeg', new Uint8Array([0xff, 0xd8, 0xff]), 'jpg'],
    ['image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'png'],
    ['image/webp', new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]), 'webp']
  ])('accepts %s signatures and derives the extension', async (type, signature, extension) => {
    const result = await validateBuilderMediaFile(new Blob([signature], { type }), async () => ({ width: 1, height: 1 }));
    expect(result.extension).toBe(extension);
  });

  it('accepts a valid image after MIME, signature, and dimension checks', async () => {
    await expect(validateBuilderMediaFile(png(), async () => ({ width: 1200, height: 800 })))
      .resolves.toEqual({ mimeType: 'image/png', extension: 'png', sizeBytes: 12, width: 1200, height: 800 });
  });

  it.each([
    [new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/svg+xml' }), 'UNSUPPORTED_MEDIA_TYPE'],
    [new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), 'MEDIA_SIGNATURE_MISMATCH'],
    [new Blob([new Uint8Array(BUILDER_MEDIA_MAX_BYTES + 1)], { type: 'image/png' }), 'FILE_TOO_LARGE']
  ])('rejects invalid files without attempting upload', async (file, code) => {
    try {
      await validateBuilderMediaFile(file, async () => ({ width: 1, height: 1 }));
      throw new Error('Expected validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(BuilderMediaValidationError);
      expect((error as BuilderMediaValidationError).issue.code).toBe(code);
    }
  });

  it('rejects decoded dimensions over either safety limit', async () => {
    await expect(validateBuilderMediaFile(png(), async () => ({ width: 8001, height: 1 })))
      .rejects.toMatchObject({ issue: { code: 'IMAGE_TOO_LARGE' } });
    await expect(validateBuilderMediaFile(png(), async () => ({ width: 7000, height: 7000 })))
      .rejects.toMatchObject({ issue: { code: 'IMAGE_TOO_LARGE' } });
  });

  it('rejects empty files, SVG, excessive height, and decode failures', async () => {
    await expect(validateBuilderMediaFile(new Blob([], { type: 'image/png' })))
      .rejects.toMatchObject({ issue: { code: 'EMPTY_FILE' } });
    await expect(validateBuilderMediaFile(new Blob(['<svg/>'], { type: 'image/svg+xml' })))
      .rejects.toMatchObject({ issue: { code: 'UNSUPPORTED_MEDIA_TYPE' } });
    await expect(validateBuilderMediaFile(png(), async () => ({ width: 1, height: 8001 })))
      .rejects.toMatchObject({ issue: { code: 'IMAGE_TOO_LARGE' } });
    await expect(validateBuilderMediaFile(png(), async () => { throw new Error('decode'); }))
      .rejects.toMatchObject({ issue: { code: 'IMAGE_DECODE_FAILED' } });
  });

  it('sanitizes display names without mutating the source value', () => {
    const source = 'C:\\fakepath\\before\u0000-after.png';
    expect(sanitizeBuilderMediaDisplayName(source)).toBe('before-after.png');
    expect(source).toContain('fakepath');
    expect(sanitizeBuilderMediaDisplayName('   ')).toBe('Untitled image');
  });

  it('returns immutable public domain objects without private binary fields', () => {
    const asset = freezeBuilderMediaAsset({
      id: 'asset-1', userId: 'user-1', websiteId: 'site-1', bucketId: 'media',
      objectPath: 'user-1/site-1/asset-1.png', publicUrl: 'https://cdn/asset-1.png',
      displayName: 'Asset.png', mimeType: 'image/png', sizeBytes: 8, width: 1, height: 1,
      createdAt: '2026-07-26T00:00:00.000Z', updatedAt: '2026-07-26T00:00:00.000Z'
    });
    expect(Object.isFrozen(asset)).toBe(true);
    expect((asset as unknown as { blob?: Blob }).blob).toBeUndefined();
    expect(() => { (asset as { displayName: string }).displayName = 'changed'; }).toThrow();
  });

  it('builds the required owner/website/asset path', () => {
    expect(createBuilderMediaObjectPath('user-1', 'site-1', 'asset-1', 'webp'))
      .toBe('user-1/site-1/asset-1.webp');
  });
});
