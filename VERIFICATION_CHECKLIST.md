# Verification Checklist - After Git Deploy Setup

## Before Creating New Git-Connected Pages Project

- [x] All code committed to GitHub
- [x] Worker deployed and working
- [x] Current manual-deploy Pages project accessible as backup
- [x] DEPLOYMENT.md guide created
- [x] .cloudflare-pages-ignore file created

## When Creating New Pages Project

### Configuration Settings to Use:
```
Project name: curlys-order-form
Production branch: main
Framework preset: None
Build command: (leave empty)
Build output directory: public
Root directory: (leave empty)
Environment variables: (none needed - frontend only)
```

**Important**: The `public/` directory contains both the order form and dashboard.

## After New Pages Project is Created

### Verify Frontend Works:
- [ ] Pages project deploys successfully
- [ ] New URL loads index.html correctly
- [ ] CSS styling appears correct
- [ ] Form sections render properly

### Verify Worker Connection:
- [ ] Customer search autocomplete works
- [ ] Product search autocomplete works
- [ ] Variant expansion works
- [ ] Product details show vendor name
- [ ] Status badges show for draft/archived products

### Verify Phone Number Features:
- [ ] Phone field appears when customer selected
- [ ] Phone validation works (10-11 digits)
- [ ] "Customer refused" checkbox works
- [ ] Verification note shows for existing phones
- [ ] Manual entry phone validation works

### Verify Order Creation:
- [ ] Can add products to order
- [ ] Can add custom line items
- [ ] Submit button works
- [ ] Draft order creates in Shopify
- [ ] Confirmation email sent from tom@curlys.ca

### Test Complete Workflow:
1. [ ] Search and select customer
2. [ ] Enter/verify phone number
3. [ ] Search for product (with variants)
4. [ ] Expand variants and select one
5. [ ] Add multiple items
6. [ ] Add order notes
7. [ ] Submit order
8. [ ] Verify draft order in Shopify
9. [ ] Verify email received

## After Verification Complete

- [ ] Update custom domain (if needed)
- [ ] Delete old manual-deploy project (optional)
- [ ] Update any bookmarks/links to new URL
- [ ] Test that future git pushes auto-deploy

## Worker Git Auto-Deploy (Optional)

If setting up Worker auto-deploy:
- [ ] Worker Settings → Connect to Git
- [ ] Select ThomasMcCrossin/curlys-order-form
- [ ] Set path to: worker/
- [ ] Verify worker deploys on git push

---

**Everything Should Be Identical** - The only difference is the Pages URL will be cleaner (curlys-order-form.pages.dev instead of a hash).

All functionality, styling, worker connection, and features will work exactly the same! ✅
