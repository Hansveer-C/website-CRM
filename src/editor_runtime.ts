export type EditorRuntimeMode = 'local' | 'supabase';

export type EditorRuntimeResult =
  | { success: true; mode: EditorRuntimeMode }
  | { success: false; reason: 'configuration-unavailable' | 'mixed-configuration' };

function normalizeMode(value: string | undefined): 'auto' | EditorRuntimeMode | 'invalid' {
  const mode = value?.trim().toLowerCase() || 'auto';
  return mode === 'auto' || mode === 'local' || mode === 'supabase' ? mode : 'invalid';
}

export function resolveEditorRuntime(input: {
  production: boolean;
  supabaseConfigured: boolean;
  publicationMode?: string;
  mediaMode?: string;
}): EditorRuntimeResult {
  const publicationMode = normalizeMode(input.publicationMode);
  const mediaMode = normalizeMode(input.mediaMode);
  if (publicationMode === 'invalid' || mediaMode === 'invalid') {
    return { success: false, reason: 'configuration-unavailable' };
  }
  if (
    (publicationMode === 'local' && mediaMode === 'supabase')
    || (publicationMode === 'supabase' && mediaMode === 'local')
  ) {
    return { success: false, reason: 'mixed-configuration' };
  }
  if (input.production) {
    if (publicationMode === 'local' || mediaMode === 'local') {
      return { success: false, reason: 'mixed-configuration' };
    }
    return input.supabaseConfigured
      ? { success: true, mode: 'supabase' }
      : { success: false, reason: 'configuration-unavailable' };
  }
  const remoteRequested = publicationMode === 'supabase' || mediaMode === 'supabase';
  if (remoteRequested) {
    return input.supabaseConfigured
      ? { success: true, mode: 'supabase' }
      : { success: false, reason: 'configuration-unavailable' };
  }
  return { success: true, mode: 'local' };
}
