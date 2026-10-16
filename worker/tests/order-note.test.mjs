import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../src/index.js';

const env = { SHOPIFY_STORE: 'fixture.invalid', SHOPIFY_ADMIN_TOKEN: 'fixture-only' };

// Drive the dashboard note route against a mocked Shopify and record every call.
async function saveNote(draftId, body, draft = {}) {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = init.method || 'GET';
    calls.push({
      method,
      path: url.pathname.replace(/^\/admin\/api\/[^/]+/, ''),
      body: init.body ? JSON.parse(init.body) : undefined
    });
    const ok = obj => new Response(JSON.stringify(obj), { status: 200, headers: { 'content-type': 'application/json' } });
    if (method === 'GET' && url.pathname.endsWith(`/draft_orders/${draftId}.json`)) {
      return ok({ draft_order: { id: Number(draftId), ...draft } });
    }
    if (method === 'PUT' && url.pathname.endsWith(`/draft_orders/${draftId}.json`)) {
      return ok({ draft_order: init.body ? JSON.parse(init.body).draft_order : {} });
    }
    throw new Error(`unmocked ${method} ${url}`);
  };
  try {
    const res = await worker.fetch(new Request(`https://w.test/api/dashboard/orders/${draftId}/note`, {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '142.177.77.123', 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }), env);
    return { status: res.status, json: await res.json(), calls };
  } finally {
    globalThis.fetch = realFetch;
  }
}

const legacyNote = {
  note: 'old draft note',
  note_attributes: [
    { name: 'Request Source', value: 'In-store order form' },
    { name: 'Note', value: 'stale attribute note' }
  ]
};

test('a saved note is written to the draft order note and the legacy Note attribute', async () => {
  const r = await saveNote(1, { note: '  Held for Bubba  ' }, legacyNote);

  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true, note: 'Held for Bubba' });

  const put = r.calls.find(c => c.method === 'PUT');
  assert.deepEqual(put, {
    method: 'PUT',
    path: '/draft_orders/1.json',
    body: {
      draft_order: {
        id: 1,
        note: 'Held for Bubba',
        note_attributes: [
          { name: 'Request Source', value: 'In-store order form' },
          { name: 'Note', value: 'Held for Bubba' }
        ]
      }
    }
  });
});

test('a blank note clears the draft note and drops the legacy Note attribute', async () => {
  const r = await saveNote(2, { note: '   ' }, legacyNote);

  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true, note: '' });

  const put = r.calls.find(c => c.method === 'PUT');
  assert.deepEqual(put.body.draft_order.note, '');
  assert.deepEqual(put.body.draft_order.note_attributes, [
    { name: 'Request Source', value: 'In-store order form' }
  ]);
});

test('a note over the length cap is refused without touching Shopify', async () => {
  const r = await saveNote(3, { note: 'x'.repeat(2001) }, legacyNote);

  assert.equal(r.status, 400);
  assert.equal(r.json.ok, false);
  assert.ok(!r.calls.some(c => c.method === 'PUT'), 'no Shopify write');
});

test('a non-text note is refused', async () => {
  const r = await saveNote(4, { note: { text: 'no' } });

  assert.equal(r.status, 400);
  assert.equal(r.json.ok, false);
  assert.equal(r.calls.length, 0);
});
