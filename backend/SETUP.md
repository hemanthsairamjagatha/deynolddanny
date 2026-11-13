# DEYNOLD DANNY Backend — Production Setup Guide

> Complete step-by-step deployment instructions for Cloudflare Workers.
> Read top to bottom. Every step is mandatory.

---

## Stack Overview

| Component | Technology | Purpose |
|---|---|---|
| Runtime | Cloudflare Workers | Edge compute, global PoPs, zero cold-start |
| Database | Cloudflare D1 (SQLite) | Orders, users, products, carts, wishlists |
| Cache / KV | Cloudflare KV | Catalog read cache, Shiprocket token (23h TTL) |
| Email | Resend | OTP, order confirmation, shipping, delivery emails |
| Payments | Razorpay | Indian gateway — UPI, cards, netbanking, wallets |
| Logistics | Shiprocket | Multi-courier aggregator (Blue Dart, Delhivery, etc.) |
| Framework | Hono v4 | Lightweight TypeScript web framework for Workers |

---

## 1. Prerequisites

```bash
# Node.js 20+
node -v   # >= 20.0.0

# Wrangler CLI
npm install -g wrangler@latest

# Authenticate with Cloudflare
wrangler login
```

---

## 2. Required Accounts

| Service | URL | What You Need |
|---|---|---|
| Cloudflare | cloudflare.com | Account with Workers, D1, KV access |
| Razorpay | razorpay.com | Live Key ID + Key Secret + Webhook Secret |
| Shiprocket | app.shiprocket.in | Account email + password + Channel ID |
| Resend | resend.com | API key + verified sending domain |

---

## 3. Environment Variables — Complete Reference

### 3.1 Secrets (set via `wrangler secret put` — NEVER commit to source control)

```bash
# ── JWT Secret ─────────────────────────────────────────────────────────────
# Generate: openssl rand -hex 32  (outputs a 64-char hex string)
wrangler secret put JWT_SECRET --env production

# ── Resend Email ───────────────────────────────────────────────────────────
# From: resend.com → API Keys → Create API Key
# Format: re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
wrangler secret put RESEND_API_KEY --env production

# ── Razorpay Payment Gateway ───────────────────────────────────────────────
# From: razorpay.com → Settings → API Keys → Live Mode
# Format: rzp_live_xxxxxxxxxxxxxxxx
wrangler secret put RAZORPAY_KEY_ID --env production

# Format: (the matching secret — typically 24 chars)
wrangler secret put RAZORPAY_KEY_SECRET --env production

# From: razorpay.com → Settings → Webhooks → Edit Webhook → Secret
# Generate your own random string — MUST match what you save in Razorpay dashboard
wrangler secret put RAZORPAY_WEBHOOK_SECRET --env production

# ── Shiprocket Logistics ────────────────────────────────────────────────────
# Your Shiprocket account login email address
wrangler secret put SHIPROCKET_EMAIL --env production

# Your Shiprocket account password
wrangler secret put SHIPROCKET_PASSWORD --env production

# ── Admin Access ────────────────────────────────────────────────────────────
# Comma-separated admin email addresses (must match users.email in DB)
# Example: admin@deynolddanny.com,director@deynolddanny.com
wrangler secret put ADMIN_EMAILS --env production
```

### 3.2 Public Variables (in `wrangler.toml` — safe to commit)

```toml
[env.production.vars]
ENVIRONMENT              = "production"
FRONTEND_URL             = "https://deynolddanny.com"
BACKEND_URL              = "https://api.deynolddanny.com"    # your Worker custom domain
ADMIN_URL                = "https://admin.deynolddanny.com"
MEDIA_BUCKET_PUBLIC_URL  = "https://media.deynolddanny.com"
SHIPROCKET_PICKUP_PINCODE = "400001"           # your warehouse 6-digit pincode
SHIPROCKET_CHANNEL_ID    = "1234567"           # from Shiprocket → Channels
```

### 3.3 Frontend Variables (root `.env` — git-ignored)

