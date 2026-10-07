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
captain. Implementation remains blocked on an approved request contract,
identity/custom-item/lifecycle rules, transport, data/auth/secret boundary and
bounded target acceptance. No implementation launch is authorized by this issue
or stub. Discovery documentation is committed locally only until source delivery
can avoid the known branch-push Worker deployment outside this issue's scope.

**Verification.** Check that all proposed interfaces are backed by target
source, that data ownership/security decisions are explicit, and that the
read-only scope does not imply cross-system writes; run `git diff --check`.

**Escalation.** Stop before writing target/runtime changes if the target, owner,
access boundary, or data authority is unclear; preserve the discovery findings
and identify the exact missing decision.
