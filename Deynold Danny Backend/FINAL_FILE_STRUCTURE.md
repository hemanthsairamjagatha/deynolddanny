# DEYNOLD DANNY — FINAL SYSTEM FILE STRUCTURE & DIRECTORY BLUEPRINT
**Version:** 2.0.0-PRODUCTION • **Status:** APPROVED & FINAL • **Target Platform:** Cloudflare Edge Ecosystem  
**Repository Strategy:** Clean Decoupled Multi-Project Architecture (Frontend, Backend Worker, Admin SPA)

---

## 1. HIGH-LEVEL REPOSITORY TOPOLOGY

The complete DEYNOLD DANNY luxury e-commerce ecosystem is divided into three cleanly isolated projects that can live in a single monorepo or three separate Git repositories:

```
DEYNOLD-DANNY-ECOSYSTEM/
├── frontend/               ← Astro 4 + React Islands (Hosted on Cloudflare Pages)
│                             Domain: deynolddanny.com
├── backend/                ← Cloudflare Worker + Hono.js + D1 + KV + R2 + Queues
│                             Domain: api.deynolddanny.com
├── admin/                  ← Standalone React + Vite Admin SPA (Cloudflare Pages)
│                             Domain: admin.deynolddanny.com
└── shared/                 ← Common TypeScript interfaces & Zod validation schemas
```

---

## 2. FRONTEND FILE STRUCTURE (`frontend/`)
> Built with Astro 4 (Static Site Generation + React Islands). Delivers sub-second load times and zero unnecessary client-side JavaScript.

