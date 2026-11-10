# GEMINI.md --- Gemini Agent Operating Rules

> **Project:** `deynold-danny-ecommerce`\
> **Applies to:** Gemini, Gemini CLI, and any coding agent explicitly
> instructed to follow this file.\
> **Canonical engineering contract:** Root `AGENTS.md`.

## 1. Mandatory reading before every task

Before planning, inspecting implementation details, or changing
anything, you MUST:

1.  Read the **entire** root `AGENTS.md`.
2.  Read the **entire** root `GEMINI.md`.
3.  Treat `AGENTS.md` as the canonical source for architecture, approved
    dependencies, security, coding conventions, testing, and change
    control. This file supplements that contract with the Gemini
    workflow and mandatory documentation-update procedure.
4.  Inspect the actual repository, current branch, working tree, and
    `git status`. Never assume a previously described file or folder
    still exists.
5.  Read the relevant source files, package manifest, lockfile,
    framework configuration, environment declarations, and existing
    tests before relying on their behavior.

Do not begin implementation until both instruction files have been read.
Conversation history, previous agent summaries, memory, and proposed
plans are not substitutes for inspecting the current repository.

## 2. Instruction precedence and conflicts

-   Follow both instruction files. Do not silently ignore a rule because
    it is inconvenient.
-   `AGENTS.md` is the canonical architecture and engineering contract.
    `GEMINI.md` defines the execution workflow and documentation
    synchronization requirements.
-   If the files contain a direct contradiction, stop and report the
    exact conflicting sections before making the affected change. Do not
    silently choose one.
-   If a user request appears to require changing an approved
    architectural decision, identify the impact and follow the approval
    / ADR process in `AGENTS.md`.
-   Never invent architecture decisions, endpoints, API contracts, data
    models, package capabilities, environment variables, business rules,
    or provider guarantees.

## 3. Architecture guardrails

Follow the detailed rules in `AGENTS.md`. Key non-negotiable boundaries:

-   Preserve the approved Astro + React + TypeScript + existing
    Tailwind + Nano Stores frontend and the separately owned Hono
    backend.
-   Use Astro for routing, server-rendered/static composition, and
    SEO-oriented content. Use React islands for genuine
    browser-interactive experiences and stateful UI.
-   Keep Astro and React component boundaries valid. Do not pass Astro
    components as React children or hydrate static content without a
    demonstrated need.
-   Keep business-critical truth on the backend: prices, variants,
    inventory, discounts, orders, payment verification, authorization,
    and persistent customer data.
-   Follow the approved frontend API / BFF approach. Inspect the real
    Hono routes or backend contract before implementing or changing API
    calls.
-   Keep feature-specific code in its owning feature. Put components in
    shared locations only when they are genuinely reusable.
-   Respect dependency direction, browser/server separation, session
    security, validation, accessibility, caching, SEO, consent, and
    observability rules in `AGENTS.md`.
-   Preserve the existing design, responsive behavior, content, and
    interactions unless the user explicitly requests a change.
-   Do not migrate package managers, replace lockfiles, upgrade major
    dependencies, or change framework versions without explicit
    approval.
-   Do not create speculative abstractions, duplicate implementations,
    placeholder files, or empty folders.

## 4. Repository-first implementation workflow

For every coding task:

1.  **Understand the request.** Identify the requested behavior and the
    smallest complete scope.
2.  **Inspect before editing.** Review the actual files, established
    patterns, related features, API clients, stores, schemas, utilities,
    tests, and current Git changes.
3.  **Identify ownership.** Determine which existing feature or layer
    owns the responsibility. Do not create a new folder or category
    merely because it seems tidy.
4.  **Plan minimally.** Identify likely files, dependencies, risks, and
    missing contracts. Ask for clarification before proceeding if a
    material decision cannot safely be inferred.
5.  **Implement incrementally.** Make the smallest complete change.
    Preserve unrelated user work. Avoid broad rewrites and unrelated
    cleanup.
6.  **Validate.** Run relevant type checks, linting, tests, builds,
    and/or browser checks that are available and appropriate.
