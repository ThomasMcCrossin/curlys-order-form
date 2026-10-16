# Issue #28 — dashboard order note

- Owning issue: https://github.com/ThomasMcCrossin/curlys-order-form/issues/28
- Branch: `dashboard/order-note-20261015`
- Scope: one Worker route and its dashboard control. No change to the order
  form's note-on-create behavior, no bulk action, no deployment credential work.

## Outcome and acceptance

Staff can add or edit a note on an order request that already exists, from the
request card in `public/dashboard.html`. The note is saved to the Shopify draft
order and shown on the card without a page reload.

Acceptance requires the existing offline gate, a Worker test that asserts the
exact `PUT /draft_orders/:id.json` payload, and a live readback on the deployed
Worker and Pages after the merge. The live readback reads; it does not mutate a
real draft order.

## Implementation and evidence

- Worker route `POST /api/dashboard/orders/:id/note` in `worker/src/index.js`.
- Dashboard control `editOrderNote()` and its Add/Edit Note buttons in
  `public/dashboard.html`.
- Focused test `worker/tests/order-note.test.mjs`; the new route is also added
  to the staff-boundary loop in `worker/tests/staff-auth.test.mjs`.

## Non-interactive decisions

- Write both `draft_order.note` and the legacy `Note` note attribute, because
  the dashboard reads the attribute first. A blank note drops the attribute
  rather than leaving a stale value that would shadow the cleared note.
- Cap notes at 2000 characters and refuse anything longer before touching
  Shopify.
- Keep the note mutation as an explicit button press; no automatic note writes.