```
frontend/
├── .astro/                                ← Astro generated type cache
├── public/                                ← Static public assets served from root
│   ├── favicon.ico
│   ├── logo.png                           ← DEYNOLD DANNY official anchor monogram logo
│   ├── hero-banner.png                    ← High-resolution hero banner (1521x855)
│   └── images/                            ← High-res editorial and product images
│       ├── category-denim-sweatshirts.jpg
│       ├── category-shirts.jpg
│       ├── category-polo-t-shirts.jpg
│       ├── category-hoodies.jpg
│       ├── category-denim-shirts.jpg
│       ├── category-felpe.jpg
│       ├── category-scarpe.jpg
│       ├── category-accessori.jpg
│       ├── mastery-men-1.jpg
│       ├── mastery-men-1-hover.jpg
│       ├── mastery-men-2.jpg
│       ├── mastery-men-2-hover.jpg
│       ├── style-space-1.jpg
│       ├── style-space-1-hover.jpg
│       ├── news-men-1.jpg
│       └── news-men-1-hover.jpg
│
├── src/
│   ├── env.d.ts                           ← Astro & environment variable type definitions
│   │
│   ├── components/
│   │   ├── astro/                         ← Zero-JS Static Components (Server-rendered HTML)
│   │   │   ├── Header.astro               ← 2-tier header, CSS drawer, logo, utility icons
│   │   │   ├── HeroBanner.astro           ← Hero campaign banner & search strip overlay
│   │   │   ├── CategoryGrid.astro         ← 6-card editorial collection grid (3x2 layout)
│   │   │   ├── EditorialDuo.astro         ← 2-card bottom showcase (Scarpe & Accessori)
│   │   │   └── Footer.astro               ← Minimalist white footer, navigation & newsletter
│   │   │
│   │   └── react/                         ← Hydrated Interactive Islands (`client:load`)
│   │       ├── ProductCard.tsx            ← Product card with hover swap, size strip, quick buy
│   │       ├── ProductCarousel.tsx        ← Horizontal luxury carousel with model/flat toggle
│   │       ├── CartDrawer.tsx             ← Slide-over cart, live qty, subtotal in INR, checkout
│   │       ├── CartTrigger.tsx            ← Header bag trigger with live atom quantity counter
│   │       ├── AuthModal.tsx              ← Passwordless 6-digit OTP login/signup modal
│   │       ├── AccountPanel.tsx           ← Customer profile, address manager & orders
│   │       ├── WishlistDrawer.tsx         ← Slide-over saved products panel
│   │       ├── SearchOverlay.tsx          ← Real-time debounced full-screen search
│   │       └── CheckoutFlow.tsx           ← Multi-step address, coupon & Cashfree pay
│   │
│   ├── layouts/
│   │   ├── Layout.astro                   ← Master HTML wrapper, Google Fonts & SEO meta tags
│   │   └── AccountLayout.astro            ← Client portal layout with navigation sidebar
│   │
│   ├── pages/
│   │   ├── index.astro                    ← Main Flagship Homepage (Currently Built)
│   │   │
│   │   ├── products/
│   │   │   └── [slug].astro               ← Dynamic Product Detail Page (PDP)
│   │   │
│   │   ├── category/
│   │   │   └── [slug].astro               ← Category collection page with filters
│   │   │
│   │   ├── checkout/
│   │   │   ├── index.astro                ← Secure checkout landing page
│   │   │   └── return.astro               ← Cashfree payment return & invoice confirmation
│   │   │
│   │   ├── account/
│   │   │   ├── index.astro                ← Client profile and default addresses
│   │   │   └── orders/
│   │   │       ├── index.astro            ← Customer order history list
│   │   │       └── [id].astro             ← Detailed invoice & live shipment tracker
│   │   │
│   │   ├── wishlist.astro                 ← Dedicated wishlist page
│   │   ├── search.astro                   ← Search results page
│   │   ├── about-us.astro                 ← Brand heritage, atelier & craftsmanship story
│   │   ├── contact-us.astro               ← Client care, concierge & atelier contact
│   │   ├── privacy-policy.astro           ← GDPR & Indian DPDP compliant privacy policy
│   │   ├── terms-and-conditions.astro     ← Luxury e-commerce terms of sale
│   │   ├── shipping-delivery.astro        ← Domestic & international logistics policy
│   │   └── return-exchange.astro          ← 14-day complimentary return guidelines
│   │
│   ├── stores/                            ← Global Client State (Nanostores)
│   │   ├── cartStore.ts                   ← Cart atom, subtotal calculation, drawer toggle
│   │   ├── authStore.ts                   ← JWT access token, user session atom
│   │   ├── wishlistStore.ts               ← Wishlisted item IDs atom
│   │   └── searchStore.ts                 ← Query string, results, recent searches atom
│   │
│   ├── lib/                               ← Client-Side Utilities
│   │   ├── api.ts                         ← Type-safe fetch client with auto-refresh JWT
│   │   ├── cashfree.ts                    ← Cashfree Web SDK loader & checkout trigger
│   │   └── formatters.ts                  ← Currency (INR paise to ₹), dates, sizes
│   │
│   ├── styles/
│   │   ├── global.css                     ← Tailwind base styles and font declarations
│   │   └── luxury-custom.css              ← Bespoke luxury styling (62KB production CSS)
│   │
│   ├── types/
│   │   ├── ecommerce.ts                   ← CartItem, ProductCardData, CategoryCardData
│   │   └── api.ts                         ← Client-side request/response DTOs
│   │
│   └── data/
│       └── products.ts                    ← Static fallback seed products & categories
│
├── .gitignore
├── astro.config.mjs                       ← Astro config with React & Tailwind integrations
├── package.json                           ← Frontend scripts and package dependencies
├── tailwind.config.mjs                    ← Tailwind CSS design system tokens and colors
└── tsconfig.json                          ← TypeScript strict configuration
```

---

## 3. BACKEND WORKER FILE STRUCTURE (`backend/`)
> Built with Cloudflare Workers + Hono.js. Runs entirely on V8 edge isolates with 0ms cold starts, native WebCrypto, and native Cloudflare D1/KV/R2/Queues bindings.

