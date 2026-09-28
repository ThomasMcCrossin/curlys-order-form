# Curly's Order Form mission: issue #16

**Task.** Move every Shopify Admin API call in the worker to the fleet-wide version 2026-07.

**Scope.** `worker/src/index.js` routes all REST and GraphQL calls through `shopifyAdminBase()`. That uses the `SHOPIFY_API_VERSION` var from `worker/wrangler.toml` and falls back to `DEFAULT_SHOPIFY_API_VERSION`; both are `2026-07`. Fields removed or deprecated at 2026-07 are replaced:
- `inventorySetQuantities` `compareQuantity` becomes `changeFromQuantity` with `@idempotent(key:)`.
- `Product.featuredImage` becomes `featuredMedia.preview.image`.
- `ProductVariant.image` becomes `media`.
- `InventoryItem.variant` becomes `variants`.

The tests and docs change with it: `architecture.md`, `DEPLOYMENT.md`, and both copies of `improved-worker.md`.

**Evidence.**
- All 8 GraphQL operations validate against the 2026-07 Admin schema with Shopify's dev-mcp validator, with no deprecations.
- The 2026-07 release notes list no REST changes for draft orders, customers or orders.
- `node --test worker/tests/*.test.mjs` passes.
- Live read-only proof on the preview and production Worker is recorded on the issue.

**Not proven live.** The write paths (draft create/update/invoice, customer create/update, the inventory mutation, reconcile) are covered by schema validation and mocked tests only. A live proof would need a real write, which needs owner approval.

**Retirement.** Change `SHOPIFY_API_VERSION` in `worker/wrangler.toml`, or revert the issue #16 commits.
