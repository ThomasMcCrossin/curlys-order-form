# Issue 35: order form partner polish

- Issue: https://github.com/ThomasMcCrossin/curlys-order-form/issues/35
- Scope: rank 7 of the partner UI scan, limited to the order form's store identity, typography, focus and customer-details control. Preserve the order workflow and business rules.
- Identity: use the store name and black/orange palette documented in `worker/src/emails.js`; the header is a text wordmark, not a new logo.
- Verification: local isolated customer and product browser recipes; Worker test suite. A prospect capture requires an approved real catalogue and must not invent a customer or submit an order.
- Deployment, production writes and publishing are outside this task.
