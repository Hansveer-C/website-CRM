import Sortable from 'sortablejs';

export interface OpportunitiesSortableOptions {
  editable?: boolean;
  onStageChange?: (opportunityId: string, newStage: string, oldStage: string) => boolean | void | Promise<boolean | void>;
}

export interface OpportunitiesSortableController {
  destroy: () => void;
  isDestroyed: () => boolean;
  getInstancesCount: () => number;
}

const activeControllers = new WeakMap<HTMLElement, OpportunitiesSortableController>();

export async function normalizeTransitionResult(
  result: boolean | void | Promise<boolean | void>
): Promise<boolean> {
  try {
    if (result && typeof (result as any).then === 'function') {
      const resolved = await result;
      return resolved !== false;
    }
    return result !== false;
  } catch (error) {
    console.error('[OpportunitiesSortable] Stage transition rejected or threw:', error);
    return false;
  }
}

function revertDomElement(item: HTMLElement, fromContainer: HTMLElement, oldIndex: number | undefined): void {
  if (!item || !fromContainer) return;
  const siblings = Array.from(fromContainer.children || []).filter(el => el !== item);
  const targetChild = (oldIndex !== undefined && oldIndex >= 0 && oldIndex < siblings.length)
    ? siblings[oldIndex]
    : null;

  if (typeof fromContainer.insertBefore === 'function') {
    fromContainer.insertBefore(item, targetChild);
  } else if (typeof fromContainer.appendChild === 'function') {
    fromContainer.appendChild(item);
  }
}

export function initOpportunitiesSortable(
  root: HTMLElement,
  options: OpportunitiesSortableOptions = {}
): OpportunitiesSortableController {
  if (!root) {
    return {
      destroy: () => {},
      isDestroyed: () => true,
      getInstancesCount: () => 0
    };
  }

  // Duplicate-init protection: destroy existing controller if present
  const existing = activeControllers.get(root);
  if (existing && !existing.isDestroyed()) {
    existing.destroy();
  }

  if (options.editable === false) {
    const noopController: OpportunitiesSortableController = {
      destroy: () => {},
      isDestroyed: () => true,
      getInstancesCount: () => 0
    };
    activeControllers.set(root, noopController);
    return noopController;
  }

  let isDestroyed = false;

  async function executeStageTransition(
    opportunityId: string,
    destinationStage: string,
    sourceStage: string
  ): Promise<boolean> {
    if (typeof options.onStageChange === 'function') {
      try {
        const result = options.onStageChange(opportunityId, destinationStage, sourceStage);
        return await normalizeTransitionResult(result);
      } catch (error) {
        console.error('[OpportunitiesSortable] onStageChange threw error:', error);
        return false;
      }
    }

    if (typeof (window as any)?.updateOpportunityStage === 'function') {
      try {
        const result = (window as any).updateOpportunityStage(opportunityId, destinationStage);
        return await normalizeTransitionResult(result);
      } catch (error) {
        console.error('[OpportunitiesSortable] window.updateOpportunityStage threw error:', error);
        return false;
      }
    }

    return false;
  }

  const stageColumns = Array.from(root.querySelectorAll<HTMLElement>('.wo-pipeline-stage-cards'));
  const sortableInstances: Sortable[] = [];

  for (const column of stageColumns) {
    try {
      const instance = Sortable.create(column, {
        group: 'opportunities-pipeline',
        sort: false,
        animation: 150,
        ghostClass: 'wo-opportunity-card--ghost',
        chosenClass: 'wo-opportunity-card--chosen',
        dragClass: 'wo-opportunity-card--dragging',
        handle: '.wo-opportunity-card-handle',
        filter: 'input, select, textarea, button, a, .wo-opportunity-stage-select',
        preventOnFilter: false,
        touchStartThreshold: 5,
        fallbackTolerance: 3,
        onEnd: async (evt) => {
          if (isDestroyed) return;

          const itemEl = evt.item as HTMLElement | undefined;
          const toContainer = evt.to as HTMLElement | undefined;
          const fromContainer = evt.from as HTMLElement | undefined;

          if (!itemEl || !toContainer || !fromContainer) return;

          const opportunityId = itemEl.getAttribute('data-opportunity-id')?.trim();
          if (!opportunityId) {
            revertDomElement(itemEl, fromContainer, evt.oldIndex);
            return;
          }

          const fromStage = fromContainer.getAttribute('data-stage')
            || fromContainer.closest('[data-stage]')?.getAttribute('data-stage')
            || '';
          const toStage = toContainer.getAttribute('data-stage')
            || toContainer.closest('[data-stage]')?.getAttribute('data-stage')
            || '';

          if (!fromStage || !toStage || fromStage === toStage) {
            revertDomElement(itemEl, fromContainer, evt.oldIndex);
            return;
          }

          const success = await executeStageTransition(opportunityId, toStage, fromStage);
          if (!success) {
            revertDomElement(itemEl, fromContainer, evt.oldIndex);
          } else {
            // Update data-current-stage on the card's stage select if present
            const stageSelect = itemEl.querySelector<HTMLSelectElement>('.wo-opportunity-stage-select');
            if (stageSelect) {
              stageSelect.value = toStage;
              stageSelect.setAttribute('data-current-stage', toStage);
            }
          }
        }
      });
      sortableInstances.push(instance);
    } catch (err) {
      console.warn('[OpportunitiesSortable] Failed to initialize column:', err);
    }
  }

  // Handle click on stage control to prevent bubbling to card navigation
  const handleRootClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.closest('.wo-opportunity-card-stage-control') || target.classList.contains('wo-opportunity-stage-select'))) {
      event.stopPropagation();
    }
  };

  // Handle change on stage select with rollback protection
  const handleRootChange = async (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target || !target.classList.contains('wo-opportunity-stage-select')) return;
    event.stopPropagation();

    const selectEl = target as HTMLSelectElement;
    const opportunityId = selectEl.getAttribute('data-opportunity-id')?.trim();
    const previousStage = selectEl.getAttribute('data-current-stage')?.trim() || '';
    const destinationStage = selectEl.value;

    if (!opportunityId || !destinationStage || destinationStage === previousStage) {
      return;
    }

    const success = await executeStageTransition(opportunityId, destinationStage, previousStage);
    if (!success) {
      // Rollback visible value to previous stage
      selectEl.value = previousStage;
    } else {
      selectEl.setAttribute('data-current-stage', destinationStage);
    }
  };

  root.addEventListener('click', handleRootClick);
  root.addEventListener('change', handleRootChange);

  const controller: OpportunitiesSortableController = {
    destroy: () => {
      if (isDestroyed) return;
      isDestroyed = true;

      root.removeEventListener('click', handleRootClick);
      root.removeEventListener('change', handleRootChange);

      for (const instance of sortableInstances) {
        try {
          instance.destroy();
        } catch {
          // ignore
        }
      }
      sortableInstances.length = 0;
      activeControllers.delete(root);
    },
    isDestroyed: () => isDestroyed,
    getInstancesCount: () => sortableInstances.length
  };

  activeControllers.set(root, controller);
  return controller;
}
