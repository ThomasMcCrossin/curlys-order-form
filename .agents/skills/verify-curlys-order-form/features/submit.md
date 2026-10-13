# Create draft request

Staff create a draft request from a selected or manually entered customer and
line items, receive a reference, reset the form and find the request in the dashboard.

## Sub-features

- `submit-selected`: attach Nora by ID and add her previously missing email.
- `submit-custom`: save two custom items, price and special instructions.
- `submit-reset`: Create Another Order clears the previous form.
- `submit-manual`: create a new synthetic customer and a second draft.
- `submit-readback`: confirm both saved drafts through dashboard search.
- `submit-notification`: capture the Worker's notification intent at Resend's boundary.

## How to get to it (user POV)

- Open `/`, search/select a customer, then add items and choose **Create Draft Order**.
- Alternatively choose **Or enter customer details manually** before submitting.
- From success choose **Create Another Order** to start a second request.
- Open `/dashboard.html` directly and search by the displayed draft reference.

## Driving it with Playwright

Preconditions: fresh launch with exactly two seeded drafts; Nora (102) has no
email; the synthetic Resend adapter is enabled. Doctor passes.

Run `node "$S/drive.mjs" "$RUN" submit --headless`.

- **Prepare selected customer.** Search Nora in exact label `Search Customer`,
  click the Nora Verify autocomplete result, then button `Add email`. Fill
  `#customerEmailInput` with `nora@example.invalid`.
- **Prepare items.** Click `+ Add Custom Item`, fill Title `Verify Bottle`, Price
  `7.50`, Quantity `2`, then exact button `Add Custom Item`. Total is `$15.00`.
  Fill placeholder `Add any special instructions or notes...` with
  `Verification only: two bottles`. Capture `before-submit` screenshot/ARIA.
- **Submit.** Click exact button `Create Draft Order`; `#successText` contains
  `#V402`. Read-only fixture inspection requires customer 102's email update,
  a third draft attached to 102, two taxable bottles at `7.50`, the exact note
  and one captured notification addressed to `nora@example.invalid` containing
  the item. Capture `selected-success`.
- **Reset/manual entry.** Click `Create Another Order`; the empty item list and
  focused customer search return. Click `Or enter customer details manually`.
  Fill First Name `Morgan`, Last Name `Verify`, Email `morgan@example.invalid`;
  add the same two custom bottles. Submit yields `#V403`, four total drafts,
  and a second captured notification to Morgan. Capture `manual-success`.
- **Second view.** Navigate to `/dashboard.html`. Fill `#searchBox` with `#V402`
  and press `End` (keyup); exactly one `.order-card` shows Nora Verify and the
  saved note. Repeat with `#V403`; exactly one card shows Morgan Verify.
  Capture both `dashboard-*-readback` screenshot/ARIA pairs.
- **Proof.** `steps.json` and the trace show both actual button submissions.
  `requests.jsonl` records `/order-request` bodies/responses. `outbound.jsonl`
  records synthetic customer update/create, draft creates and Resend calls;
  `state-readback.json` plus the dashboard show the resulting state.

## Gotchas

- Run once per fresh instance: fixed expected IDs intentionally fail if baseline
  state was changed. Do not edit expected IDs merely to hide a bad precondition.
- The UI's Shopify admin link is not opened; even a local page can contain live
  external links. The browser guard would block that navigation.
- Email capture proves payload generation, not delivery. No real email, Shopify
  draft, customer record or production datastore is touched.
- Variant-only submission, refused-email submission, error recovery and phone
  update persistence are not proved by this custom-item recipe. Their existence
  in other tests is not browser-path evidence.