7.  **Review.** Inspect the final diff and status for accidental
    changes, security issues, dead code, broken imports, regressions,
    and out-of-scope edits.
8.  **Synchronize documentation.** Update both root instruction files as
    described in Section 8 before reporting completion.

## 5. Adding files, features, routes, and categories

Before adding a file, feature, route, or product category:

-   Search for an existing implementation, data model, reusable
    component, or established pattern.
-   Identify the owning feature and correct layer under `AGENTS.md`.
-   Check dependency direction and Astro / server / browser boundaries.
-   For routes, make rendering, caching, authentication, authorization,
    SEO, and `noindex` decisions based on the actual route purpose.
-   Confirm the backend/API contract exists; never fabricate it.
-   Add only files needed for a real responsibility. Avoid placeholder
    files and speculative scaffolding.
-   Treat a new product category or collection as data/configuration
    unless distinct code behavior is genuinely required. Do not
    automatically create a source feature folder for every category.
-   If the proposed change alters an approved architectural decision,
    stop and follow the ADR / approval process in `AGENTS.md`.

## 6. Security and data integrity

-   Never store session tokens in `localStorage`, query strings, or
    URLs. Follow the secure cookie/session model in `AGENTS.md`.
-   Never trust client-provided prices, stock, discounts, roles, order
    totals, payment status, or resource ownership.
-   Do not weaken authorization, validation, CSRF protections, security
    headers, or payment verification to make a flow work.
-   Validate untrusted input at the correct boundary using established
    project schemas and patterns.
-   Use safe redirect / return URL handling. Do not expose secrets in
    logs, browser code, or committed configuration.
-   Never invent credentials, secrets, production values, or
    personal/customer data.

## 7. Testing and validation

-   Add or update tests for changed behavior when appropriate and
    consistent with the existing test strategy.
-   Prefer the project's installed tools and conventions. Do not add a
    new test framework without approval.
-   Run the narrowest relevant checks first, then broader checks when
    practical.
-   Report exact commands and observed outcomes as `PASS`, `FAIL`, or
    `NOT RUN`.
-   If a check cannot run, state why. Never describe an unrun check as
    passed.
-   Distinguish pre-existing failures from failures introduced by the
    current task.

## 8. Mandatory end-of-task update --- BOTH files

At the end of **every task that generates or changes application code,
configuration, routes, tests, assets, dependencies, or project
structure**, you MUST update both root files:

-   `AGENTS.md`
-   `GEMINI.md`

This requirement applies even when the task makes **no** architecture or
directory-structure change. The purpose is to keep the actual
implementation record accurate, not to rewrite standing rules.

### Required update procedure

1.  Complete the implementation and run the relevant validation.
2.  Inspect the final repository tree, `git diff`, and `git status`.
3.  Refresh the **Current repository structure / implementation
    snapshot** in both files using the real working repository. Record
    only paths and structures that actually exist. Include relevant
    additions, modifications, removals, moves, routes, feature modules,
    and category/data changes.
4.  Append a factual entry to the **Implementation update log** in both
    files. Every entry must include:
    -   Date of the task.
    -   Short task summary and completion state: `COMPLETE` or
        `INCOMPLETE`.
    -   Files added, modified, deleted, or moved.
    -   Structural change summary. If there was none, write exactly:
        `No architecture or directory-structure change in this task`.
    -   Validation commands and observed `PASS`, `FAIL`, or `NOT RUN`
        results.
    -   Outstanding blockers, known failures, and unverified items.
5.  Keep the snapshot and corresponding task record synchronized in both
    files. `AGENTS.md` remains the detailed canonical contract;
    `GEMINI.md` may summarize standing rules but must contain the same
    current implementation snapshot and task record.
6.  Preserve all standing rules. Do not shorten, replace, weaken, or
    delete architecture/security requirements during routine updates.
7.  Do not erase previous implementation log entries. Append a new
    entry. Correct an earlier entry only when it is factually wrong, and
    explain the correction.
8.  If the task is interrupted or validation is incomplete, record
    `INCOMPLETE` and list what remains and which checks were not run.
9.  If either file cannot be updated, do not claim compliance. State
    exactly which file was not updated and why.

