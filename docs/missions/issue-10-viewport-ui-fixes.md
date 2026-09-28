# Curly's Order Form mission: issue #10

**Task.** Audit the order form and staff dashboard across viewports with varied product/order data and fix text wrapping, overflow, clipping and small tap targets.

**Scope.** `public/index.html` and `public/dashboard.html` presentation only (CSS and markup attributes). **Authority.** Playwright against a local static server with every `*.workers.dev` request mocked and unmocked requests aborted; no production reads or mutations. Merge and deploy were owner-authorized on 2026-09-28.

**Viewport coverage.** 320x568, 375x667, 390x844, 414x896, 768x1024, 1024x768, 1280x800, 1440x900, 1920x1080, plus iPhone SE/13 profiles emulated in Chromium (WebKit libraries are missing on the audit host, so real Safari rendering is unverified).

**Acceptance.** No state × viewport has document-level horizontal scroll or off-screen elements; long unbroken titles, SKUs, emails and supplier names wrap inside their boxes; mobile tap targets are at least 40px except inline text links and checkboxes inside labelled rows; no JS behavior change; `node --test worker/tests/*.test.mjs` still passes.

**Known leftovers.** Prices lack thousands separators (JS formatting, out of scope); dashboard header buttons wrap unevenly at 1024px.

**Non-goals.** No redesign, JS logic change, Worker change, or Shopify/email mutation.

**Retirement.** Revert the issue #10 commits; no persistent service or configuration is introduced.