```
backend/
├── migrations/                            ← Cloudflare D1 SQL Migrations
│   ├── 0001_initial_schema.sql            ← Tables: users, otps, addresses, products, orders...
│   └── 0002_seed_data.sql                 ← Complete 15 products & 65+ variants seed
│
├── src/
│   ├── index.ts                           ← Worker Entrypoint: Hono App, CORS, Cron routing
│   │
│   ├── config/                            ← Environment & Constants
│   │   ├── constants.ts                   ← Shipping thresholds, tax rates, cookie configs
│   │   └── env.ts                         ← Typed Cloudflare Worker environment bindings
│   │
│   ├── db/                                ← Database Access Layer
│   │   ├── client.ts                      ← D1 prepared statement runner & transaction helpers
│   │   └── queries/                       ← Modular, pre-compiled SQL query builders
│   │       ├── users.ts                   ← User lookup, creation, profile updates
│   │       ├── otps.ts                    ← OTP storage, hash comparison, consumption
│   │       ├── products.ts                ← Catalog filtering by section, pagination, PDP
│   │       ├── inventory.ts               ← Atomic stock holds, commits, and rollbacks
│   │       ├── cart.ts                    ← Server cart persistence & guest cart merge
│   │       ├── orders.ts                  ← Order creation, status updates, invoice fetch
│   │       └── analytics.ts               ← Admin revenue aggregation & sales velocity
│   │
│   ├── middleware/                        ← HTTP Request Pipelines
│   │   ├── cors.ts                        ← Strict Origin validation (Production + Admin)
│   │   ├── auth.ts                        ← Customer JWT authentication (HS256 validation)
│   │   ├── adminAuth.ts                   ← Admin role & email whitelist gatekeeper
│   │   ├── rateLimit.ts                   ← D1-backed sliding-window rate limiter
│   │   ├── errorHandler.ts                ← Global RFC-7807 error formatter
│   │   └── securityHeaders.ts             ← HSTS, CSP, X-Frame-Options, Referrer-Policy
│   │
│   ├── routes/                            ← Public & Customer API Endpoints
│   │   ├── auth.ts                        ← POST /send-otp, POST /verify-otp, POST /refresh
│   │   ├── products.ts                    ← GET /products, GET /products/:slug, GET /products?section=
│   │   ├── categories.ts                  ← GET /categories, GET /categories/:slug
│   │   ├── cart.ts                        ← GET /cart, POST /items, PATCH /:id, POST /merge
│   │   ├── checkout.ts                    ← POST /initiate (Cart validate & stock hold)
│   │   ├── payments.ts                    ← POST /webhook, GET /verify/:orderId
│   │   ├── orders.ts                      ← GET /orders, GET /orders/:id
│   │   ├── wishlist.ts                    ← GET /wishlist, POST /:id, DELETE /:id
│   │   ├── search.ts                      ← GET /search (FTS5 full text search)
│   │   ├── users.ts                       ← GET /me, PATCH /me, addresses CRUD
│   │   └── newsletter.ts                  ← POST /subscribe, POST /unsubscribe
│   │
│   ├── routes/admin/                      ← Protected Admin Panel Endpoints
│   │   ├── index.ts                       ← Admin router with adminAuth middleware applied
│   │   ├── dashboard.ts                   ← GET /analytics/overview, GET /analytics/revenue
│   │   ├── products.ts                    ← POST /products, PATCH /:id, DELETE /:id
│   │   ├── inventory.ts                   ← GET /matrix, PATCH /stock, POST /bulk-adjust
│   │   ├── orders.ts                      ← GET /orders, PATCH /:id/status, POST /:id/refund
│   │   ├── customers.ts                   ← GET /users, GET /users/:id, PATCH /:id/status
│   │   ├── coupons.ts                     ← GET /coupons, POST /coupons, DELETE /:id
│   │   └── uploads.ts                     ← POST /presign (Direct client-to-R2 upload token)
│   │
│   ├── services/                          ← Core Business Logic & External Integrations
│   │   ├── crypto.ts                      ← WebCrypto SHA-256 OTP hashing & random token gen
│   │   ├── jwt.ts                         ← Jose-based HS256 JWT sign, verify & cookie parser
│   │   ├── resend.ts                      ← Resend API client (OTP & Order email templates)
│   │   ├── cashfree.ts                    ← Cashfree Orders API, fetch order & HMAC check
│   │   ├── stockEngine.ts                 ← Atomic inventory hold, commit & timeout rollback
│   │   ├── cache.ts                       ← Cloudflare KV catalog caching helper (5-min TTL)
│   │   └── r2Storage.ts                   ← R2 bucket operations & presigned PUT generator
│   │
│   ├── queues/                            ← Cloudflare Queue Consumers (Async Workers)
│   │   └── emailConsumer.ts               ← Background transactional email dispatcher
│   │
│   ├── crons/                             ← Scheduled Background Triggers
│   │   └── inventoryReaper.ts             ← Releases stock for unpaid carts older than 15 mins
│   │
│   └── types/                             ← TypeScript Type Declarations
│       ├── bindings.d.ts                  ← Cloudflare Env (DB, KV, R2, EMAIL_QUEUE, secrets)
│       ├── models.ts                      ← Database entity interfaces (Product, Order, etc.)
│       └── api.ts                         ← Request body schemas & response contracts
│
├── .editorconfig
├── .gitignore
├── package.json                           ← Backend dependencies (Hono, Zod, Jose, Nanoid)
├── tsconfig.json                          ← Worker TypeScript compiler configuration
└── wrangler.toml                          ← Complete Cloudflare deployment configuration
```

