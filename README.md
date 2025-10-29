# Curlys Order Form

A customer order form application for Shopify with autocomplete search for customers and products.

## Project Structure

```
.
├── index.html              # Main order form (frontend)
├── docs/
│   ├── deployment-guide.md # Complete deployment instructions
│   └── improved-worker.md  # Cloudflare Worker code
├── scripts/                # Python utility scripts
└── README.md              # This file
```

## Features

- Customer search with autocomplete
- Product search with barcode support
- Manual customer entry
- Custom line items
- Real-time order total calculation
- Draft order creation in Shopify

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Cloudflare Worker
- **Platform**: Shopify (REST & GraphQL APIs)
- **Hosting**: Cloudflare Pages

## Quick Start

1. Review the [deployment guide](docs/deployment-guide.md)
2. Set up your Cloudflare Worker
3. Update the `WORKER_URL` in `index.html`
4. Deploy to Cloudflare Pages

## Configuration

Before deploying, you'll need:

- Shopify store access
- Shopify Admin API token
- Cloudflare account (free tier works)
- Wrangler CLI installed

See the [deployment guide](docs/deployment-guide.md) for detailed setup instructions.

## Cost

**$0/month** - Runs entirely on free tiers

## License

Proprietary - All rights reserved
