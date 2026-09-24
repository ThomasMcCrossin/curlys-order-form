import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../src/index.js';

const env = { SHOPIFY_STORE: 'fixture.invalid', SHOPIFY_ADMIN_TOKEN: 'fixture-only' };

const product = (id, title, vendor = '', status = 'ACTIVE', variants = []) => ({
  node: {
    id: `gid://${id}`, title, vendor, status, featuredImage: null,
    variants: { edges: variants.map(node => ({ node })) }
  }
});
const variant = (parent, id, overrides = {}) => ({ node: {
  legacyResourceId: String(id), barcode: '', sku: '', title: '', displayName: `Option ${id}`,
  price: '1', inventoryQuantity: 1, ...overrides,
  product: parent.node
} });

// Classify each Shopify request by which retrieval source it represents. The mock is
// retrieval-aware so tests can assert per-source query syntax and per-source failures.
function detectSource(query, q) {
  if (query.includes('productVariants')) {
    return q.includes('barcode:') || q.includes('sku:') ? 'identifier' : 'variant';
  }
  if (q.includes('title:')) return 'title';
  if (q.includes('vendor:')) return 'vendor';
  return 'broad';
}

async function search(q, fixtures = {}) {
  const previousFetch = globalThis.fetch;
  const previousError = console.error;
  const failing = new Set([].concat(fixtures.failing || []));
  const calls = { identifier: [], title: [], vendor: [], variant: [], broad: [] };
  console.error = () => {};
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).hostname, 'fixture.invalid');
    const { query, variables } = JSON.parse(options.body);
    const source = detectSource(query, variables.q);
    calls[source].push(variables.q);
    if (failing.has(source)) {
      return new Response(JSON.stringify({ errors: [{ message: 'fixture failure' }] }), { status: 200 });
    }
    const edges = fixtures[source] || [];
    const data = query.includes('products(first:') ? { products: { edges } } : { productVariants: { edges } };
    return new Response(JSON.stringify({ data }), { status: 200 });
  };
  try {
    const response = await worker.fetch(
      new Request(`https://fixture.invalid/api/products/search?q=${encodeURIComponent(q)}`), env);
    assert.equal(response.status, 200);
    return { results: (await response.json()).products, calls };
  } finally {
    globalThis.fetch = previousFetch;
    console.error = previousError;
  }
}

test('title matches outrank vendor, variant and broad metadata regardless of source order or status', async () => {
  const title = product('title', 'Sample Bar', '', 'ARCHIVED');
  const vendor = product('vendor', 'Zzz', 'Sample', 'DRAFT');
  const option = product('option', 'Option');
  const meta = product('meta', 'Metadata');
  const { results, calls } = await search('sample', {
    title: [title],
    vendor: [vendor],
    variant: [variant(option, 5, { displayName: 'Sample flavour' })],
    broad: [meta]
  });
  assert.deepEqual(results.map(p => p.productTitle), ['Sample Bar', 'Zzz', 'Option', 'Metadata']);
  assert.ok(results.every(p => p.type === 'product'));
  // Text query: no dedicated identifier lookup, but all four text sources ran.
  assert.equal(calls.identifier.length, 0);
  assert.equal(calls.title.length, 1);
  assert.equal(calls.vendor.length, 1);
  assert.equal(calls.variant.length, 1);
  assert.equal(calls.broad.length, 1);
  assert.ok(calls.variant[0].includes('product_status:ACTIVE'));
});

test('identifier-shaped queries rank exact barcode/SKU above variant text and emit selectable variants', async () => {
  const exact = product('exact', 'Other');
  const option = product('option', 'Option');
  const meta = product('meta', 'Metadata');
  const { results, calls } = await search('12345', {
    identifier: [variant(exact, 1, { barcode: '12345' }), variant(exact, 2, { sku: '12345' })],
    variant: [variant(option, 5, { displayName: '12345 flavour' })],
    broad: [meta]
  });
  assert.deepEqual(results.map(r => r.type), ['variant', 'variant', 'product', 'product']);
  assert.deepEqual(results.slice(0, 2).map(r => r.variantId), ['1', '2']);
  assert.ok(results.slice(0, 2).every(r => !('productId' in r)));
  assert.equal(calls.identifier.length, 1);
  assert.ok(calls.identifier[0].includes('(barcode:"12345" OR sku:"12345")'));
});

test('identifier lookup is gated to identifier-shaped input only', async () => {
  const text = await search('sample', { title: [product('t', 'Sample')] });
  assert.equal(text.calls.identifier.length, 0);
  assert.equal(text.calls.title.length, 1);

  const alphaOnly = await search('wheyprotein', { title: [product('t', 'Wheyprotein')] });
  assert.equal(alphaOnly.calls.identifier.length, 0);

  const identifier = await search('ab-123', { identifier: [variant(product('p', 'P'), 7, { sku: 'AB-123' })] });
  assert.equal(identifier.calls.identifier.length, 1);
  assert.ok(identifier.calls.identifier[0].includes('barcode:"ab-123"'));
  assert.deepEqual(identifier.results.map(r => r.type), ['variant']);
});

