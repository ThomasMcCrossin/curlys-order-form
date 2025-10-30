# Deployment Guide - Curlys Order Form

## Current Setup

### Frontend (Cloudflare Pages)
- **Current URL**: https://a5869244.curlys-order-form.pages.dev
- **Repository**: https://github.com/ThomasMcCrossin/curlys-order-form
- **Branch**: `main`
- **Deployment Method**: Manual upload (needs migration to Git)

### Backend (Cloudflare Worker)
- **URL**: https://curlys-order-form-worker.thomas-mccrossin.workers.dev
- **Configuration**: `worker/wrangler.toml`
- **Auto-deploy**: Can be configured via Cloudflare Dashboard

---

## Setting Up Git Auto-Deploy

### Step 1: Create New Git-Connected Pages Project

1. Go to https://dash.cloudflare.com
2. Navigate to **Workers & Pages**
3. Click **Create application** → **Pages** → **Connect to Git**
4. Authorize GitHub and select: `ThomasMcCrossin/curlys-order-form`
5. Configure build settings:
   ```
   Project name: curlys-order-form
   Production branch: main
   Framework preset: None
   Build command: (leave empty)
   Build output directory: public
   Root directory: (leave empty)
   ```
6. Click **Save and Deploy**

**Note**: The `public/` directory contains:
- `index.html` - Main order form
- `dashboard.html` - Staff dashboard

### Step 2: Configure Worker Git Auto-Deploy

1. Go to **Workers & Pages** → **curlys-order-form-worker**
2. Navigate to **Settings** tab
3. Scroll to **Deployments** section
4. Click **Connect to Git**
5. Select repository: `ThomasMcCrossin/curlys-order-form`
6. Configure:
   ```
   Production branch: main
   Path to worker: worker/
   ```
7. Click **Save**

### Step 3: Verify Deployment

After setup, every push to `main` branch will:
- ✅ Auto-deploy the frontend (index.html) to Pages
- ✅ Auto-deploy the worker (worker/src/index.js) to Workers

---

## What Will Be The Same

### ✅ All Code & Functionality
- All HTML, CSS, and JavaScript in `index.html`
- All worker logic in `worker/src/index.js`
- All configurations in `worker/wrangler.toml`
- Phone validation, variant grouping, email settings - everything!

### ✅ Worker Configuration
- FROM_EMAIL: `tom@curlys.ca`
- STAFF_EMAIL: `tom@curlys.ca`
- AUTO_INVOICE_ON_STOCK: `true`
- All environment variables preserved

### ✅ Worker URL
- **Will NOT change**: `https://curlys-order-form-worker.thomas-mccrossin.workers.dev`
- Already configured in `index.html` (line 712)

---

## What Will Be Different

### Pages URL
- **Old**: https://a5869244.curlys-order-form.pages.dev
- **New**: https://curlys-order-form.pages.dev (cleaner!)
- Or you can set a custom domain in Settings

### Deployment Method
- **Before**: Manual upload via `wrangler pages deploy`
- **After**: Automatic on every `git push` to main

---

## Configuration Files Reference

### Frontend (Public Directory)
```
/public/
  ├── index.html      - Main order form
  └── dashboard.html  - Staff dashboard

/exported-assets/     - Static assets (unused)
```

### Backend (Worker Directory)
```
/worker/src/index.js     - Worker code
/worker/wrangler.toml    - Worker configuration
/worker/package.json     - Worker dependencies
```

### Worker Environment Variables (Already Configured)
```toml
SHOPIFY_STORE = "curlys-sports-supplements.myshopify.com"
FROM_EMAIL = "tom@curlys.ca"
STAFF_EMAIL = "tom@curlys.ca"
STAFF_NOTIFY_ALL = "true"
AUTO_INVOICE_ON_STOCK = "true"
FLOW_SHARED_SECRET = "BrownsCornerCanteen"
```

### Worker Secrets (Not in Git - Already Set in Cloudflare)
- `SHOPIFY_ADMIN_TOKEN` - Shopify Admin API access token
- `RESEND_API_KEY` - Resend.com API key for emails

---

## Manual Deployment (If Needed)

### Deploy Frontend Only
```bash
export CLOUDFLARE_API_TOKEN="your-token-here"
npx wrangler pages deploy public --project-name=curlys-order-form
```

### Deploy Worker Only
```bash
export CLOUDFLARE_API_TOKEN="your-token-here"
cd worker
npx wrangler deploy
```

---

## Testing After New Deployment

1. ✅ Load the new Pages URL
2. ✅ Test customer search (should hit worker API)
3. ✅ Test product search with variants
4. ✅ Test phone number validation
5. ✅ Create a test draft order
6. ✅ Verify emails are sent from `tom@curlys.ca`

---

## Rollback Plan

If something goes wrong:
1. Old manual-deploy project is still available at the hash URL
2. Worker is unaffected (separate deployment)
3. Can always redeploy manually using commands above

---

_Last updated: 2025-10-30_
