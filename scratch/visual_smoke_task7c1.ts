import { strict as assert } from 'node:assert';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { chromium, type Page } from '@playwright/test';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const screenshotDirectory = resolve(repositoryRoot, 'scratch/screenshots/phase1c_task7c1');
const port = 4187;
const baseUrl = `http://127.0.0.1:${port}`;

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 }
] as const;

const dashboardStates = [
  { name: 'populated', query: 'normal', expected: 'ready' },
  { name: 'empty', query: 'empty', expected: 'ready' },
  { name: 'loading', query: 'loading', expected: 'loading' }
] as const;

function startVite(): ChildProcess {
  return spawn(
    process.execPath,
    [resolve(repositoryRoot, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        VITE_ENABLE_BROWSER_FIXTURES: 'true',
        VITE_BROWSER_FIXTURE_ZERO_WEBSITE: 'false',
        VITE_BUILDER_PUBLICATION_PERSISTENCE: 'local',
        VITE_BUILDER_MEDIA_PERSISTENCE: 'local'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );
}

async function waitForServer(server: ChildProcess): Promise<void> {
  const deadline = Date.now() + 30_000;
  let lastError = 'server did not respond';
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited before readiness with code ${server.exitCode}.`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise(resolveWait => setTimeout(resolveWait, 150));
  }
  throw new Error(`Timed out waiting for Vite: ${lastError}`);
}

async function shellDiagnostics(page: Page) {
  return await page.evaluate(`(() => {
    const visible = element => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const documentOverflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth;
    const main = document.querySelector('.wo-shell-main');
    const topbar = document.querySelector('.wo-shell-topbar');
    const addLead = document.querySelector('.wo-shell-topbar-actions .wo-dashboard-action');
    const topbarRect = topbar?.getBoundingClientRect();
    const addLeadRect = addLead?.getBoundingClientRect();
    const mainOverflow = main ? main.scrollWidth - main.clientWidth : 0;
    const offenders = [...document.querySelectorAll('body *')]
      .filter(element => {
        if (!visible(element)) return false;
        const rect = element.getBoundingClientRect();
        return rect.right > window.innerWidth + 1 || rect.left < -1;
      })
      .slice(0, 8)
      .map(element => ({
        tag: element.tagName,
        className: element.className,
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right)
      }));

    return {
      shell: document.querySelectorAll('.wo-shell').length,
      shellMain: document.querySelectorAll('.wo-shell-main').length,
      main: document.querySelectorAll('main').length,
      legacySidebar: document.querySelectorAll('.sidebar').length,
      h1: document.querySelectorAll('h1').length,
      topbar: document.querySelectorAll('.wo-shell-topbar').length,
      topbarVisible: visible(topbar),
      topbarTop: topbarRect?.top ?? Number.POSITIVE_INFINITY,
      topbarBottom: topbarRect?.bottom ?? Number.NEGATIVE_INFINITY,
      viewportHeight: window.innerHeight,
      addLeadVisible: visible(addLead),
      addLeadTop: addLeadRect?.top ?? Number.POSITIVE_INFINITY,
      addLeadBottom: addLeadRect?.bottom ?? Number.NEGATIVE_INFINITY,
      sidebarVisible: visible(document.querySelector('.wo-shell-sidebar')),
      menuVisible: visible(document.querySelector('[data-shell-drawer-toggle]')),
      documentOverflow,
      mainOverflow,
      offenders
    };
  })()`);
}

async function assertOrdinaryShell(page: Page, width: number, label: string, requireDashboardMain = false): Promise<void> {
  const diagnostics = await shellDiagnostics(page);
  assert.equal(diagnostics.shell, 1, `${label}: expected exactly one .wo-shell`);
  assert.equal(diagnostics.shellMain, 1, `${label}: expected exactly one .wo-shell-main`);
  assert.equal(diagnostics.main, 1, `${label}: expected exactly one main landmark`);
  assert.equal(diagnostics.legacySidebar, 0, `${label}: legacy .sidebar must be absent`);
  assert.equal(diagnostics.h1, 1, `${label}: shell must own exactly one h1`);
  assert.equal(diagnostics.topbar, 1, `${label}: expected exactly one shell topbar`);
  assert.equal(diagnostics.topbarVisible, true, `${label}: shell topbar should be visible`);
  assert.ok(
    diagnostics.topbarTop < diagnostics.viewportHeight && diagnostics.topbarBottom > 0,
    `${label}: shell topbar should intersect the viewport`
  );
  assert.ok(
    diagnostics.documentOverflow <= 1,
    `${label}: document overflowed by ${diagnostics.documentOverflow}px; ${JSON.stringify(diagnostics.offenders)}`
  );
  if (requireDashboardMain) {
    assert.equal(diagnostics.addLeadVisible, true, `${label}: Dashboard Add lead action should be visible`);
    assert.ok(
      diagnostics.addLeadTop >= 0 && diagnostics.addLeadBottom <= diagnostics.viewportHeight,
      `${label}: Dashboard Add lead action should be fully inside the viewport`
    );
    assert.ok(
      diagnostics.mainOverflow <= 1,
      `${label}: Dashboard main overflowed by ${diagnostics.mainOverflow}px; ${JSON.stringify(diagnostics.offenders)}`
    );
  }
  if (width >= 1024) {
    assert.equal(diagnostics.sidebarVisible, true, `${label}: desktop sidebar should be visible`);
    assert.equal(diagnostics.menuVisible, false, `${label}: desktop menu trigger should be hidden`);
  } else {
    assert.equal(diagnostics.sidebarVisible, false, `${label}: tablet/mobile sidebar should be hidden`);
    assert.equal(diagnostics.menuVisible, true, `${label}: tablet/mobile menu trigger should be visible`);
  }
}

async function captureDashboardStates(browser: Awaited<ReturnType<typeof chromium.launch>>): Promise<number> {
  let screenshotCount = 0;
  for (const viewport of viewports) {
    for (const state of dashboardStates) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      await context.addInitScript({ content: "window.localStorage.setItem('onboarding_seen', 'true');" });
      const page = await context.newPage();
      await page.route('**/favicon.ico', route => route.fulfill({ status: 204, body: '' }));
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error') errors.push(`${message.text()} @ ${message.location().url || 'unknown'}`);
      });

      const url = `${baseUrl}/?dashboardState=${state.query}#/dashboard`;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.locator(`.wo-dashboard[data-dashboard-state="${state.expected}"]`).waitFor();
      await page.evaluate(`(() => {
        document.querySelector('.wo-shell-main')?.scrollTo({ top: 0, behavior: 'instant' });
        window.scrollTo({ top: 0, behavior: 'instant' });
      })()`);
      await assertOrdinaryShell(page, viewport.width, `${state.name} ${viewport.name}`, true);
      assert.equal(errors.length, 0, `${state.name} ${viewport.name}: browser errors: ${errors.join(' | ')}`);

      const screenshotPath = resolve(
        screenshotDirectory,
        `dashboard-${state.name}-${viewport.width}x${viewport.height}.png`
      );
      await page.screenshot({ path: screenshotPath, fullPage: false });
      screenshotCount += 1;

      if (state.name === 'populated' || (state.name === 'empty' && viewport.width < 1024)) {
        const lowerRegion = page.locator('[data-dashboard-region="activity-lead-flow"]');
        await lowerRegion.scrollIntoViewIfNeeded();
        await page.waitForTimeout(100);
        const lowerDiagnostics = await page.evaluate(`(() => {
          const main = document.querySelector('.wo-shell-main');
          const region = document.querySelector('[data-dashboard-region="activity-lead-flow"]');
          const rect = region?.getBoundingClientRect();
          return {
            mainScrollTop: main?.scrollTop ?? 0,
            windowScrollY: window.scrollY,
            regionTop: rect?.top ?? Number.POSITIVE_INFINITY,
            regionBottom: rect?.bottom ?? Number.NEGATIVE_INFINITY,
            viewportHeight: window.innerHeight
          };
        })()`);
        assert.ok(
          lowerDiagnostics.mainScrollTop > 0 || lowerDiagnostics.windowScrollY > 0,
          `${state.name} ${viewport.name} lower: expected a non-zero scroll offset`
        );
        assert.ok(
          lowerDiagnostics.regionTop < lowerDiagnostics.viewportHeight && lowerDiagnostics.regionBottom > 0,
          `${state.name} ${viewport.name} lower: activity/lead-flow region is not visible`
        );
        await assertOrdinaryShell(page, viewport.width, `${state.name} ${viewport.name} lower`, true);
        await page.screenshot({
          path: resolve(
            screenshotDirectory,
            `dashboard-${state.name}-${viewport.width}x${viewport.height}-lower.png`
          ),
          fullPage: false
        });
        screenshotCount += 1;
      }

      await context.close();
    }
  }
  return screenshotCount;
}

