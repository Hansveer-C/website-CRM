import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(fileURLToPath(new URL('./main.ts', import.meta.url)), 'utf8');

describe('production CRM hydration integration', () => {
  it('authenticates before hydration and covers every array-backed primary CRM view', () => {
    const authGate = mainSource.indexOf("if (authState.status === 'unauthenticated')");
    const hydration = mainSource.indexOf('await ensureProductionCrmData(authState.user.id, view)', authGate);
    expect(hydration).toBeGreaterThan(authGate);
    expect(mainSource).toContain("'dashboard', 'clients', 'contact-detail', 'opportunities', 'quotes', 'new-quote'");
    expect(mainSource).toContain("'quote-preview', 'invoices'");
  });

  it('clears hydrated tenant state with the protected runtime and exposes loading/error UI', () => {
    const clearStart = mainSource.indexOf('function clearProtectedRuntimeData');
    expect(mainSource.slice(clearStart, clearStart + 300)).toContain('crmProductionHydrator.clear()');
    expect(mainSource).toContain('Loading CRM data');
    expect(mainSource).toContain('Some CRM data could not be loaded.');
    expect(mainSource).toContain('retry before relying on empty results.');
  });

  it('awaits asynchronous CRM renderers before adding the hydration result notice', () => {
    expect(mainSource).toContain("case 'clients': await renderClients(); break;");
    expect(mainSource).toContain("case 'contact-detail': if (id) await renderContactDetail(id); break;");
  });
});