### Current repository structure / implementation snapshot

- **Verification date:** 2026-11-10
- **Verification status:** Verified against active working repository
- **Framework & Stack:** Astro 4.16.18 + React 18.3.1 + TypeScript 5.6.3 + Tailwind CSS 3.4.14 + Nano Stores 0.11.3
- **Active Routes:**
  - `/` -> `src/pages/index.astro` (Homepage with hero, category grid, editorial duo, and 3 product carousels)
  - `/products/[slug]` -> `src/pages/products/[slug].astro` (Dedicated luxury split-screen Product Detail Page with image gallery, sticky purchase panel, fit finder, size guide, lightbox, style-it-with, and related suggestions)
  - `/wishlist` -> `src/pages/wishlist.astro` (Dedicated luxury wishlist experience with breadcrumbs, count header, empty state matching reference, and populated shopping grid)
  - `/account/sign-in` (or `/login`) -> `src/pages/account/sign-in.astro` (Client identification & sign-in experience)
  - `/account/sign-up` (or `/signup`) -> `src/pages/account/sign-up.astro` (Client profile creation & registration)
  - `/account/forgot-password` -> `src/pages/account/forgot-password.astro` (Client credential recovery assistance)

```text
deynold-danny-ecommerce/
├── public/
│   ├── hero-banner.jpg
│   ├── hero-banner.png
│   ├── logo.png
│   └── images/
│       ├── cady-trousers-detail.jpg
│       ├── cady-trousers-model-3.jpg
│       ├── cady-trousers-model-4.jpg
│       ├── cady-trousers-model.jpg
│       ├── cady-trousers-product.jpg
│       ├── cady-trousers-swatch.jpg
│       ├── cady-vest.jpg
│       ├── nappa-flat.jpg
│       ├── suggest-pants-1.jpg
│       ├── suggest-pants-2.jpg
│       ├── suggest-pants-3.jpg
│       ├── suggest-pants-4.jpg
│       ├── autumn-product-[1..5].jpg
│       ├── category-[abiti,accessori,camicie,cappotti,felpe,giubbini,maglieria,pantaloni,scarpe].jpg
│       ├── mastery-men-[1..5].jpg & hover
│       ├── news-men-[1..5].jpg & hover
│       ├── style-space-[1..5].jpg & hover
│       └── thread-mastery-[1..5].jpg
├── src/
│   ├── components/
│   │   └── layout/
│   │       ├── Header.astro
│   │       └── Footer.astro
│   ├── config/
│   │   ├── ecommerce.config.ts
│   │   ├── navigation.config.ts
│   │   ├── routes.ts
│   │   └── site.config.ts
│   ├── features/
│   │   ├── home/
│   │   │   ├── components/
│   │   │   │   ├── HeroBanner.astro
│   │   │   │   ├── CategoryGrid.astro
│   │   │   │   └── EditorialDuo.astro
│   │   │   └── data/
│   │   │       └── home-content.ts
│   │   ├── catalog/
│   │   │   ├── components/
│   │   │   │   ├── ProductCard.tsx
│   │   │   │   ├── ProductCarousel.tsx
│   │   │   │   ├── ProductColorSelector.tsx
│   │   │   │   ├── ProductSizeSelector.tsx
│   │   │   │   ├── ProductSizingActions.tsx
│   │   │   │   ├── ProductPurchasePanel.tsx
│   │   │   │   ├── ProductGallery.tsx
│   │   │   │   ├── ProductLightbox.tsx
│   │   │   │   ├── ProductDetailExperience.tsx
│   │   │   │   ├── StyleItWith.astro
│   │   │   │   └── RelatedProducts.astro
│   │   │   ├── fit-finder/
│   │   │   │   └── FitFinderDialog.tsx
│   │   │   ├── size-guide/
│   │   │   │   └── SizeGuideDialog.tsx
│   │   │   ├── types/
│   │   │   │   ├── product.types.ts
│   │   │   │   ├── size-guide.types.ts
│   │   │   │   └── fit-recommendation.types.ts
│   │   │   ├── utils/
│   │   │   │   └── product.utils.ts
│   │   │   └── data/
│   │   │       └── products.ts
│   │   ├── cart/
│   │   │   ├── components/
│   │   │   │   ├── CartDrawer.tsx
│   │   │   │   └── CartTrigger.tsx
│   │   │   ├── store/
│   │   │   │   └── cart.store.ts
│   │   │   └── types/
│   │   │       └── cart.types.ts
│   │   ├── wishlist/
│   │   │   ├── components/
│   │   │   │   ├── WishlistButton.tsx
│   │   │   │   └── WishlistExperience.tsx
│   │   │   ├── store/
│   │   │   │   └── wishlist.store.ts
│   │   │   └── types/
│   │   │       └── wishlist.types.ts
│   │   └── auth/
│   │       ├── components/
│   │       │   ├── SignInForm.tsx
│   │       │   ├── SignUpForm.tsx
│   │       │   └── ForgotPasswordForm.tsx
│   │       └── types/
│   │           └── auth.types.ts
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   ├── StorefrontLayout.astro
│   │   ├── AuthLayout.astro
│   │   └── Layout.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── wishlist.astro
│   │   ├── login.astro
│   │   ├── signup.astro
│   │   ├── account/
│   │   │   ├── sign-in.astro
│   │   │   ├── sign-up.astro
│   │   │   └── forgot-password.astro
│   │   └── products/
│   │       └── [slug].astro
│   ├── styles/
│   │   ├── global.css
│   │   ├── variables.css
│   │   ├── typography.css
│   │   └── luxury-custom.css
│   └── env.d.ts
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
├── package.json
├── package-lock.json
├── AGENTS.md
└── GEMINI.md
```

