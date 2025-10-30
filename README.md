# Curlys Order Form

A complete order management system for Shopify with customer/product search, staff dashboard, and automated notifications.

## Project Structure

```
.
├── public/                 # Frontend (deployed to Cloudflare Pages)
│   ├── index.html         # Customer order form
│   └── dashboard.html     # Staff management dashboard
├── worker/                # Backend (deployed to Cloudflare Workers)
│   ├── src/index.js      # API and business logic
│   └── wrangler.toml     # Worker configuration
├── docs/                  # Documentation
├── DEPLOYMENT.md          # Deployment guide
└── README.md             # This file
```

## Features

### Customer Order Form (`index.html`)
- Customer search with autocomplete
- Product search with variant support
- Barcode scanning
- Phone number validation
- Draft order creation in Shopify
- Email notifications with variant details

### Staff Dashboard (`dashboard.html`)
- View all pending order requests
- Filter by custom items or status
- Search by customer/order
- Mark items as arrived
- Email customers
- Direct Shopify links

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Cloudflare Worker
- **Platform**: Shopify (REST & GraphQL APIs)
- **Hosting**: Cloudflare Pages

## Quick Start

1. Review [DEPLOYMENT.md](DEPLOYMENT.md) for complete setup guide
2. Set up Git-connected Cloudflare Pages (frontend auto-deploys)
3. Set up Cloudflare Worker (backend API)
4. Configure environment variables in Worker

## URLs

- **Order Form**: `https://your-pages.pages.dev/` (or custom domain)
- **Dashboard**: `https://your-pages.pages.dev/dashboard.html` (password: `curlys2025`)
- **Worker API**: `https://curlys-order-form-worker.thomas-mccrossin.workers.dev`

## Configuration

Before deploying, you'll need:

- Shopify store with Admin API access
- Cloudflare account (free tier works)
- Resend account for emails (free tier: 3000/month)
- GitHub repository (for auto-deploy)

See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step instructions.

## Cost

**$0/month** - Runs entirely on free tiers

## License

Proprietary - All rights reserved
