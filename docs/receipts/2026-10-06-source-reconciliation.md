# Order Form source reconciliation — 2026-10-06

## Custody and scope

Continuing captain: `term_24937d41-6a67-4228-9a35-1bdf13e952ef`, Task
`task_7c255ca45c48`, Dispatch `ctx_53e200c9fdea`, Run `run_fb84fb7f9e9b`,
objective/workspace lease `372b257a-df27-4b1f-8f2a-ee427bfffdef`.
Read current brain issue #270 BODY and registered route plus semantic direction
ACK through the typed Run-home relay before repository writes.

This piece changes documentation only. No runtime code, new tests, Shopify
requests, actual customer/draft writes, email sends, credentials, deployment,
merge or issue closure. Claim recorded on existing issue #2. No other owner's
worktree, private material or money document was touched.

## Findings

- Reviewed `main` commit `caba4d8`. Issue #2's cap already exists;
  `worker/tests/product-search-cap.test.mjs` covers twelve parents capped at ten,
  duplicate-parent merging with grouped variants, title search, barcode/SKU
  selection, and retrieval-source failure handling. No duplicate implementation
  or new regression test is warranted by these results.
- Issue #3 remains OPEN but its mission explicitly records supersession by the
  2026-09-28 owner decision. CLOSED [issue #13](https://github.com/ThomasMcCrossin/curlys-order-form/issues/13)
  requires email with a refusal escape, then phone when needed. Current
  `public/index.html` and `email-progressive.test.mjs` implement/check that
  contract: missing phone alone produces no prompt. Restoring issue #3's old
  phone-only UI would contradict this later decision. Corrected the stale
  roadmap instead; acceptance/status reconciliation remains on existing issues.
- Issue #5 remains discovery-only. Its mission requires an explicitly authorized
  target-side review path and approved data/auth contract before implementation.
  No target inspection, connectivity or integration was performed.
- Read all own issue #2/#3/#5 comments using paginated REST retrieval; latest
  #2/#3 receipts are comments `5794363568` and `5794363894` (2026-09-23).
  These dated fixtures do not override issue #13's later contract.

## Verification

Ran the existing gate once against the source worktree based on `caba4d8`:

```sh
node --test worker/tests/*.test.mjs
```

Result: **45 tests, 45 pass, 0 fail, 0 skipped**. Included 14 product-search
checks and 6 inline contact-UI checks. Fixtures intercept fetch; Shopify,
Resend and inventory/draft operations are simulated, not live mutations.
Expected simulated rejection diagnostics and Node's existing module-type
warning occurred; no unrelated package changes were made.

Documentation checks: `git diff --check`; exact changed local mission/receipt
links checked for existence. Source-only evidence is not deployed acceptance.

## Remaining boundaries

Issue #2 needs source review/acceptance; #3 needs status reconciliation with its
already-recorded supersession, not a repeated operator phone-policy question.
Issue #5 needs the authorized target inspection path and contract approval.
Do not merge this PR into an auto-deploying branch under this nondeployment
scope. The continuing captain Task remains active after the PR/receipt.
