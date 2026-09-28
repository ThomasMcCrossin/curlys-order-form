# Curly's Order Form mission: issue #3

> **Superseded (2026-09-28, branch `feat/require-email-refusal-gate`).** By owner
> decision, email (not phone) is now the required contact. A selected customer
> without an email gets an inline "Add email" link that reveals an email field and a
> "Customer refused to provide email" checkbox; a customer missing only a phone gets
> no prompt. If email is refused and there is no phone on file, a phone is required.
> The phone disclosure described below no longer exists; this stub is kept as dated
> evidence.

**Task.** Use progressive disclosure for a missing customer phone number.

**Scope.** Selected-customer UI in `public/index.html`: show a small “Add phone
number” link, reveal an inline field on demand, and retain the existing
customer/order flow. **Authority.** Inspect, edit, and run focused tests in one
task worktree after a future steward validates the packet; this stub does not
authorize launch or any live/external action.

**Non-goals.** No dedicated API endpoint, `write_customers` permission,
Shopify mutation, phone-policy decision, deployment, credentials, or unrelated
TODO conversion.

**Output.** Focused source change plus concise verification evidence.

**Acceptance.** A selected customer without a phone gets the minimal link; the
field is hidden until activated and expands inline; customers with a phone do
not get unnecessary UI; existing order behavior remains intact.

**Route.** `small-bounded-edit`, `luna-max-implementer`, Luna/max via the
canonical dispatcher. **Timeout.** 20 minutes. **Advisory envelope.** 50,000
processed tokens. **Deterministic check.** Focused missing-phone UI check plus
`git diff --check`.
**Parallelism.** Serial: this mission owns the selected-customer display path
and should not overlap edits to the same UI. **Escalation.**
`acceptance-contract-failed`, `authority-insufficient`, or
`conflicting-evidence` only.