---

## 4. STANDALONE ADMIN PANEL (`admin/`)
> Built with React 18 + Vite + Tailwind CSS. Deployed on Cloudflare Pages. Protected at the edge by Cloudflare Zero Trust Access. Directly administers D1, KV, and R2.

```
admin/
├── public/
│   ├── favicon.ico
│   └── admin-logo.png                     ← DEYNOLD DANNY Atelier Admin Logo
│
├── src/
│   ├── main.tsx                           ← React DOM mount point & QueryClientProvider
│   ├── App.tsx                            ← Router configuration (React Router 6)
│   │
│   ├── assets/                            ← Admin SVG icons and styles
│   │   └── admin.css                      ← Admin design system and typography
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AdminLayout.tsx            ← Authenticated app shell with persistent sidebar
│   │   │   ├── Sidebar.tsx                ← Navigation links (Dashboard, Products, Orders...)
│   │   │   └── TopNav.tsx                 ← Admin email badge, environment status, logout
│   │   │
│   │   ├── common/
│   │   │   ├── DataTable.tsx              ← Headless TanStack table with search & pagination
│   │   │   ├── StatCard.tsx               ← Metric KPI widget with percentage change indicator
│   │   │   ├── StatusBadge.tsx            ← Luxury status pill (Confirmed, Shipped, Delivered)
│   │   │   ├── ConfirmModal.tsx           ← Action confirmation dialog (Delete, Cancel Order)
│   │   │   └── EmptyState.tsx             ← Empty data placeholder illustration
│   │   │
│   │   └── forms/
│   │       ├── R2ImageUploader.tsx        ← Drag & drop image uploader with direct R2 upload
│   │       ├── VariantStockMatrix.tsx     ← Dynamic size (44-54, UNI) and color inventory editor
│   │       └── RichTextEditor.tsx         ← Minimal garment description & care instructions
│   │
│   ├── pages/
│   │   ├── Login.tsx                      ← Admin OTP login screen (restricted to ADMIN_EMAILS)
│   │   ├── Dashboard.tsx                  ← Gross revenue, today's orders, low stock warnings
│   │   │
│   │   ├── products/
│   │   │   ├── ProductList.tsx            ← Paginated product catalog table with quick filters
│   │   │   ├── ProductCreate.tsx          ← Create new luxury garment, variants, and gallery
│   │   │   └── ProductEdit.tsx            ← Modify price, description, images, active status
│   │   │
│   │   ├── inventory/
│   │   │   └── InventoryMatrix.tsx        ← Real-time stock counts across all sizes and colors
│   │   │
│   │   ├── orders/
│   │   │   ├── OrderList.tsx              ← Incoming orders queue filtered by payment status
│   │   │   └── OrderDetail.tsx            ← Line items, customer address, courier dispatch form
│   │   │
│   │   ├── customers/
│   │   │   ├── CustomerList.tsx           ← Registered client directory and lifetime spend
│   │   │   └── CustomerDetail.tsx         ← Client order history and saved addresses
│   │   │
│   │   ├── coupons/
│   │   │   └── CouponManager.tsx          ← Create & deactivate promo codes (Fixed/Percentage)
│   │   │
│   │   └── audit/
│   │       └── AuditLogs.tsx              ← Immutable trail of admin actions & stock adjustments
│   │
│   ├── context/
│   │   └── AuthContext.tsx                ← Admin authentication state & token refresher
│   │
│   ├── hooks/                             ← Custom React Hooks
│   │   ├── useProducts.ts                 ← TanStack Query hooks for catalog CRUD
│   │   ├── useOrders.ts                   ← Query hooks for order updates & tracking dispatch
│   │   └── useAnalytics.ts                ← Query hooks for real-time dashboard KPIs
│   │
│   ├── lib/
│   │   ├── apiClient.ts                   ← Axios/Fetch client configured with Bearer JWT
│   │   └── uploadToR2.ts                  ← Direct-to-R2 upload handler via presigned URLs
│   │
│   └── types/
│       └── admin.ts                       ← Admin dashboard DTOs and state types
│
├── index.html                             ← Vite HTML template
├── package.json                           ← Dependencies (@tanstack/react-table, recharts...)
├── postcss.config.js
├── tailwind.config.js                     ← Luxury Dark/Cream admin theme configuration
├── tsconfig.json
└── vite.config.ts                         ← Vite build configuration
```

