# Curly's Order Form mission: issue #6

**Task.** Audit product-search usability across representative screen sizes and improve result relevance so title matches rank first and vendor matches rank second.

**Scope.** Read-only Playwright checks of the order form and Shopify-backed product-search endpoint; product relevance logic in `worker/src/index.js`; reproducible offline fixtures/tests; and a durable findings report. **Authority.** Inspect the live Pages UI and make read-only search requests to the production Worker. Edit and test in the issue worktree. Do not deploy or mutate Shopify, orders, customers, inventory, email, or Cloudflare configuration.

**Search coverage.** Sample product titles and vendors returned by broad searches, then exercise exact and partial title, vendor, variant, SKU, barcode, punctuation/case, and noisy multi-token queries. Avoid recording customer data or credentials.

**Viewport coverage.** At minimum: 320x568, 375x667, 390x844, 768x1024, 1024x768, 1280x720, 1440x900, and 1920x1080.

**Acceptance.** Evidence identifies UX defects and search-result noise; ranking is deterministic with exact/strong title matches first, vendor matches next, then variant/SKU/barcode or broader metadata matches; the 10-parent-product cap and grouped variants remain intact; focused automated checks and `git diff --check` pass.

**Outputs.** `docs/audits/2026-09-24-product-search-ui-ux.md`, automated test fixtures/checks, and any bounded source fix justified by the audit.

**Non-goals.** No deployment, visual redesign, customer-search data collection, Shopify mutation, secret access, or unrelated refactor.

**Retirement.** Revert the issue commit(s) and remove the issue row/report/tests; no persistent service or configuration is introduced.
