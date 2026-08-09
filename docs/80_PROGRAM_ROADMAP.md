# Curly's Order Form Program Roadmap

This is the canonical task inventory for the legacy checklist conversion dated
2026-08-09. GitHub issues and their matching mission stubs are canonical for
ready technical work. The legacy surfaces remain available only as historical
provenance; see [TODO.md](../TODO.md), [VERIFICATION_CHECKLIST.md](../VERIFICATION_CHECKLIST.md),
and the [change record](changes/2026-08-09-doctrine-conversion.md).

## Ready technical work

| Issue | Mission | Scope | Route |
| --- | --- | --- | --- |
| [#2](https://github.com/ThomasMcCrossin/curlys-order-form/issues/2) | [Limit grouped product search results](missions/issue-2-limit-grouped-product-search-results.md) | Return at most 10 grouped products, not 10 variants. | `small-bounded-edit` / `luna-max-implementer` / max |
| [#3](https://github.com/ThomasMcCrossin/curlys-order-form/issues/3) | [Progressive disclosure for missing phone](missions/issue-3-progressive-disclosure-missing-phone.md) | Reveal a minimal inline phone input only when the selected customer has no phone. | `small-bounded-edit` / `luna-max-implementer` / max |

These are the only converted technical missions. Labels created for the
conversion are `converted-from-todo`, `domain:product-search`, and
`domain:customer-experience`. No pre-existing GitHub issues were present.

## Done or evidenced in the legacy record

The conversion records the legacy claims for confirmation-email content,
tracked sender configuration, product display and grouping, search debounce,
customer update behavior, and product-status search/badges. They are mapped
without reopening them as new tasks; see the source-line table in the change
record.

## Operator-held decisions

The following remain decisions for an authorized operator and are not issues:

- Back-in-stock delivery policy: remove the duplicate plain-text message versus
  send only the Shopify draft-order invoice, including the related
  `AUTO_INVOICE_ON_STOCK` behavior (TODO lines 6-8).
- Branding, sender, deliverability, and live `FROM_EMAIL` configuration (TODO
  lines 11 and 17-19; line 16 is tracked configuration only).
- Whether to authorize a dedicated customer-phone endpoint and the live
  `write_customers` permission (TODO lines 66-67).
- Whether draft and archived products are included by default or behind a
  toggle (TODO lines 84-86).
- Pages cutover and live verification, including URL, deployment, workflow,
  and optional old-project cleanup (the held checklist block at lines 29-71).
- Optional Worker Git auto-deploy and its live verification (checklist lines
  76-79).

## Evidence boundary

This roadmap relies on repository evidence plus the authenticated GitHub
inventory performed by the Sol root. Implementation evidence names commits
`c03e926`, `805c297`, and `4b08b72`, plus `public/index.html`,
`worker/src/index.js`, and `worker/wrangler.toml`. The conversion created the
three named labels and issues #2 and #3; it performed no deployment,
credential change, domain implementation, or external-system verification.
