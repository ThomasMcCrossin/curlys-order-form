# Next Steps for Deployment

## Current Status ✅

- ✅ Worker code created and configured (`/worker/src/index.js`)
- ✅ Cloudflare Worker config ready (`/worker/wrangler.toml`)
- ✅ Shopify store configured: `curlys-sports-supplements.myshopify.com`
- ✅ All environment variables already set in Cloudflare (SHOPIFY_ADMIN_TOKEN, RESEND_API_KEY, etc.)
- ✅ Frontend HTML form ready (`/index.html`)
- ✅ Code pushed to GitHub: https://github.com/ThomasMcCrossin/curlys-order-form

## What's Left to Do 🎯

### 1. Deploy the Cloudflare Worker (5 minutes)

```bash
# Navigate to worker directory
cd "/Users/curlys/Curlys Order Form/worker"

# Login to Cloudflare (opens browser)
wrangler login

# Deploy the worker
wrangler deploy

# You'll get a URL like: https://curlys-order-form-worker.YOUR-ACCOUNT.workers.dev
# SAVE THIS URL - you need it for step 2!
```

**Note:** If the worker name conflicts with an existing one, either:
- Update `name` in `wrangler.toml` to match your existing worker, OR
- Choose a different name

The secrets (SHOPIFY_ADMIN_TOKEN, RESEND_API_KEY, FLOW_SHARED_SECRET) are already configured in Cloudflare and will be preserved.

### 2. Update HTML with Worker URL (1 minute)

Open `index.html` and find this line (around line 605):

```javascript
const WORKER_URL = 'https://your-worker.your-account.workers.dev';
```

Replace it with your actual worker URL from step 1.

### 3. Deploy to Cloudflare Pages (5 minutes)

**Option A: Direct Upload (Fastest)**
1. Go to: https://dash.cloudflare.com/
2. Click **Pages** → **Create application** → **Upload assets**
3. Project name: `curlys-order-form`
4. Drag and drop `index.html`
5. Deploy!

You'll get a URL like: `https://curlys-order-form.pages.dev`

**Option B: Connect GitHub (Better for updates)**
1. Go to: https://dash.cloudflare.com/
2. Click **Pages** → **Create application** → **Connect to Git**
3. Select: `ThomasMcCrossin/curlys-order-form`
4. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `/`
5. Deploy!

### 4. Test Everything (2 minutes)

1. Open your Pages URL (e.g., `https://curlys-order-form.pages.dev`)
2. Try searching for a customer
3. Try searching for a product
4. Create a test draft order
5. Check Shopify Admin → Orders → Drafts

## Quick Reference Commands

```bash
# Clone repo on another computer
git clone https://github.com/ThomasMcCrossin/curlys-order-form.git

# Deploy worker
cd worker && wrangler deploy

# View worker logs
cd worker && wrangler tail

# Test worker endpoints
curl https://YOUR-WORKER-URL/health
curl "https://YOUR-WORKER-URL/api/customers/search?q=test"
curl "https://YOUR-WORKER-URL/api/products/search?q=test"
```

## Environment Variables Already Set in Cloudflare

These are already configured in your Cloudflare Worker (don't need to set them again):

| Variable | Value | Type |
|----------|-------|------|
| SHOPIFY_STORE | curlys-sports-supplements.myshopify.com | Variable |
| SHOPIFY_ADMIN_TOKEN | *(hidden)* | Secret |
| RESEND_API_KEY | *(hidden)* | Secret |
| FROM_EMAIL | dwayne@curlys.ca | Variable |
| STAFF_EMAIL | dwayne@curlys.ca | Variable |
| STAFF_NOTIFY_ALL | true | Variable |
| AUTO_INVOICE_ON_STOCK | true | Variable |

**Note:** `FLOW_SHARED_SECRET` is stored as a Cloudflare secret (not in Git).

## Troubleshooting

**Worker deploy fails with "name already exists":**
- Check your existing workers at: https://dash.cloudflare.com/
- Either update `worker/wrangler.toml` name to match, or delete the old worker

**Customer/Product search returns empty:**
- Check worker logs: `wrangler tail`
- Verify SHOPIFY_ADMIN_TOKEN has correct permissions
- Test API token at: https://admin.shopify.com/store/curlys-sports-supplements/settings/apps/development

**CORS errors in browser:**
- Make sure worker is deployed
- Check WORKER_URL in index.html matches your actual worker URL
- Worker already has CORS headers enabled

## Files Structure

```
.
├── index.html              # Order form (needs WORKER_URL updated)
├── worker/
│   ├── src/index.js        # Worker code (ready to deploy)
│   ├── wrangler.toml       # Worker config (ready to deploy)
│   └── package.json        # Package info
├── docs/                   # Documentation
├── scripts/                # Python utilities
└── NEXT_STEPS.md          # This file
```

## Contact Info

- GitHub Repo: https://github.com/ThomasMcCrossin/curlys-order-form
- Shopify Admin: https://admin.shopify.com/store/curlys-sports-supplements
- Cloudflare Dashboard: https://dash.cloudflare.com/

---

**Estimated Total Time to Deploy: 15 minutes**

Good luck! 🚀
