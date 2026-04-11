# Curly's Order Form — Architecture

## Overview
Curly's Order Form is a lightweight order-request system built on static HTML/JS frontends and a Cloudflare Worker backend. It creates and manages Shopify Draft Orders for in‑store requests, with optional customer/staff email notifications and a staff dashboard for tracking pending/ready items.

## System Context

```
Staff/Customer Browser
   │
   ├─ Cloudflare Pages (static HTML/CSS/JS)
   │     ├─ /index.html (customer order form)
   │     └─ /dashboard.html (staff dashboard)
   │
   └─ Cloudflare Worker API
         ├─ Shopify Admin REST/GraphQL APIs
         └─ Resend Email API

Shopify Flow (webhook)
   └─ /flow/back-in-stock → Cloudflare Worker → Shopify Draft Orders + Resend
```

## Repository Layout
- `public/index.html`: customer order form UI + client logic.
- `public/dashboard.html`: staff dashboard UI + client logic.
- `worker/src/index.js`: Cloudflare Worker API and business logic.
- `worker/wrangler.toml`: Worker config and non‑secret environment variables.
- `docs/`: deployment and operational guides.
- `scripts/`: one‑off analysis utilities (not used at runtime).

## Runtime Components

### Frontend: Customer Order Form (`public/index.html`)
Responsibilities:
- Authenticate via IP whitelist check (`/api/auth/check-ip`), otherwise password login with “remember device” stored in `localStorage`.
- Autocomplete customer search (`/api/customers/search`) and product search (`/api/products/search`).
- Build line items (variants or custom items), validate phone numbers, and submit order requests (`/order-request`).

Key client configuration:
- `WORKER_URL`: Cloudflare Worker base URL.
- `ORDER_FORM_PASSWORD`: local password gate (client‑side only).

### Frontend: Staff Dashboard (`public/dashboard.html`)
Responsibilities:
- Authenticate via IP whitelist check or password.
- Load and render draft order requests (`/api/dashboard/orders`).
- Filter/search/sort in the UI and provide bulk actions.
- Mark items as ready (`/api/dashboard/orders/:id/ready`) and email customers (`/api/dashboard/orders/:id/email`).

Key client configuration:
- `WORKER_URL`: Cloudflare Worker base URL.
- `DASHBOARD_PASSWORD`: local password gate (client‑side only).

### Backend: Cloudflare Worker (`worker/src/index.js`)
Responsibilities:
- Provide a REST API for both frontends.
- Integrate with Shopify Admin REST/GraphQL APIs.
- Send customer/staff emails via Resend.
- Handle Shopify Flow “back in stock” webhook.

API endpoints:
- `GET /health`: health check.
- `GET /api/auth/check-ip`: returns whether request IP is whitelisted.
- `GET /api/customers/search?q=`: customer search via Shopify REST.
- `GET /api/products/search?q=`: product/variant search via Shopify GraphQL.
- `POST /order-request`: creates a Shopify Draft Order and sends emails.
- `GET /api/dashboard/orders`: lists open draft orders with `order-request` tag.
- `POST /api/dashboard/orders/:id/ready`: tags draft as ready.
- `POST /api/dashboard/orders/:id/email`: emails the draft order customer.
- `POST /flow/back-in-stock`: webhook for stock events.

## Data Model & State
State is stored in Shopify Draft Orders—there is no separate database.

Draft order usage:
- Tags:
  - `order-request` marks drafts created by this system.
  - `pending` / `ready` represents fulfillment readiness.
  - `no-email` when a customer email is missing.
  - `notified` when back‑in‑stock notifications are sent.
- `note`: free‑form staff notes.
- `note_attributes`:
  - `Request Source`, `Internal Ref`, `Customer Email`, `Customer Phone`.
  - `notified_variant_<id>` for back‑in‑stock tracking.
- Line items:
  - Variant‑based items (`variant_id`) for Shopify products.
  - Custom items with `title`, `price`, `quantity`.

## Key Flows

### 1) Customer search
1. UI calls `GET /api/customers/search?q=...`
2. Worker uses Shopify REST `/customers/search.json`
3. UI renders autocomplete results

### 2) Product search
1. UI calls `GET /api/products/search?q=...`
2. Worker tries barcode search (GraphQL `productVariants`)
3. If no barcode match, worker searches products by title (GraphQL `products`)
4. UI renders product groups and variant options

### 3) Order request creation
1. UI validates customer and line items
2. Worker finds or creates customer (email preferred; phone attach‑only)
3. Worker builds draft order payload and posts to Shopify REST
4. Worker optionally emails customer and staff via Resend
5. UI shows confirmation with Shopify admin link

### 4) Staff dashboard operations
1. UI loads orders from `GET /api/dashboard/orders`
2. Worker lists open draft orders and filters on tags
3. Staff can:
   - Mark ready (`POST /api/dashboard/orders/:id/ready`)
   - Email customer (`POST /api/dashboard/orders/:id/email`)

### 5) Back‑in‑stock webhook (Shopify Flow)
1. Flow triggers `POST /flow/back-in-stock` with shared secret
2. Worker matches pending drafts by variant ID
3. Worker emails customer (and optionally sends Shopify invoice)
4. Worker tags draft as notified

## External Integrations
- **Shopify Admin REST API**: customers + draft orders.
- **Shopify Admin GraphQL API**: product/variant search.
- **Resend API**: outbound email notifications.
- **Shopify Flow**: back‑in‑stock webhook sender.

Shopify API version used: `2024-10` (hardcoded in worker).

## Configuration & Secrets
Worker configuration is defined in `worker/wrangler.toml`:
- Non‑secret vars: `SHOPIFY_STORE`, `FROM_EMAIL`, `STAFF_EMAIL`, `STAFF_NOTIFY_ALL`, `AUTO_INVOICE_ON_STOCK`.
- Secrets (set in Cloudflare): `SHOPIFY_ADMIN_TOKEN`, `RESEND_API_KEY`, `FLOW_SHARED_SECRET`.

Frontend configuration (hardcoded in HTML):
- `WORKER_URL`
- `ORDER_FORM_PASSWORD` / `DASHBOARD_PASSWORD`

## Security & Access Model
- CORS is open (`Access-Control-Allow-Origin: *`).
- A basic IP whitelist check exists in the Worker for “trusted” access.
- Password gates are client‑side only and stored in `localStorage` when “remember device” is enabled.
- Shopify and Resend credentials live only in Worker secrets.

## Deployment Architecture
- **Cloudflare Pages** serves static frontend assets in `public/`.
- **Cloudflare Worker** serves the backend API and integrates with Shopify/Resend.
- Deployment instructions live in `DEPLOYMENT.md` and `docs/deployment-guide.md`.

## Observability & Operations
- Worker logs via `console` (viewable with `wrangler tail`).
- `GET /health` provides a basic uptime check.
- No structured logging or metrics beyond Cloudflare defaults.

## Failure Modes & Limits
- Shopify API rate limits can affect search and order creation.
- Missing or invalid Worker secrets prevent Shopify/Resend operations.
- Email delivery depends on Resend configuration and customer email presence.
- No caching: all searches hit Shopify directly.

## Known Gaps / Future Enhancements
See `TODO.md` for backlog items, including:
- Email templating improvements
- Product search refinements
- Enhanced phone number handling
- Optional caching or access controls
