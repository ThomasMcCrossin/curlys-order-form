# Request observation lifecycle — source contract candidate v1

Issue #5, 2026-10-07. This is one source-only qualifier, not an approved endpoint,
producer implementation, credential, persistent store or deployed integration.
Parent: [target discovery and owner decisions](../integration-curlys-ops.md).
Owner visibility answer at `218e3c5` requires full captured customer/request
context. Retention question `orderform5-removed-draft-retention-v1` is unanswered;
this contract defines **no expiry horizon, purge operation or deletion command**.

## Identity and observation boundary

An observation targets one source namespace tuple: source system `shopify`,
store key and Shopify `DraftOrder` GID. This identifies an existing source draft,
not a producer retry-stable request ID, final sales Order, Ops procurement draft
or receiving intent. The absent producer request/line ID and create-idempotency
contract remain separate gaps; do not manufacture them from customer, title/SKU,
variant overlap or an Ops integer ID.

A future authenticated observer supplies a source observation timestamp and one
of three typed outcomes. It must not confuse transport HTTP status with source
absence. The reference specimen assumes these attestations are already trusted;
it does not authenticate or discover a source. No customer lookup is performed.

| Outcome | Required evidence | Projection consequence |
| --- | --- | --- |
| `present` | Successful authorized observation, exact source identity, full request snapshot | Latest copied context, `observed`, eligible for active demand. Clear earlier absence evidence. |
| `absent` | Successful authorized exact lookup, or complete enumeration covering the draft and agreed scope | Keep last snapshot; label `source_unavailable`, exclude from active demand. Record first confirmed absence timestamp once. Never infer fulfilled/paid/cancelled. |
| `unavailable` | Failed refresh, outage, denied access, partial/incomplete enumeration or uncertain response | Preserve previous context/lifecycle/absence evidence and authoritative watermark. No first-absence timestamp and no expiry clock. |

The synthetic envelope names `authorized`, `success` and `complete` evidence.
These are specification inputs, not security controls a browser/client may
self-assert. Exact lookup classification, enumeration scope, source completeness,
observer clock ordering and authenticated adapter ownership need the later
approved transport/auth contract. Repeated calls over an unknown cursor or a
page missing an item are never complete evidence.

## Replay, ordering and restoration

- Each successful present/absent observation carries `observedAt` and
  `observationId`. Compare only observations for the exact same source tuple.
- Older observations cannot overwrite newer authoritative state. An exact
  replay at the latest timestamp is a no-op. A conflicting observation at the
  same timestamp fails visibly rather than guessing a winner.
- An unavailable observation does not advance the authoritative watermark; it
  cannot suppress an otherwise valid successful observation or start absence.
- Repeated confirmed absence keeps the first absence timestamp. A later present
  observation clears it and replaces the snapshot with all newly captured
  customer/request context. A later new absence begins a new absence episode.
- Missing source retains the complete last known snapshot, including customer
  names/contact, catalog/custom items, notes and request prices. It is a proposed
  internal projection, not financial/source truth. No historical revisions or
  paid/fulfilled audit completeness are claimed.

## Offline qualifier

Run only the self-contained synthetic reference specimen:

```sh
node docs/contracts/qualify-request-observation.mjs
```

It exercises the candidate semantics with reserved `fixture.invalid` customer
contact data, no network, credentials, filesystem writes, timer or operational
imports. It verifies full-context preservation, failed/incomplete observation,
confirmed absence, repeated absence, restoration, replay/out-of-order conflict
and source identity isolation. It is not connected to `public/` or `worker/` and
is not a second runtime implementation or live acceptance gate.

No expiry is implemented while the retention answer is pending. Even a later
retention answer covers only an eventual projection policy: never delete source
Shopify drafts/orders, original invoices/receipts/payment evidence, Books entries,
receiving records, financial originals or attachments. No outbound message,
production export/store/purge, credential change or matching/deletion behavior is
authorized here. Issue #20's user-token/unknown build-trigger hold remains
independent; source push/deployment is not part of this artifact.
