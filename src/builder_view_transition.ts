export interface BuilderViewTransition {
  finished: Promise<unknown>;
}

export interface BuilderViewTransitionDocument {
  startViewTransition?(update: () => void): BuilderViewTransition;
}

function isExpectedSkippedTransition(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  return error instanceof Error && error.message === 'Transition was skipped';
}

export class BuilderViewTransitionController {
  private active = false;

  render(documentLike: BuilderViewTransitionDocument, update: () => void): void {
    if (!documentLike.startViewTransition || this.active) {
      update();
      return;
    }
    this.active = true;
    let transition: BuilderViewTransition;
    try {
      transition = documentLike.startViewTransition(update);
    } catch (error) {
      this.active = false;
      if (isExpectedSkippedTransition(error)) {
        update();
        return;
      }
      throw error;
    }
    void Promise.resolve(transition.finished)
      .catch(error => {
        if (!isExpectedSkippedTransition(error)) queueMicrotask(() => { throw error; });
      })
      .finally(() => { this.active = false; });
  }
}
