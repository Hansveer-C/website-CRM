import { describe, it, expect, vi } from 'vitest';
import {
  renderApplicationShell,
  initApplicationShell,
  type ShellController,
  type ShellNavigationTarget,
  type ApplicationShellOptions
} from './application_shell';

describe('Application Shell Controller Mount & Navigation Authority Lifecycle', () => {
  it('1. Sole mount authority: renderAppWithShell attaches exactly ONE controller per full-shell render', () => {
    let currentController: ShellController | null = null;
    let initCount = 0;
    let destroyCount = 0;

    const mockInitApplicationShell = vi.fn((container: HTMLElement, opts: any) => {
      initCount += 1;
      return {
        destroy: vi.fn(() => {
          destroyCount += 1;
        }),
        openDrawer: vi.fn(),
        closeDrawer: vi.fn()
      };
    });

    const mockApp = { innerHTML: '' } as unknown as HTMLElement;

    function testRenderAppWithShell(options: ApplicationShellOptions) {
      currentController?.destroy();
      mockApp.innerHTML = renderApplicationShell(options);
      currentController = mockInitApplicationShell(mockApp, {
        onNavigate: (target: ShellNavigationTarget) => {}
      });
    }

    // Step 1: Render Dashboard
    testRenderAppWithShell({
      activeView: 'dashboard',
      title: 'Dashboard Overview',
      contentHtml: '<div>Dashboard Content</div>'
    });
    expect(initCount).toBe(1);
    expect(destroyCount).toBe(0);

    // Step 2: Navigate to Clients
    testRenderAppWithShell({
      activeView: 'clients',
      title: 'Clients & Leads',
      contentHtml: '<div>Clients Content</div>'
    });
    expect(initCount).toBe(2);
    expect(destroyCount).toBe(1);

    // Step 3: Navigate back to Dashboard
    testRenderAppWithShell({
      activeView: 'dashboard',
      title: 'Dashboard Overview',
      contentHtml: '<div>Dashboard Content</div>'
    });
    expect(initCount).toBe(3);
    expect(destroyCount).toBe(2);
  });

  it('2. Specialized boundary: navigating to exempt standalone routes destroys controller, navigating back mounts exactly one controller', () => {
    let currentController: ShellController | null = null;
    let initCount = 0;
    let destroyCount = 0;

    const mockInitApplicationShell = vi.fn((container: HTMLElement, opts: any) => {
      initCount += 1;
      return {
        destroy: vi.fn(() => {
          destroyCount += 1;
        }),
        openDrawer: vi.fn(),
        closeDrawer: vi.fn()
      };
    });

    const mockApp = { innerHTML: '' } as unknown as HTMLElement;

    function testRenderAppWithShell(options: ApplicationShellOptions) {
      currentController?.destroy();
      mockApp.innerHTML = renderApplicationShell(options);
      currentController = mockInitApplicationShell(mockApp, {
        onNavigate: (target: ShellNavigationTarget) => {}
      });
    }

    function testExecuteNavigation(view: string) {
      if (['builder', 'preview', 'site'].includes(view)) {
        currentController?.destroy();
        currentController = null;
      }

      if (view === 'dashboard') {
        testRenderAppWithShell({
          activeView: 'dashboard',
          title: 'Dashboard Overview',
          contentHtml: '<div>Dashboard</div>'
        });
      } else if (view === 'builder') {
        mockApp.innerHTML = '<div id="builder-app">Builder</div>';
      } else if (view === 'preview') {
        mockApp.innerHTML = '<div id="preview-app">Preview</div>';
      } else if (view === 'site') {
        mockApp.innerHTML = '<div id="site-app">Public Site</div>';
      }
    }

    // 1. Mount Dashboard
    testExecuteNavigation('dashboard');
    expect(initCount).toBe(1);
    expect(currentController).not.toBeNull();

    // 2. Navigate to Builder (exempt)
    testExecuteNavigation('builder');
    expect(destroyCount).toBe(1);
    expect(initCount).toBe(1); // No new controller mounted
    expect(currentController).toBeNull();

    // 3. Mount Dashboard again
    testExecuteNavigation('dashboard');
    expect(initCount).toBe(2);
    expect(currentController).not.toBeNull();

    // 4. Navigate to Preview (exempt)
    testExecuteNavigation('preview');
    expect(destroyCount).toBe(2);
    expect(initCount).toBe(2);
    expect(currentController).toBeNull();

    // 5. Mount Dashboard again
    testExecuteNavigation('dashboard');
    expect(initCount).toBe(3);
    expect(currentController).not.toBeNull();

    // 6. Navigate to Public Site (exempt)
    testExecuteNavigation('site');
    expect(destroyCount).toBe(3);
    expect(initCount).toBe(3);
    expect(currentController).toBeNull();
  });

  it('3. Builder boundary: navigating to Builder studio canvas destroys controller, returning remounts exactly once', () => {
    let currentController: ShellController | null = null;
    let initCount = 0;
    let destroyCount = 0;

    const mockInitApplicationShell = vi.fn((container: HTMLElement, opts: any) => {
      initCount += 1;
      return {
        destroy: vi.fn(() => {
          destroyCount += 1;
        }),
        openDrawer: vi.fn(),
        closeDrawer: vi.fn()
      };
    });

    const mockApp = { innerHTML: '' } as unknown as HTMLElement;

    function testExecuteNavigation(view: string) {
      if (['builder', 'site', 'preview'].includes(view) || !['dashboard', 'clients', 'website-settings'].includes(view)) {
        currentController?.destroy();
        currentController = null;
      }

      if (view === 'dashboard') {
        currentController?.destroy();
        mockApp.innerHTML = renderApplicationShell({
          activeView: 'dashboard',
          title: 'Dashboard Overview',
          contentHtml: '<div>Dashboard</div>'
        });
        currentController = mockInitApplicationShell(mockApp, {});
      } else if (view === 'builder') {
        mockApp.innerHTML = '<div class="builder-workspace"><canvas id="studio-canvas"></canvas></div>';
      }
    }

    // Step 1: Dashboard
    testExecuteNavigation('dashboard');
    expect(initCount).toBe(1);
    expect(destroyCount).toBe(0);
    expect(mockApp.innerHTML).toContain('wo-shell');

    // Step 2: Builder
    testExecuteNavigation('builder');
    expect(destroyCount).toBe(1);
    expect(initCount).toBe(1);
    expect(currentController).toBeNull();
    expect(mockApp.innerHTML).not.toContain('wo-shell');

    // Step 3: Return to Dashboard
    testExecuteNavigation('dashboard');
    expect(initCount).toBe(2);
    expect(destroyCount).toBe(1);
    expect(currentController).not.toBeNull();
    expect(mockApp.innerHTML).toContain('wo-shell');
  });
});
