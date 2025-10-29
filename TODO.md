# TODO - Future Enhancements

## Email Improvements (HIGH PRIORITY)

### Back-in-Stock Email Flow
- [ ] Remove duplicate plain text email notification
- [ ] Only send the Shopify draft order invoice (it's better formatted and allows payment)
- [ ] Update AUTO_INVOICE_ON_STOCK behavior to not send plain text email alongside invoice

### Order Request Confirmation Email
- [ ] Make email look nicer/more branded
- [ ] Reference the specific item(s) they requested in the email body
- [ ] Show product names, quantities in confirmation

### Email Branding
- [ ] Change FROM email from `dwayne@curlys.ca` to `tom@curlys.ca`
- [ ] Add Curlys logo to email header
- [ ] Consider deliverability impact of images/branding
- [ ] Update FROM_EMAIL variable in Cloudflare Worker settings

### Technical Implementation
- Located in: `/worker/src/index.js`
- Email sending functions around lines 231-333
- sendResend() function around line 480+

---

## Product Search Improvements (HIGH PRIORITY)

### Display Changes
- [ ] Hide "Default Title" when variant title is "Default Title"
- [ ] Add **vendor name** to product subtitle (currently shows variant title)
- [ ] Format: `[Vendor] • $price • SKU: xxx • Barcode: xxx`

### Variant Grouping
- [ ] Collapse variants under their parent product
- [ ] Show parent product title with expandable variants
- [ ] Limit to **10 products** (not 10 variants)
- [ ] This allows browsing more products without variant clutter

### Search Debouncing
- [ ] Increase debounce delay to reduce API calls while typing
- [ ] Current: 300ms delay
- [ ] Suggested: 500-800ms delay
- [ ] Note: At 10-15 uses/week, API cost is negligible
- [ ] But better UX to wait for user to finish typing

### Technical Implementation
- Frontend: `/index.html` around lines 746-776 (displayProductResults)
- Backend: `/worker/src/index.js` lines 43-150 (product search queries)
- Need to add vendor field to GraphQL queries
- Need to modify display logic to group by product

---

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
