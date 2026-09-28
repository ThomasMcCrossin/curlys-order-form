import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../src/index.js';

const baseEnv = { SHOPIFY_STORE: 'fixture.invalid', SHOPIFY_ADMIN_TOKEN: 'fixture-only', ORDER_FORM_ACTION_TOKEN: 'staff' };

// Route one worker request through a mocked Shopify; `respond` answers each captured call.
async function run(request, env, respond) {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const call = { url, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    return new Response(JSON.stringify(respond(call)), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const res = await worker.fetch(request, env);
    return { res, json: await res.json(), calls };
  } finally {
    globalThis.fetch = realFetch;
  }
}

const customerSearch = () => new Request('https://w.test/api/customers/search?q=nora');

test('every Shopify call defaults to Admin API 2026-07', async () => {
  const { calls } = await run(customerSearch(), baseEnv, () => ({ customers: [] }));
  assert.ok(calls.length > 0);
  for (const c of calls) assert.match(c.url.pathname, /^\/admin\/api\/2026-07\//);
});

test('SHOPIFY_API_VERSION overrides the default', async () => {
  const { calls } = await run(customerSearch(), { ...baseEnv, SHOPIFY_API_VERSION: '2026-10' }, () => ({ customers: [] }));
  for (const c of calls) assert.match(c.url.pathname, /^\/admin\/api\/2026-10\//);
});

test('product search reads thumbnails from featuredMedia', async () => {
  const product = {
    id: 'gid://shopify/Product/1', title: 'Whey Protein', vendor: 'Brand', status: 'ACTIVE',
    featuredMedia: { preview: { image: { url: 'https://cdn.test/whey.png' } } },
    variants: { edges: [{ node: { legacyResourceId: '11', barcode: '', sku: '', title: 'Default', displayName: 'Whey', price: '1', inventoryQuantity: 1 } }] }
  };
  const { json, calls } = await run(new Request('https://w.test/api/products/search?q=whey'), baseEnv, c => {
    const q = c.body?.query || '';
    assert.doesNotMatch(q, /featuredImage/);
    return { data: q.includes('productVariants') ? { productVariants: { edges: [] } } : { products: { edges: [{ node: product }] } } };
  });
  assert.ok(calls.some(c => /featuredMedia/.test(c.body?.query || '')));
  assert.equal(JSON.stringify(json).includes('https://cdn.test/whey.png'), true);
});

test('inventory zero uses changeFromQuantity with an idempotency key', async () => {
  const snapshot = {
    productVariant: {
      legacyResourceId: '11', displayName: 'Whey', inventoryQuantity: 3, product: { title: 'Whey' },
      inventoryItem: {
        id: 'gid://shopify/InventoryItem/5', legacyResourceId: '5', tracked: true,
        inventoryLevels: { edges: [{ node: { location: { id: 'gid://shopify/Location/9', name: 'Store' }, quantities: [{ name: 'available', quantity: 3 }] } }] }
      }
    }
  };
  const request = new Request('https://w.test/api/products/11/inventory-zero', { method: 'POST', headers: { 'x-order-form-auth': 'staff' } });
  const { res, calls } = await run(request, baseEnv, c => (/inventorySetQuantities/.test(c.body.query)
    ? { data: { inventorySetQuantities: { inventoryAdjustmentGroup: { reason: 'correction', changes: [] }, userErrors: [] } } }
    : { data: snapshot }));
  assert.equal(res.status, 200);
  const mutation = calls.find(c => /inventorySetQuantities/.test(c.body.query)).body;
  assert.match(mutation.query, /@idempotent\(key: \$idempotencyKey\)/);
  assert.ok(mutation.variables.idempotencyKey);
  assert.deepEqual(mutation.variables.input.quantities, [{
    inventoryItemId: 'gid://shopify/InventoryItem/5', locationId: 'gid://shopify/Location/9', quantity: 0, changeFromQuantity: 3
  }]);
});
