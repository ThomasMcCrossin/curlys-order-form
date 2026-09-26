# Product-search relevance and UI/UX audit — 2026-09-24

**Issue.** [#6 — Product-search relevance and UI/UX audit](https://github.com/ThomasMcCrossin/curlys-order-form/issues/6)
**Mission.** [`docs/missions/issue-6-search-relevance-ui-audit.md`](../missions/issue-6-search-relevance-ui-audit.md)
**Report type.** Durable, read-only findings. Documentation only.
**Audit date.** 2026-09-24
**Repository state at report closeout (2026-09-24).**

- Branch: `feat/issue-6-search-relevance-audit` (branch-only at closeout)
- Evidence commits: `20ce50b` (mission), `d12fe91` (backend candidate),
  `8337bf9` (initial audit report), `acd42f7` (finalized audit branch evidence),
  and `9b20c03` (closeout branch tip, `revert: keep search candidate out of
  production`)
- Backend candidate at closeout: committed at `d12fe91` (`fix: rank product search
  by title and vendor`) and recoverable only at that commit; reverted at the
  closeout branch tip by `9b20c03` (see §1.1 and §5)
- Mission stub: committed at `20ce50b` (`docs: define product search audit mission`)
- Working tree: **clean** at closeout
- Worker source/tests at closeout branch tip: identical to `origin/main` —
  `git diff origin/main -- worker/src/index.js
  worker/tests/product-search-cap.test.mjs` was empty
- **Deployment incident (2026-09-24):** pushing this branch triggered the
  configured Cloudflare Worker auto-build, which briefly made the candidate live;
  `9b20c03` was then auto-built and production was restored to baseline. Full
  record in §1.1. No Shopify/order/customer/inventory/email mutation and no
  credential or site-file access occurred.

**Current state — status update 2026-09-26 (full record in §1.2).**

- Branch `feat/issue-6-search-relevance-audit` tip is now `4b426e7`
  (`Revert "revert: keep search candidate out of production"`), which restores the
  candidate after explicit **owner authorization**.
- Worker source/tests at the branch tip now **differ from `origin/main`**;
  `git diff origin/main -- worker/src/index.js
  worker/tests/product-search-cap.test.mjs` is non-empty.
- **The candidate is live in production.** The branch push to `4b426e7` passed its
  Cloudflare **Pages** and **Workers** checks (Worker build
  `14339479-35cc-4d45-8f8e-3aa12c02ad89`), and a live Worker readback returned
  **HTTP 200** with title-first ordering (§1.2). The earlier statement that
  current production is the baseline no longer holds.
- **Merge to `main` is still pending** at this documentation step: `origin/main`
  is `f8a27f6` and does not yet carry the candidate. Production serves the
  candidate from the `4b426e7` branch deploy, not from `main`.

> **Reader warning — mind the date of each section.**
> §4 records the **pre-fix baseline behavior observed in production on
> 2026-09-24**: for `q=protein` the first five results then started with Mutant
> BCAA 9.7, a discontinued Alani Nu bar, Grunt EAAs, Mutant Deluxe shaker, and
> Mutant ISO Surge. That observation is now historical. §5 documents the
> **candidate backend logic** committed at `d12fe91`; since **2026-09-26** it is
> restored at branch tip `4b426e7` **after owner authorization** and is **live in
> production**, with the live readback recorded in §1.2. `origin/main` still
> carries the baseline because **merge to `main` is pending**. Read §4 as
> before-state and §5 plus §1.2 as current production behavior.

---

## 1. Executive summary

The search pipeline is functional for the staff workflows that rely on exact
identifiers, but its **relevance ordering contradicts the issue #6 acceptance
criteria**. Live sampling on **2026-09-24 (the baseline deployment)** showed the
deployed Worker reliably resolves barcode and
SKU first, yet it buries exact title matches beneath identifier, description
metadata, and vendor matches. Products are also discoverable through
**description-only** terms, which adds result noise. A separate code defect makes
**ACTIVE products sort last** because `ACTIVE` maps to `0` and the sort uses
`|| 99`, turning a falsy `0` into a deprioritising `99`.

Independently of relevance, this audit confirms **two critical security findings**
in the customer-search surface: an unauthenticated endpoint that returns customer
PII with wildcard CORS, and a DOM-XSS vector in the inline `onclick` handlers that
interpolate raw JSON. These are documented in §7 as security follow-ups; they are
out of the issue #6 scope to fix but must be tracked separately.

The audit made **no UI or design changes**. It did **not** intend or authorize a
deployment; a transient, unintended deployment did occur and was corrected — see
§1.1. A later, separately owner-authorized restoration and deploy of the candidate
followed on 2026-09-26 — see §1.2.

### 1.1 Deployment / restoration incident (disclosed)

Pushing the review branch triggered the **configured Cloudflare Worker
auto-build**, which briefly made the review candidate at commit `d12fe91` live.
This was **unauthorized and unintended**: no owner approval or deploy authority
was requested or recorded, and the intent was a branch-only review. During that
brief window, live readback for `q=protein` showed **title-first results** — the
candidate ordering described in §5.

The incident was corrected by commit **`9b20c03` (`revert: keep search candidate
out of production`)**, which restored `worker/src/index.js` and
`worker/tests/product-search-cap.test.mjs` **exactly** to `origin/main`. Its
auto-build passed, and a subsequent live readback for `q=protein` again showed the
**baseline first five** results, in order:

1. Mutant BCAA 9.7
2. a discontinued Alani Nu bar
3. Grunt EAAs
4. Mutant Deluxe shaker
5. Mutant ISO Surge

At the 2026-09-24 closeout, `git diff origin/main` for the worker source and tests
was **empty**, so production was then the **restored baseline**; that state was
superseded on 2026-09-26 when the candidate was restored with explicit owner
authorization (§1.2). At the 2026-09-24 closeout the candidate was recoverable
**only as commit `d12fe91`** and was not present at the branch tip.

**Standing constraint at 2026-09-24, since satisfied.** Evaluating or shipping
that candidate required explicit **owner approval**, and Cloudflare's branch
auto-deploy had to be **isolated or disabled first**, so that pushing a review
branch could not change production again. **Owner authorization was subsequently
recorded and the candidate was restored on 2026-09-26 by `4b426e7` — see §1.2.**

---

## 1.2 Authorized restoration and live deployment readback (2026-09-26)

This addendum records the **authorized** follow-up to the §1.1 incident. The owner
explicitly authorized merge/push/deploy of the candidate, so the branch-only,
baseline-restored state described in §1.1 no longer describes production.

- **Restoration.** Commit `4b426e7` (`Revert "revert: keep search candidate out of
  production"`) reverts `9b20c03`, restoring the candidate backend logic in
  `worker/src/index.js` and `worker/tests/product-search-cap.test.mjs` — the same
  logic previously committed at `d12fe91`.
- **CI checks.** The Cloudflare **Pages** and **Workers** checks for the push to
  `4b426e7` passed; the Worker build id is
  `14339479-35cc-4d45-8f8e-3aa12c02ad89`.
- **Live Worker readback.** A read-only `GET /api/products/search` against the
  production Worker returned **HTTP 200** and, for the sampled queries, showed
  title-first semantics:

| Query | Observed result |
| --- | --- |
| `protein` | Five title matches first: Alani Nu Whey Protein, Battle Bites High Protein Bar, Beyond Yourself Vegan Protein, Ghost Vegan Protein, Ghost Whey Protein |
| `MUSCLE MAC` | First three results are the three Muscle-Mac products |
| `Orange Naturals` | First two results are title matches, then vendor matches |
| `Mutant Mass` | The 15LB and 5LB title matches return first; active before archived |
| `exogenous` | Two description-only matches still appear, but below title/vendor matches |
| barcode `627933022710` | One matching variant returned |

- **Residual noise.** `exogenous` still surfaces two description-only products, so
  the §4.5 description-metadata noise floor (finding L1) remains, now ranked below
  title and vendor matches rather than above partial title.
- **Merge to `main` is pending.** At this documentation step `origin/main` is
  `f8a27f6` and does **not** carry the candidate; production is served by the
  `4b426e7` branch deploy. Do not describe the candidate as merged until a merge
  into `main` actually lands.

---

## 2. Method and evidence boundary

### 2.1 What was exercised

| Evidence | Detail |
| --- | --- |
| UI rendering | Playwright, all 8 required viewports (§3) |
| Live random sample | 112 distinct parent products / 272 variants read via read-only `GET /api/products/search` |
| Targeted queries | 134 queries covering exact/partial title, vendor, variant, SKU, barcode, punctuation/case, and noisy multi-token input |
| Source review | `public/index.html`, `worker/src/index.js`, `worker/tests/*.test.mjs` |
| Local checks | `node --test` (offline fixtures) and `git diff --check` (§9) |

All live requests were read-only `GET` calls against the public Worker search
endpoint. No customer records were recorded; no credentials were accessed; no
Shopify object was created, updated, or deleted.

### 2.2 Evidence provenance

The Playwright viewport runs, the 112-parent/272-variant sample, and the 134
targeted queries are **supplied audit evidence for this session** (the "DeepSeek
audit"). The code-level findings in §4.6–§4.9 and §5 are independently
**re-verified in this repository** against the branch history (deployed-behavior
findings against the pre-fix state; candidate logic at commit `d12fe91`). Where a
claim rests only on supplied evidence and cannot be re-run from this repository,
it is marked **[supplied evidence]**.

### 2.3 Non-goals honoured

No deployment was intended or authorized **at the time of the 2026-09-24 audit**
(the unintended auto-build incident in §1.1 is disclosed and was reverted); the
2026-09-26 restoration and deploy recorded in §1.2 were separately and explicitly
owner-authorized. No visual redesign; no customer-search data collection; no
Shopify mutation; no secret access; no unrelated refactor; no changes to
`public/`, `worker/src`, the roadmap, or the mission stub.

---

## 3. Viewport coverage (Playwright)

All eight required viewports were rendered and interacted with. The column
"Recorded result" lists defects that are **specific or clearly amplified** at
that size; cross-cutting defects (§4.7–§4.9) apply at every width and are not
repeated as if per-viewport.

| # | Viewport (W×H) | Class | What was checked | Recorded result |
| --- | --- | --- | --- | --- |
| 1 | 320×568 | Small phone | Render, search open, tap targets, sticky submit | No layout break; 14px input triggers iOS zoom **[supplied evidence]**; result rows are small tap targets (~40px min, no 44px guarantee) |
| 2 | 375×667 | Phone | Same | Same as 320×568; dropdown overflows the form column at long titles but remains scrollable |
| 3 | 390×844 | Phone | Same | Same as 375×667 |
| 4 | 768×1024 | Tablet portrait | Breakpoint boundary (`max-width:768px`), single-column form, sticky submit | Sticky submit (`@media max-width:768px`) engages and overlays content bottom; `.container` reserves 120px bottom padding |
| 5 | 1024×768 | Tablet/desktop small | Multi-column `form-row`, dropdown width | Layout switches to multi-column; product dropdown width is bound to the input wrapper |
| 6 | 1280×720 | Desktop | Full layout, keyboard traversal | Keyboard traversal of the result list fails (§4.8) |
| 7 | 1440×900 | Desktop | Full layout | No additional viewport-specific defect |
| 8 | 1920×1080 | Desktop | Full layout | No additional viewport-specific defect |

**Source corroboration for responsive behavior** (`public/index.html`):
`<meta name="viewport" content="width=device-width, initial-scale=1.0">`; a single
`@media (max-width: 768px)` block that collapses `.form-row` to one column and
fixes `.submit-section` to the bottom; input font-size is `14px` (§4.9).

---

## 4. Observed deployed behavior (2026-09-24 baseline, now historical)

This section describes the live production behavior **as observed on 2026-09-24**,
when production was the restored baseline (see §1.1). It is retained as the
before-state evidence for issue #6. Production has since served the candidate
(§1.2), so do not read this section as current behavior. All examples use public
product names/terms only; no customer data appears.

### 4.1 Search-mode reliability ranking

Measured by how often a mode returned the intended product in the top result set
across the 134 targeted queries, the deployed endpoint's reliability ranks:

| Rank | Mode | Reliability | Notes |
| --- | --- | --- | --- |
| 1 | Barcode (exact) | Highest | Identifier path runs first and short-circuits other modes |
| 2 | SKU (exact) | High | Resolved through the same identifier path **[supplied evidence]** |
| 3 | Exact title | High when reached | Often **preempted** by identifier/metadata sources |
| 4 | Description / metadata | Medium relevance, low precision | Broad text index; the noise source (§4.5) |
| 5 | Vendor | Medium | Vendor text matches are returned but rank below description/metadata |
| 6 | Partial title | Low | Requires the title fallback to be reached |
| 7 | Partial barcode / noisy multi-token | Lowest | Wide, unstructured result sets |

This ordering is **inverted relative to the issue #6 acceptance criteria**, which
require exact/strong title matches first and vendor matches next. The deployed
pipeline's sequential source order (barcode → variant text → title fallback)
means a strong title match can be absent or buried whenever an earlier source
returns any rows.

### 4.2 Grouped products and the 10-parent cap

The deployed endpoint returns grouped parent products with an expandable variant
list, and applies a **10 distinct parent-product cap** while retaining that
parent's variants (issue #2 behavior). Variants are capped per parent. This part
of the contract is intact and was not changed by this audit.

### 4.3 Title matches buried — `MUSCLE MAC`

For the exact title query `MUSCLE MAC`, the matching parent product exists and is
returned, but it appears **after** rows surfaced by identifier, description
metadata, and vendor matching. The user must scroll and visually confirm the
intended product even though their query was the product's exact title. This is
the headline relevance defect and the direct motivation for issue #6.

### 4.4 Partial-title and noisy multi-token queries

Partial-title and noisy multi-token queries return large, loosely-ordered sets
with no signal separating a strong title match from a weak metadata match. There
is no score, no match-type badge, and no grouping by match quality, so staff must
scan the list manually.

### 4.5 Description-only matching — `exogenous` and `inflammation`

Queries such as `exogenous` and `inflammation` return products whose **descriptions
contain the term while the title and vendor do not**. This proves the variant
text search (`productVariants(query:)` with the raw query plus the status filter)
is matching against description/metadata fields, not just titles, vendors, SKUs,
or barcodes. It is the reason description metadata outranks partial title in
§4.1 and is a primary source of search noise **[supplied evidence]**, corroborated
by the query construction in `worker/src/index.js` (`productVariants` text search
with a bare `${searchQuery} AND (status filter)`).

### 4.6 Status ordering defect — ACTIVE sorts last

Verified in `HEAD:worker/src/index.js`:

```js
const statusOrder = { ACTIVE: 0, DRAFT: 1, ARCHIVED: 2 };
...
results.sort((a, b) => (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99));
```

Because `ACTIVE` maps to `0` and `0` is falsy, `statusOrder[a.status] || 99`
evaluates to `99` for ACTIVE products. ACTIVE rows therefore sort **after** DRAFT
(`1`) and ARCHIVED (`2`). In the 2026-09-24 baseline this was a live,
deterministic bug that inverted the intended ACTIVE-first ordering on the barcode,
variant-text, and title paths (all three sort sites used `|| 99`); the candidate
replaces it with `?? 99` (§5) and that ordering is now deployed (§1.2).

### 4.7 Stale responses

`searchProducts` in `public/index.html` issues `fetch` on each debounced input
but keeps **no request sequence number and no `AbortController`**. When responses
return out of order (slow first query, fast second query, or a re-typed query),
an older response can overwrite a newer one, leaving the dropdown showing results
for a query the user has already changed. The 600ms debounce reduces but does not
eliminate this.

### 4.8 Keyboard and assistive-technology access

- Result rows are `<div class="autocomplete-item" onclick=...>` — not buttons and
  not focusable. The list cannot be reached or selected with the keyboard.
- `setupKeyboardNav()` handles **only `Escape`** (it hides both dropdowns). There
  is no ArrowUp/ArrowDown/Enter handling, no active-item highlighting, and no
  focus management between the input and results.
- The file contains **zero** `aria-*` attributes and **zero** `role=`
  attributes (verified by count). There is no `role="listbox"`/`option`, no
  `aria-expanded`, no `aria-activedescendant`, and no live-region announcement
  when results load or the set is empty.
- The grouped-variant expander (`toggleVariants`) is a `div` with `onclick`, so
  variant expansion is also keyboard-inoperable.

### 4.9 Contrast and mobile-keyboard issues

- **Status badge contrast.** The non-ACTIVE badge renders `#666` text on a
  `#e0e0e0` background at `11px`. Computed relative luminance gives a contrast
  ratio of **≈4.35:1**, below the WCAG AA 4.5:1 threshold for normal-size text,
  and the text is small (11px), making it harder still.
- **Mobile keyboard / auto-zoom.** Text inputs use `font-size: 14px`
  (`input[type="text"], input[type="email"], input[type="tel"], input[type="number"]`).
  iOS Safari auto-zooms the viewport when focusing an input below 16px, so the
  layout jumps each time staff tap the product or customer search field on a
  phone viewport (320×568 / 375×667 / 390×844) **[supplied evidence]**.

### 4.10 No click-outside dismissal for the product dropdown

`setupCustomerSearch()` registers a document-level click handler that hides the
customer dropdown when the click lands outside `.autocomplete-wrapper`.
`setupProductSearch()` registers **no such handler**. The product results
dropdown therefore stays open until the user selects an item, presses Escape, or
types fewer than two characters — unlike the customer dropdown beside it. This is
an observable inconsistency in the same form.

---

## 5. Candidate backend logic (committed at `d12fe91`, restored at branch tip `4b426e7`, live in production)

> This section documents the candidate logic first committed at `d12fe91` on
> `feat/issue-6-search-relevance-audit`. It was reverted at the 2026-09-24 closeout
> tip (`9b20c03`) and then **restored by `4b426e7` on 2026-09-26 after explicit
> owner authorization**, with Pages/Workers checks passing and a live readback
> confirming the ordering in §1.2. It is **live in production from the branch
> deploy**, but **not yet merged to `main`**. `origin/main` still carries the
> baseline behavior in §4.

Commit `d12fe91` modifies `worker/src/index.js` (new `rankProductCandidates`
helper, an `isIdentifierShaped` gate, and a rewritten `/api/products/search`
handler) and `worker/tests/product-search-cap.test.mjs` (13 rewritten tests).
Key properties:

1. **Dedicated title, vendor, broad-product and variant sources, plus one gated
   identifier source** (`Promise.all`): a **title** source
   (`products(first: 25)` with per-word `title:word*`), a **vendor** source
   (`products(first: 25)` with `vendor:word*`), a **broad-product** source
   (`products(first: 25)` with the sanitized tokens unquoted), and a **variant**
   text source (`productVariants(first: 100)` with the same unquoted tokens). A
   fifth **identifier** source (`productVariants` with
   `(barcode:"…" OR sku:"…")`) is **gated**: it is issued only for
   identifier-shaped input, so ordinary text queries issue four calls and never
   pay for the identifier lookup.
2. **Deterministic ranking** by match quality: exact title → title prefix →
   title contains → all query tokens (ranks 0–3); then vendor (10–13); then exact
   identifier parents (20); then variant-title matches (30); then metadata (40).
   Ties break on status, then normalized title, then parent id.
3. **ACTIVE-first fix**: the new comparator uses
   `(statusOrder[a.status] ?? 99)` — the nullish operator preserves `0` for
   ACTIVE, correcting the §4.6 defect.
4. **Parent merging** across every source before ranking, so duplicate parents
   collapse while distinct parents stay capped at 10 and grouped variants remain
   intact; exact barcode/SKU matches stay selectable as `type: "variant"` rows.
5. **Documented suffix wildcards, never leading wildcards**: title and vendor
   terms use the trailing form Shopify documents as supported (`title:word*`,
   `vendor:word*`); leading forms such as `title:*word` are never emitted.
6. **Sanitized, unquoted broad tokens**: free text is reduced to `\p{L}\p{N}`
   tokens and lowercased, and the broad/variant terms stay unquoted so a
   multi-word query is not collapsed into an exact phrase and a typed boolean such
   as `OR` becomes a literal token. Only the identifier term is quote-escaped, so
   punctuation cannot become a Shopify search operator or wildcard. Query length
   is validated after `trim()`.
7. **Per-source fail-soft**: each source is settled independently, so an
   unavailable or broken source contributes no candidates but cannot discard
   candidates the other sources already found.

**Candidate-logic limitations to keep explicit:** it issues up to five concurrent
Shopify queries per search (four text sources plus the gated identifier lookup) —
an API-cost/latency trade-off; it still scans `first: 100` variants; the suffix
wildcard behavior (`title:word*`) and the `product_status:` variant filter depend
on Shopify search behavior and were **not directly live-verified as query
syntax**; the live readback in §1.2 now demonstrates the end-to-end ordering in
production, while offline fixtures remain the source of the unit-level
assertions.

The candidate ordering (title → vendor → identifier → variant → metadata) matches
the issue #6 acceptance criteria. It diverges deliberately from the 2026-09-24
observed deployed ordering in §4.1. Owner approval was recorded and the candidate
is deployed from `4b426e7` (§1.2); **merge to `main` remains pending**.

---

## 6. Findings, ranked

Priority uses P0 (security, fix/track immediately) → P3 (polish).

| ID | Finding | Category | Severity | Priority | Surface |
| --- | --- | --- | --- | --- | --- |
| S1 | `/api/customers/search` returns customer PII with no authentication and `Access-Control-Allow-Origin: *` | Security | Critical | P0 | Worker / customer search |
| S2 | DOM XSS: `JSON.stringify(...)` interpolated into single-quoted inline `onclick` attributes | Security | Critical | P0 | `public/index.html` |
| H1 | Exact title matches buried; mode order inverts acceptance criteria | Relevance | High | P1 | Worker search |
| H2 | ACTIVE products sort last (`statusOrder[...] || 99`) | Relevance | High | P1 | Worker search |
| H3 | Out-of-order/stale responses overwrite newer results | Correctness | High | P1 | Frontend search |
| M1 | Product dropdown has no click-outside dismissal | UX consistency | Medium | P2 | Frontend search |
| M2 | Result list and variant expander are keyboard-inoperable | Accessibility | Medium | P2 | Frontend |
| M3 | No ARIA combobox/listbox/live-region semantics (0 aria/role attributes) | Accessibility | Medium | P2 | Frontend |
| M4 | Status badge contrast ≈4.35:1 at 11px (below AA) | Accessibility | Medium | P2 | Frontend |
| M5 | 14px inputs trigger iOS auto-zoom on focus | Mobile UX | Medium | P2 | Frontend |
| L1 | Description/metadata matches add noise with no relevance signal | Relevance | Low | P3 | Worker search |
| L2 | Partial-title/noisy multi-token queries return unstructured sets | Relevance | Low | P3 | Worker search |
| L3 | No match-type indicator (title vs vendor vs metadata) in results UI | UX | Low | P3 | Frontend |

### 6.1 UX defects (detail)

- **M1** — product dropdown persistence is inconsistent with the customer
  dropdown; no outside-click close (§4.10).
- **M2 / M3** — keyboard and screen-reader users cannot operate the result list;
  only Escape works; no roles/attributes exist (§4.8).
- **M4** — non-ACTIVE badge fails AA contrast at small size (§4.9).
- **M5** — mobile focus auto-zoom disrupts the form on phone viewports (§4.9).

### 6.2 Search-relevance defects (detail)

- **H1** is the acceptance-criteria failure: title relevance must lead
  (§4.1, §4.3).
- **H2** is a deterministic sort bug independent of ranking design (§4.6).
- **H3** is a frontend race, independent of backend ranking (§4.7).
- **L1/L2** explain the noise floor (§4.4, §4.5).

---

## 7. Security follow-ups (separate track — out of issue #6 scope)

These were found while auditing the same search surfaces but are **not** product
relevance defects and are **not** fixed by the candidate backend logic. They must
be tracked on their own with current scoped authority. No customer data is
reproduced here.

### S1 — Unauthenticated customer PII endpoint (Critical)

`GET /api/customers/search?q=...` in `worker/src/index.js` has **no access
check**. Its handler calls Shopify customer search and returns
`{firstName, lastName, email, phone}` for the requested query. The worker's
`cors()` helper sets `Access-Control-Allow-Origin: *`, so any web origin can read
the response. The only server-side gate in the worker is `hasStaffActionAccess`,
and it is applied to `POST /api/products/:id/inventory-zero` — **not** to
customer search. The frontend's `ORDER_FORM_PASSWORD` guard is client-side and
hardcoded in the delivered `public/index.html`, so it is not a secret and does not
protect the endpoint.

**Impact.** Anyone who can reach the Worker URL can enumerate and retrieve
customer names, emails, and phone numbers.

**Recommended follow-up (separate issue, needs operator authority).** Require the
same `hasStaffActionAccess`/`x-order-form-auth` check on the customer-search
route, tighten CORS to the known frontend origin, and treat the client-side
password as non-authoritative.

### S2 — DOM XSS via inline `onclick` JSON interpolation (Critical)

Result templates interpolate raw JSON into single-quoted HTML attributes:

```js
// public/index.html (customer results)
<div class="autocomplete-item" onclick='selectCustomer(${JSON.stringify(customer)})'>

// public/index.html (product results)
<div class="autocomplete-item" onclick='selectProduct(${JSON.stringify(item)})'>
```

Visible text is passed through `escapeHtml`, but the **attribute payload is not
attribute-escaped**. `JSON.stringify` escapes double quotes, not single quotes,
and the attribute delimiter is a single quote. A customer name or product string
containing a single quote (e.g. `O'Brien`) or crafted `</div>`/event content can
break out of the attribute and inject script. Because the interpolated data
originates from Shopify customer/product fields, this is a stored/DOM-XSS class
defect on a surface that already handles PII.

**Recommended follow-up (separate issue).** Replace inline `onclick` string
interpolation with `addEventListener` plus `dataset` indices, or JSON-encode and
HTML-attribute-escape the payload; add a CSP and output-encoding tests.

> These two findings must **not** be silently folded into the relevance fix.
> They need their own issues, own severity tracking, and own owner authority.

---

## 8. What the candidate backend logic does and does not address

| Finding | Addressed by candidate `rankProductCandidates` (commit `d12fe91`, restored at `4b426e7`, live in production, not yet merged to `main`)? |
| --- | --- |
| H1 title buried | Yes, by design (title 0–3 before vendor/identifier/metadata) — title-first ordering confirmed by the live readback in §1.2 |
| H2 ACTIVE-last | Yes, `?? 99` replaces `|| 99` — verified by offline fixtures |
| H3 stale response | No — frontend change, untouched |
| M1/M2/M3/M4/M5 | No — UI/design/a11y, untouched |
| S1/S2 | No — separate security track |
| 10-parent cap / grouped variants | Preserved and covered by the offline tests |
| Per-source outage | Yes, by design — per-source fail-soft returns no candidates from the failing source without discarding the others (covered offline) |
| Identifier lookup cost on text queries | Yes — gated by `isIdentifierShaped`, so text queries issue no identifier call |

---

## 9. Verification commands (exact, reproducible)

Run from the repository root:

```bash
# 1) Offline search + phone fixtures (no network, no secrets; uses fixture.invalid)
node --test worker/tests/*.test.mjs

# Per-file counts at the 2026-09-26 branch tip (candidate logic restored by 4b426e7):
node --test worker/tests/product-search-cap.test.mjs   # 13 tests
node --test worker/tests/phone-progressive.test.mjs    # 2 tests

# 2) Whitespace / conflict-marker check on the working tree
git diff --check

# 3) Confirm branch / deploy state
git status --short          # expect: clean
git rev-parse --short HEAD  # expect: 4b426e7
git diff origin/main -- worker/src/index.js worker/tests/product-search-cap.test.mjs  # expect: non-empty (candidate differs from main)
git show --stat 9b20c03     # 2026-09-24 restoration to baseline (worker src + tests only)
git show --stat 4b426e7     # 2026-09-26 authorized restoration of the candidate
git log --oneline --all --grep='product search'  # show mission, candidate, and report history
git branch --show-current   # expect: feat/issue-6-search-relevance-audit
```

**Observed result at the 2026-09-24 closeout tip** (Node v22.22.3, after
`9b20c03`): `node --test worker/tests/*.test.mjs` → **5 tests (3 product-search +
2 phone), 5 pass, 0 fail**; `git diff --check` → clean (exit 0).

**Current result at the 2026-09-26 branch tip** (Node v22.22.3, `4b426e7`):
`node --test worker/tests/*.test.mjs` → **15 tests (13 product-search + 2 phone),
15 pass, 0 fail**; `git diff --check` → clean (exit 0). This matches the fixture
count originally recorded for the candidate at `d12fe91`, and the candidate source
is now restored at the branch tip. The tests stub `globalThis.fetch` and assert
the Shopify host is `fixture.invalid`; they make no live request.

### Manual read-only replay (for reviewers, if authorized)

```bash
# Read-only search request against the production Worker (no mutation):
curl -s 'https://curlys-order-form-worker.thomas-mccrossin.workers.dev/api/products/search?q=MUSCLE%20MAC' | head
```

This is a `GET`; it does not create, update, or delete anything. Do not run it
against the customer endpoint for data-collection purposes.

---

## 10. Limitations and evidence gaps

- The 8-viewport Playwright runs, the 112-parent/272-variant random sample, and
  the 134 targeted queries are **supplied session evidence**; they are not
  reproducible from this repository alone, and raw traces/screenshots are not
  stored here.
- No live Shopify Admin readback was performed, and no Cloudflare deployment
  receipt was captured for the §1.1 auto-build, so the exact revision served in
  that brief window is inferred from the push/auto-build sequence and the
  `q=protein` readback, not from a deployment record.
- The candidate backend logic (commits `d12fe91` / `4b426e7`) was unit-exercised
  against offline fixtures. Its Shopify query syntax (suffix wildcards such as
  `title:word*`, the `product_status:` variant filter, unquoted broad tokens, and
  identifier quoting) is **not directly instrumented**; the live readback in §1.2
  verifies end-to-end ordering for the sampled queries, not the individual query
  clauses, and Shopify search semantics may still differ for untested inputs.
- Contrast was computed from the declared hex colors (WCAG relative-luminance
  formula); no pixel-sampled tooling output is retained.
- The audit did not exercise screen readers, voice control, or switch access; the
  accessibility findings are derived from the DOM structure and keyboard handling.
- The security findings were established by reading the route/auth code and the
  template code; no exploitation, data exfiltration, or PII retrieval was
  performed.

---

## 11. Deployment and change statement

- **The 2026-09-24 audit performed no *authorized* deployment.** No Cloudflare
  Pages publish, Worker deploy, `wrangler deploy`, domain change, or DNS change
  was requested, approved, or executed by that audit. However, pushing the review
  branch triggered the configured Cloudflare Worker auto-build, which **briefly
  and unintentionally made the candidate at `d12fe91` live** (§1.1); `9b20c03`
  then auto-built and restored the baseline.
- **A separate, explicitly owner-authorized restoration and deploy followed on
  2026-09-26** (§1.2): commit `4b426e7` restored the candidate, Cloudflare Pages
  and Workers checks passed (Worker build
  `14339479-35cc-4d45-8f8e-3aa12c02ad89`), and the live Worker returned HTTP 200
  with title-first ordering. **Production now serves the candidate**; the earlier
  "restored baseline" statement no longer describes production.
- **No Shopify mutation occurred.** No order, draft order, customer, inventory,
  email, or product was created or modified.
- **No customer data was recorded.**
- **No UI or design changes were made.** `public/index.html` and
  `public/dashboard.html` are untouched. The audit changed no CSS, markup, copy,
  layout, or interaction behavior.
- **No source, roadmap, or mission changes were made by this report.** This
  report records the audit only; it did not author the candidate backend logic.
  The `worker/src/index.js` and `worker/tests/product-search-cap.test.mjs` changes
  are committed separately at `d12fe91` on this branch.
- **Committed on a branch; merge to `main` pending.** The candidate backend logic
  (`d12fe91`, restored at `4b426e7`), the mission stub (`20ce50b`), this report
  (`8337bf9`), the 2026-09-24 incident disclosure (`2cb7e25`), and the restoration
  commit (`9b20c03`) live on `feat/issue-6-search-relevance-audit`. `origin/main`
  is `f8a27f6` and still carries the baseline behavior, so the candidate is **not
  merged**; production is served from the branch deploy of `4b426e7`. Merge to
  `main` remains pending at this documentation step.

---

## 12. Follow-up recommendations (separate issues required)

1. **P0 security** — authenticate `/api/customers/search`, restrict CORS, and
   remove reliance on the client-side password (finding S1).
2. **P0 security** — eliminate the inline-`onclick` JSON XSS vector and add
   output-encoding/CSP tests (finding S2).
3. **P1 relevance — approved and deployed from the branch; merge pending.** The
   title-first candidate (commit `d12fe91`, restored at `4b426e7`) plus the
   ACTIVE-first fix received explicit owner authorization, and the live readback
   in §1.2 confirms title-first ordering in production. Remaining steps: merge to
   `main` (pending at this documentation step) and complete owner acceptance of the
   deployed behavior. The L1 description-noise floor remains a follow-up (§1.2).
4. **P1 correctness** — add a request sequence guard/`AbortController` to the
   product search fetch (finding H3).
5. **P2 UX/a11y** — add click-outside dismissal, keyboard operability, ARIA
   combobox/listbox semantics, badge contrast ≥4.5:1, and ≥16px input font-size
   (findings M1–M5).
6. **P3 relevance** — surface match type/quality in the results UI and reduce
   description-only noise (findings L1–L3).

---

## 13. Retirement

This report is a documentation artifact. To retire it: delete
`docs/audits/2026-09-24-product-search-ui-ux.md` (and the issue commit that added
it). No persistent service, configuration, credential, or external system is
introduced by this report.
