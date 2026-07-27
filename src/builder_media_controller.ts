import type { BuilderMediaAsset, BuilderMediaAssetPage } from './builder_media_asset';
import type { BuilderMediaRepository } from './builder_media_repository';
import type { BuilderDocument } from './builder_document';

export interface BuilderMediaPickerTarget {
  pageId: string;
  sectionId: string;
  field: string;
  multiple?: boolean;
}

export interface BuilderMediaControllerState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  assets: readonly BuilderMediaAsset[];
  search: string;
  nextCursor?: string;
  error?: string;
  uploading: number;
  pickerTarget?: BuilderMediaPickerTarget;
}

export interface BuilderMediaUploadOutcome {
  fileName: string;
  asset?: BuilderMediaAsset;
  error?: string;
}

function setMediaField(root: Record<string, unknown>, path: string, value: string): void {
  const segments = path.split('.').filter(Boolean);
  if (!segments.length) throw new Error('BUILDER_MEDIA_TARGET_UNAVAILABLE');
  let current: Record<string, unknown> = root;
  segments.slice(0, -1).forEach((segment, index) => {
    const existing = current[segment];
    if (existing !== null && typeof existing === 'object') {
      current = existing as Record<string, unknown>;
      return;
    }
    const next: Record<string, unknown> | unknown[] = /^\d+$/.test(segments[index + 1]) ? [] : {};
    current[segment] = next;
    current = next as Record<string, unknown>;
  });
  current[segments[segments.length - 1]] = value;
}

export function applyBuilderMediaAssetSelection(
  document: BuilderDocument,
  target: BuilderMediaPickerTarget,
  assets: readonly BuilderMediaAsset[],
  createId: () => string = () => crypto.randomUUID()
): BuilderDocument {
  if (document.page.id !== target.pageId || assets.length === 0) {
    throw new Error('BUILDER_MEDIA_TARGET_UNAVAILABLE');
  }
  const targetSection = document.sections.find(section => section.id === target.sectionId);
  if (!targetSection) throw new Error('BUILDER_MEDIA_TARGET_UNAVAILABLE');

  return {
    ...document,
    sections: document.sections.map(section => {
      if (section.id !== target.sectionId) return section;
      const content = structuredClone(section.content) as Record<string, unknown>;
      if (target.multiple) {
        if (section.type !== 'gallery') throw new Error('BUILDER_MEDIA_TARGET_UNAVAILABLE');
        const existingItems = Array.isArray(content.items) ? content.items : [];
        content.items = [
          ...existingItems,
          ...assets.map(asset => ({ id: createId(), before: asset.publicUrl, after: asset.publicUrl }))
        ];
      } else {
        setMediaField(content, target.field, assets[0].publicUrl);
      }
      return { ...section, content };
    })
  };
}

export class BuilderMediaController {
  private readonly repository: BuilderMediaRepository;
  private readonly websiteId: string;
  private requestSequence = 0;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private _state: BuilderMediaControllerState = {
    status: 'idle',
    assets: [],
    search: '',
    uploading: 0
  };
  onChange?: (state: BuilderMediaControllerState) => void;

  constructor(repository: BuilderMediaRepository, websiteId: string) {
    this.repository = repository;
    this.websiteId = websiteId;
  }

  get state(): BuilderMediaControllerState { return this._state; }

  private update(patch: Partial<BuilderMediaControllerState>): void {
    this._state = { ...this._state, ...patch };
    this.onChange?.(this._state);
  }

  async load(options: { append?: boolean } = {}): Promise<void> {
    const sequence = ++this.requestSequence;
    this.update({ status: 'loading', error: undefined });
    try {
      const page: BuilderMediaAssetPage = await this.repository.listAssets(this.websiteId, {
        search: this._state.search,
        ...(options.append && this._state.nextCursor ? { cursor: this._state.nextCursor } : {})
      });
      if (sequence !== this.requestSequence) return;
      this.update({
        status: 'ready',
        assets: options.append
          ? [...new Map([...this._state.assets, ...page.items].map(asset => [asset.id, asset])).values()]
          : page.items,
        nextCursor: page.nextCursor,
        error: undefined
      });
    } catch (error) {
      if (sequence !== this.requestSequence) return;
      this.update({
        status: 'error',
        error: error instanceof Error ? error.message : 'Media could not be loaded.'
      });
    }
  }

  setSearch(value: string, debounceMs = 250): void {
    this.update({ search: value });
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.load(), debounceMs);
  }

  openPicker(target: BuilderMediaPickerTarget): void {
    this.update({ pickerTarget: { ...target } });
  }

  closePicker(): void { this.update({ pickerTarget: undefined }); }

  async upload(files: readonly File[]): Promise<readonly BuilderMediaUploadOutcome[]> {
    this.update({ uploading: this._state.uploading + files.length });
    const outcomes = await Promise.all(files.map(async file => {
      try {
        const asset = await this.repository.uploadAsset({
          websiteId: this.websiteId,
          file,
          displayName: file.name
        });
        return { fileName: file.name, asset };
      } catch (error) {
        return {
          fileName: file.name,
          error: error instanceof Error ? error.message : 'Upload failed.'
        };
      } finally {
        this.update({ uploading: Math.max(this._state.uploading - 1, 0) });
      }
    }));
    await this.load();
    return outcomes;
  }

  dispose(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.requestSequence += 1;
    this.repository.dispose?.();
  }
}
