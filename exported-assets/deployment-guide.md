# Complete Deployment Guide

## Overview

You're going to deploy:
1. **Frontend**: HTML order form on Cloudflare Pages
2. **Backend**: Cloudflare Worker with API endpoints

Total cost: **$0/month** (within free tier limits)

---

## Part 1: Deploy the Worker (Backend)

### Step 1: Install Wrangler CLI

```bash
npm install -g wrangler
# or
pnpm install -g wrangler
```

### Step 2: Login to Cloudflare

```bash
wrangler login
```

This will open a browser window to authenticate.

### Step 3: Create Worker Project

```bash
mkdir order-form-worker
cd order-form-worker
wrangler init
```

When prompted:
- Name: `order-form-worker`
- Type: Choose "Fetch handler"
- TypeScript: No (we'll use JavaScript)
- Git: Yes

### Step 4: Replace Worker Code

Replace the contents of `src/index.js` (or `index.js`) with the improved worker code from the previous file.

### Step 5: Configure wrangler.toml

Edit `wrangler.toml`:

```toml
name = "order-form-worker"
main = "src/index.js"
compatibility_date = "2024-10-29"

[vars]
SHOPIFY_STORE = "your-store.myshopify.com"
# Replace with your actual Shopify store URL (without https://)
```

### Step 6: Set Secrets

These are sensitive values that shouldn't be in your code:

```bash
# Shopify Admin API token
wrangler secret put SHOPIFY_ADMIN_TOKEN
# When prompted, paste your Shopify Admin API access token

# Email configuration (if using Resend for notifications)
wrangler secret put RESEND_API_KEY
wrangler secret put FROM_EMAIL
wrangler secret put STAFF_EMAIL

# Flow webhook secret (optional, for back-in-stock notifications)
wrangler secret put FLOW_SHARED_SECRET
```

**How to get Shopify Admin API token:**
1. Go to Shopify Admin → Settings → Apps and sales channels
2. Click "Develop apps"
3. Create a custom app with these permissions:
   - `read_customers`, `write_customers`
   - `read_products`
   - `read_draft_orders`, `write_draft_orders`
4. Install the app and copy the Admin API access token

### Step 7: Deploy Worker

```bash
wrangler deploy
```

You'll get a URL like: `https://order-form-worker.your-account.workers.dev`

**Save this URL!** You'll need it for the frontend.

### Step 8: Test the Worker

```bash
# Test health check
curl https://order-form-worker.your-account.workers.dev/health

# Test customer search (should return empty array if no matches)
curl "https://order-form-worker.your-account.workers.dev/api/customers/search?q=test"

# Test product search
curl "https://order-form-worker.your-account.workers.dev/api/products/search?q=test"
```

---

## Part 2: Deploy the Frontend to Cloudflare Pages

### Option A: Direct Upload (Easiest - No Git Required)

1. **Download the order form HTML** from the app I generated above
2. **Go to Cloudflare Dashboard** → Pages
3. Click **"Create application"** → **"Pages"** → **"Upload assets"**
4. Create project name: `order-form`
5. Drag and drop the HTML file (or select it)
6. Click **"Deploy site"**

You'll get a URL like: `https://order-form.pages.dev`

7. **Update the HTML file**:
   - Open the HTML file in a text editor
   - Find the line: `const WORKER_URL = 'https://your-worker.workers.dev';`
   - Replace with your actual worker URL from Step 7
   - Re-upload to Cloudflare Pages (create new deployment)

### Option B: Git Deployment (Better for Version Control)

1. **Create a new GitHub repository**

```bash
mkdir order-form-frontend
cd order-form-frontend
git init
```

2. **Add the HTML file**
   - Save the order form HTML as `index.html`
   - Update `WORKER_URL` in the file

3. **Create a simple project structure**:

```
order-form-frontend/
├── index.html
└── README.md
```

4. **Push to GitHub**:

```bash
git add .
git commit -m "Initial order form"
git remote add origin https://github.com/yourusername/order-form.git
git push -u origin main
```

5. **Connect to Cloudflare Pages**:
   - Go to Cloudflare Dashboard → Pages
   - Click "Create application" → "Pages" → "Connect to Git"
   - Select your repository
   - Build settings:
     - Framework preset: None
     - Build command: (leave empty)
     - Build output directory: `/`
   - Click "Save and Deploy"

---

## Part 3: Custom Domain (Optional)

If you want to use your own domain like `orders.yourstore.com`:

### For Cloudflare Pages:

1. Go to your Pages project → Custom domains
2. Click "Set up a custom domain"
3. Enter: `orders.yourstore.com`
4. Follow instructions to add DNS records

### For the Worker:

Workers automatically work on your custom Pages domain, no extra setup needed!

---

## Part 4: Testing the Complete System

### Test Flow:

1. **Open your order form**: `https://order-form.pages.dev` (or your custom domain)

2. **Test Customer Search**:
   - Type a customer name/email in the search box
   - You should see autocomplete suggestions
   - Select a customer

3. **Test Product Search**:
   - Type a product name or barcode
   - You should see product suggestions with prices
   - Select a product and set quantity

4. **Submit an Order**:
   - Click "Create Draft Order"
   - Check your Shopify admin for the new draft order

5. **Check Shopify**:
   - Go to Shopify Admin → Orders → Drafts
   - You should see your draft order with the tag "order-request"

---

## Troubleshooting

### Issue: "CORS error" in browser console

**Solution**: Make sure your worker has CORS headers. Check that the `cors()` function is being called.

### Issue: "Failed to fetch" when searching

**Solutions**:
1. Check that `WORKER_URL` in the HTML matches your worker URL exactly
2. Make sure worker is deployed: `wrangler deploy`
3. Check browser console for specific error messages

### Issue: "Shopify API error"

**Solutions**:
1. Verify your Shopify Admin API token has the right permissions
2. Check that `SHOPIFY_STORE` is set correctly (no https://)
3. Make sure secrets are set: `wrangler secret list`

### Issue: "Product with ID xxx is no longer available"

**Solution**: This was your original error! It happens when you use the product ID instead of variant ID. The new worker code handles this properly by:
- Getting variant IDs from the product search
- Properly parsing variant IDs
- Handling products without explicit variants (they have a default variant)

### Issue: Customer/Product search returns empty results

**Solutions**:
1. Check that you have customers/products in Shopify
2. Try searching for something you know exists
3. Check worker logs: `wrangler tail` (in your worker directory)
4. Verify API token has read permissions

---

## Maintenance

### Updating the Frontend:

**Option A (Direct Upload)**:
1. Edit the HTML file
2. Go to Cloudflare Pages → your project → Upload new version

**Option B (Git)**:
```bash
# Edit files
git add .
git commit -m "Updated form"
git push
# Cloudflare Pages auto-deploys
```

### Updating the Worker:

```bash
cd order-form-worker
# Edit src/index.js
wrangler deploy
```

### Monitoring:

```bash
# View real-time logs
wrangler tail

# View worker analytics
# Go to Cloudflare Dashboard → Workers & Pages → order-form-worker → Metrics
```

---

## Going Further

### Add Features:

1. **Save recent customers** using Cloudflare KV for faster lookup
2. **Add product images** to autocomplete (already supported in worker)
3. **Barcode scanner integration** using device camera
4. **Print receipt** after creating draft order
5. **Offline mode** using Service Workers

### Security Enhancements:

1. **Add authentication**: Use Cloudflare Access to require login
2. **Rate limiting**: Add rate limits to prevent abuse
3. **Input validation**: Add more validation on the worker side

### Performance:

1. **Cache frequently searched items** using Cloudflare KV
2. **Lazy load product images**
3. **Prefetch common searches**

---

## Cost Estimate

Based on typical usage (20 orders/day, 2 staff):

| Service | Usage | Cost |
|---------|-------|------|
| Cloudflare Pages | Static hosting | **$0** (unlimited) |
| Worker requests | ~150/day | **$0** (free tier: 100k/day) |
| KV operations | 0 (not using yet) | **$0** |
| **TOTAL** | | **$0/month** |

You won't pay anything unless you exceed 100,000 worker requests per day (you're at 0.15% of that).

---

## Support

If you run into issues:

1. **Check worker logs**: `wrangler tail`
2. **Check browser console**: F12 → Console tab
3. **Check Shopify API logs**: Shopify Admin → Settings → Apps → Your custom app → API access
4. **Cloudflare docs**: https://developers.cloudflare.com/workers/
5. **Shopify docs**: https://shopify.dev/docs/api/admin-rest

---

## Quick Reference

### Useful Commands:

```bash
# Deploy worker
wrangler deploy

# View worker logs
wrangler tail

# List secrets
wrangler secret list

# Update a secret
wrangler secret put SECRET_NAME

# Test worker locally
wrangler dev
```

### Important URLs:

- Cloudflare Dashboard: https://dash.cloudflare.com
- Shopify Admin: https://your-store.myshopify.com/admin
- Worker URL: https://order-form-worker.your-account.workers.dev
- Pages URL: https://order-form.pages.dev

### File Locations:

```
order-form-worker/
├── src/
│   └── index.js          (Worker code)
├── wrangler.toml          (Worker config)
└── package.json

order-form-frontend/
└── index.html             (Order form HTML)
```
