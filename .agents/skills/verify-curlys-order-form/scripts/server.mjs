#!/usr/bin/env node
// Loopback-only Node adapter: production files unchanged, no platform credentials.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { root, fingerprint, startTicks } from './control.mjs';
import { createFixtures } from '../lib/fixtures.mjs';

const run = process.argv[2];
const fixtures = createFixtures(run);
globalThis.fetch = fixtures.fetch;
const { default: worker } = await import(pathToFileURL(join(root, 'worker/src/index.js')));
const env = Object.freeze({
  SHOPIFY_STORE: 'fixture.invalid', SHOPIFY_ADMIN_TOKEN: 'fixture-only',
  RESEND_API_KEY: 'fixture-only', FROM_EMAIL: 'verify@example.invalid',
  STAFF_EMAIL: 'staff@example.invalid', AUTO_INVOICE_ON_STOCK: 'false'
});
// Simulate the existing trusted-network entry path. No password/token is copied.
const workerSource = readFileSync(join(root, 'worker/src/index.js'), 'utf8');
const trustedIP = workerSource.match(/const whitelistedIPs = \["([\d.]+)"\]/)?.[1];
if (!trustedIP) throw new Error('Trusted-IP contract changed; update the adapter explicitly');
const origins = ['public/index.html', 'public/dashboard.html'].map(file => {
  const source = readFileSync(join(root, file), 'utf8');
  return source.match(/const WORKER_URL = '([^']+)'/)?.[1];
});
if (!origins[0] || origins[0] !== origins[1]) throw new Error('Worker origin contract changed');
let manifest;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, manifest.url);
    const log = record => appendFileSync(join(run, 'requests.jsonl'), JSON.stringify({ method: req.method, path: url.pathname + url.search, ...record }) + '\n');
    if (url.pathname === '/__verify__/identity' && req.method === 'GET') {
      res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(manifest)); return;
    }
    const staticFile = { '/': 'index.html', '/index.html': 'index.html', '/dashboard.html': 'dashboard.html' }[url.pathname];
    if (staticFile && req.method === 'GET') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(readFileSync(join(root, 'public', staticFile))); log({ status: 200 }); return;
    }
    if (url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const allowed = req.method === 'GET' && ['/health', '/api/auth/check-ip', '/api/customers/search', '/api/products/search', '/api/dashboard/orders'].includes(url.pathname)
      || req.method === 'POST' && url.pathname === '/order-request';
    if (!allowed) {
      log({ status: 501, blocked: true }); res.writeHead(501); res.end('Unmapped verification route; external fallthrough is disabled'); return;
    }
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 1024 * 1024) throw new Error('Request too large');
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks).toString();
    const response = await worker.fetch(new Request(url, {
      method: req.method,
      headers: { 'content-type': 'application/json', 'CF-Connecting-IP': trustedIP },
      ...(body ? { body } : {})
    }), env);
    const text = await response.text();
    log({ status: response.status, ...(body ? { body: JSON.parse(body) } : {}), response: text });
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(text);
  } catch (error) {
    console.error(error);
    res.writeHead(500); res.end('Verification adapter failed; inspect server.log');
  }
});
server.listen(0, '127.0.0.1', () => {
  manifest = {
    run, root, pid: process.pid, startTicks: startTicks(process.pid), nonce: randomUUID(),
    url: `http://127.0.0.1:${server.address().port}`, workerOrigin: origins[0],
    fingerprint: fingerprint(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    node: process.version, mode: 'node-worker-synthetic-boundaries'
  };
  writeFileSync(join(run, 'instance.json'), JSON.stringify(manifest, null, 2));
  console.log(`READY ${manifest.url} (synthetic Shopify and Resend; trusted-network entry)`);
});
process.on('SIGTERM', () => { server.closeAllConnections(); server.close(() => process.exit(0)); });
