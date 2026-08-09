# Doctrine conversion — 2026-08-09

## Result

The legacy task surfaces are preserved with historical banners. GitHub issues
#2 and #3, with exactly one matching mission stub each, are the only ready
technical work. Operator-held choices remain decisions. The canonical roadmap
is [docs/80_PROGRAM_ROADMAP.md](../80_PROGRAM_ROADMAP.md); the mission index is
[docs/missions/README.md](../missions/README.md).

## TODO mapping

Each of the 33 TODO checkboxes and the separate lines 84-86 decision is assigned
exactly once below. “Done/evidenced” records the supplied current evidence; it
does not independently reverify the claim.

| Source | Assignment | Disposition |
| --- | --- | --- |
| TODO 6-8 | Back-in-stock delivery policy | Operator hold |
| TODO 11 | Email branding | Operator hold |
| TODO 12-13 | Confirmation email item detail and quantities | Done/evidenced |
| TODO 16 | `FROM_EMAIL` sender change | Tracked configuration only; operator hold |
| TODO 17-19 | Logo, deliverability, and live sender configuration | Operator hold |
| TODO 31-33 | Product display title/vendor/format | Done/evidenced |
| TODO 36-37 | Parent-product grouping and expansion | Done/evidenced |
| TODO 38-39 | Limit grouped search to 10 products | GitHub issue #2 + mission stub |
| TODO 42-44 | Search debounce increase | Done/evidenced |
| TODO 45 | API-cost note | Historical context only |
| TODO 46 | Wait-for-typing UX rationale | Done/evidenced |
| TODO 59-60 | Missing-phone link and expandable field | GitHub issue #3 + mission stub |
| TODO 61 | Update customer record with new phone | Done/evidenced; live mutation authority remains held |
| TODO 62 | Minimal inline phone UI | GitHub issue #3 + mission stub |
| TODO 65 | Detect missing phone in customer display | Done/evidenced |
| TODO 66-67 | Endpoint and `write_customers` permission | Operator hold |
| TODO 78-81 | All statuses and status badges | Done/evidenced |
| TODO 84-86 | Default statuses versus toggle | Operator hold; not a checkbox |

## VERIFICATION_CHECKLIST mapping

All 41 checklist checkboxes are assigned exactly once. Lines 5-9 are legacy
checked assertions and were not independently reverified. Lines 29-71 are one
held Pages cutover/live-verification decision. Lines 76-79 are one held
optional Worker Git auto-deploy decision.

| Source | Assignment | Disposition |
| --- | --- | --- |
| Checklist 5-9 | Five legacy checked setup assertions | Historical checked assertions; not independently reverified |
| Checklist 29-32 | Pages deployment, URL, CSS, and rendering | Operator hold: Pages cutover/live verification |
| Checklist 35-39 | Customer/product search, variants, vendor, statuses | Operator hold: Pages/Worker live verification |
| Checklist 42-46 | Phone UI, validation, refusal, note, manual entry | Operator hold: live verification |
| Checklist 49-53 | Order creation and confirmation email | Operator hold: live verification |
| Checklist 56-64 | Complete workflow steps 1-9 | Operator hold: live verification |
| Checklist 68-71 | Domain, old project, links, future auto-deploy | Operator hold: Pages cutover/live decision |
| Checklist 76-79 | Worker Git connection, repository, path, push deploy | Operator hold: optional Worker Git auto-deploy |

The grouped rows above are non-overlapping contiguous source ranges and cover
5 + 4 + 5 + 5 + 5 + 9 + 4 + 4 = 41 checkboxes.

## Operator holds

No held choice was converted into an issue or mission. The holds are the
back-in-stock delivery policy; branding/sender/deliverability/live sender
configuration; customer endpoint and live permission; default-versus-toggle
status policy; Pages cutover and live verification; and optional Worker Git
auto-deploy with live verification.

## Supplied evidence and limits

Supplied implementation evidence names commits `c03e926`, `805c297`, and
`4b08b72`, and current paths `public/index.html`, `worker/src/index.js`, and
`worker/wrangler.toml`. There were zero pre-existing GitHub issues; the labels
`converted-from-todo`, `domain:product-search`, and
`domain:customer-experience` were created. The authenticated Sol root performed
the GitHub inventory and created those labels and issues; workers received no
credentials or GitHub authority. This conversion performed no deployment,
credential change, domain implementation, or external-system verification.