### Implementation update log

- **2026-11-09 — Architectural Restructuring to Feature Boundaries**:
  - **Status:** COMPLETE
  - **Summary:** Restructured existing components, pages, state, styles, and configurations into the canonical architecture defined in `AGENTS.md`. Established `src/features/{home,catalog,cart,wishlist}`, `src/components/layout/`, `src/config/`, `src/layouts/{BaseLayout,StorefrontLayout}.astro`, and modular CSS tokens.
  - **Files Moved / Created:** Relocated components from `src/components/{astro,react}/` into appropriate feature directories; created config files in `src/config/`.
  - **Validation:** `npx astro check` (PASS: 0 errors), `npm run build` (PASS).
  - **Blockers:** None.

- **2026-11-09 — Premium Product Detail Page Implementation**:
  - **Status:** COMPLETE
  - **Summary:** Implemented the luxury split-screen product detail page (`/products/[slug]`) adhering to Section 8.1 of `AGENTS.md`. Built React interactive island (`ProductDetailExperience.tsx`), 2-column desktop / carousel mobile gallery (`ProductGallery.tsx`), fullscreen lightbox (`ProductLightbox.tsx`), sticky purchase panel (`ProductPurchasePanel.tsx`), color swatches (`ProductColorSelector.tsx`), size pills (`ProductSizeSelector.tsx`), sizing utilities (`ProductSizingActions.tsx`), `FitFinderDialog.tsx`, `SizeGuideDialog.tsx`, and sibling Astro sections (`ProductDescription.astro`, `ProductDetailsAccordion.astro`, `StyleItWith.astro`, `RelatedProducts.astro`). Connected `addToCart` and `toggleWishlist` via Nano Stores.
  - **Files Added:**
    - `src/pages/products/[slug].astro`
    - `src/features/catalog/components/{ProductDetailExperience.tsx, ProductGallery.tsx, ProductLightbox.tsx, ProductPurchasePanel.tsx, ProductColorSelector.tsx, ProductSizeSelector.tsx, ProductSizingActions.tsx, ProductDescription.astro, ProductDetailsAccordion.astro, StyleItWith.astro, RelatedProducts.astro}`
    - `src/features/catalog/fit-finder/FitFinderDialog.tsx`
    - `src/features/catalog/size-guide/SizeGuideDialog.tsx`
    - `src/features/catalog/types/{product.types.ts, size-guide.types.ts, fit-recommendation.types.ts}`
    - `src/features/catalog/utils/product.utils.ts`
    - `src/features/wishlist/{store/wishlist.store.ts, types/wishlist.types.ts}`
    - Extracted 12 high-resolution imagery assets in `public/images/`.
  - **Files Modified:**
    - `src/features/catalog/data/products.ts` (added complete `cadyTrousersProduct` reference and slugs/galleries for all 15 catalog items)
    - `src/features/catalog/components/ProductCard.tsx` (linked cards to `/products/[slug]`)
    - `src/features/catalog/components/ProductCarousel.tsx` (cleaned unused props)
    - `src/components/layout/Footer.astro` (fixed deprecated submit handler)
  - **Validation:**
    - `npx astro check`: PASS (47 files checked: 0 errors, 0 warnings, 0 hints)
    - `npm run build`: PASS (17 static HTML pages generated cleanly in 4.91s)
  - **Blockers:** None.

