export class BuilderPageRevisionAuthority {
  private readonly revisions = new Map<string, number>();
  private readonly reloadRequired = new Set<string>();

  has(pageId: string): boolean {
    return this.revisions.has(pageId);
  }

  get(pageId: string): number | undefined {
    return this.revisions.get(pageId);
  }

  accept(pageId: string, revision: number): void {
    this.revisions.set(pageId, revision);
    this.reloadRequired.delete(pageId);
  }

  invalidateAfterConflict(pageId: string): void {
    this.revisions.delete(pageId);
    this.reloadRequired.add(pageId);
  }

  requiresReload(pageId: string): boolean {
    return this.reloadRequired.has(pageId);
  }
}
