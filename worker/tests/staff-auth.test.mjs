import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../src/index.js';

const env = { ORDER_FORM_ACTION_TOKEN: btoa('1234'), ORDER_FORM_SESSION_SECRET: 'fixture-session-secret' };
const ip = { 'CF-Connecting-IP': '203.0.113.9' };

const login = (pin, e = env) => worker.fetch(new Request('https://w.test/api/auth/login', {
  method: 'POST', headers: { ...ip, 'content-type': 'application/json' }, body: JSON.stringify({ pin })
}), e);
const verify = (token, e = env) => worker.fetch(new Request('https://w.test/api/auth/verify', {
  headers: { ...ip, ...(token ? { 'x-order-form-auth': token } : {}) }
}), e).then(r => r.json());

test('wrong PIN is refused without a token', async () => {
  const res = await login('0000');
  assert.equal(res.status, 401);
  assert.equal((await res.json()).token, undefined);
});

test('right PIN returns a 30-day session token that verifies', async () => {
  const res = await login('1234');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.token, /^v1\.\d+\./);
  assert.ok(body.expiresAt - Date.now() > 29 * 24 * 3600 * 1000);
  assert.deepEqual(await verify(body.token), { ok: true });
});

test('tampered, expired, missing and foreign-secret tokens do not verify', async () => {
  const { token } = await (await login('1234')).json();
  const [, exp, sig] = token.split('.');
  assert.deepEqual(await verify(`v1.${Number(exp) + 1}.${sig}`), { ok: false });
  assert.deepEqual(await verify(`v1.${Date.now() - 1000}.${sig}`), { ok: false });
  assert.deepEqual(await verify(''), { ok: false });
  assert.deepEqual(await verify(token, { ...env, ORDER_FORM_SESSION_SECRET: 'other' }), { ok: false });
});

test('login fails closed without a session secret', async () => {
  assert.equal((await login('1234', { ORDER_FORM_ACTION_TOKEN: btoa('1234') })).status, 401);
});

test('rate limiter refuses attempts before checking the PIN', async () => {
  const keys = [];
  const LOGIN_LIMITER = { limit: async ({ key }) => { keys.push(key); return { success: false }; } };
  const res = await login('1234', { ...env, LOGIN_LIMITER });
  assert.equal(res.status, 429);
  assert.deepEqual(keys, ['login:203.0.113.9']);
});

test('the work IP verifies without a token', async () => {
  const res = await worker.fetch(new Request('https://w.test/api/auth/verify', { headers: { 'CF-Connecting-IP': '142.177.77.123' } }), env);
  assert.deepEqual(await res.json(), { ok: true });
});

const staffCall = (path, headers = {}, method = 'GET') =>
  worker.fetch(new Request(`https://w.test${path}`, { method, headers: { ...ip, ...headers } }), env);

test('staff routes refuse requests without the work IP or a session token', async () => {
  for (const [path, method] of [['/api/customers/search?q=a'], ['/api/products/search?q=a'], ['/api/dashboard/orders'],
    ['/api/dashboard/supplier-queue'], ['/api/dashboard/orders/1/email', 'POST'], ['/order-request', 'POST']]) {
    assert.equal((await staffCall(path, {}, method)).status, 401, path);
  }
});

test('the raw PIN token no longer opens staff routes; a session token does', async () => {
  assert.equal((await staffCall('/api/products/0/inventory-zero', { 'x-order-form-auth': btoa('1234') }, 'POST')).status, 401);
  const { token } = await (await login('1234')).json();
  const res = await staffCall('/api/products/0/inventory-zero', { 'x-order-form-auth': token }, 'POST');
  assert.deepEqual([res.status, (await res.json()).error], [400, 'Invalid variant id']);
});

test('health, IP check and login stay public', async () => {
  assert.equal((await staffCall('/health')).status, 200);
  assert.equal((await staffCall('/api/auth/check-ip')).status, 200);
  assert.equal((await login('0000')).status, 401);
});
