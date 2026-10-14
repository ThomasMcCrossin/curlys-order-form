---
name: verify-curlys-order-form
description: Verify Curlys Order Form customer entry, product selection, draft submission, and staff dashboard in a browser after frontend or Worker changes; capture evidence without production calls.
---

# Verify Curlys Order Form

Read [features/README.md](features/README.md), then the feature being changed.
This harness serves the real `public/` pages and calls the real Worker `fetch`
handler. Shopify and Resend are synthetic adapters at the Worker's outbound
HTTP boundary. This is browser/Worker integration proof, not a Cloudflare or
Shopify sandbox deployment.

## Launch

Run from the repo root on Linux with Node **22+**, npm and Chromium dependencies.
The default Node 18 on clarencehub cannot import the Worker's ES modules. On
this host, select the installed runtime without changing any service:

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
node --version
SKILL=.agents/skills/verify-curlys-order-form
npm ci --ignore-scripts --prefix "$SKILL"
node "$SKILL/node_modules/playwright/cli.js" install chromium
node --test worker/tests/*.test.mjs
```

If Chromium lacks system libraries, report that blocker; do not change host
services or install system packages as a side effect of verification.

Launch seeds a new private run directory automatically: three synthetic
customers, two product variants and two draft requests. There is no database,
migration, `.env`, Cloudflare credential, Docker service or Wrangler process.
An OS-assigned free port binds only to `127.0.0.1`. Each launch and browser has
separate state, so concurrent runs do not share sessions or records.

```bash
S="$SKILL/scripts"
RUN=$(node "$S/control.mjs" launch)
printf '%s\n' "$RUN"
# Keep this trap in the shell that drives the run, including failed attempts.
trap 'node "$S/control.mjs" cleanup "$RUN"' EXIT
```

The command returns only when `doctor` passes; `server.log` records `READY`.
Readiness includes usable customer/product search and dashboard fixtures, not
just `/health`. Save `RUN`; there is deliberately no shared "latest" instance.

**Safety boundary:** the pages still contain their production Worker URL. Open
them only through `drive.mjs`, whose browser routing is installed before any
navigation. It redirects that origin to the owned local Worker and blocks every
other external browser request (including dashboard Google Fonts). Worker
outbound `fetch` has no network fallback. Unknown routes/calls fail the proof.
No production credential is loaded; synthetic addresses use `example.invalid`.
Never open these pages in an ordinary browser as a supposedly safe local test.

## Doctor

```bash
node "$S/control.mjs" doctor "$RUN"
```

Run this first when anything looks off. It checks Linux PID/start time/argv,
worktree identity, port nonce, source/helper fingerprint, Worker health,
simulated trusted-network auth and seeded search/dashboard responses. It writes
`doctor.json`; it makes no customer/order mutation (only audit artifacts).
A source mismatch requires cleanup and a fresh launch, not driving a stale
instance. The auth path simulates the Worker's existing trusted IP header;
password and remembered-device authentication are **not** proved.

## Drive

Choose one mapped recipe per fresh launch:

```bash
node "$S/drive.mjs" "$RUN" contacts --headless
# OR: products | submit | dashboard, replacing contacts above.
# Use --headed only with an available local display.
```

The driver clicks/fills the actual UI, waits for observable states and uses
stable labels, existing IDs and data attributes. It never calls UI setters or
adds test-only mutation endpoints. `submit` drives both existing-customer and
manual-entry paths and reads the results from the dashboard. Read the map for
selectors, exact fixtures and uncovered entries before extending a recipe.
A missing fixture or unsupported action is a failure/blocker, not a reason to
skip an assertion. Use a fresh launch for every recipe and after every failure.

## Evidence

All artifacts survive under `~/.local/state/verify/curlys-order-form/run-*/`:

- `instance.json`, `doctor.json`, `server.log`: process, revision, source hash,
  readiness and runtime diagnostics.
- `FEATURE/steps.json`, `trace.zip`, `*.png`, `*.aria.txt`: user actions and
  resulting states. Screenshots disable finite animations for readable proof.
- `requests.jsonl`: actual Worker inputs and responses; `outbound.jsonl`:
  intercepted Shopify/Resend calls and their synthetic outcome.
- `fixture-state.json`, `FEATURE/state-readback.json`: final synthetic records
  and message captures. `submit` additionally checks the dashboard's second
  user-facing readback, customer email update, line items, notes and recipients.
- `FEATURE/network.json`, `page-errors.json`, `console.jsonl`, `result.json`:
  routing decisions, diagnostics and exit verdict; failures retain screenshots
  and traces too.

A screenshot alone is not proof. Require actions **and** assertions, state
readback for writes, network audit, and exit code 0. Non-submitting journeys
assert no mutation requests, added drafts or messages. `submit` asserts captured
messages at the Resend boundary; it sends none. The mode is not named or treated
as a dry-run: it exercises real Worker mutations against in-memory fixtures.
Expected blocked font requests are logged; any other unexpected external browser
request or unsupported Worker call fails the run. Report coverage per feature
and entry point, not a blanket "app verified".

For local trace inspection (starts only your viewer; stop it afterwards):

```bash
node "$SKILL/node_modules/playwright/cli.js" show-trace "$RUN/submit/trace.zip" --host 127.0.0.1 --port 0
```

## Cleanup

```bash
node "$S/control.mjs" cleanup "$RUN"
trap - EXIT
# After a successful submit recipe:
test -s "$RUN/submit/result.json" && test -s "$RUN/submit/trace.zip"
test -s "$RUN/cleanup.json"
```

Cleanup signals only the recorded PID after checking its start time and exact
server/worktree arguments; it never kills by process name or touches Docker.
The driver closes its own browser and disposable profile even on failure.
Keep fixture snapshots, logs and run manifests as evidence, not reusable app
state. Cleanup is repeatable, and does not delete the run directory. If the
shell is interrupted, recover `RUN` from its printed path and run cleanup.

## Helpers

- `scripts/control.mjs launch|doctor RUN|cleanup RUN`: lifecycle commands above.
- `scripts/drive.mjs RUN FEATURE --headless|--headed`: browser recipe above.
- `scripts/server.mjs RUN`: executable private child, invoked by `launch` as
  `node "$S/server.mjs" "$RUN"`; use the controller, not a manually shared server.
- `lib/fixtures.mjs`: adapter module imported by that child; never a live API
  client. Keep synthetic fixtures and the boundary allowlist here.

Setup pins Playwright in this skill's package/lockfile; no global skill or npm
install is required. No product source change is needed. For maintenance as
features change, use `/maintain-verification-skill` and update the feature map.

### Unverified target setup

This local stand-in supplies a Node HTTP-to-Worker adapter, automatic fixture
seeding, a simulated Cloudflare trusted-IP header, browser Worker-origin
redirection and outbound HTTP stubs. A real Cloudflare/Shopify target supplies
none of those helpers. Cloudflare runtime/CORS enforcement, Access/domains,
real API schema/permissions/pagination, actual data persistence, external fonts,
email delivery, scheduled jobs, Stocky, inventory-zero and dashboard mutation
workflows remain unverified. Deployment or live writes/sends require fresh
scoped authorization; this skill grants none.
