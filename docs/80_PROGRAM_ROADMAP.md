# Curly's Order Form Program Roadmap

This is the canonical task inventory for the legacy checklist conversion dated
2026-08-09. GitHub issues and their matching mission stubs are canonical for
ready technical work. The legacy surfaces remain available only as historical
provenance; see [TODO.md](../TODO.md), [VERIFICATION_CHECKLIST.md](../VERIFICATION_CHECKLIST.md),
and the [change record](changes/2026-08-09-doctrine-conversion.md).

## Converted technical missions — current source status

| Issue | Mission | Scope | Next check |
| --- | --- | --- | --- |
| [#2](https://github.com/ThomasMcCrossin/curlys-order-form/issues/2) | [Limit grouped product search results](missions/issue-2-limit-grouped-product-search-results.md) | Return at most 10 grouped products, not 10 variants. | Present on `main` at `caba4d8`; current offline fixtures verify saturation, parent deduplication, grouped variants and barcode/SKU/title behavior. Full existing gate passed 45/45 on 2026-10-06; source acceptance/review remains. |
| [#3](https://github.com/ThomasMcCrossin/curlys-order-form/issues/3) — **SUPERSEDED, issue still OPEN** | [Historical missing-phone mission](missions/issue-3-progressive-disclosure-missing-phone.md) | Superseded by the owner's 2026-09-28 email-required decision in [#13](https://github.com/ThomasMcCrossin/curlys-order-form/issues/13) (CLOSED). Do not restore the old phone prompt. | Current `email-progressive.test.mjs` verifies inline missing-email disclosure, no prompt for missing phone alone, and refusal requiring phone. See the [source receipt](receipts/2026-10-06-source-reconciliation.md); issue reconciliation remains. |

## Technical work — issue status

| Issue | Mission | Scope | Route |
| --- | --- | --- | --- |
| [#6](https://github.com/ThomasMcCrossin/curlys-order-form/issues/6) — **CLOSED, done and deployed** | [Product-search relevance and UI/UX audit](missions/issue-6-search-relevance-ui-audit.md) | Audit responsive search UX and rank title matches before vendor and broader metadata matches. | `multi-surface-audit` / parallel specialists, then bounded implementation — **complete**: candidate merged to `main` by PR #7 at merge commit `a699a5669fe1ed768b851b41da9943e380f61580` (2026-09-26), merge-triggered Cloudflare Pages and Workers checks passed, post-merge live readback confirmed title-first ordering, and issue #6 is CLOSED |
| [#10](https://github.com/ThomasMcCrossin/curlys-order-form/issues/10) | [Viewport wrapping and overflow fixes](missions/issue-10-viewport-ui-fixes.md) | Presentation-only fixes in `public/index.html` and `public/dashboard.html` from a mocked-Worker Playwright audit at 320–1920px. | Owner-authorized merge and deploy on 2026-09-28; live readback recorded on the issue. |

**Issue #6 — done and deployed (2026-09-26 closeout).** The audit report
[`docs/audits/2026-09-24-product-search-ui-ux.md`](audits/2026-09-24-product-search-ui-ux.md)
is complete. PR #7 (`feat/issue-6-search-relevance-audit`) merged to `main` at
merge commit `a699a5669fe1ed768b851b41da9943e380f61580` on **2026-09-26**; the
merge-triggered Cloudflare **Pages** and **Workers** checks passed (final Worker
build `1830aac0-9901-4972-b824-d702777d57bf`), and issue **#6 is CLOSED**. Tests
on `origin/main` pass **15/15** (`node --test worker/tests/*.test.mjs`) and
`git diff --check` is clean.

Post-merge live Worker readback returned **HTTP 200** with title-first ordering:
`protein` → top three title matches Alani Nu Whey Protein, Battle Bites High
Protein Bar, Beyond Yourself Vegan Protein; `MUSCLE MAC` → top three all
Muscle-Mac titles; `Orange Naturals` → top two title matches then vendor match
Bounce Back; `Mutant Mass` → top two are the 15LB and 5LB ACTIVE title matches;
`exogenous` → the two description-only products still returned; barcode
`627933022710` → one archived variant (report §1.2). The L1 description-noise
floor remains a follow-up, and owner acceptance of the deployed behavior remains
the standing check. The earlier unintended auto-build and baseline restoration
incident remains recorded as history in report §1.1.

**Issues #2 and #3:** The 2026-09-23 source review is historical evidence, not the current phone contract. On 2026-10-06, authenticated readback still showed both issues OPEN, but CLOSED issue #13 and the issue #3 mission explicitly supersede missing-phone disclosure. Current source at `caba4d8` passes the existing offline gate (45/45); this is **not** owner acceptance or deployment evidence. Do not repeat issue #2's implementation or restore issue #3's superseded UI. Keep acceptance/status reconciliation on the existing issues, with no duplicate missions.

Issues #2 and #3 are the only technical missions converted from the legacy
checklists. Labels created for that conversion are `converted-from-todo`,
`domain:product-search`, and `domain:customer-experience`. No pre-existing
GitHub issues were present at that conversion.

## Discovery scaffold — not ready for implementation

| Issue | Mission | Scope | Readiness |
| --- | --- | --- | --- |
| [#5](https://github.com/ThomasMcCrossin/curlys-order-form/issues/5) | [Curlys Ops integration discovery](missions/issue-5-curlys-ops-integration-discovery.md) | Review target-side workflow and define an evidence-backed integration boundary; see the [concept scaffold](integration-curlys-ops.md). | Blocked on authorized target-side review and operator decisions; no runtime work authorized. |

## Done or evidenced in the legacy record

The conversion records the legacy claims for confirmation-email content,
tracked sender configuration, product display and grouping, search debounce,
customer update behavior, and product-status search/badges. They are mapped
without reopening them as new tasks; see the source-line table in the change
record.

## Operator-held decisions

The following remain decisions for an authorized operator and are not issues:

- Decided 2026-09-28 by the owner (branch `feat/customer-email-design`): the
  store does not hold items; a back-in-stock event sends one message, our own
  email, with `AUTO_INVOICE_ON_STOCK = "false"` (the `sendInvoice` path stays,
  switched off); sender is `Curly's Sports & Supplements <orders@curlys.ca>` with
  reply-to `STAFF_EMAIL`; customer email copy lives only in
  `worker/src/emails.js`. Deploying that configuration still needs scoped
  Cloudflare authority and readback.
- Whether to authorize a dedicated customer-phone endpoint and the live
  `write_customers` permission (TODO lines 66-67).
- Whether draft and archived products are included by default or behind a
  toggle (TODO lines 84-86).
- Pages cutover and live verification, including URL, deployment, workflow,
  and optional old-project cleanup (the held checklist block at lines 29-71).
- Optional Worker Git auto-deploy and its live verification (checklist lines
  76-79).

## Evidence boundary

This roadmap relies on repository evidence plus the authenticated GitHub
inventory performed by the Sol root. Implementation evidence names commits
`c03e926`, `805c297`, and `4b08b72`, plus `public/index.html`,
`worker/src/index.js`, and `worker/wrangler.toml`. The conversion created the
three named labels and issues #2 and #3; it performed no deployment,
credential change, domain implementation, or external-system verification.
