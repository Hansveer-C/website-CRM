import { describe, expect, it } from 'vitest';
import { BuilderSaveStateController, builderSaveStatusLabel } from './builder_save_state';

describe('BuilderSaveStateController', () => {
  it('moves dirty to saving to saved', () => { const state = new BuilderSaveStateController(); state.markDirty(); state.begin(1); state.complete(1, { success: true }, false); expect(state.status).toBe('saved'); });
  it('moves dirty to saving to failed', () => { const state = new BuilderSaveStateController(); state.markDirty(); state.begin(1); state.complete(1, { success: false, code: 'NETWORK_FAILURE' }, true); expect(state.status).toBe('failed'); });
  it('never labels a failed save Saved', () => { const state = new BuilderSaveStateController(); state.begin(1); state.complete(1, { success: false, code: 'TRANSACTION_FAILED' }, false); expect(builderSaveStatusLabel(state.status)).toBe('Save failed'); });
  it('keeps a newer edited document dirty after an older success', () => { const state = new BuilderSaveStateController(); state.begin(1); state.complete(1, { success: true }, true); expect(state.status).toBe('dirty'); });
  it('ignores stale earlier completions', () => { const state = new BuilderSaveStateController(); state.begin(1); state.begin(2); state.complete(1, { success: true }, false); expect(state.status).toBe('saving'); });
  it('exposes a conflict state', () => { const state = new BuilderSaveStateController(); state.begin(1); state.complete(1, { success: false, code: 'CONFLICT' }, true); expect(state.status).toBe('conflict'); });
  it('can preserve a reload-required conflict across Builder reinitialization', () => { const state = new BuilderSaveStateController(); state.resetSaved(); state.requireReloadForConflict(); expect(state.status).toBe('conflict'); });
  it('supports a successful retry', () => { const state = new BuilderSaveStateController(); state.begin(1); state.complete(1, { success: false }, true); state.markDirty(); state.begin(2); state.complete(2, { success: true }, false); expect(state.status).toBe('saved'); });
});
