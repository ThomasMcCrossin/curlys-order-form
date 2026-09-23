# Curlys Order Form ↔ Curlys Ops — integration scaffold

**Status:** Concept only. No runtime wiring or behavior changes are included.
**Evidence boundary:** This scaffold is based on `curlys-order-form` source only. The
Curlys Ops codebase and its current interfaces have not been reviewed, so the
proposal below is a set of questions and candidate boundaries—not a description
of what Ops can already do.

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
- Send only the fields Ops needs. Customer name/contact details, free-form
  notes, prices, and other personal or commercially sensitive data should not
  be copied by default; approve each field's purpose and retention first.

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
7. Which customer fields (if any) are required in Ops, for what purpose, and
   with what retention? Can the initial view omit contact data and free-form
   notes?
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
