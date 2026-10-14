#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, openSync, closeSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const scripts = dirname(fileURLToPath(import.meta.url));
export const root = resolve(scripts, '../../../..');
export const evidence = join(homedir(), '.local/state/verify/curlys-order-form');
export const sourceFiles = [
  'public/index.html', 'public/dashboard.html', 'worker/src/index.js', 'worker/src/emails.js',
  ...['scripts/control.mjs', 'scripts/server.mjs', 'scripts/drive.mjs', 'lib/fixtures.mjs', 'package-lock.json']
    .map(file => `.agents/skills/verify-curlys-order-form/${file}`)
];
export function fingerprint() {
  const hash = createHash('sha256');
  for (const file of sourceFiles) hash.update(file).update(readFileSync(join(root, file)));
  return hash.digest('hex');
}
export function startTicks(pid) {
  try { return readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ')[19]; }
  catch { return null; }
}
export function getRun(path) {
  const run = realpathSync(path);
  assert.equal(dirname(run), realpathSync(evidence), 'Run must be directly under the evidence directory');
  const manifest = JSON.parse(readFileSync(join(run, 'instance.json')));
  assert.equal(manifest.run, run);
  assert.equal(manifest.root, root, 'Instance belongs to another worktree');
  return { run, manifest };
}
function owns(manifest) {
  if (startTicks(manifest.pid) !== manifest.startTicks) return false;
  const argv = readFileSync(`/proc/${manifest.pid}/cmdline`, 'utf8').split('\0');
  return argv.includes(join(scripts, 'server.mjs')) && argv.includes(manifest.run);
}
export async function doctor(path) {
  const { run, manifest } = getRun(path);
  assert(owns(manifest), 'Owned server is not running (PID/start-time/argv mismatch)');
  assert.equal(manifest.fingerprint, fingerprint(), 'Source changed; clean up and launch again');
  const url = new URL(manifest.url);
  assert.equal(url.hostname, '127.0.0.1');
  const get = async path => {
    const response = await fetch(`${url.origin}${path}`, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    assert.equal(response.status, 200, path);
    return response;
  };
  const identity = await (await get('/__verify__/identity')).json();
  assert.equal(identity.nonce, manifest.nonce, 'Port no longer belongs to this run');
  assert.equal(identity.pid, manifest.pid);
  assert.equal(identity.fingerprint, fingerprint());
  assert.equal(await (await get('/health')).text(), 'OK');
  assert.equal((await (await get('/api/auth/check-ip')).json()).whitelisted, true);
  assert((await (await get('/api/customers/search?q=Avery')).json()).customers.some(c => c.id === 101));
  assert((await (await get('/api/products/search?q=protein')).json()).products.some(p => p.productTitle === 'Verify Protein'));
  assert((await (await get('/api/dashboard/orders')).json()).orders.some(o => o.id === 301));
  const report = { ok: true, url: manifest.url, run, pid: manifest.pid, fingerprint: manifest.fingerprint, node: process.version, checkedAt: new Date().toISOString() };
  writeFileSync(join(run, 'doctor.json'), JSON.stringify(report, null, 2));
  return report;
}
export async function cleanup(path) {
  const { run, manifest } = getRun(path);
  if (owns(manifest)) {
    process.kill(manifest.pid, 'SIGTERM');
    for (let i = 0; i < 100 && owns(manifest); i++) await new Promise(r => setTimeout(r, 50));
    assert(!owns(manifest), 'Server did not exit; refusing to escalate or kill unrelated processes');
  } else if (startTicks(manifest.pid) !== null) {
    // PID reuse is not authority to stop anything.
    console.error('PID absent or reused; no signal sent');
  }
  writeFileSync(join(run, 'cleanup.json'), JSON.stringify({ serverStopped: true, evidenceRetained: true, checkedAt: new Date().toISOString() }, null, 2));
}
async function launch() {
  mkdirSync(evidence, { recursive: true, mode: 0o700 });
  const run = mkdtempSync(join(evidence, 'run-'));
  const log = openSync(join(run, 'server.log'), 'a', 0o600);
  // Deliberately exclude credentials, NODE_OPTIONS, .env loaders and proxy configuration.
  const child = spawn(process.execPath, [join(scripts, 'server.mjs'), run], {
    cwd: root, detached: true, stdio: ['ignore', log, log],
    env: { HOME: homedir(), PATH: process.env.PATH, NODE_NO_WARNINGS: '1' }
  });
  closeSync(log);
  let spawnError;
  child.on('error', error => { spawnError = error; });
  try {
    for (let i = 0; i < 100; i++) {
      if (spawnError) throw spawnError;
      if (existsSync(join(run, 'instance.json'))) {
        await doctor(run);
        child.unref();
        return run;
      }
      assert(child.exitCode === null, `Startup failed; inspect ${run}/server.log`);
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error(`Startup timeout; inspect ${run}/server.log`);
  } catch (error) {
    // This ChildProcess was created above, never discovered by name.
    child.kill('SIGTERM');
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert(Number(process.versions.node.split('.')[0]) >= 22, 'Use Node 22+ (Node 18 cannot load the Worker ES modules)');
    const [command, path] = process.argv.slice(2);
    if (command === 'launch') console.log(await launch());
    else if (command === 'doctor') console.log(JSON.stringify(await doctor(path), null, 2));
    else if (command === 'cleanup') { await cleanup(path); console.log(`Stopped owned instance; retained ${path}`); }
    else throw new Error('Usage: node control.mjs launch | doctor RUN | cleanup RUN');
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
