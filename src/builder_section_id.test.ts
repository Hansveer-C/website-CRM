import { describe, expect, it, vi } from 'vitest';
import { createBuilderSectionId } from './builder_section_id';

describe('Builder section IDs', () => {
  it('uses the supplied cryptographically strong UUID source with a stable prefix', () => {
    const randomUUID = vi.fn(() => '123e4567-e89b-12d3-a456-426614174000');
    expect(createBuilderSectionId(randomUUID)).toBe('sec-123e4567-e89b-12d3-a456-426614174000');
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });
});
