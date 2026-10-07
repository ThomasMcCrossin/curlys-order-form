# Curlys Order Form ↔ Curlys Ops — target-aware discovery

**Status:** Target source discovery recorded 2026-10-07; owner chose full
request/customer visibility. Runtime identity/auth/transport/replay/lifecycle
contract remains unapproved. No wiring, connectivity or behavior changes included.
**Evidence boundary:** Order Form observations below come from this repository.
Ops observations come from its current owning captain's authenticated source-only
packet (`relay_05bac4e54861`), not an Order Form target login or live readback.
Candidate interfaces and the illustrative payload remain unapproved.

## Owner decision — full request/customer visibility

Question `orderform5-request-visibility-v1`, delivered to current Order Form
Dispatch `ctx_53e200c9fdea` in `relay_3ba9c82bde64`, 2026-10-07.
Raw answer, preserved without rewriting:

```json
"I'd want everything why would we keep our customer names and data out of that tf??? "
```

This is a valid free-text direction beyond the offered choices: the desired
internal Ops view includes customer names and data, not an anonymous demand
summary or a stripped request list. Do not re-ask whether names/contact data
belong in this view. Earlier minimization exclusions below are superseded for
captured request/customer information; they were proposals, not technical limits.

The business purpose is for authorized staff to identify the customer, understand
the entire request (including custom items), and follow up from the operational
view without re-entering or hunting for its details elsewhere.

### Desired data coverage — source design, not a live export

Include all information captured by this request workflow: customer ID/name/email/
phone; draft reference and source tags/status/timestamps; catalog product/variant
references, title/SKU when present, quantity and request prices; custom item text,
quantity and price; request notes and captured note attributes. Preserve provenance,
nullable fields and separate request/line/DraftOrder/Order namespaces. This does
not assert that every field is already returned by an existing feed or that a new
stable request ID exists. The exact field mapping/versioned schema is still source
contract work. Do not invent payment credentials or import unrelated Shopify
customer history: neither is captured request information.

Use isolated authenticated staff/service access and clear source ownership;
customer context must not become a public/browser-embedded unauthenticated feed.
The answer is business visibility direction, not authority for customer queries,
production data transfer, new credentials, sends, lifecycle mutation or deployment.

Retention is **not settled**: the earlier 30-day stale-projection expiry was part
of offered options, not explicitly selected by this raw answer. Do not silently
expire full request history under that proposal. Preserve a separate retention/
history design gap; missing/deleted drafts must not be labelled fulfilled or paid,
and no source draft/Books/receiving record may be deleted by this discovery.

### Retention question challenged — no horizon selected