```env
# d:\Denold Danny\.env
PUBLIC_BACKEND_URL=https://api.deynolddanny.com
PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxx
```

### 3.4 Local Development (`.dev.vars` — git-ignored)

```env
# d:\Denold Danny\backend\.dev.vars  (copy from .dev.vars.example)
JWT_SECRET=dev_secret_at_least_64_chars_long_replace_before_production_do_not_use
RESEND_API_KEY=re_your_resend_api_key_here
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_test_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
SHIPROCKET_EMAIL=your@email.com
SHIPROCKET_PASSWORD=your_shiprocket_password
ADMIN_EMAILS=admin@deynolddanny.com
```

---

## 4. Cloudflare Resource Setup

### 4.1 D1 Database

```bash
# Create the D1 database (once — skip if already created)
wrangler d1 create deynold-danny-db

# Copy the returned database_id into wrangler.toml [[d1_databases]] → database_id

# Run ALL migrations in order:
npm run db:migrate:remote

# This chains:
#   0001_initial_schema.sql        — all tables, indexes, constraints
#   0002_seed_data.sql             — 8 categories, 16 products, images, coupons
#   0003_refresh_tokens_and_hardening.sql — refresh_tokens, shiprocket fields
#   0004_audit_logs.sql            — order_audit_logs table

# Verify tables are created:
wrangler d1 execute deynold-danny-db --remote \
  --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

### 4.2 KV Namespace

```bash
# Create KV namespace (once — skip if already created)
wrangler kv:namespace create CATALOG_KV --env production

# Copy the returned id into wrangler.toml [[kv_namespaces]] → id
```

### 4.3 Custom Domain (strongly recommended)

Cloudflare Dashboard → Workers & Pages → `deynold-danny-backend` → Settings → Custom Domains:
- Add `api.deynolddanny.com` → this becomes the `BACKEND_URL`

---

## 5. Razorpay Setup

### 5.1 Get Live API Keys

1. Login → [razorpay.com](https://razorpay.com) Dashboard
2. Top-right: switch to **Live Mode**
3. Settings → API Keys → **Generate Key**
4. Copy **Key ID** (format: `rzp_live_xxx`) and **Key Secret**
5. Set them via `wrangler secret put` (see Section 3.1)

### 5.2 Configure Webhook

1. Razorpay Dashboard → Settings → Webhooks → **Add New Webhook**
2. **Webhook URL:** `https://api.deynolddanny.com/api/payments/webhook`
3. **Secret:** generate a random string, set it via `wrangler secret put RAZORPAY_WEBHOOK_SECRET`
4. Enable these events:
   - ✅ `payment.captured`
   - ✅ `payment.failed`
   - ✅ `order.paid`
5. Save and verify the webhook is active (green status)

### 5.3 Test Mode (Development)

For local development, use test keys (`rzp_test_*`) in `backend/.dev.vars`.
Razorpay test card: `4111 1111 1111 1111`, any future date, any CVV.

---

## 6. Shiprocket Setup

### 6.1 Get Credentials

