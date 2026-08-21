import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { escapeHtmlText, safeTelHref, safeNavHref } from './crm_html_output';

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter((candidate): candidate is string => !!candidate);

const chromeExecutable = process.env.CRM_XSS_DISABLE_BROWSER === '1'
  ? ''
  : chromeCandidates.find(existsSync) ?? '';

function inspectDom<T>(body: string, probe: string): T {
  const directory = mkdtempSync(join(tmpdir(), 'crm-xss-'));
  const file = join(directory, 'fixture.html');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>pending</title><script>window.__xss=0;</script></head><body>${body}<script>
    setTimeout(() => {
      const result = (${probe});
      document.title = btoa(unescape(encodeURIComponent(JSON.stringify(result))));
    }, 50);
  </script></body></html>`;
  try {
    writeFileSync(file, html, 'utf8');
    const dumped = execFileSync(chromeExecutable, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
      `--user-data-dir=${join(directory, 'profile')}`,
      '--virtual-time-budget=500', '--dump-dom', pathToFileURL(file).href
    ], { encoding: 'utf8', timeout: 30_000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    const encoded = dumped.match(/<title>([^<]+)<\/title>/)?.[1];
    if (!encoded || encoded === 'pending') throw new Error('Chromium DOM security probe did not complete.');
    return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as T;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('authenticated CRM stored-XSS deterministic output encoding', () => {
  it('encodes malicious HTML and every syntax-significant character', () => {
    const payload = '<img src=x onerror="window.__xss=1">';
    const encoded = escapeHtmlText(payload);

    expect(encoded).toBe('&lt;img src=x onerror=&quot;window.__xss=1&quot;&gt;');
    expect(encoded).not.toContain('<img');
    expect(escapeHtmlText('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('preserves canonical values and deterministically encodes legitimate punctuation at each render', () => {
    const contact = {
      name: 'O\'Brien & Sons <Pressure Washing>',
      source: 'A&B Exterior Cleaning',
      address: 'Hans "Test" User'
    };
    const canonicalBefore = structuredClone(contact);
    const render = () => `<h1>${escapeHtmlText(contact.name)}</h1><p>${escapeHtmlText(contact.source)}</p><address>${escapeHtmlText(contact.address)}</address>`;
    const first = render();

    expect(first).toBe('<h1>O&#39;Brien &amp; Sons &lt;Pressure Washing&gt;</h1><p>A&amp;B Exterior Cleaning</p><address>Hans &quot;Test&quot; User</address>');
    expect(render()).toBe(first);
    expect(contact).toEqual(canonicalBefore);
  });

  it('creates valid telephone links and rejects hostile schemes or attribute injection', () => {
    expect(safeTelHref('+1 (604) 555-0198')).toBe('tel:+16045550198');
    for (const hostile of [
      'javascript:alert(1)',
      '" onmouseover="window.__xss=1',
      'tel:+16045550198" onclick="window.__xss=1'
    ]) {
      expect(safeTelHref(hostile)).toBeNull();
    }
  });
});

describe.skipIf(!chromeExecutable)('authenticated CRM stored-XSS browser probes', () => {
  it('public lead contact fields cannot execute stored HTML in authenticated CRM', () => {
    const payloads = [
      '<img src=x onerror="window.__xss=1">',
      '<svg onload="window.__xss=1"></svg>',
      '"><img src=x onerror="window.__xss=1">',
      '<script>window.__xss=1</script>',
      'javascript:alert(1)',
      'A&B <tag> "double" \'single\''
    ];
    const body = payloads.map((payload, index) => `<div data-contact="${index}">${escapeHtmlText(payload)}</div>`).join('');
    const result = inspectDom<{ texts: string[]; nodes: number; handlers: number; xss: number }>(body, `({
      texts: Array.from(document.querySelectorAll('[data-contact]')).map(node => node.textContent),
      nodes: document.querySelectorAll('img,svg,script:not(:last-child)').length,
      handlers: document.querySelectorAll('[onerror],[onload]').length,
      xss: window.__xss
    })`);
    expect(result.texts).toEqual(payloads);
    expect(result.nodes).toBe(0);
    expect(result.handlers).toBe(0);
    expect(result.xss).toBe(0);
  });

  it('renders contact email, phone, address, and quote-breaking values as literal DOM values', () => {
    const email = '"><img src=x onerror="window.__xss=1">@example.test';
    const phone = '" onfocus="window.__xss=1';
    const address = '<svg onload="window.__xss=1"></svg> & O\'Brien';
    const body = `
      <input id="email" value="${escapeHtmlText(email)}">
      <input id="phone" value="${escapeHtmlText(phone)}">
      <div id="address" title="${escapeHtmlText(address)}">${escapeHtmlText(address)}</div>`;
    const result = inspectDom<{ email: string; phone: string; address: string; title: string; nodes: number; handlers: number; xss: number }>(body, `({
      email: document.querySelector('#email').value,
      phone: document.querySelector('#phone').value,
      address: document.querySelector('#address').textContent,
      title: document.querySelector('#address').getAttribute('title'),
      nodes: document.querySelectorAll('img,svg').length,
      handlers: document.querySelectorAll('[onerror],[onload],[onfocus]').length,
      xss: window.__xss
    })`);
    expect(result).toEqual({ email, phone, address, title: address, nodes: 0, handlers: 0, xss: 0 });
  });

  it('protects Dashboard, Clients, Opportunity, Quote, and timeline text sinks', () => {
    const malicious = '<img src=x onerror="window.__xss=1">';
    const fields = {
      dashboardContact: malicious,
      clientName: malicious,
      opportunityNotes: `Message: ${malicious}`,
      quoteCustomer: malicious,
      quoteService: '<svg onload="window.__xss=1"></svg>',
      quoteNotes: '<script>window.__xss=1</script>',
      timelineMessage: `Received SMS: ${malicious}`
    };
    const body = Object.entries(fields).map(([name, value]) => `<div data-sink="${name}">${escapeHtmlText(value)}</div>`).join('');
    const result = inspectDom<{ fields: Record<string, string>; nodes: number; handlers: number; xss: number }>(body, `({
      fields: Object.fromEntries(Array.from(document.querySelectorAll('[data-sink]')).map(node => [node.dataset.sink, node.textContent])),
      nodes: document.querySelectorAll('img,svg,script:not(:last-child)').length,
      handlers: document.querySelectorAll('[onerror],[onload]').length,
      xss: window.__xss
    })`);
    expect(result.fields).toEqual(fields);
    expect(result.nodes).toBe(0);
    expect(result.handlers).toBe(0);
    expect(result.xss).toBe(0);
  });

  it('preserves legitimate punctuation and does not mutate or double-encode canonical data', () => {
    const contact = {
      name: 'O\'Brien & Sons <Pressure Washing>',
      source: 'A&B Exterior Cleaning',
      address: 'Hans "Test" User'
    };
    const canonicalBefore = structuredClone(contact);
    const render = () => `<h1>${escapeHtmlText(contact.name)}</h1><p>${escapeHtmlText(contact.source)}</p><address>${escapeHtmlText(contact.address)}</address>`;
    const first = render();
    const result = inspectDom<{ name: string; source: string; address: string }>(`${first}${render()}`, `({
      name: document.querySelector('h1').textContent,
      source: document.querySelector('p').textContent,
      address: document.querySelector('address').textContent
    })`);
    expect(result).toEqual(contact);
    expect(contact).toEqual(canonicalBefore);
    expect(render()).toBe(first);
    expect(result.name).not.toContain('&amp;');
  });

  it('creates only intended tel links and rejects hostile schemes or attribute injection', () => {
    expect(safeTelHref('+1 (604) 555-0198')).toBe('tel:+16045550198');
    for (const hostile of ['javascript:alert(1)', '" onmouseover="window.__xss=1', 'tel:+16045550198" onclick="window.__xss=1']) {
      expect(safeTelHref(hostile)).toBeNull();
    }
    const href = safeTelHref('+1 (604) 555-0198')!;
    const result = inspectDom<{ href: string; attributes: string[]; handlers: number }>(`<a id="call" href="${escapeHtmlText(href)}">Call</a>`, `({
      href: document.querySelector('#call').getAttribute('href'),
      attributes: Array.from(document.querySelector('#call').attributes).map(attribute => attribute.name),
      handlers: document.querySelectorAll('[onclick],[onmouseover],[onerror]').length
    })`);
    expect(result).toEqual({ href: 'tel:+16045550198', attributes: ['id', 'href'], handlers: 0 });
  });

  it('navigation labels and paths render inert text without executing scripts or injecting DOM elements', () => {
    const maliciousLabel = '"><img src=x onerror="window.__xss=1"><svg onload="window.__xss=1"></svg>Malicious';
    const maliciousPath = '"><script>window.__xss=1</script>';
    const safeHref = safeNavHref(maliciousPath);
    const body = `
      <header>
        <nav>
          <a href="${escapeHtmlText(safeHref)}"
             data-nav-path="${escapeHtmlText(maliciousPath)}"
             onclick="event.preventDefault(); window.navigateTo('site', this.getAttribute('data-nav-path'))">
             ${escapeHtmlText(maliciousLabel)}
          </a>
        </nav>
      </header>
    `;
    const result = inspectDom<{ linkText: string; href: string; nodes: number; handlers: number; xss: number }>(body, `({
      linkText: document.querySelector('a').textContent.trim(),
      href: document.querySelector('a').getAttribute('href'),
      nodes: document.querySelectorAll('img,svg,script:not(:last-child)').length,
      handlers: document.querySelectorAll('[onerror],[onload]').length,
      xss: window.__xss
    })`);
    expect(result.linkText).toBe(maliciousLabel);
    expect(result.nodes).toBe(0);
    expect(result.handlers).toBe(0);
    expect(result.xss).toBe(0);
  });
});

describe('authenticated CRM sink wiring', () => {
  const main = readFileSync(fileURLToPath(new URL('./main.ts', import.meta.url)), 'utf8');
  const dashboardRenderer = readFileSync(fileURLToPath(new URL('./ui/dashboard/dashboard.ts', import.meta.url)), 'utf8');
  const contactsRenderer = readFileSync(fileURLToPath(new URL('./ui/contacts/contacts.ts', import.meta.url)), 'utf8');
  const opportunitiesRenderer = readFileSync(fileURLToPath(new URL('./ui/opportunities/opportunities.ts', import.meta.url)), 'utf8');
  const hydrator = readFileSync(fileURLToPath(new URL('./crm_production_hydration.ts', import.meta.url)), 'utf8');

  it('encodes every audited public or user-controlled CRM HTML sink at render time', () => {
    for (const renderedValue of [
      'item.service_name', 'item.description', 'quote.notes', 'item.content'
    ]) {
      expect(main).toContain(`escapeHtmlText(${renderedValue})`);
    }
    expect(dashboardRenderer).toContain('escapeHtmlText(row.description)');
    expect(opportunitiesRenderer).toContain("escapeHtmlText(opportunity.notes.replace(/\\n/g, ' '))");
    for (const renderedValue of ['contact.name', 'latest.description']) {
      expect(contactsRenderer).toContain(`escapeHtmlText(${renderedValue})`);
    }
    expect(contactsRenderer).toContain("escapeHtmlText(contact.source || 'Not recorded')");
    expect(contactsRenderer).toContain("escapeHtmlText(contact.address || 'Not recorded')");
    expect(contactsRenderer).toContain('escapeHtmlText(formatContactPhone(contact.phone))');
    expect(contactsRenderer).toContain('safeTelHref(contact.phone)');
    expect(main).toContain('messageText.textContent = message;');
    expect(main).not.toContain('<span>${message}</span>');
  });

  it('keeps canonical production hydration raw and free of output encoding', () => {
    expect(hydrator).not.toContain('escapeHtmlText');
    expect(hydrator).toContain('this.collections[result.name].push(...result.rows as never[])');
  });

  it('keeps local fixture persistence raw while applying encoding only at shared render sinks', () => {
    const localLead = main.slice(main.indexOf('function createLocalMockWebsiteLead'), main.indexOf('const handleInboundCall'));
    expect(localLead).not.toContain('escapeHtmlText');
    expect(localLead).toContain('name: body.name');
    expect(localLead).toContain('phone: body.phone');
  });
});
