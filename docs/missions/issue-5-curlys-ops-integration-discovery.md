# Curlys Order Form mission: issue #5

**Task.** Define a target-aware, minimal integration boundary between the Order
Form and Curlys Ops.

**Status.** Target source discovery recorded 2026-10-07; not dispatchable for
implementation. The current concept at
[`docs/integration-curlys-ops.md`](../integration-curlys-ops.md) includes the current
Ops owner's source-only packet (`relay_05bac4e54861`, Dispatch
`ctx_dc7a8c6a414d`, revision `52dae3d484fa3579ad85a73449bc93979ce60efa`).
No request-feed endpoint or approved Order Form principal was identified in the
inspected target surfaces. No live target inspection or integration occurred.

**Scope.** After the target project and review path are explicitly authorized,
inspect its existing data model, API/auth boundary, deployment, and operator
workflow. Update the concept with evidence-backed ownership, identifiers,
allowed data, transport, deduplication/replay, access controls, and one bounded
read-only first-slice acceptance plan.

**Non-goals.** No runtime code, credentials, customer-data transfer, Shopify
mutation, email changes, deployment, or change to draft completion/reconciliation.
Do not assume the illustrative payload in the concept is an existing or approved
Curlys Ops contract.

**Output.** Updated concept and a concise record of target evidence, unresolved
operator decisions, and an implementation-ready acceptance packet (if the
operator approves proceeding).

**Readiness.** Target source evidence is now available from the owning Ops
captain. Owner answer `orderform5-request-visibility-v1` (2026-10-07) chooses full
captured request/customer visibility, including names and data; the raw answer
is preserved in the discovery document. Do not re-ask or strip that context.
Implementation remains blocked on exact schema, identity/custom-item/lifecycle
rules, transport, isolated auth/secret boundary and target acceptance. No
implementation launch is authorized by this issue or stub. The owner challenged
the premature retention question; no horizon was selected and no re-ask is due.
Expiry remains out of scope unless a concrete approved storage design needs it.

**Source integration — 2026-11-08.** Fleet cleanup issue #676 explicitly authorizes
merge/deployment tonight. The retained discovery commits are integrated on top of
current `main`, without changing `public/`, `worker/` or deployment configuration;
never push the historical branch alone because its old runtime could auto-deploy.
This supersedes the historical local-only source delivery hold for this scoped
documentation integration, not the implementation or customer-data boundaries.

**Verification.** Check that all proposed interfaces are backed by target
source, that data ownership/security decisions are explicit, and that the
read-only scope does not imply cross-system writes; run `git diff --check`.

**Escalation.** Stop before writing target/runtime changes if the target, owner,
access boundary, or data authority is unclear; preserve the discovery findings
and identify the exact missing decision.
