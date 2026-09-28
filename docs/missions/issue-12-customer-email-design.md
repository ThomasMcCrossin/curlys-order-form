# Curly's Order Form mission: issue #12

**Task.** Make every Worker-sent customer email first-class and apply the owner's 2026-09-28 communication decisions.

**Scope.** `worker/src/emails.js` (new; the single source of customer email copy), the call sites and escaping in `worker/src/index.js`, the `FROM_EMAIL` and `AUTO_INVOICE_ON_STOCK` vars in `worker/wrangler.toml`, and `worker/tests/emails.test.mjs`. Shopify draft-order notification templates are out of scope; drafts serve other store workflows.

**Owner decisions.** The store does not hold items. A back-in-stock event sends one message, our email; the Shopify invoice path stays in code but is switched off. The sender is `Curly's Sports & Supplements <orders@curlys.ca>` and reply-to stays `STAFF_EMAIL`. Custom items remain staff-only lookups with no stock email.

**Acceptance.** Every customer email has a preheader, a logo header, escaped dynamic values, a plain-text part, and a footer with the store name, address and phone. No email promises a hold or payment terms. Triggers, recipients and reply-to are unchanged. `node --test worker/tests/*.test.mjs` passes. Renders were checked at 600px, at 375px and in dark mode.

**Preconditions for deploy.** `orders@curlys.ca` exists in Google Workspace. The Resend `curlys.ca` domain is verified (DKIM at `resend._domainkey`, SPF on `send.curlys.ca`, checked 2026-09-28).

**Retirement.** Revert the issue #12 commits. To re-enable Shopify invoices, set `AUTO_INVOICE_ON_STOCK = "true"`.
