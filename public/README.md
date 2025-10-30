# Public Frontend Files

This directory contains all frontend HTML pages that get deployed to Cloudflare Pages.

## Files

### `index.html`
**Order Form** - Main customer-facing page for creating order requests.

**Features:**
- Customer search and management
- Product search with variant selection
- Phone number validation
- Draft order creation
- Email notifications

**Access:** Root URL (e.g., `https://curlys-order-form.pages.dev`)

---

### `dashboard.html`
**Staff Dashboard** - Internal tool for managing pending orders.

**Features:**
- View all pending order requests
- Filter by custom items or status
- Mark items as arrived
- Email customers
- Direct links to Shopify admin

**Access:** `/dashboard.html` (e.g., `https://curlys-order-form.pages.dev/dashboard.html`)

**Password:** `curlys2025` (change in dashboard.html line 197)

---

## Deployment

These files are automatically deployed to Cloudflare Pages when you push to the `main` branch.

**Build Settings:**
- Build output directory: `public`
- No build command needed (static files)