test('vendor retrieval uses suffix-prefix token syntax and matches reordered terms', async () => {
  const vendor = product('v', 'Unrelated', 'Whey Protein');
  const { results, calls } = await search('protein whey', { vendor: [vendor] });
  assert.deepEqual(results.map(p => p.productTitle), ['Unrelated']);
  assert.equal(calls.vendor.length, 1);
  assert.ok(calls.vendor[0].includes('vendor:protein* AND vendor:whey*'));
  assert.ok(!calls.vendor[0].includes('vendor:*'));
});

test('punctuation is stripped and leading wildcards are never emitted', async () => {
  const { calls } = await search('  foo:*) OR status:ARCHIVED  ');
  assert.equal(calls.identifier.length, 0);
  const queries = [...calls.title, ...calls.vendor, ...calls.variant, ...calls.broad];
  assert.equal(queries.length, 4);
  for (const q of queries) {
    assert.ok(!q.includes('title:*'));
    assert.ok(!q.includes('vendor:*'));
  }
  assert.ok(calls.title[0].includes('(title:foo* AND title:or* AND title:status* AND title:archived*)'));
  // Broad text is unquoted and lowercased so a typed OR cannot act as a boolean operator.
  assert.ok(calls.broad[0].includes('(foo or status archived)'));
  assert.ok(!calls.broad[0].includes('"foo'));
});

test('broad retrieval is unquoted so a partial multi-token match is not lost to a phrase query', async () => {
  const meta = product('meta', 'Metadata');
  const { results, calls } = await search('whey chocolate', { broad: [meta] });
  assert.deepEqual(results.map(p => p.productTitle), ['Metadata']);
  assert.ok(calls.broad[0].includes('(whey chocolate)'));
  assert.ok(!calls.broad[0].includes('"whey'));
  assert.ok(calls.variant[0].includes('(whey chocolate)'));
});

test('saturation: twelve matching parents collapse to ten deterministic grouped parents', async () => {
  const parents = Array.from({ length: 12 }, (_, i) => product(`p${i}`, `Sample ${String(i).padStart(2, '0')}`));
  const { results } = await search('sample', { title: [...parents].reverse() });
  assert.equal(results.length, 10);
  assert.equal(new Set(results.map(p => p.productTitle)).size, 10);
  assert.deepEqual(results.map(p => p.productTitle), parents.slice(0, 10).map(p => p.node.title));
});

test('duplicate parents from multiple sources merge and their variants are grouped under the cap', async () => {
  const shared = product('shared', 'Sample');
  const others = Array.from({ length: 11 }, (_, i) => product(`q${i}`, `Sample ${String(i).padStart(2, '0')}`));
  const { results } = await search('sample', {
    title: [...others, shared],
    vendor: [shared],
    variant: [variant(shared, 2), variant(shared, 1), variant(shared, 1)]
  });
  assert.equal(results.length, 10);
  const grouped = results.find(r => r.productTitle === 'Sample');
  assert.ok(grouped);
  assert.deepEqual(grouped.variants.map(v => v.variantId), ['1', '2']);
});

test('status tie-breaks rank ties, and source order never changes the result', async () => {
  const active = product('a', 'Sample A', '', 'ACTIVE');
  const draft = product('b', 'Sample B', '', 'DRAFT');
  const archived = product('c', 'Sample C', '', 'ARCHIVED');
  const { results } = await search('sample', { title: [archived, draft, active] });
  assert.deepEqual(results.map(r => r.status), ['ACTIVE', 'DRAFT', 'ARCHIVED']);
  const { results: reversed } = await search('sample', { title: [active, draft, archived] });
  assert.deepEqual(reversed, results);
});

test('a title match keeps an exact-identifier variant selectable inside its grouped payload', async () => {
  const parent = product('p', '12345 Widget');
  const variants = Array.from({ length: 26 }, (_, i) => variant(parent, i + 1).node);
  const { results } = await search('12345', {
    title: [product('p', '12345 Widget', '', 'ACTIVE', variants)],
    identifier: [variant(parent, 99, { barcode: '12345' })]
  });
  assert.equal(results[0].type, 'product');
  assert.equal(results[0].variants.length, 25);
  assert.equal(results[0].variants[0].variantId, '99');
});

test('one failing source does not discard candidates found by the others', async () => {
  const { results } = await search('sample', {
    title: [product('t', 'Sample')],
    failing: ['vendor', 'broad', 'variant']
  });
  assert.deepEqual(results.map(p => p.productTitle), ['Sample']);
});

test('all text sources failing still returns a well-formed empty result', async () => {
  const { results } = await search('sample', { failing: ['title', 'vendor', 'broad', 'variant'] });
  assert.deepEqual(results, []);
});

test('queries shorter than two characters or without literal tokens issue no Shopify call', async () => {
  const short = await search(' a ');
  assert.deepEqual(short.results, []);
  assert.equal(Object.values(short.calls).flat().length, 0);
  const punctuation = await search('...');
  assert.deepEqual(punctuation.results, []);
  assert.equal(Object.values(punctuation.calls).flat().length, 0);
});
