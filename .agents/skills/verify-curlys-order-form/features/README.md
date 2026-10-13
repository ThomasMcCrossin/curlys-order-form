# Curlys Order Form verification map

This is the maintained source for user-facing verification. Read the matching
feature before driving it. Commands below use `S` and `RUN` from
[the launch instructions](../SKILL.md#launch).

## Baseline preconditions

- Launch a **fresh** instance for each recipe; `doctor` must pass.
- Synthetic customers: Avery Verify (101, email/no phone), Nora Verify (102,
  phone/no email), Sam Verify (103, neither). All email addresses are `.invalid`.
- Verify Protein has Chocolate (201, $12.50, no stock, barcode `9900000000201`,
  SKU `VERIFY-201`) and Vanilla (202, $15.00, three in stock).
- Dashboard seeds: #V301 pending/critical/custom for Avery; #V302 ready/product
  for Nora. Submit creates #V402 and #V403. No snoozed or muted draft is seeded.
- The browser enters via the existing trusted-network path. It has empty local
  storage, no real customer data and no production auth token.

## Driving conventions and proof

Run one full recipe with `node "$S/drive.mjs" "$RUN" FEATURE --headless`, choosing
one of the four literal feature names below. Each driver step pairs UI actions
with assertions and records them in `FEATURE/steps.json`. Supporting selectors
are listed for extending the same harness, not for bypassing its network guard.
Use labels first, existing IDs/data attributes when labels are unavailable.

Capture actions plus screenshot/ARIA state and network/state readback. Report
unmet preconditions as failures; never replace a difficult user path with an
internal function call. A passing recipe covers only its listed assertions,
not every sub-feature or integration mentioned in Gotchas. Retain failed proof
and clean up the owned instance after every attempt.

## Features

- [Customer contact](contacts.md) — `contacts`: search/select/change, inline
  missing-email entry, selected/manual refusal gates.
- [Products and line items](products.md) — `products`: text/variant, barcode,
  SKU, quantity/remove, custom item, no matches and Escape.
- [Create draft request](submit.md) — `submit`: selected-customer email update,
  custom request, reset/manual request, captured notifications, dashboard readback.
- [Staff dashboard](dashboard.md) — `dashboard`: direct page entry, four tabs,
  critical metric/dropdown focus, sort, search/empty/clear, selection and density.

## Coverage boundary

Primary surface: the two web pages. Secondary surface: Worker HTTP routes,
exercised through the pages plus the existing offline tests. There is no app
CLI. `/` is the order-form entry used by these recipes; `/index.html` is a static
alias served by the adapter but is not a separately proved entry point.

Password/remember-device entry, inventory-zero, supplier queue/CSV, purchase
reconciliation, ready/complete/email/reminder mutations, bulk mutation, print,
Shopify links and scheduled/Flow triggers are not seeded recipes. An attempt
at an unmapped API route fails closed with 501; unknown outbound calls are
recorded as blocked. Extend the fixture at the external-system boundary before
mapping those paths. Missing muted/snoozed/Stocky prerequisites are blockers,
not successful empty-result proofs of those workflows.
