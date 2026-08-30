import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initOpportunitiesSortable,
  normalizeTransitionResult,
  type OpportunitiesSortableController
} from './opportunities_sortable';
import { renderOpportunitiesContent } from './opportunities';

describe('Opportunities Sortable & Accessibility Controller (Phase OSS-1A1A)', () => {
  let mockWindow: any;
  let mockDocument: any;
  let rootListeners: { [type: string]: ((event: any) => void)[] } = {};

  beforeEach(() => {
    rootListeners = {};
    mockDocument = {
      createElement: () => ({ style: {}, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => [])
    };
    mockWindow = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    (global as any).window = mockWindow;
    (global as any).document = mockDocument;
  });

  afterEach(() => {
    delete (global as any).window;
    delete (global as any).document;
  });

  function createMockRoot(columns: any[] = []): any {
    const root: any = {
      nodeType: 1,
      querySelectorAll: vi.fn((selector: string) => {
        if (selector === '.wo-pipeline-stage-cards') return columns;
        return [];
      }),
      addEventListener: vi.fn((type: string, listener: any) => {
        if (!rootListeners[type]) rootListeners[type] = [];
        rootListeners[type].push(listener);
      }),
      removeEventListener: vi.fn((type: string, listener: any) => {
        if (rootListeners[type]) {
          rootListeners[type] = rootListeners[type].filter(l => l !== listener);
        }
      })
    };
    return root;
  }

  function createMockColumn(stage: string): any {
    const children: any[] = [];
    const col: any = {
      nodeType: 1,
      children,
      style: {},
      getAttribute: vi.fn((attr: string) => (attr === 'data-stage' ? stage : null)),
      closest: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      insertBefore: vi.fn((item: any, ref: any) => {
        const idx = children.indexOf(ref);
        if (idx !== -1) {
          children.splice(idx, 0, item);
        } else {
          children.push(item);
        }
      }),
      appendChild: vi.fn((item: any) => {
        children.push(item);
      })
    };
    return col;
  }

  function createMockCard(id: string): any {
    return {
      nodeType: 1,
      style: {},
      getAttribute: vi.fn((attr: string) => (attr === 'data-opportunity-id' ? id : null)),
      querySelector: vi.fn(() => null),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
  }

  it('A. Markup audit: no new Opportunity markup contains inline onclick, onchange, ondrag*, or ondrop', () => {
    const owner = 'user-test';
    const contact = { id: 'c1', user_id: owner, name: 'Customer Test', phone: null, email: null, address: '', tags: [], source: 'Referral', status: 'lead' as const, created_at: '2026-08-01T00:00:00Z' };
    const pipeline = { id: 'p1', name: 'Standard Pipeline', stages: ['New Lead', 'Scheduled'] };
    const opportunity = { id: 'opp-1', user_id: owner, contact_id: 'c1', pipeline_stage: 'New Lead', value: 350, status: 'open' as const, notes: '', created_at: '2026-08-01T00:00:00Z' };

    const html = renderOpportunitiesContent({
      userId: owner,
      pipeline,
      opportunities: [opportunity],
      contacts: [contact],
      editable: true
    });

    // Verify stage controls have zero inline event handlers
    expect(html).not.toMatch(/class="wo-opportunity-card-stage-control"[^>]*onclick/i);
    expect(html).not.toMatch(/class="[^"]*wo-opportunity-stage-select[^"]*"[^>]*onchange/i);
    expect(html).not.toContain('ondragstart');
    expect(html).not.toContain('ondragover');
    expect(html).not.toContain('ondrop');
  });

  it('B. Safe data attributes: stage select contains safely escaped data-opportunity-id and data-current-stage', () => {
    const owner = 'user-test';
    const contact = { id: 'c1', user_id: owner, name: 'O\'Connor & Sons <tag>', phone: null, email: null, address: '', tags: [], source: 'Referral', status: 'lead' as const, created_at: '2026-08-01T00:00:00Z' };
    const pipeline = { id: 'p1', name: 'Standard Pipeline', stages: ['New Lead', 'Scheduled'] };
    const opportunity = { id: 'opp-"injection"', user_id: owner, contact_id: 'c1', pipeline_stage: 'New Lead', value: 350, status: 'open' as const, notes: '', created_at: '2026-08-01T00:00:00Z' };

    const html = renderOpportunitiesContent({
      userId: owner,
      pipeline,
      opportunities: [opportunity],
      contacts: [contact],
      editable: true
    });

    expect(html).toContain('data-opportunity-id="opp-&quot;injection&quot;"');
    expect(html).toContain('data-current-stage="New Lead"');
    expect(html).not.toContain('opp-"injection"');
  });

  it('C. Same transition boundary: drag and select change route to the same transition helper', async () => {
    const col1 = createMockColumn('New Lead');
    const col2 = createMockColumn('Scheduled');
    const root = createMockRoot([col1, col2]);

    const onStageChange = vi.fn(() => true);
    initOpportunitiesSortable(root, { editable: true, onStageChange });

    // 1. Drag path
    const card = createMockCard('opp-1');
    const Sortable = require('sortablejs');
    const instance = Sortable.get(col1);
    await instance.options.onEnd({
      item: card,
      to: col2,
      from: col1,
      oldIndex: 0,
      newIndex: 0
    });
    expect(onStageChange).toHaveBeenCalledWith('opp-1', 'Scheduled', 'New Lead');

    // 2. Select path
    const mockSelect = {
      classList: { contains: (c: string) => c === 'wo-opportunity-stage-select' },
      getAttribute: vi.fn((attr: string) => {
        if (attr === 'data-opportunity-id') return 'opp-2';
        if (attr === 'data-current-stage') return 'New Lead';
        return null;
      }),
      setAttribute: vi.fn(),
      value: 'Scheduled'
    };

    const changeListeners = rootListeners['change'] || [];
    expect(changeListeners.length).toBe(1);

    await changeListeners[0]({
      target: mockSelect,
      stopPropagation: vi.fn()
    });

    expect(onStageChange).toHaveBeenCalledWith('opp-2', 'Scheduled', 'New Lead');
  });

  it('D. Rejected synchronous select transition restores previous visible value', async () => {
    const root = createMockRoot([]);
    const onStageChange = vi.fn(() => false); // Explicit synchronous rejection
    initOpportunitiesSortable(root, { editable: true, onStageChange });

    const mockSelect = {
      classList: { contains: (c: string) => c === 'wo-opportunity-stage-select' },
      getAttribute: vi.fn((attr: string) => {
        if (attr === 'data-opportunity-id') return 'opp-1';
        if (attr === 'data-current-stage') return 'New Lead';
        return null;
      }),
      setAttribute: vi.fn(),
      value: 'Scheduled'
    };

    const changeListeners = rootListeners['change'] || [];
    await changeListeners[0]({
      target: mockSelect,
      stopPropagation: vi.fn()
    });

    expect(onStageChange).toHaveBeenCalledWith('opp-1', 'Scheduled', 'New Lead');
    // Value must be restored to previous stage
    expect(mockSelect.value).toBe('New Lead');
    expect(mockSelect.setAttribute).not.toHaveBeenCalledWith('data-current-stage', 'Scheduled');
  });

  it('E. Rejected asynchronous select transition restores previous visible value', async () => {
    const root = createMockRoot([]);
    const onStageChange = vi.fn(async () => false); // Asynchronous rejection
    initOpportunitiesSortable(root, { editable: true, onStageChange });

    const mockSelect = {
      classList: { contains: (c: string) => c === 'wo-opportunity-stage-select' },
      getAttribute: vi.fn((attr: string) => {
        if (attr === 'data-opportunity-id') return 'opp-1';
        if (attr === 'data-current-stage') return 'New Lead';
        return null;
      }),
      setAttribute: vi.fn(),
      value: 'Scheduled'
    };

    const changeListeners = rootListeners['change'] || [];
    await changeListeners[0]({
      target: mockSelect,
      stopPropagation: vi.fn()
    });

    expect(mockSelect.value).toBe('New Lead');
    expect(mockSelect.setAttribute).not.toHaveBeenCalledWith('data-current-stage', 'Scheduled');
  });

  it('F. Thrown / rejected error during transition safely restores previous value', async () => {
    const root = createMockRoot([]);
    const onStageChange = vi.fn(() => {
      throw new Error('Network error or server-disabled guard failure');
    });
    initOpportunitiesSortable(root, { editable: true, onStageChange });

    const mockSelect = {
      classList: { contains: (c: string) => c === 'wo-opportunity-stage-select' },
      getAttribute: vi.fn((attr: string) => {
        if (attr === 'data-opportunity-id') return 'opp-1';
        if (attr === 'data-current-stage') return 'New Lead';
        return null;
      }),
      setAttribute: vi.fn(),
      value: 'Scheduled'
    };

    const changeListeners = rootListeners['change'] || [];
    await changeListeners[0]({
      target: mockSelect,
      stopPropagation: vi.fn()
    });

    expect(mockSelect.value).toBe('New Lead');
    expect(mockSelect.setAttribute).not.toHaveBeenCalledWith('data-current-stage', 'Scheduled');
  });

  it('G. Successful transition does not rollback and updates data-current-stage', async () => {
    const root = createMockRoot([]);
    const onStageChange = vi.fn(() => true); // Success
    initOpportunitiesSortable(root, { editable: true, onStageChange });

    const mockSelect = {
      classList: { contains: (c: string) => c === 'wo-opportunity-stage-select' },
      getAttribute: vi.fn((attr: string) => {
        if (attr === 'data-opportunity-id') return 'opp-1';
        if (attr === 'data-current-stage') return 'New Lead';
        return null;
      }),
      setAttribute: vi.fn(),
      value: 'Scheduled'
    };

    const changeListeners = rootListeners['change'] || [];
    await changeListeners[0]({
      target: mockSelect,
      stopPropagation: vi.fn()
    });

    expect(mockSelect.value).toBe('Scheduled');
    expect(mockSelect.setAttribute).toHaveBeenCalledWith('data-current-stage', 'Scheduled');
  });

  it('H. Invalid / missing Opportunity ID fails safely without calling transition callback', async () => {
    const root = createMockRoot([]);
    const onStageChange = vi.fn(() => true);
    initOpportunitiesSortable(root, { editable: true, onStageChange });

    const mockSelect = {
      classList: { contains: (c: string) => c === 'wo-opportunity-stage-select' },
      getAttribute: vi.fn(() => null), // Missing ID
      setAttribute: vi.fn(),
      value: 'Scheduled'
    };

    const changeListeners = rootListeners['change'] || [];
    await changeListeners[0]({
      target: mockSelect,
      stopPropagation: vi.fn()
    });

    expect(onStageChange).not.toHaveBeenCalled();
  });

  it('I. Non-editable mode initializes zero Sortable instances', () => {
    const col1 = createMockColumn('New Lead');
    const root = createMockRoot([col1]);

    const controller = initOpportunitiesSortable(root, { editable: false });
    expect(controller.isDestroyed()).toBe(true);
    expect(controller.getInstancesCount()).toBe(0);
  });

  it('J. Non-editable markup does not expose misleading active movement controls', () => {
    const owner = 'user-test';
    const contact = { id: 'c1', user_id: owner, name: 'Test Contact', phone: null, email: null, address: '', tags: [], source: 'Referral', status: 'lead' as const, created_at: '2026-08-01T00:00:00Z' };
    const pipeline = { id: 'p1', name: 'Standard Pipeline', stages: ['New Lead', 'Scheduled'] };
    const opportunity = { id: 'opp-1', user_id: owner, contact_id: 'c1', pipeline_stage: 'New Lead', value: 350, status: 'open' as const, notes: '', created_at: '2026-08-01T00:00:00Z' };

    const html = renderOpportunitiesContent({
      userId: owner,
      pipeline,
      opportunities: [opportunity],
      contacts: [contact],
      editable: false
    });

    expect(html).not.toContain('class="wo-opportunity-card-handle"');
    expect(html).not.toContain('class="wo-opportunity-stage-select"');
    expect(html).toContain('Read-only in production');
  });

  it('K. Duplicate initialization remains safe and destroys previous controller', () => {
    const col1 = createMockColumn('New Lead');
    const root = createMockRoot([col1]);

    const firstController = initOpportunitiesSortable(root, { editable: true });
    expect(firstController.isDestroyed()).toBe(false);

    const secondController = initOpportunitiesSortable(root, { editable: true });
    expect(firstController.isDestroyed()).toBe(true);
    expect(secondController.isDestroyed()).toBe(false);
  });

  it('L. Teardown removes all root event listeners and destroys Sortable instances', () => {
    const col1 = createMockColumn('New Lead');
    const root = createMockRoot([col1]);

    const controller = initOpportunitiesSortable(root, { editable: true });
    expect(rootListeners['click']?.length).toBe(1);
    expect(rootListeners['change']?.length).toBe(1);

    controller.destroy();
    expect(controller.isDestroyed()).toBe(true);
    expect(rootListeners['click']?.length || 0).toBe(0);
    expect(rootListeners['change']?.length || 0).toBe(0);
  });

  it('M. TypeScript compilation uses maintained @types and no local sortablejs.d.ts remains', () => {
    const localDtsPath = resolve(__dirname, '../../sortablejs.d.ts');
    expect(existsSync(localDtsPath)).toBe(false);
  });
});