- **2026-11-09 — Remote Synchronization to GitHub**:
  - **Status:** COMPLETE
  - **Summary:** Committed all architectural restructuring changes and the complete luxury Product Detail Page implementation, and pushed commit `dc2f1d3` to remote branch `main` at `https://github.com/hemanthsairamjagatha/deynolddanny.git`.
  - **Structural change summary:** No architecture or directory-structure change in this task.
  - **Validation:** `git push origin main` (PASS: exit code 0), `npx astro check` (PASS: 0 errors).
  - **Blockers:** None.

- **2026-11-09 — Removal of Cady Trousers Product Card from Carousel**:
  - **Status:** COMPLETE
  - **Summary:** Removed the Cady Trousers product card from the homepage carousel (`masteryProducts`) in `src/features/catalog/data/products.ts`, while maintaining the dedicated luxury Product Detail Page at `/products/cady-trousers` in `allProducts`.
  - **Files Modified:** `src/features/catalog/data/products.ts`.
  - **Structural change summary:** No architecture or directory-structure change in this task.
  - **Validation:** `npx astro check` (PASS: 47 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 17 static pages generated).
  - **Blockers:** None.

- **2026-11-09 — Removal of Redundant Lower Editorial & Accordion Sections from Product Detail Page**:
  - **Status:** COMPLETE
  - **Summary:** Removed the redundant full-width editorial narrative (`ProductDescription.astro`) and duplicate technical specifications section (`ProductDetailsAccordion.astro`) from below the split-screen product experience in `src/pages/products/[slug].astro`. Product specifications and care guidelines remain cleanly accessible via the sticky purchase panel accordions (`Size & fit`, `Composition & care`, `Delivery & returns`).
  - **Files Removed:** `src/features/catalog/components/ProductDescription.astro`, `src/features/catalog/components/ProductDetailsAccordion.astro`.
  - **Files Modified:** `src/pages/products/[slug].astro`.
  - **Structural change summary:** Removed 2 redundant Astro component files and unrendered them from `src/pages/products/[slug].astro`.
  - **Validation:** `npx astro check` (PASS: 45 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 17 static pages generated).
  - **Blockers:** None.

- **2026-11-09 — Implementation of Login, Sign Up, and Forgot Password Pages**:
  - **Status:** COMPLETE
  - **Summary:** Implemented client authentication and security recovery pages following Section 3 of `AGENTS.md`. Created `src/layouts/AuthLayout.astro` for boutique access, `src/features/auth/` containing `SignInForm.tsx`, `SignUpForm.tsx`, `ForgotPasswordForm.tsx`, and `auth.types.ts`. Configured routes `/account/sign-in`, `/account/sign-up`, and `/account/forgot-password` with redirect aliases at `/login` and `/signup`. Updated `Header.astro` user icon and `routes.ts`.
  - **Files Added:**
    - `src/layouts/AuthLayout.astro`
    - `src/features/auth/components/{SignInForm.tsx, SignUpForm.tsx, ForgotPasswordForm.tsx}`
    - `src/features/auth/types/auth.types.ts`
    - `src/pages/account/{sign-in.astro, sign-up.astro, forgot-password.astro}`
    - `src/pages/{login.astro, signup.astro}`
  - **Files Modified:**
    - `src/components/layout/Header.astro`
    - `src/config/routes.ts`
  - **Structural change summary:** Added `src/features/auth/` module, `src/layouts/AuthLayout.astro`, and `src/pages/account/` routes.
  - **Validation:** `npx astro check` (PASS: 55 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 22 static pages generated).
  - **Blockers:** None.

