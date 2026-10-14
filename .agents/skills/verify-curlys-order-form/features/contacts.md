# Customer contact

Staff can search for a customer or enter one manually, add missing email inline,
and accept refusal only when a usable phone number is available.

## Sub-features

- `contact-select`: select an email-only customer without a missing-phone prompt.
- `contact-change`: return from the selected card to customer search.
- `contact-add-email`: explicitly reveal and focus the missing-email input.
- `contact-submit-gate`: submission also reveals a required missing-email field.
- `contact-refusal`: selected and manual customers without email need a phone.

## How to get to it (user POV)

- Open `/`, use **Search Customer**, then choose the autocomplete result.
- Choose **Change** on the selected card to search again.
- Choose **Add email**, or **Create Draft Order** while email is missing.
- Choose **Or enter customer details manually** below the search field.

## Driving it with Playwright

Preconditions: fresh launch, passing doctor and all three seeded customers.

Run `node "$S/drive.mjs" "$RUN" contacts --headless`.

- **Select.** `getByLabel('Search Customer', {exact: true}).fill('Avery')`, then
  click `#customerResults .autocomplete-item` containing `Avery Verify`.
  `#selectedCustomerName` matches; `#emailSection` and `#missingEmailPrompt` are hidden.
- **Change and add email.** Click button `Change`, search/select Nora, then click
  button `Add email`. `#customerEmailInput` has focus. Fill it with
  `nora@example.invalid`; capture `nora-email.png` and its ARIA snapshot.
- **Submission entry.** Change to Sam and click `Create Draft Order`.
  `#emailErrorNote` is visible; this proves implicit disclosure separately from
  the explicit Add email entry.
- **Refuse.** Check `#emailRefusedCheckbox`, submit, and require a visible
  `#phoneErrorNote` containing `required`. Fill label `Customer Phone Number`
  with `9025550101`; submission now reaches `Please add at least one item to the order`.
- **Manual path.** Change customer, click `Or enter customer details manually`,
  then submit. Require `#manualEmailErrorNote`. Check
  `#manualEmailRefusedCheckbox`; submit and require `#manualPhoneErrorNote`.
  Fill exact label `Phone` with `9025550102`; submit reaches the no-items error.
- **Proof.** `steps.json`, `avery`, `nora-email`, `refused-email` and
  `manual-gates` snapshots plus the audit prove that validation ran without
  sending an order request or mutating a customer. The submit recipe separately
  proves saving Nora's email through the real Worker.

## Gotchas

- Customer search debounces 300 ms; wait for the result, not a fixed sleep.
- These validation checks intentionally have no line items. Reaching the item
  error proves the contact gate accepted input; it does not prove submission.
- Do not restore the superseded missing-phone prompt. Email is required unless
  refused; a customer with email but no phone gets no extra prompt.
- Invalid phone format, phone-on-file refusal and remembered login are covered
  only where existing offline tests say so, not by this browser recipe.
