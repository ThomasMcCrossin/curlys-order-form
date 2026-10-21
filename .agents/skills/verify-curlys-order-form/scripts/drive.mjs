#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { expect } from 'playwright/test';
import { doctor, getRun } from './control.mjs';

const [path, feature, mode] = process.argv.slice(2);
assert(['contacts', 'products', 'submit', 'dashboard'].includes(feature), 'Usage: node drive.mjs RUN contacts|products|submit|dashboard --headless|--headed');
assert(['--headless', '--headed'].includes(mode), 'Choose --headless for non-interactive runs or --headed for local viewing');
await doctor(path);
const { run, manifest } = getRun(path);
const proof = join(run, feature);
assert(!existsSync(proof), 'Evidence already exists; launch a fresh run instead of overwriting it');
mkdirSync(proof);
const state = () => JSON.parse(readFileSync(join(run, 'fixture-state.json')));
assert.equal(state().drafts.length, 2, 'Recipe requires a fresh seeded instance');
const steps = [];
const errors = [];
const network = [];
let browser, context, page;
const save = (file, value) => writeFileSync(join(proof, file), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
async function step(action, fn) {
  const entry = { action, status: 'started' }; steps.push(entry); save('steps.json', steps);
  await fn(); entry.status = 'passed'; save('steps.json', steps);
}
async function snapshot(name) {
  await page.screenshot({ path: join(proof, `${name}.png`), fullPage: true, animations: 'disabled' });
  save(`${name}.aria.txt`, await page.locator('body').ariaSnapshot());
}
async function selectCustomer(name) {
  await page.getByLabel('Search Customer', { exact: true }).fill(name);
  await page.locator('#customerResults .autocomplete-item').filter({ hasText: `${name} Verify` }).click();
  await expect(page.locator('#selectedCustomerName')).toHaveText(`${name} Verify`);
}
async function searchDashboard(query) {
  await page.locator('#searchBox').fill(query);
  // This shipped field filters on keyup, not input.
  await page.locator('#searchBox').press('End');
}
async function customItem() {
  await page.getByRole('button', { name: '+ Add Custom Item', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Verify Bottle');
  await page.getByLabel('Price', { exact: true }).fill('7.50');
  await page.getByLabel('Quantity', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Add Custom Item', exact: true }).click();
  await expect(page.locator('#totalAmount')).toHaveText('$15.00');
}
async function contacts() {
  await step('Search and select email-only Avery; no missing-phone prompt', async () => {
    await selectCustomer('Avery');
    await expect(page.locator('#emailSection')).toBeHidden();
    await expect(page.locator('#missingEmailPrompt')).toBeHidden();
    await snapshot('avery');
  });
  await step('Change customer; explicitly open Add email for Nora', async () => {
    await page.getByRole('button', { name: 'Change', exact: true }).click();
    await selectCustomer('Nora');
    await expect(page.locator('#emailSection')).toBeHidden();
    await page.getByRole('button', { name: 'Add email', exact: true }).click();
    await expect(page.locator('#customerEmailInput')).toBeFocused();
    await page.getByLabel('Customer Email', { exact: false }).fill('nora@example.invalid');
    await snapshot('nora-email');
  });
  await step('Sam refuses email; submit reveals required phone; valid phone reaches item validation', async () => {
    await page.getByRole('button', { name: 'Change', exact: true }).click();
    await selectCustomer('Sam');
    await page.getByRole('button', { name: 'Create Draft Order', exact: true }).click();
    await expect(page.locator('#emailErrorNote')).toBeVisible();
    await page.locator('#emailRefusedCheckbox').check();
    await page.getByRole('button', { name: 'Create Draft Order', exact: true }).click();
    await expect(page.locator('#phoneErrorNote')).toContainText('required');
    await page.getByLabel('Customer Phone Number', { exact: true }).fill('9025550101');
    await page.getByRole('button', { name: 'Create Draft Order', exact: true }).click();
    await expect(page.locator('#errorText')).toHaveText('Please add at least one item to the order');
    await snapshot('refused-email');
  });
  await step('Manual entry has the same email/refused-phone gates', async () => {
    await page.getByRole('button', { name: 'Change', exact: true }).click();
    await page.getByRole('button', { name: 'Or enter customer details manually', exact: true }).click();
    await page.getByRole('button', { name: 'Create Draft Order', exact: true }).click();
    await expect(page.locator('#manualEmailErrorNote')).toBeVisible();
    await page.locator('#manualEmailRefusedCheckbox').check();
    await page.getByRole('button', { name: 'Create Draft Order', exact: true }).click();
    await expect(page.locator('#manualPhoneErrorNote')).toContainText('required');
    await page.getByLabel('Phone', { exact: true }).fill('9025550102');
    await page.getByRole('button', { name: 'Create Draft Order', exact: true }).click();
    await expect(page.locator('#errorText')).toHaveText('Please add at least one item to the order');
    await snapshot('manual-gates');
  });
}
async function products() {
  await step('Search text, expand grouped variants, choose Chocolate', async () => {
    await page.getByLabel('Search Products', { exact: true }).fill('protein');
    await page.locator('.product-header').filter({ hasText: 'Verify Protein' }).click();
    await snapshot('expanded-variants');
    await page.locator('.variant-item').filter({ hasText: 'Chocolate' }).click();
    await expect(page.locator('#lineItemsList')).toContainText('Chocolate');
    await expect(page.locator('#totalAmount')).toHaveText('$12.50');
  });
  await step('Change line quantity to 3, then remove it', async () => {
    await page.locator('.line-item-quantity').fill('3');
    await page.locator('.line-item-quantity').press('Tab');
    await expect(page.locator('#totalAmount')).toHaveText('$37.50');
    await snapshot('quantity');
    await page.getByTitle('Remove', { exact: true }).click();
    await expect(page.locator('#emptyLineItems')).toBeVisible();
  });
  await step('Barcode entry selects a standalone variant', async () => {
    await page.getByLabel('Search Products', { exact: true }).fill('9900000000201');
    await page.locator('#productResults .autocomplete-item').filter({ hasText: 'Chocolate' }).click();
    await expect(page.locator('#totalAmount')).toHaveText('$12.50');
    await snapshot('barcode');
    await page.getByTitle('Remove', { exact: true }).click();
  });
  await step('SKU entry selects the same standalone variant', async () => {
    await page.getByLabel('Search Products', { exact: true }).fill('VERIFY-201');
    await page.locator('#productResults .autocomplete-item').filter({ hasText: 'Chocolate' }).click();
    await expect(page.locator('#totalAmount')).toHaveText('$12.50');
    await snapshot('sku');
    await page.getByTitle('Remove', { exact: true }).click();
  });
  await step('Custom item editor adds two items at $7.50', async () => { await customItem(); await snapshot('custom'); });
  await step('No-match search is explicit, Escape closes results', async () => {
    await page.getByLabel('Search Products', { exact: true }).fill('volcano');
    await expect(page.locator('#productResults')).toHaveText('No products found');
    await page.getByLabel('Search Products', { exact: true }).press('Escape');
    await expect(page.locator('#productResults')).toBeHidden();
  });
}
async function submit() {
  await step('Select Nora, add email, custom items and a note', async () => {
    await selectCustomer('Nora');
    await page.getByRole('button', { name: 'Add email', exact: true }).click();
    await page.getByLabel('Customer Email', { exact: false }).fill('nora@example.invalid');
    await customItem();
    await page.getByPlaceholder('Add any special instructions or notes...').fill('Verification only: two bottles');
    await snapshot('before-submit');
  });
  await step('Create draft; verify Worker writes and synthetic notification', async () => {
    await page.getByRole('button', { name: 'Create Draft Order', exact: true }).click();
    await expect(page.locator('#successText')).toContainText('#V402');
    const s = state();
    assert.equal(s.customers.find(c => c.id === 102).email, 'nora@example.invalid');
    assert.equal(s.drafts.length, 3);
    assert.equal(s.drafts[2].customer.id, 102);
    assert.deepEqual(s.drafts[2].line_items, [{ title: 'Verify Bottle', price: '7.50', quantity: 2, taxable: true, custom: true }]);
    assert.equal(s.drafts[2].note, 'Verification only: two bottles');
    assert.equal(s.messages.length, 1);
    assert.equal(s.messages[0].to, 'nora@example.invalid');
    assert(s.messages[0].html.includes('Verify Bottle'));
    await snapshot('selected-success');
  });
  await step('Create Another Order resets form; manual customer submits a second draft', async () => {
    await page.getByRole('button', { name: 'Create Another Order', exact: true }).click();
    await expect(page.locator('#emptyLineItems')).toBeVisible();
    await expect(page.locator('#customerSearch')).toBeFocused();
    await page.getByRole('button', { name: 'Or enter customer details manually', exact: true }).click();
    await page.getByLabel('First Name', { exact: true }).fill('Morgan');
    await page.getByLabel('Last Name', { exact: true }).fill('Verify');
    await page.getByLabel('Email *', { exact: true }).fill('morgan@example.invalid');
    await customItem();
    await page.getByRole('button', { name: 'Create Draft Order', exact: true }).click();
    await expect(page.locator('#successText')).toContainText('#V403');
    assert.equal(state().drafts.length, 4);
    assert.equal(state().messages.length, 2);
    assert.equal(state().messages[1].to, 'morgan@example.invalid');
    await snapshot('manual-success');
  });
  await step('Open dashboard as a second user-facing view; search each persisted draft', async () => {
    await page.goto(`${manifest.url}/dashboard.html`);
    await expect(page.locator('[data-order-id="402"]')).toContainText('Verification only: two bottles');
    await searchDashboard('#V402');
    await expect(page.locator('.order-card')).toHaveCount(1);
    await expect(page.locator('.order-card')).toContainText('Nora Verify');
    await snapshot('dashboard-selected-readback');
    await searchDashboard('#V403');
    await expect(page.locator('.order-card')).toHaveCount(1);
    await expect(page.locator('.order-card')).toContainText('Morgan Verify');
    await snapshot('dashboard-manual-readback');
  });
}
async function dashboard() {
  await step('Pending and Ready tabs show separate seeded drafts', async () => {
    await expect(page.locator('[data-order-id="301"]')).toBeVisible();
    await expect(page.locator('.order-card')).toHaveCount(1);
    await page.locator('[data-tab="ready"]').click();
    await expect(page.locator('[data-order-id="302"]')).toBeVisible();
    await snapshot('ready');
  });
  await step('Saved ready-order note is readable above products without email, on desktop and phone', async () => {
    const card = page.locator('[data-order-id="302"]');
    const note = card.locator('.note-text');
    await expect(card).toContainText('No email');
    await expect(note).toHaveText('Held for Nora\nKeep <sealed> & call on pickup');
    await expect(note).toHaveCSS('white-space', 'pre-wrap');
    await expect(card.locator('.inline-note').getByRole('button', { name: 'Edit Note', exact: true })).toBeVisible();
    assert.equal(await note.locator('*').count(), 0, 'Note text must not become HTML');
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await note.scrollIntoViewIfNeeded();
      const noteBox = await card.locator('.inline-note').boundingBox();
      const itemsBox = await card.locator('.items-list').boundingBox();
      assert(noteBox.y + noteBox.height <= itemsBox.y, 'Note must precede products');
      assert(noteBox.x >= 0 && noteBox.x + noteBox.width <= width, 'Note must fit the viewport');
      await snapshot(`ready-note-${width}`);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
  });
  await step('Custom and All tabs; focus via metric and dropdown; sorting', async () => {
    await page.locator('[data-tab="custom"]').click();
    await expect(page.locator('[data-order-id="301"]')).toBeVisible();
    await page.locator('[data-tab="all"]').click();
    await expect(page.locator('.order-card')).toHaveCount(2);
    await page.locator('[data-focus-filter="critical"]').click();
    await expect(page.locator('.order-card')).toHaveCount(1);
    await expect(page.locator('#focusFilterSelect')).toHaveValue('critical');
    await page.locator('#focusFilterSelect').selectOption('all');
    await page.locator('#sortBySelect').selectOption('newest');
    await expect(page.locator('.order-card').first()).toHaveAttribute('data-order-id', '302');
    await snapshot('all');
  });
  await step('Search, empty result, clear query, then selection/clear', async () => {
    await searchDashboard('Avery');
    await expect(page.locator('.order-card')).toHaveCount(1);
    await searchDashboard('volcano');
    await expect(page.locator('#emptyState')).toBeVisible();
    await expect(page.locator('.order-card')).toHaveCount(0);
    await snapshot('empty-search');
    await searchDashboard('');
    await expect(page.locator('.order-card')).toHaveCount(2);
    await page.locator('[data-order-id="301"] .order-checkbox').click();
    await expect(page.locator('[data-order-id="301"]')).toHaveClass(/selected/);
    // The toolbar and floating bulk bar both expose Clear Selection.
    await page.getByRole('button', { name: /Clear Selection/ }).first().click();
    await expect(page.locator('.order-card.selected')).toHaveCount(0);
  });
  await step('Compact density survives reload within this disposable browser', async () => {
    await page.getByRole('button', { name: 'Compact', exact: true }).click();
    await page.reload();
    await expect(page.locator('body')).toHaveClass(/density-compact/);
    await expect(page.locator('[data-order-id="301"]')).toBeVisible();
    await snapshot('compact-reloaded');
    await page.locator('[data-tab="ready"]').click();
    await expect(page.locator('[data-order-id="302"] .note-text')).toHaveText('Held for Nora\nKeep <sealed> & call on pickup');
    await snapshot('compact-ready-note');
  });
}

try {
  browser = await chromium.launch({ headless: mode === '--headless', args: ['--disable-background-networking'] });
  context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const record = { method: request.method(), url: url.href };
    if (url.origin === manifest.url) {
      network.push({ ...record, outcome: 'local' }); return route.continue();
    }
    if (url.origin === manifest.workerOrigin) {
      // Forward only to the owned local Worker, never fetch the original URL.
      const local = `${manifest.url}${url.pathname}${url.search}`;
      network.push({ ...record, outcome: 'redirected-to-local', target: local });
      const response = await context.request.fetch(local, {
        method: request.method(), data: request.postData() || undefined,
        headers: { 'content-type': 'application/json' }, maxRedirects: 0
      });
      return route.fulfill({ response });
    }
    network.push({ ...record, outcome: 'blocked' });
    return route.abort('blockedbyclient');
  });
  await context.routeWebSocket('**/*', socket => {
    errors.push(`Unexpected WebSocket: ${socket.url()}`); socket.close();
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => appendFileSync(join(proof, 'console.jsonl'), JSON.stringify({ type: message.type(), text: message.text() }) + '\n'));
  await page.goto(`${manifest.url}/${feature === 'dashboard' ? 'dashboard.html' : ''}`);
  await expect(page.locator(feature === 'dashboard' ? '#dashboard' : '#mainContent')).toBeVisible();
  await snapshot('initial');
  await ({ contacts, products, submit, dashboard }[feature])();
  await step('Audit side effects and blocked network, not just the rendered screen', async () => {
    assert.deepEqual(errors, []);
    const outbound = readFileSync(join(run, 'outbound.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert(outbound.every(c => c.outcome === 'stubbed'), 'Worker attempted an unsupported external call');
    const incoming = readFileSync(join(run, 'requests.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert(incoming.every(c => !c.blocked && c.status < 400), 'Unsupported/failed Worker route');
    assert(network.filter(c => c.outcome === 'blocked').every(c => new URL(c.url).hostname === 'fonts.googleapis.com'), 'Unexpected external browser traffic');
    if (feature !== 'submit') {
      assert.equal(state().drafts.length, 2);
      assert.equal(state().messages.length, 0);
      assert(!incoming.some(c => c.method !== 'GET'), 'Read-only journey submitted a mutation');
      assert(outbound.every(c => c.method === 'GET' || new URL(c.url).pathname.endsWith('/graphql.json') && !c.body.query.includes('mutation')));
    }
    save('state-readback.json', state());
  });
  save('result.json', { status: 'passed', feature, mode: manifest.mode, url: manifest.url, fingerprint: manifest.fingerprint, revision: manifest.revision });
  console.log(`PASS ${feature}: ${proof}`);
} catch (error) {
  if (page) await snapshot('failure').catch(() => {});
  save('result.json', { status: 'failed', feature, error: error.stack });
  console.error(error.stack); process.exitCode = 1;
} finally {
  save('network.json', network); save('page-errors.json', errors);
  if (context) await context.tracing.stop({ path: join(proof, 'trace.zip') }).catch(() => {});
  if (browser) await browser.close();
}