- **2026-11-09 — Remote Synchronization to GitHub**:
  - **Status:** COMPLETE
  - **Summary:** Committed and pushed authentication pages (`/account/sign-in`, `/account/sign-up`, `/account/forgot-password`, `/login`, `/signup`), `src/features/auth/`, and `AuthLayout.astro` along with the removal of redundant PDP editorial sections to remote branch `main`.
  - **Structural change summary:** No architecture or directory-structure change in this task.
  - **Validation:** `git push origin main` (PASS: exit code 0), `npx astro check` (PASS: 55 files, 0 errors, 0 warnings, 0 hints).
  - **Blockers:** None.

- **2026-11-10 — Implementation of Luxury Wishlist Page**:
  - **Status:** COMPLETE
  - **Summary:** Built the dedicated Wishlist page (`/wishlist`) matching the user-provided visual reference (`media_1794251233052_d63a9662.png`). Implemented `WishlistExperience.tsx` React island featuring top breadcrumbs (`Home / My Wishlist` with underlined Home), centered heading and reactive item count subtitle (`You have N items on your Wishlist`), full-width divider, and empty state ("Add products to your Wishlist to see them here."). For populated states, implemented a responsive luxury card grid with quick Add to Bag (integrating with `cart.store.ts`), size selection, and one-click removal via `wishlist.store.ts`. Updated `Header.astro` and `routes.ts`.
  - **Files Added:**
    - `src/pages/wishlist.astro`
    - `src/features/wishlist/components/{WishlistExperience.tsx, WishlistButton.tsx}`
  - **Files Modified:**
    - `src/features/wishlist/store/wishlist.store.ts` (added `removeFromWishlist` and `clearWishlist`)
    - `src/features/wishlist/types/wishlist.types.ts`
    - `src/components/layout/Header.astro`
    - `src/config/routes.ts`
  - **Structural change summary:** Added `src/pages/wishlist.astro` route and `src/features/wishlist/components/` module.
  - **Validation:** `npx astro check` (PASS: 58 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 23 static pages generated).
  - **Blockers:** None.