async function smokeOrdinaryRoute(
  page: Page,
  width: number,
  route: string,
  selector: string,
  label: string
): Promise<void> {
  await page.goto(`${baseUrl}/${route}`, { waitUntil: 'networkidle' });
  await page.locator(selector).first().waitFor();
  await assertOrdinaryShell(page, width, label);
}

async function smokeRegressionRoutes(browser: Awaited<ReturnType<typeof chromium.launch>>): Promise<number> {
  let assertionGroups = 0;
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    await context.addInitScript({ content: "window.localStorage.setItem('onboarding_seen', 'true');" });
    const page = await context.newPage();
    await page.route('**/favicon.ico', route => route.fulfill({ status: 204, body: '' }));
    const width = viewport.width;

    await smokeOrdinaryRoute(page, width, '#/clients', '.clients-table', `Clients ${viewport.name}`);
    assertionGroups += 1;
    await smokeOrdinaryRoute(page, width, '#/opportunities', '.kanban-board', `Opportunities ${viewport.name}`);
    assertionGroups += 1;
    await smokeOrdinaryRoute(page, width, '#/quotes', '.clients-table', `Quotes ${viewport.name}`);
    assertionGroups += 1;
    await smokeOrdinaryRoute(page, width, '#/website-dashboard', '.website-dashboard-identity', `Website Dashboard ${viewport.name}`);
    assertionGroups += 1;

    await page.goto(`${baseUrl}/#/builder?websiteId=ws-1&pageId=p3&action=edit`, { waitUntil: 'networkidle' });
    await page.locator('.pb-canvas-area').waitFor();
    const builder = await shellDiagnostics(page);
    assert.equal(builder.shell, 0, `Builder ${viewport.name}: Builder must remain shell-free`);
    assert.equal(builder.shellMain, 0, `Builder ${viewport.name}: Builder must have no shell main`);
    assert.equal(builder.main, 1, `Builder ${viewport.name}: expected one main landmark`);
    assert.equal(builder.legacySidebar, 0, `Builder ${viewport.name}: legacy .sidebar must be absent`);
    assert.ok(
      builder.documentOverflow <= 1,
      `Builder ${viewport.name}: document overflowed by ${builder.documentOverflow}px; ${JSON.stringify(builder.offenders)}`
    );
    assertionGroups += 1;
    await context.close();
  }
  return assertionGroups;
}

async function main(): Promise<void> {
  mkdirSync(screenshotDirectory, { recursive: true });
  const server = startVite();
  let serverOutput = '';
  server.stdout?.on('data', chunk => { serverOutput += String(chunk); });
  server.stderr?.on('data', chunk => { serverOutput += String(chunk); });

  try {
    await waitForServer(server);
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
      const screenshots = await captureDashboardStates(browser);
      const regressionGroups = await smokeRegressionRoutes(browser);
      console.log(`Task 7C.1 visual smoke PASS: ${screenshots} screenshots; ${regressionGroups} regression route/viewport groups.`);
      console.log(`Screenshots: ${screenshotDirectory}`);
    } finally {
      await browser.close();
    }
  } catch (error) {
    if (serverOutput.trim()) console.error(serverOutput.trim());
    throw error;
  } finally {
    server.kill();
  }
}

await main();
