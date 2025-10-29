# TODO - Future Enhancements

## Customer Phone Number Handling

### For Existing Customers
- [ ] Add "+ Add phone number" link below customer details when selected customer has no phone
- [ ] Show expandable phone input field when clicked
- [ ] Update customer record in Shopify when order is created with new phone number
- [ ] Keep minimal UI - just a small link that expands inline

### Technical Implementation
- [ ] Modify customer selection display to check if phone is missing
- [ ] Add API endpoint to update customer phone number
- [ ] Ensure Shopify API permissions include `write_customers` scope

---

## Product Search - Include Draft/Archived Products

### Current Behavior
- Product search only returns ACTIVE products
- Draft and archived products are excluded by Shopify API default

### Needed Changes
- [ ] Update GraphQL queries to include all product statuses
- [ ] Add `status:ACTIVE OR status:DRAFT OR status:ARCHIVED` to search queries
- [ ] Add subtle status badges (e.g., "Draft", "Archived") next to product titles
- [ ] Style badges to be minimal and non-intrusive (small gray pills)

### Questions to Answer
- Should draft/archived products be included by default?
- Or add a toggle/checkbox to include them?
- Decision: _[To be determined]_

---

## Technical Notes

### Current Product Search Query
Located in: `/worker/src/index.js`
- Line 60: `productVariants(first: 10, query: $q)` - barcode search
- Line 97: `products(first: 10, query: $q)` - title search

Need to add status filter to both queries.

### Current Customer Display
Located in: `/index.html`
- Line 683-696: `selectCustomer()` function
- Line 487-502: Selected customer card HTML

Add phone input field conditionally in this section.

---

## Priority
- Low priority - current version is usable for production
- Implement when time allows
- Nice-to-have features that improve UX

---

_Last updated: 2025-10-29_