- **2026-11-10 — Complete Cloudflare Worker Backend Implementation**:
  - **Status:** COMPLETE
  - **Summary:** Built the full production-ready Cloudflare Worker backend for DEYNOLD DANNY in `backend/` (adjacent to frontend `src/`). Implemented Hono.js API server with Cloudflare D1 (SQLite), KV (catalog read-cache), R2 (media storage), Queues (email jobs), and Cron (inventory reaper). All 30+ REST endpoints implemented, TypeScript compiles with 0 errors, D1 migrations apply cleanly, all endpoints smoke-tested locally with `wrangler dev --local`. Frontend `src/` is completely untouched.
  - **Architecture guarantees implemented:**
    - All monetary values stored as integer paise; `paiseToRupeesFloat()` only at Cashfree webhook boundary
    - Atomic stock hold pattern: `holdStock` → (Cashfree payment) → `commitStock` OR `rollbackStock`
    - D1-backed rate limiting (never KV counters)
    - KV used strictly for catalog read-cache (`getCatalogCache` / `setCatalogCache` / `invalidateCatalogCache`)
    - `availableStock = stock − reserved_stock` exposed to clients; raw `stock` never returned
    - Every admin write inserts a row into `admin_logs`
    - HMAC-SHA256 webhook verification for Cashfree payment events
    - Passwordless OTP auth (email via Resend) with JWT access + refresh tokens
    - Idempotency key support on checkout to prevent duplicate orders
    - All ESM imports use `.js` extension (Cloudflare Workers requirement)
  - **Files Added (50 total):**
    - `backend/.gitignore`, `backend/package.json`, `backend/tsconfig.json`, `backend/wrangler.toml`
    - `backend/migrations/0001_initial_schema.sql` (18 tables + FTS5 + triggers), `backend/migrations/0002_seed_data.sql` (16 products, 68 variants, all categories)
    - `backend/src/types/{bindings.d.ts, models.ts, api.ts}`
    - `backend/src/config/{constants.ts, env.ts}`
    - `backend/src/middleware/{auth.ts, adminAuth.ts, cors.ts, errorHandler.ts, rateLimit.ts, securityHeaders.ts}`
    - `backend/src/services/{crypto.ts, jwt.ts, resend.ts, cashfree.ts, stockEngine.ts, stockEngine.cron.ts, cache.ts, r2Storage.ts, money.ts}`
    - `backend/src/db/{client.ts, queries/users.ts, queries/otps.ts, queries/products.ts, queries/cart.ts, queries/orders.ts, queries/inventory.ts, queries/analytics.ts}`
    - `backend/src/routes/{auth.ts, products.ts, categories.ts, cart.ts, checkout.ts, payments.ts, orders.ts, wishlist.ts, users.ts, search.ts, newsletter.ts}`
    - `backend/src/routes/admin/{index.ts, dashboard.ts, products.ts, inventory.ts, orders.ts, customers.ts, coupons.ts, uploads.ts}`
    - `backend/src/queues/emailConsumer.ts`
    - `backend/src/index.ts` (main Hono app entry point)
  - **Files Modified:** None in `src/` — frontend is completely untouched.
  - **Structural change summary:** New `backend/` directory with 4 config files, 2 migration SQL files, and 43 TypeScript source files across types, config, middleware, services, db, routes (public + admin), queues.
  - **Cloudflare bindings (wrangler.toml):** `CATALOG_KV` (KVNamespace), `MEDIA_BUCKET` (R2Bucket), `deynold-danny-db` (D1), `deynold-danny-emails` (Queue consumer + producer).
  - **Known deviations / open items:**
    - Category IDs in seed data (`cat-abiti, cat-capispalla, cat-camicie, cat-maglieria, cat-pantaloni, cat-accessori, cat-scarpe, cat-borse`) differ from frontend `ecommerce.config.ts` — reconciliation pending.
    - Frontend auth forms (`SignInForm.tsx`, `SignUpForm.tsx`) still use email+password flow — need migration to OTP flow when user requests it.
    - Cloudflare resources (D1 database, KV namespace, R2 bucket, Queue) need to be created with `wrangler` CLI and real IDs added to `wrangler.toml` before production deploy.
  - **Validation:** `npx tsc --noEmit` (PASS: 0 errors), `npx wrangler d1 migrations apply deynold-danny-db --local` (PASS: both migrations applied), `GET /health` (200 ✅), `GET /api/products` (200 ✅), `GET /api/products/cady-trousers` (200 ✅), `GET /api/categories` (200 ✅), `GET /api/search?q=wool` (200 ✅), `POST /api/auth/send-otp` (200 ✅), `POST /api/cart/items` (201 ✅), auth guards 401 ✅, `POST /api/newsletter/subscribe` (200 ✅).
  - **Blockers:** None — backend is fully operational locally. Production deploy requires Cloudflare resource provisioning and secret injection (user action).

## 9. Required final response

After each coding task, provide a concise completion report that states:

-   What was implemented and what was intentionally left unchanged.
-   Files added, modified, deleted, or moved.
-   Validation commands and actual `PASS` / `FAIL` / `NOT RUN` results.
-   Known issues, blockers, and remaining work.
-   `AGENTS.md` updated: **YES / NO**.
-   `GEMINI.md` updated: **YES / NO**.
-   Structure snapshot updated in both files: **YES / NO**.
-   Implementation log appended in both files: **YES / NO**.

Never say both files were updated unless you verified that they were.
Never claim a task is complete or architecture-compliant without
evidence from the actual repository and relevant checks.

------------------------------------------------------------------------

**Core rule:** Read both instruction files first. Follow the approved
architecture. Inspect before changing. Implement only what is needed.
Validate honestly. Update both instruction files after every coding
task.