Question `orderform5-removed-draft-retention-v1`; owning Issue raw receipt
[6036304327](https://github.com/ThomasMcCrossin/curlys-order-form/issues/5#issuecomment-6036304327).
Raw answer preserved exactly:

```json
"the fuck are you talking about??? "
```

Captain disposition: the question asked about a hypothetical future stored copy
before any request projection/store existed. It was premature, not a necessary
current implementation decision. The owner challenged the explanation/premise;
no retention period, indefinite retention, expiry/purge authority or lifecycle
change was selected. Do not repeat the same question in simpler wording or treat
the clerk's unaccepted re-ask draft as an answer.

Plain owner reply: I asked about a future copy before we have one. Ops does not
currently store these requests. Your instruction to include the full customer
and request details stands. Nothing has been copied, deleted or given an expiry.
I will leave expiry out of the source design; no retention choice is needed now.

Continue independent source qualification without a production store or purge.
Revisit retention only if an actual approved storage/history design introduces
a concrete need, with its real records/use/behavior established first. No repeat
visibility question and no inferred permission from this challenged answer.

## Independent source contract qualifier

[Request observation lifecycle candidate v1](contracts/request-observation-v1.md)
qualifies present/confirmed-missing/unavailable outcomes, replay/order conflicts,
source identity isolation and restoration using synthetic full request/customer
context. Failed/incomplete observations never begin absence or expiry; no retention
horizon, copystore purge, live adapter or producer request identity is implemented.
This advances independent source design without a retention horizon; the
challenged retention question is not a pending choice to re-ask. Separate
auth/transport/trigger readiness remains unqualified.

## Verified Ops source boundary — 2026-10-07

Inspector: Ops Task `task_a97b569f8e04`, Dispatch `ctx_dc7a8c6a414d`, at its home
`/home/curlyshub/curlys-ops`. Inspected revision
`52dae3d484fa3579ad85a73449bc93979ce60efa`; cached `origin/main`
`57ada9ecebba1491bf46c93feaca32afdc72aab0`. Inspector verified the relevant
paths below unchanged across those revisions. No live deployment, database
contents, credential values, connectivity or permission was inspected here.

All paths/lines in this section refer to that Ops source, not this repository.

| Existing target surface | Meaning and evidence | Integration consequence |
| --- | --- | --- |
| Shopify sales mirror | `src/curlys_ops/models/shopify_orders.py:24–217`; queue `src/curlys_ops/shopify_order_queue.py:58–64` | Already-created sales, not customer requests or Shopify Draft Orders. Shopify owns commercial source state; Ops owns its downstream mirror/evidence. |
| Supplier PO drafts/submitted orders | `src/curlys_ops/models/intelligence.py:1041–1073`; `src/curlys_ops/procurement/supplier_catalog_ordering_api.py:145–157,3445–3513` | Procurement lifecycle, not an order-request ledger. Draft writes are restricted to reviewable Ops drafts/transport-free dry-run receipts; submitted-order views are read-only. |
| Receiving intents | `src/curlys_ops/models/receiving_receipt_intent.py:37–63,78,106–166` | Invoice/delivery counts and inventory receipt recovery, not customer intake or request fulfilment proof. |

The inspected models, queue allowlist, supplier domain and API manifest contain
no dedicated customer-request model, request feed or `draft_orders/*` topic.
This is a bounded source finding, not proof about every uninspected system.
Do not invent `GET /requests`, `POST /customer-orders` or a generic intake API.

### Routes and authentication

`cloudflare/invoice-review/src/ops-route-manifest.js:206–232` declares supplier
catalog draft create/detail routes and submitted-order list/detail routes under
`/api/operator-review/supplier-catalog/`. These map to origin
`/operator-review/supplier-catalog/` routes, not a customer request interface.
Draft editing/reopening is restricted to `draft|review_required|reviewable`
(`supplier_catalog_ordering_api.py:3366–3394`); submitted detail requires
`submitted` status. None authorizes an adapter or supplier purchase/send.

Runbook `docs/runbooks/ops_api_origin_systemd.md:15–35` names `ops.curlys.ca`,
origin `ops-api.curlys.ca`, bind `127.0.0.1:8766`, runtime `/srv/curlys-ops/app`,
and `scripts/serve_operator_review_employee_hub.py`. These are source references,
not live availability or permission to connect.

Worker Access verification exists in `cloudflare/invoice-review/src/index.js:
1091,7818–7862`. `buildUpstreamHeaders` (`:11289–11317`) strips blocked inbound
headers and supplies correlation/trusted attribution; binding names are
`OPS_ACCESS_CLIENT_ID`, `OPS_ACCESS_CLIENT_SECRET`, `OPS_API_BEARER_TOKEN`.
Origin bearer checks (`src/curlys_ops/operator_review_employee_hub_server.py:
1189–1215`) return 503 when unconfigured and 401 when missing/wrong, using
constant-time comparison. Actor headers are attribution after authenticated
transport (`src/curlys_ops/operator_actor.py:5–23`), not credentials.

No existing Order Form service principal, customer-safe request-read scope or
approved cross-repo secret/auth contract was identified. Do not borrow staff
credentials or treat actor headers as authentication.

### Identity, custom items and replay

- Sales uniqueness is `(entity, store_key, shopify_order_id)`; line uniqueness is
  `(order_id, source_line_key)`. Product/variant IDs, SKU/barcode can be null
  (`models/shopify_orders.py:96–217`). Contact/name/tags/notes columns are not
  permission to transfer that data.
- Queue lines retain Shopify line ID when present; otherwise use a synthetic
  key (`shopify_order_queue.py:1315–1387`). CSV fallback hashes name, line number,
  title, SKU, quantity and price (`src/curlys_ops/shopify_order_history.py:
  311–332`). It is an import identity within a sale, not stable custom-request
  identity; edits/reordering can change it.
- No request ↔ DraftOrder ↔ final Order mapping, stable custom-request-line ID,
  partial fulfilment/purchase correlation or completion/deletion policy was
  found in these surfaces. Any-overlapping-variant matching is not justified
  by this target source. Keep integer IDs and Shopify GIDs separate.
- Sales queue topics are `orders/create`, `orders/updated`, `orders/cancelled`,
  `refunds/create`. Books-owned `hooks.curlys.ca` remains public ingress; Ops
  is a downstream Queue/R2 consumer (`docs/runbooks/shopify_order_queue_drain.md:
  18–25`). Do not create a second public ingress.
- Sales evidence keys include source/entity/store/topic and webhook ID or stable
  payload hash; duplicate evidence skips normalized mutation within a shared
  transaction; missing refund base-order dependencies retry without partial
  evidence (`models/shopify_orders.py:24–43`; queue `:358–363`; queue-drain
  runbook `:136–156`). This does not prevent duplicate form-created drafts.
- Supplier `external_reference` uniqueness/idempotency (`supplier_catalog_ordering_api.py:
  4670–4735`) and receiving nonce/line/lot/movement identities are domain-specific,
  not reusable Shopify Draft Order intake guarantees. Replenishment draft/on-order
  signals (`src/curlys_ops/stocky_replenishment_priority.py:885–907`) are aggregate
  purchasing inputs, not customer request identity or completion events.

### Target-aware acceptance gate

A read-only request view/feed is a possible first slice, not an approved contract.
Before implementation, both owners must approve direction/source ownership,
a dedicated versioned handoff/read endpoint, isolated least-privilege auth and
secret ownership, separate request/line/DraftOrder/Order namespaces, custom and
partial-item semantics, minimal fields, revisions/observation time, producer
idempotency, consumer upsert/replay/conflict rules, paging/completeness,
deletions/tombstones, retention and failure visibility. The owner has explicitly
chosen full captured request/customer context (above); do not strip names/contact/
custom notes under the superseded minimization proposal. This does not imply
payment credentials, unrelated history, public access or live transfer authority.
Ops `docs/runbooks/cross_repo_boundary_contract.md` owns the cross-repo requirements;
Books inputs stay one-way and accounting truth stays Books-owned.

Source/fixture acceptance, once a contract is approved: duplicates and uncertain
producer retry, edits/replay/version conflicts, custom items and partial items,
paging completeness, stale/deleted drafts, access denial and target outage.
Require the existing form to remain usable without Ops. Later auth/connectivity
and actual target acceptance need their own scoped authority. No fixture or live
pilot is introduced by this discovery documentation. Draft matching/deletion
changes remain a separate operator-held behavior decision.

## Intent

Keep the order form as a quick, simple request-capture surface. If Curlys Ops
can add useful purchasing, task, or follow-up context, link the resulting
request into Ops without making staff enter it twice or making either system
silently own the other's records.

The first useful milestone should be deliberately small: an approved,
server-to-server, **read-only** operational view of a request in Ops, linked
back to its Shopify Draft Order. Do not begin with shared mutable status,
Shopify writes from Ops, or customer-facing messages. Whether this is the right
first slice depends on the Ops-side review and operator decisions below.

## What this repository currently does

- `public/index.html` submits customer details, notes, product variants, and
  custom line items to `POST /order-request`.
- `worker/src/index.js` creates a Shopify Draft Order tagged `order-request`
  and `pending`, with some request/customer context in note attributes. The
  draft is also the workflow record; this repository has no separate database.
- `public/dashboard.html` presents those drafts, marks them ready, sends
  customer emails, and can complete requests by deleting their draft.
- The dashboard's supplier queue groups pending request demand and enriches it
  with a **read-only** Stocky supplier/purchase-order lookup. This is useful
  current precedent for operational context, but it is not evidence about
  Curlys Ops or an existing Order Form ↔ Ops contract.
- A manual and scheduled reconciliation looks for later Shopify orders by
  customer and variant. If any requested variant overlaps a later order, the
  current implementation hard-deletes the whole matching draft. Custom lines
  without variant IDs are skipped by this reconciliation.

## Why the draft-order boundary deserves attention

A Shopify Draft Order is currently doing double duty as a financial Shopify
object and as this app's request/workflow record. That keeps the implementation
small, but it creates limitations an Ops link should not copy blindly:

1. **Lifecycle history is destructive.** Completion and purchase reconciliation
   hard-delete drafts rather than retaining an explicit resolved request linked
   to an actual order. Reconciliation accepts any overlapping variant as a
   match, not a full item/quantity resolution.
2. **Request creation is not idempotent.** The form does not send a stable
   request key. If Shopify creates the draft but the browser loses the response,
   a retry can create another draft and potentially repeat notifications.
3. **Custom items have weak identity.** They carry title/price/quantity but no
   product, variant, or SKU identity, so automatic supplier matching and
   purchase reconciliation cannot reliably recognize them.
4. **The workflow vocabulary is implicit.** Tags such as `pending` and `ready`
   encode state on the draft. Ops status, purchasing status, customer
   notification state, and Shopify payment/order state must not be collapsed
   into one unreviewed status field.
5. **Existing dashboard API access is not an integration contract.** The
   dashboard's page-level password is not a server-to-server API boundary, and
   the worker currently permits cross-origin requests. Do not expose an Ops
   integration by reusing a UI route without first designing and validating
   backend authentication, authorization, and data minimization.

These are observations from this repository, not a mandate to replace the
current system. Any behavior change—especially retention/deletion,
reconciliation, or retry handling—needs its own scoped decision and verification.

## Candidate first integration boundary

Subject to target-side discovery and operator approval:

- Keep Shopify as the system that owns the draft and this Worker as the only
  component that talks to Shopify for this form.
- Let Ops consume a narrow request projection or notification from a trusted
  server-side integration. Do not call Ops directly from the browser or embed an
  Ops credential in a static page.
- Make the first Ops view read-only: show a request, useful item/supplier
  context, and a link/reference to the Shopify draft. Do not send writes back to
  Shopify or replace the existing dashboard yet.
- Use an Order Form request identifier that is stable across retries, and the
  Shopify draft ID as a separate external reference. Ops must upsert/deduplicate
  by the stable request identifier. The current app does not yet provide that
  idempotency contract.
- Represent catalog-backed and custom items differently. A catalog item can
  include Shopify variant ID, SKU, display name, and quantity; a custom item
  should remain explicitly `custom` / `unmatched` until staff resolve its
  identity. Avoid guessing that a title match is the same product.
- Include full captured request/customer context per the 2026-10-07 owner
  answer above, including names/contact details, custom text, notes and request
  prices. Preserve access controls and provenance. Exact schema, retention and
  safe transport remain contract work; no live copy occurs in this milestone.

**Transport is undecided.** A pull-based read-only projection may fit a small
pilot; a push/event feed may be better if Ops needs prompt updates. The current
system has no durable event outbox, so a webhook alone would need an explicit
retry/replay and delivery-failure design. A polling feed would need a stable
cursor, paging, backend authorization, and defined behavior for deleted or
updated drafts. Do not pick a transport until the Ops integration surface and
operational requirements are known.

Illustrative payload shape only (not an API commitment):

```json
{
  "contractVersion": 1,
  "requestId": "stable-order-form-id",
  "source": {
    "system": "curlys-order-form",
    "shopifyDraftOrderId": "draft-id",
    "shopifyDraftOrderName": "draft-name"
  },
  "status": "pending",
  "createdAt": "timestamp",
  "items": [
    {
      "kind": "shopify_variant",
      "variantId": "variant-id",
      "sku": "sku-or-null",
      "title": "display name",
      "quantity": 1
    },
    {
      "kind": "custom",
      "title": "staff-entered item",
      "quantity": 1,
      "identityStatus": "unmatched"
    }
  ]
}
```

The field names and status are illustrative only. They must be aligned with
Curlys Ops rather than implemented as written.

## Discovery questions before any wiring

1. What specific workflow in Curlys Ops should improve: purchasing, task
   follow-up, receiving, customer service, or something else?
2. What is the target record type and its canonical ID? Can it link to an
   external Shopify draft and survive a draft being closed or removed?
3. Which system owns each lifecycle transition? Is the form still the source of
   request intake, and does Ops own any status beyond purchasing/receiving?
4. What authentication, authorization, data retention, and audit facilities
   already exist in Ops? Which trusted server-side integration path is
   supported?
5. How are request retries, duplicate intake, delivery replay, backfills, and
   target downtime handled? What is the minimum durable state needed?
6. How should custom items, catalog identity changes, partial purchasing, and
   multiple requests for the same item behave?
7. **Visibility decided 2026-10-07:** full captured request/customer context,
   including names/contact and custom notes. Do not ask again about omitting it.
   Exact field mapping and retention/history remain source design gaps.
8. Should completion/reconciliation retain a resolved request and actual-order
   reference instead of deleting the draft? This is an operator-held decision,
   not implied by integration work.

## Suggested stages

1. **Target-aware discovery (current tracked task).** Review the Ops code and
   its operator workflow; update this document with verified target interfaces,
   data ownership, security, and one agreed use case. No runtime changes.
2. **Contract decision.** Approve IDs, item semantics, allowed fields, state
   ownership, transport, auth, retry/replay, and observability. Record
   unresolved lifecycle/deletion decisions separately.
3. **Read-only pilot.** If approved, deliver one narrow Ops view that links
   requests to Shopify drafts; test duplicates, custom items, stale/deleted
   drafts, outages, and access denial. Keep the existing form/dashboard usable
   when Ops is unavailable.
4. **Optional lifecycle extension.** Only after the pilot is proven, decide
   whether Ops actions should update the request. Add explicit authorization,
   idempotent commands, audit history, confirmation, and safe failure behavior
   before any cross-system writes.

## Scope and authority

This artifact does not authorize SSH access to another host, runtime edits,
customer-data export, new credentials, Shopify mutation, email changes, or
Cloudflare deployment. Target-specific discovery needs an explicitly permitted
source/review path. Any future behavior change requires its own acceptance and
verification; the integration is removable by removing the eventual adapter
and configuration, but no adapter is introduced here.

Tracked follow-up: [Issue #5](https://github.com/ThomasMcCrossin/curlys-order-form/issues/5)
and [its mission stub](missions/issue-5-curlys-ops-integration-discovery.md).
