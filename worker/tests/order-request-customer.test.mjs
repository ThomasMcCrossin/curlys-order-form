import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../src/index.js';

const env = { SHOPIFY_STORE: 'fixture.invalid', SHOPIFY_ADMIN_TOKEN: 'fixture-only' };

// Submit one order request against a mocked Shopify and record every Shopify call.
async function submit(customer, customers = {}, { failEmailPut = false } = {}) {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path: url.pathname.replace('/admin/api/2024-10', ''), search: url.search, body });
    const ok = obj => new Response(JSON.stringify(obj), { status: 200, headers: { 'content-type': 'application/json' } });
    const byId = url.pathname.match(/\/customers\/(\d+)\.json$/);
    if (byId) {
      if (method === 'PUT' && failEmailPut) return new Response('{"errors":"taken"}', { status: 422 });
      const found = customers[byId[1]];
      return found ? ok({ customer: { ...found } }) : new Response('{}', { status: 404 });
    }
    if (url.pathname.endsWith('/customers/search.json')) return ok({ customers: [] });
    if (url.pathname.endsWith('/customers.json')) return ok({ customer: { id: 999, ...body.customer } });
    if (url.pathname.endsWith('/draft_orders.json')) return ok({ draft_order: { id: 1, name: '#D1', line_items: [] } });
    if (url.pathname.endsWith('/graphql.json')) return ok({ data: { nodes: [] } });
    throw new Error(`unmocked ${method} ${url}`);
  };
  try {
    const res = await worker.fetch(new Request('https://w.test/order-request', {
      method: 'POST',
      body: JSON.stringify({ customer, items: [{ customTitle: 'Thing', customPrice: '5', quantity: 1 }] })
    }), env);
    return { status: res.status, json: await res.json(), calls };
  } finally {
    globalThis.fetch = realFetch;
  }
}

const phoneOnly = { 42: { id: 42, email: null, phone: '+19025550100', first_name: 'Nora' } };

test('selected phone-only customer gets the new email added, not a duplicate customer', async () => {
  const r = await submit({ id: 42, email: 'nora@example.com', phone: '+19025550100' }, phoneOnly);
  assert.equal(r.status, 200);
  const put = r.calls.find(c => c.method === 'PUT' && c.path === '/customers/42.json');
  assert.deepEqual(put.body, { customer: { id: 42, email: 'nora@example.com' } });
  assert.ok(!r.calls.some(c => c.method === 'POST' && c.path === '/customers.json'), 'no customer create');
  const draft = r.calls.find(c => c.path === '/draft_orders.json');
  assert.deepEqual(draft.body.draft_order.customer, { id: 42 });
});

test('selected customer who refused email attaches by id without edits', async () => {
  const r = await submit({ id: 42, email: '', phone: '+19025550100' }, phoneOnly);
  assert.equal(r.status, 200);
  assert.ok(!r.calls.some(c => c.method !== 'GET' && c.path.startsWith('/customers')), 'no customer writes');
  assert.deepEqual(r.calls.find(c => c.path === '/draft_orders.json').body.draft_order.customer, { id: 42 });
});

test('email add failure still creates the draft for the selected customer', async () => {
  const r = await submit({ id: 42, email: 'nora@example.com', phone: '+19025550100' }, phoneOnly, { failEmailPut: true });
  assert.equal(r.status, 200);
  assert.deepEqual(r.calls.find(c => c.path === '/draft_orders.json').body.draft_order.customer, { id: 42 });
});

test('existing email is never overwritten', async () => {
  const r = await submit({ id: 7, email: 'new@example.com' }, { 7: { id: 7, email: 'old@example.com' } });
  assert.equal(r.status, 200);
  assert.ok(!r.calls.some(c => c.method === 'PUT' && c.path === '/customers/7.json'));
});

test('manual entry without id keeps the email search-or-create path', async () => {
  const r = await submit({ email: 'mia@example.com', firstName: 'Mia' });
  assert.equal(r.status, 200);
  assert.ok(r.calls.some(c => c.path === '/customers/search.json'));
  assert.ok(r.calls.some(c => c.method === 'POST' && c.path === '/customers.json'));
});
