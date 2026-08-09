# Curly's Order Form mission: issue #2

**Task.** Limit grouped product search results to 10 products, not 10 variants.

**Scope.** Product-search grouping and display in `public/index.html`, with
the supporting query path in `worker/src/index.js` only if required by the
existing implementation. **Authority.** Inspect, edit, and run focused tests
in one task worktree after a future steward validates the packet; this stub
does not authorize launch or any live/external action.

**Non-goals.** No product-status policy, vendor redesign, deployment, Shopify
mutation, credentials, or unrelated TODO conversion.

**Output.** Focused source change plus concise verification evidence.

**Acceptance.** Search results contain no more than 10 distinct parent products;
variants remain grouped beneath their parent and existing selection behavior is
preserved.

**Route.** `small-bounded-edit`, `luna-max-implementer`, Luna/max via the
canonical dispatcher. **Timeout.** 20 minutes. **Advisory envelope.** 50,000
processed tokens. **Deterministic check.** Focused grouped-result check plus
`git diff --check`.
**Parallelism.** Serial: this mission owns the product-search behavior and
should not overlap edits to the same display path. **Escalation.**
`acceptance-contract-failed`, `authority-insufficient`, or
`conflicting-evidence` only.
