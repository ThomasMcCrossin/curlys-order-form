# Staff dashboard

Staff browse pending, ready and custom requests, narrow the list by focus or
search, select visible cards and choose a compact layout.

## Sub-features

- `dashboard-tabs`: Pending, Ready, Custom Items and All Orders show appropriate requests.
- `dashboard-focus`: the Critical metric and Focus dropdown filter the same list.
- `dashboard-sort`: newest-first ordering puts the newer request first.
- `dashboard-search`: name match, no matches and clearing update visible cards.
- `dashboard-selection`: select a card and clear selection without a bulk mutation.
- `dashboard-density`: Compact survives a reload in the disposable session.

## How to get to it (user POV)

- Open `/dashboard.html` directly from its URL; there is no tested order-form navigation link.
- Use the four tabs, the **Critical Aging** metric or the **Focus** dropdown.
- Use the **Sort** dropdown and the toolbar search field.
- Click a card's checkbox area and **Clear Selection**.
- Choose **Compact** in the header, then reload the page.

## Driving it with Playwright

Preconditions: fresh launch, passing doctor, #V301 pending/critical/custom for
Avery and newer #V302 ready/product for Nora. Start via trusted-network access.

Run `node "$S/drive.mjs" "$RUN" dashboard --headless`.

- **Tabs.** Initially `[data-order-id="301"]` is the one visible `.order-card`.
  Click `[data-tab="ready"]`: #V302 appears. Click `[data-tab="custom"]`: #V301
  appears. Click `[data-tab="all"]`: exactly two cards appear.
- **Focus/sort.** Click `[data-focus-filter="critical"]`; one card remains and
  `#focusFilterSelect` reads `critical`. Use `selectOption('all')` on that
  dropdown. Use `selectOption('newest')` on `#sortBySelect`; first card ID is 302.
- **Search.** Fill `#searchBox` with `Avery`, then press `End`; one card remains.
  Replace with `volcano` and press `End`; no cards and `#emptyState` visible.
  Clear the field and press `End`; two cards return.
- **Selection.** Click `[data-order-id="301"] .order-checkbox`; its card gains
  class `selected`. Click the first button matching `/Clear Selection/`;
  `.order-card.selected` count becomes zero.
- **Density.** Click exact button `Compact`, reload; body retains
  `density-compact` and #V301 is visible again in the default Pending tab.
- **Proof.** `steps.json`, `ready`, `all`, `empty-search`, and `compact-reloaded`
  screenshot/ARIA pairs show state transitions. The final audit requires no
  non-GET app request, added draft or captured message.

## Gotchas

- Search uses `onkeyup`, so Playwright `fill()` alone does not filter. Press
  `End` afterwards; do not call the internal filter function.
- Clear Selection appears in both toolbar and bulk bar. Scope the locator.
- Finite card-entry animations are disabled only for screenshots, otherwise
  an immediate capture can show a nearly transparent card.
- Missing snoozed/muted/Stocky seed data blocks those journeys. This recipe does
  not claim an empty tab proves reminders or supplier purchasing.
- Items Arrived, Completed/Delete, Email Customer, reminders, bulk mutations,
  Supplier Queue/CSV, Scan Purchases, Shopify links, print and keyboard shortcuts
  remain unmapped/unverified. Their API calls fail closed in this harness; never
  point the page at production to make them pass.