1. Login → [app.shiprocket.in](https://app.shiprocket.in)
2. Your login **email + password** are the API credentials — set them as secrets
3. Settings → Channels → note your **Channel ID** (numeric)
4. Settings → Pickup Locations → note your warehouse **pincode** (6 digits)

### 6.2 Configure Inbound Webhook

1. Shiprocket Dashboard → Settings → Webhooks (or API → Webhooks)
2. **Webhook URL:** `https://api.deynolddanny.com/api/webhooks/shiprocket`
3. Enable events:
   - ✅ Shipment Delivered
   - ✅ NDR (Non-Delivery Report)
   - ✅ RTO Initiated
   - ✅ Pickup Scheduled
   - ✅ Picked Up
4. Save

**What our webhook does:**
| Shiprocket Event | Our Action |
|---|---|
| `DELIVERED` | `orders.status = 'delivered'`, `delivered_at = now()`, send delivery email |
| `RTO INITIATED` | `orders.status = 'returned'`, audit log |
| `NDR` | `orders.status = 'ndr_pending'`, audit log (admin must action) |
| `PICKUP SCHEDULED` / `PICKED UP` | `orders.status = 'shipped'` (if `confirmed`) |

---

## 7. Resend Setup

### 7.1 Get API Key

1. Login → [resend.com](https://resend.com) → API Keys → **Create API Key**
2. Format: `re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
3. Set via `wrangler secret put RESEND_API_KEY --env production`

### 7.2 Verify Your Sending Domain

1. Resend → Domains → Add Domain → enter `deynolddanny.com`
2. Add the DNS TXT and MX records to your domain registrar (Cloudflare DNS, GoDaddy, etc.)
3. Resend will show "Verified" once DNS propagates (up to 24h)

**FROM address used:** `noreply@deynolddanny.com` (set in `src/services/resend.ts`)

**Emails sent by the backend:**
| Trigger | Email |
|---|---|
| OTP login | Verification code to customer |
| Order paid | Order confirmation with itemised receipt |
| Admin ships order | Dispatch notification with tracking number |
| Shiprocket DELIVERED | Delivery confirmation to customer |
| Contact form submitted | Enquiry notification to admin |

---

## 8. Deployment

```bash
cd "d:\Denold Danny\backend"

# 1. Install dependencies
npm install

# 2. Type check (must be 0 errors)
npm run type-check

# 3. Deploy to production
npm run deploy
# or:
wrangler deploy --env production
```

---

## 9. Database Migrations

```bash
# Run all migrations on remote D1 (production)
npm run db:migrate:remote

# Local development
npm run db:migrate:local
```

### Migration Chain

| File | Contents |
|---|---|
| `0001_initial_schema.sql` | All tables: users, otps, addresses, products, variants, images, cross-sells, carts, orders, order_items, wishlists, coupons, newsletter, admin_logs |
| `0002_seed_data.sql` | 8 categories, 16 products, product images, cross-sell relationships, WELCOME10 coupon |
| `0003_refresh_tokens_and_hardening.sql` | `refresh_tokens` table, Shiprocket columns on orders, `pincode_cache` table |
| `0004_audit_logs.sql` | `order_audit_logs` table, indexes |

---

## 10. Complete API Endpoint Reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | None | Health check |
| `POST` | `/api/auth/send-otp` | None | Send OTP to email |
| `POST` | `/api/auth/verify-otp` | None | Verify OTP → access + refresh tokens |
| `POST` | `/api/auth/refresh` | HttpOnly Cookie | Rotate refresh token → new access token |
| `GET` | `/api/auth/me` | Bearer | Current user from token |
| `POST` | `/api/auth/logout` | HttpOnly Cookie | Revoke refresh token |
| `GET` | `/api/products` | None | Product listing (paginated) |
| `GET` | `/api/products/:slug` | None | Product detail with variants, images |
| `GET` | `/api/products/featured` | None | Featured products |
| `GET` | `/api/categories` | None | All categories |
| `GET` | `/api/categories/:slug/products` | None | Products by category |
| `GET` | `/api/search` | None | Full-text product search |
| `GET` | `/api/cart` | Optional Bearer | View cart |
| `POST` | `/api/cart/items` | Optional Bearer | Add item to cart |
| `PATCH` | `/api/cart/items/:id` | Optional Bearer | Update item quantity |
| `DELETE` | `/api/cart/items/:id` | Optional Bearer | Remove item |
| `DELETE` | `/api/cart` | Optional Bearer | Clear cart |
| `POST` | `/api/cart/merge` | Bearer | Merge guest cart after sign-in |
| `POST` | `/api/checkout` | Bearer | Create order + Razorpay order |
| `POST` | `/api/payments/verify` | Bearer | Verify payment signature (client-side) |
| `POST` | `/api/payments/webhook` | None (signature verified) | Razorpay / Cashfree webhook |
| `GET` | `/api/payments/verify/:orderId` | Bearer | Fallback status query |
| `GET` | `/api/orders` | Bearer | List user's orders (paginated) |
| `GET` | `/api/orders/:id` | Bearer | Order detail (ownership verified) |
| `GET` | `/api/wishlist` | Bearer | User's wishlist |
| `POST` | `/api/wishlist` | Bearer | Add product to wishlist |
| `DELETE` | `/api/wishlist/:productId` | Bearer | Remove from wishlist |
| `GET` | `/api/wishlist/check/:productId` | Bearer | Is product in wishlist? |
| `GET` | `/api/users/me` | Bearer | User profile |
| `PATCH` | `/api/users/me` | Bearer | Update profile (name, phone) |
| `GET` | `/api/users/me/addresses` | Bearer | List saved addresses |
| `POST` | `/api/users/me/addresses` | Bearer | Add address |
| `PATCH` | `/api/users/me/addresses/:id` | Bearer | Update address |
| `DELETE` | `/api/users/me/addresses/:id` | Bearer | Delete address |
| `POST` | `/api/coupons/validate` | None | Real-time coupon check (read-only) |
| `POST` | `/api/newsletter/subscribe` | None | Newsletter subscribe |
| `GET` | `/api/newsletter/unsubscribe?token=` | None | Unsubscribe |
| `POST` | `/api/contact` | None | Contact form (rate-limited 3/hr) |
| `POST` | `/api/webhooks/shiprocket` | None (Shiprocket origin) | Delivery status updates |
| `GET` | `/api/admin/dashboard` | Admin Bearer | Analytics overview |
| `GET` | `/api/admin/orders` | Admin Bearer | All orders (paginated, filterable) |
| `GET` | `/api/admin/orders/:id` | Admin Bearer | Full order detail |
| `PATCH` | `/api/admin/orders/:id/tracking` | Admin Bearer | Manual tracking update |
| `POST` | `/api/admin/orders/:id/ship` | Admin Bearer | Auto-ship via Shiprocket |
| `GET` | `/api/admin/orders/:id/tracking` | Admin Bearer | Live Shiprocket tracking |
| `POST` | `/api/admin/orders/pincode-check` | Admin Bearer | Shiprocket serviceability |
| `GET` | `/api/admin/products` | Admin Bearer | Product management |
| `POST` | `/api/admin/products` | Admin Bearer | Create product |
| `PATCH` | `/api/admin/products/:id` | Admin Bearer | Update product |
| `DELETE` | `/api/admin/products/:id` | Admin Bearer | Deactivate product |
| `GET` | `/api/admin/inventory` | Admin Bearer | Stock levels |
| `PATCH` | `/api/admin/inventory/:variantId` | Admin Bearer | Update stock |
| `GET` | `/api/admin/customers` | Admin Bearer | Customer list |
| `GET` | `/api/admin/coupons` | Admin Bearer | Coupon list |
| `POST` | `/api/admin/coupons` | Admin Bearer | Create coupon |
| `PATCH` | `/api/admin/coupons/:id` | Admin Bearer | Update / deactivate coupon |

---

## 11. All Ecommerce Edge Cases Handled

| Scenario | Mechanism |
|---|---|
| Duplicate payment webhook | Atomic `UPDATE WHERE payment_status != 'paid'` idempotency lock |
| Payment captured for cancelled order | Webhook guard: skip if already paid/cancelled |
| OTP brute-force (3+ wrong attempts) | Auto-consume OTP at attempt 3; return `TOO_MANY_ATTEMPTS` (429) |
| Deactivated user account | 403 on OTP verify and on every token refresh |
| Cart empty at checkout | 400 `EMPTY_CART` with clear message |
| Item out of stock at checkout | Atomic stock hold per-item; rollback all on first failure |
| Client price tampering | Server always recalculates from DB; client amounts are ignored |
| Coupon race condition | Atomic `UPDATE WHERE used_count < usage_limit`; second winner gets rejected |
| Coupon pre-validation (UI) | `POST /api/coupons/validate` — read-only, no DB write |
| Shiprocket token expiry | Cached 23h in KV; auto-refreshes before expiry |
| Stock double-deduction | `commitStock` guards: `WHERE stock >= ?1`, `MAX(0, ...)` |
| Abandoned checkout | Cron every 5 min releases reservations older than 15 min |
| Refresh token reuse (stolen token) | Rotation: each refresh deletes old token and issues a new one |
| NDR (delivery failure) | Status `ndr_pending`; logged in `order_audit_logs`; admin must action |
| RTO (return to origin) | Status `returned`; logged in audit trail |
| Shiprocket DELIVERED webhook | Status `delivered`, `delivered_at` set, delivery email sent |
| Guest to user cart merge | `POST /api/cart/merge` called immediately after sign-in |
| Contact form spam | Rate limited: 3 submissions per email per hour (KV TTL) |
| Admin email verification | Only emails in `ADMIN_EMAILS` env var can access `/api/admin/*` |
| Access token expiry | 15-minute lifetime; frontend auto-refreshes via HttpOnly cookie |
| Session hijacking | Access token: in-memory only on client (no localStorage) |
| SQL injection | All D1 queries use `?1`, `?2` parameterized binds — no string interpolation |
| CORS attacks | Only `FRONTEND_URL` and `ADMIN_URL` origins allowed |
| XSS via CSP | Strict Content-Security-Policy with Razorpay/Google Fonts allowlist |

---

## 12. Local Development

```bash
# Backend
cd "d:\Denold Danny\backend"
npm install
cp .dev.vars.example .dev.vars          # fill in your test credentials
npm run db:migrate:local                 # create local D1 tables and seed data
npm run dev                              # → http://localhost:8787

# Frontend (separate terminal)
cd "d:\Denold Danny"
# Create .env from PUBLIC_BACKEND_URL and PUBLIC_RAZORPAY_KEY_ID
npm run dev                              # → http://localhost:4321
```

---

## 13. Monitoring

- **Logs:** Cloudflare Dashboard → Workers & Pages → `deynold-danny-backend` → Logs (real-time tail)
- **D1 Studio:** Dashboard → D1 → `deynold-danny-db` → Tables (inspect live data)
- **Request ID:** Every response includes `X-Request-ID` header for tracing
- **Error format:** `{ "success": false, "error": { "code": "...", "message": "...", "status": 4xx } }`
- **Structured logs:** `method path status duration requestId` on every request

---

## 14. Security Checklist

- [x] `JWT_SECRET`: 64-char random string (256 bits entropy) — never committed
- [x] HttpOnly, Secure, `SameSite=Strict` refresh token cookie
- [x] Access tokens: in-memory only on client (never `localStorage`)
- [x] `RAZORPAY_WEBHOOK_SECRET`: verified via HMAC-SHA256 on every inbound webhook
- [x] Parameterized D1 queries everywhere — no SQL injection possible
- [x] CORS: only `FRONTEND_URL` and `ADMIN_URL` origins allowed
- [x] Content-Security-Policy with Razorpay, Google Fonts allowlist
- [x] `ADMIN_EMAILS` gates all `/api/admin/*` access
- [x] Rate limiting: OTP (3/15 min per email), contact form (3/hr per email)
- [x] Server-side price recalculation: client amounts are ignored
- [x] Atomic stock reserve + commit pattern — no overselling
- [x] Refresh token rotation — stolen token is invalidated on use
- [x] `X-Request-ID` per request for incident correlation
- [x] `Permissions-Policy` header to block camera/mic/geolocation

---

## 15. Cron Job

The stock reaper runs every 5 minutes via Cloudflare Cron Trigger:
```
*/5 * * * *   → releaseExpiredReservations()
```

This releases stock held for carts where checkout was abandoned (older than 15 minutes).
Verify it's active: Dashboard → Workers → `deynold-danny-backend` → Triggers → Cron Triggers.

