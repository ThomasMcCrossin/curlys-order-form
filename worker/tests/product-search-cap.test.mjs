import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../src/index.js';

const env = { SHOPIFY_STORE: 'fixture.invalid', SHOPIFY_ADMIN_TOKEN: 'fixture-only' };
const variant = (product, id) => ({ node: {
  legacyResourceId: String(id), barcode: String(id), sku: '', displayName: `V${id}`,
  price: '1', inventoryQuantity: 1,
  product: { id: `gid://${product}`, title: product, vendor: '', status: 'ACTIVE', featuredImage: null }
} });

async function searchWith(barcodeEdges, textEdges, titleEdges) {
  const priorFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).hostname, 'fixture.invalid');
    const { query } = JSON.parse(options.body);
    calls.push(query);
    const edges = query.includes('products(first:') ? titleEdges
      : query.includes('productVariants(first: 100') ? textEdges : barcodeEdges;
    const data = query.includes('products(first:') ? { products: { edges } } : { productVariants: { edges } };
    return new Response(JSON.stringify({ data }), { status: 200 });
  };
  try {
    const response = await worker.fetch(new Request('https://fixture.invalid/api/products/search?q=sample'), env);
    assert.equal(response.status, 200);
    return { products: (await response.json()).products, calls };
  } finally { globalThis.fetch = priorFetch; }
}

test('barcode matches retain variants but cap distinct parents at ten', async () => {
  const edges = [variant('P0', 1), variant('P0', 2),
    ...Array.from({ length: 11 }, (_, i) => variant(`P${i + 1}`, i + 3))];
  const { products, calls } = await searchWith(edges, [], []);
  assert.equal(new Set(products.map(p => p.productTitle)).size, 10);
  assert.equal(products.length, 11); // Both variants of the first parent remain.
  assert.equal(calls.length, 1);
});

test('variant-only text matches group variants and cap parents', async () => {
  const edges = [variant('P0', 1), variant('P0', 2),
    ...Array.from({ length: 11 }, (_, i) => variant(`P${i + 1}`, i + 3))];
  const { products, calls } = await searchWith([], edges, []);
  assert.equal(products.length, 10);
  assert.equal(products[0].variants.length, 2);
  assert.equal(calls.length, 2);
});

test('title fallback caps grouped parents and retains their variants', async () => {
  const edges = Array.from({ length: 12 }, (_, i) => ({ node: {
    id: `gid://P${i}`, title: `P${i}`, vendor: '', status: 'ACTIVE', featuredImage: null,
    variants: { edges: [
      { node: { legacyResourceId: `${i}a`, displayName: 'A', price: '1' } },
      { node: { legacyResourceId: `${i}b`, displayName: 'B', price: '1' } }
    ] }
  } }));
  const { products, calls } = await searchWith([], [], edges);
  assert.equal(products.length, 10);
  assert.ok(products.every(p => p.variants.length === 2));
  assert.equal(calls.length, 3);
});