---

## 5. SHARED CONTRACTS DIRECTORY (`shared/`)
> Eliminates type drift between frontend, backend, and admin. Can be packaged as a local workspace package or shared TypeScript file.

```
shared/
├── src/
│   ├── index.ts                           ← Root exports
│   │
│   ├── schemas/                           ← Zod Validation Schemas (Shared Validation)
│   │   ├── auth.schema.ts                 ← Email format, OTP 6-digit schema
│   │   ├── product.schema.ts              ← Product creation & variant schema
│   │   ├── checkout.schema.ts             ← Address fields & Indian pincode validation
│   │   └── coupon.schema.ts               ← Promo code format and bounds
│   │
│   └── types/                             ← TypeScript Interfaces
│       ├── product.ts                     ← Product, Variant, Category interfaces
│       ├── order.ts                       ← Order, OrderItem, PaymentStatus, OrderStatus
│       ├── cart.ts                        ← CartItem, CartSummary interfaces
│       ├── user.ts                        ← UserProfile, Address interfaces
│       └── api.ts                         ← Standardized API response envelopes
│
├── package.json
└── tsconfig.json
```

---

## 6. CLOUDFLARE SERVICE TO CODEBASE MAPPING

| Cloudflare Resource | Service Used | Corresponding Codebase Location | Free Tier Allowance | Purpose |
|---|---|---|---|---|
| **Edge Compute** | Cloudflare Workers | `backend/src/index.ts`, `backend/src/routes/` | 100,000 req/day | Edge REST API running on Hono.js with 0ms cold starts |
| **Relational Database** | Cloudflare D1 | `backend/migrations/*.sql`, `backend/src/db/` | 5M reads/day, 100k writes/day, 5 GB storage | ACID SQLite database for users, products, orders |
| **Edge Cache** | Cloudflare KV | `backend/src/services/cache.ts` | 100,000 reads/day, 1 GB storage | Sub-millisecond reads for catalog cache & token revocation |
| **Asset Storage** | Cloudflare R2 | `backend/src/services/r2Storage.ts` | 10 GB, 1M Class A, 10M Class B, **$0 egress** | Zero-egress image storage for luxury garment photography |
| **Async Queue Worker**| Cloudflare Queues | `backend/src/queues/emailConsumer.ts` | 10,000 operations/day | Reliable background delivery for Resend emails |
| **Background Cron** | Cloudflare Triggers | `backend/src/crons/inventoryReaper.ts` | 5 cron triggers/account | Runs every 5 mins to release expired unpaid carts |
| **Client Flagship App**| Cloudflare Pages | `frontend/` (Astro 4 SSG + Islands) | Unlimited bandwidth, 500 builds/mo | Hosts `deynolddanny.com` with global CDN caching |
| **Internal Admin App** | Cloudflare Pages | `admin/` (React + Vite SPA) | Unlimited bandwidth, Zero Trust (50 seats) | Hosts `admin.deynolddanny.com` |

---

## 7. FILE PLACEMENT SUMMARY FOR DEPLOYMENT

1. **Current Directory (`d:\Denold Danny`)**:
   Contains the complete, functioning Astro frontend. All components, styles (`luxury-custom.css`), and assets are located here.
2. **Backend Directory (`deynold-danny-backend`)**:
   Create this adjacent to the frontend. Run `npm create cloudflare@latest` and paste the file structure from **Section 3**.
3. **Admin Directory (`deynold-danny-admin`)**:
   Create this adjacent to the frontend. Run `npm create vite@latest` and paste the structure from **Section 4**.
4. **Master Specifications**:
   - Master Backend Blueprint: [`BACKEND_MASTER_BLUEPRINT.md`](file:///d:/Denold%20Danny/BACKEND_MASTER_BLUEPRINT.md)
   - Implementation & Rollout Plan: [`IMPLEMENTATION_PLAN.md`](file:///d:/Denold%20Danny/IMPLEMENTATION_PLAN.md)
   - Final File Tree Specification: [`FINAL_FILE_STRUCTURE.md`](file:///d:/Denold%20Danny/FINAL_FILE_STRUCTURE.md)
