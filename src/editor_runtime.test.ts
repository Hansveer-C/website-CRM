import { describe, expect, it } from 'vitest';
import { resolveEditorRuntime } from './editor_runtime';

describe('resolveEditorRuntime', () => {
  it('uses Supabase for every production editor repository', () => {
    expect(resolveEditorRuntime({ production: true, supabaseConfigured: true })).toEqual({ success: true, mode: 'supabase' });
  });

  it('never falls back locally when production configuration is missing', () => {
    expect(resolveEditorRuntime({ production: true, supabaseConfigured: false })).toEqual({ success: false, reason: 'configuration-unavailable' });
  });

  it('fails mixed production persistence configuration safely', () => {
    expect(resolveEditorRuntime({ production: true, supabaseConfigured: true, publicationMode: 'supabase', mediaMode: 'local' })).toEqual({ success: false, reason: 'mixed-configuration' });
    expect(resolveEditorRuntime({ production: true, supabaseConfigured: true, publicationMode: 'local' })).toEqual({ success: false, reason: 'mixed-configuration' });
  });

  it('keeps explicit development local mode isolated', () => {
    expect(resolveEditorRuntime({ production: false, supabaseConfigured: false, publicationMode: 'local', mediaMode: 'local' })).toEqual({ success: true, mode: 'local' });
  });

  it('requires configuration for explicit development Supabase mode', () => {
    expect(resolveEditorRuntime({ production: false, supabaseConfigured: false, publicationMode: 'supabase' })).toEqual({ success: false, reason: 'configuration-unavailable' });
  });
});
