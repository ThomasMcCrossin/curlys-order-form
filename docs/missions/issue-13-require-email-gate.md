# Curly's Order Form mission: issue #13

**Task.** Make email the required customer contact. A "Customer refused to provide email" escape makes phone required instead. Phone is otherwise optional.

**Scope.** Form validation and the missing-email disclosure in `public/index.html`. In `worker/src/index.js`, `findOrAttachCustomer` attaches to a selected customer by id and adds an email only when that customer has none. Tests: `worker/tests/email-progressive.test.mjs` and `worker/tests/order-request-customer.test.mjs`. This supersedes the missing-phone disclosure acceptance in issue #3.

**Acceptance.** Manual entry requires an email, unless it is refused; then a phone is required. A selected customer with no email gets an inline email field. A customer missing only a phone is not prompted. A selected customer is never duplicated, and an existing email is never overwritten. `node --test worker/tests/*.test.mjs` passes.

**Retirement.** Revert the issue #13 commits.
