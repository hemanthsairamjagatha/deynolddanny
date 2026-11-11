# AGENTS.md — Deynold Danny Ecommerce Frontend Engineering Rules

> **Status:** Project architecture contract  
> **Applies to:** Every AI coding agent, developer assistant, and automated code-generation tool working in this repository  
> **Project:** `deynold-danny-ecommerce`  
> **Primary stack:** Astro + React + TypeScript + Tailwind CSS + Nano Stores  
> **Backend:** Separate Hono API  
> **Deployment direction:** Cloudflare Workers with the compatible Astro adapter, subject to the versions pinned in this repository

---

## 0. Read this before doing any work

This file is the source of truth for frontend architecture and engineering conventions in this repository.

Before changing code, the agent MUST:

1. Read this entire `AGENTS.md` file.
2. Read the complete root `GEMINI.md` file as well. Both instruction files are mandatory for every task, regardless of which coding agent is being used.
3. Treat `AGENTS.md` as the canonical architecture and engineering contract. `GEMINI.md` contains the mandatory agent workflow and repository-update protocol; it must not weaken or contradict this file. If the two files appear to conflict, stop and report the exact conflict instead of choosing silently.
4. Inspect the actual repository tree. Do not assume the documented tree already exists.
5. Read `package.json`, the lockfile, `astro.config.mjs`, `tsconfig.json`, the Tailwind configuration (if present), `wrangler.jsonc` (if present), relevant environment declarations, and the files directly involved in the task.
4. Search for existing components, stores, API functions, types, validators, utilities, and tests before creating new ones.
5. Identify whether the task is a bug fix, a feature extension, a new feature, a refactor, or an architecture change.
6. Make the smallest change that fully satisfies the request while preserving the architecture and existing behavior.

**Do not start coding based only on a prompt summary, an assumed folder structure, or a previous agent's description. Verify the current repository first.**

If the real repository differs from this document, do not silently choose one. Report the exact difference, determine whether it is an intentional approved change or accidental drift, and follow the change-control rules in Section 5.

This document does not override system, platform, security, or user instructions. Within those limits, it is the controlling project-specific instruction.

---

## 1. Project mission and non-negotiable principles

Build and maintain a premium fashion ecommerce storefront that is reliable, accessible, performant, secure, SEO-capable, and straightforward to extend.

The following principles are mandatory:

1. **Preserve the approved architecture.** Do not invent a new architecture for an individual task.
2. **Feature ownership first.** Ecommerce behavior belongs to its owning feature. Shared primitives belong in shared layers only when they are genuinely shared.
3. **Astro for page composition and server-rendered content; React for browser interaction.** Do not hydrate static content without a clear reason.
4. **Backend is authoritative.** The Hono backend owns business rules, product/variant truth, inventory, prices, discounts, orders, payment verification, authorization, and persistent customer data.
5. **No duplicate sources of truth.** Do not create a second cart store, second API client, duplicate product model, duplicate wishlist button, or parallel configuration without a demonstrated need.
6. **Secure by default.** Never expose secrets or trust browser-supplied prices, stock, roles, payment state, or ownership.
7. **Accessibility is part of implementation, not a later polish task.** Every interactive component must support keyboard and assistive-technology use.
8. **Evidence before assumptions.** Inspect code and configuration; verify library APIs against installed versions; do not invent backend endpoints, provider SDK behavior, environment variables, or file contents.
9. **Minimal, reversible changes.** Avoid broad restructures, mass renames, new dependencies, and abstractions unless needed and justified.
10. **Do not create empty architecture.** A folder or file is added when a real responsibility exists, not merely to make the tree look complete.

---

## 2. Approved technology and responsibility boundaries

| Area | Approved direction | Rules |
|---|---|---|
| Page framework | Astro | File-based routing, layouts, server rendering, static pages, SEO content. |
| Interactive UI | React + TypeScript | Use for real client-side state and browser interactions. |
| Styling | Existing Tailwind version + CSS design tokens | Do not migrate Tailwind versions without an explicit, tested task. |
| Shared client state | Nano Stores | Use for state shared across Astro/React islands, notably cart and wishlist. |
| Validation | Zod | Validate untrusted request/response data at boundaries. |
| API backend | Separate Hono service | Backend remains the business-logic and data authority. |
| Frontend server boundary | Astro API endpoints as BFF by default | Same-origin browser calls go through `src/pages/api/` unless an approved ADR chooses direct same-site Hono cookie ownership. |
| Deployment | Cloudflare Workers direction | Follow the adapter and runtime actually pinned in the repository. Do not assume Pages/Workers compatibility. |
| Unit tests | Vitest | Test logic, stores, mappers, validators, and components where applicable. |
| Browser tests | Playwright | Test real journeys and responsive behavior. |
| Quality | ESLint, Prettier, `astro check`, CI | Existing project scripts are authoritative; do not replace them without review. |

### 2.1 Server, browser, and shared code

- `src/lib/server/**` and server-only endpoint code must never enter a browser bundle.
- Browser components must not import server modules, private environment variables, database credentials, backend secrets, or provider secrets.
- Shared modules may be imported by both sides only if they are genuinely runtime-safe in both environments.
- Use Astro's environment schema (`astro:env`) for typed environment declarations where supported by the installed Astro version.
- Only intentionally public values may use the `PUBLIC_` prefix. Never prefix secrets with `PUBLIC_`.
- Do not use browser storage for session tokens. `localStorage` is not an authentication/session store.

---

## 3. Canonical architecture baseline

This is the approved target structure. It is a guide to ownership and placement, not an instruction to create every folder immediately. Create files only when the feature is implemented or the task requires them.

```text
deynold-danny-ecommerce/
├── public/
│   ├── favicon.svg
│   ├── favicon.png
│   ├── apple-touch-icon.png
│   ├── logo.png
│   ├── _headers                         # Generated for static Cloudflare responses
│   ├── images/
│   │   ├── brand/
│   │   └── social/
│   └── fonts/
│       ├── brand-regular.woff2
│       └── brand-medium.woff2
│
├── src/
│   ├── assets/
│   │   ├── images/
│   │   │   ├── homepage/
│   │   │   ├── editorial/
│   │   │   └── categories/
│   │   └── icons/
│   │
│   ├── config/
│   │   ├── site.config.ts
│   │   ├── routes.ts
│   │   ├── navigation.config.ts
│   │   └── ecommerce.config.ts
│   │
│   ├── middleware.ts
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.astro
│   │   │   ├── Button.tsx
│   │   │   ├── Input.astro
│   │   │   ├── Input.tsx
│   │   │   ├── FormField.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Dialog.tsx
│   │   │   ├── Drawer.tsx
│   │   │   ├── Skeleton.astro
│   │   │   ├── Pagination.astro
│   │   │   └── Price.astro
│   │   ├── layout/
│   │   │   ├── Header.astro
│   │   │   ├── Footer.astro
│   │   │   ├── AnnouncementBar.astro
│   │   │   ├── MainNavigation.astro
│   │   │   ├── MobileNavigation.tsx
│   │   │   └── SkipLink.astro
│   │   ├── navigation/
│   │   │   └── Breadcrumbs.astro
│   │   ├── seo/
│   │   │   ├── SEOHead.astro
│   │   │   ├── OrganizationJsonLd.astro
│   │   │   ├── WebsiteJsonLd.astro
│   │   │   └── BreadcrumbJsonLd.astro
│   │   └── feedback/
│   │       ├── ToastViewport.tsx
│   │       ├── EmptyState.astro
│   │       ├── ErrorState.astro
│   │       └── LoadingState.astro
│   │
│   ├── features/
│   │   ├── home/
│   │   │   ├── components/
│   │   │   │   ├── HeroBanner.astro
│   │   │   │   ├── CategoryGrid.astro
│   │   │   │   ├── EditorialDuo.astro
│   │   │   │   ├── HomeProductSection.astro
│   │   │   │   └── LatestNews.astro
│   │   │   └── data/home-content.ts
│   │   │
│   │   ├── catalog/
│   │   │   ├── components/
│   │   │   │   ├── ProductCard.astro
│   │   │   │   ├── ProductGrid.astro
│   │   │   │   ├── ProductCarousel.astro
│   │   │   │   ├── ProductCarouselControls.tsx
│   │   │   │   ├── ProductFilters.tsx
│   │   │   │   ├── ProductSort.tsx
│   │   │   │   ├── ProductQuickAdd.tsx
│   │   │   │   ├── ProductDetailExperience.tsx
│   │   │   │   ├── ProductGallery.tsx
│   │   │   │   ├── ProductLightbox.tsx
│   │   │   │   ├── ProductPurchasePanel.tsx
│   │   │   │   ├── ProductColorSelector.tsx
│   │   │   │   ├── ProductSizeSelector.tsx
│   │   │   │   ├── ProductSizingActions.tsx
│   │   │   │   ├── ProductDescription.astro
│   │   │   │   ├── ProductDetailsAccordion.astro
│   │   │   │   ├── StyleItWith.astro
│   │   │   │   └── RelatedProducts.astro
│   │   │   ├── fit-finder/
│   │   │   │   ├── FitFinderDialog.tsx
│   │   │   │   ├── FitFinderForm.tsx
│   │   │   │   ├── FitFinderFields.tsx
│   │   │   │   └── FitFinderResult.tsx
│   │   │   ├── size-guide/
│   │   │   │   ├── SizeGuideDialog.tsx
│   │   │   │   ├── SizeGuideHeader.tsx
│   │   │   │   ├── SizeConversionTable.tsx
│   │   │   │   └── GarmentMeasurementsTable.tsx
│   │   │   ├── api/
│   │   │   │   ├── catalog.api.ts
│   │   │   │   └── fit-recommendation.api.ts
│   │   │   ├── schemas/
│   │   │   │   ├── catalog.schema.ts
│   │   │   │   └── fit-recommendation.schema.ts
│   │   │   ├── mappers/catalog.mapper.ts
│   │   │   ├── types/
│   │   │   │   ├── product.types.ts
│   │   │   │   ├── size-guide.types.ts
│   │   │   │   └── fit-recommendation.types.ts
│   │   │   └── utils/
│   │   │       ├── product.utils.ts
│   │   │       └── listing-params.ts
│   │   │
│   │   ├── cart/
│   │   │   ├── components/
│   │   │   │   ├── CartDrawer.tsx
│   │   │   │   ├── CartTrigger.tsx
│   │   │   │   ├── CartItem.tsx
│   │   │   │   ├── CartTotals.tsx
│   │   │   │   └── QuantitySelector.tsx
│   │   │   ├── store/cart.store.ts
│   │   │   ├── api/cart.api.ts
│   │   │   ├── schemas/cart.schema.ts
│   │   │   ├── mappers/cart.mapper.ts
│   │   │   └── types/cart.types.ts
│   │   │
│   │   ├── wishlist/
│   │   │   ├── components/
│   │   │   │   ├── WishlistButton.tsx
│   │   │   │   └── WishlistExperience.tsx
│   │   │   ├── store/wishlist.store.ts
│   │   │   ├── api/wishlist.api.ts
│   │   │   ├── types/wishlist.types.ts
│   │   │   └── mappers/wishlist.mapper.ts
│   │   │
│   │   ├── search/
│   │   │   ├── components/
│   │   │   │   ├── SearchDialog.tsx
│   │   │   │   ├── SearchCombobox.tsx
│   │   │   │   └── SearchResults.tsx
│   │   │   ├── api/search.api.ts
│   │   │   ├── schemas/search.schema.ts
│   │   │   ├── types/search.types.ts
│   │   │   └── mappers/search.mapper.ts
│   │   │
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── SignInForm.tsx
│   │   │   │   ├── SignUpForm.tsx
│   │   │   │   ├── ForgotPasswordForm.tsx
│   │   │   │   └── ResetPasswordForm.tsx
│   │   │   ├── api/auth.api.ts
│   │   │   ├── schemas/auth.schema.ts
│   │   │   ├── types/auth.types.ts
│   │   │   └── mappers/auth.mapper.ts
│   │   │
│   │   ├── checkout/
│   │   │   ├── components/
│   │   │   │   ├── CheckoutSteps.tsx
│   │   │   │   ├── AddressForm.tsx
│   │   │   │   ├── DeliveryOptions.tsx
│   │   │   │   ├── CheckoutOrderSummary.tsx
│   │   │   │   └── CheckoutForm.tsx
│   │   │   ├── api/checkout.api.ts
│   │   │   ├── schemas/checkout.schema.ts
│   │   │   ├── types/checkout.types.ts
│   │   │   └── mappers/checkout.mapper.ts
│   │   │
│   │   ├── payment/
│   │   │   ├── components/
│   │   │   │   ├── PaymentMethodSelector.tsx
│   │   │   │   └── PaymentStatus.tsx
│   │   │   ├── api/payment.api.ts
│   │   │   └── types/payment.types.ts
│   │   │
│   │   ├── orders/
│   │   │   ├── components/
│   │   │   │   ├── OrderCard.astro
│   │   │   │   ├── OrderStatus.astro
│   │   │   │   └── OrderDetails.astro
│   │   │   ├── api/orders.api.ts
│   │   │   ├── types/orders.types.ts
│   │   │   └── mappers/orders.mapper.ts
│   │   │
│   │   ├── account/
│   │   │   ├── components/
│   │   │   │   ├── ProfileForm.tsx
│   │   │   │   ├── AddressBook.tsx
│   │   │   │   └── AccountNavigation.astro
│   │   │   ├── api/account.api.ts
│   │   │   └── types/account.types.ts
│   │   │
│   │   └── consent/
│   │       └── components/CookieConsentBanner.tsx
│   │
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   ├── StorefrontLayout.astro
│   │   ├── AuthLayout.astro
│   │   ├── AccountLayout.astro
│   │   └── CheckoutLayout.astro
│   │
│   ├── pages/
│   │   ├── index.astro
│   │   ├── products/[slug].astro
│   │   ├── categories/index.astro
│   │   ├── categories/[slug].astro
│   │   ├── collections/index.astro
│   │   ├── collections/[slug].astro
│   │   ├── search.astro
│   │   ├── cart.astro
│   │   ├── wishlist.astro
│   │   ├── account/sign-in.astro
│   │   ├── account/sign-up.astro
│   │   ├── account/forgot-password.astro
│   │   ├── account/reset-password.astro
│   │   ├── account/index.astro
│   │   ├── account/profile.astro
│   │   ├── account/addresses.astro
│   │   ├── account/orders/index.astro
│   │   ├── account/orders/[orderId].astro
│   │   ├── checkout/index.astro
│   │   ├── checkout/payment-failed.astro
│   │   ├── checkout/confirmation/[orderId].astro
│   │   ├── legal/privacy-policy.astro
│   │   ├── legal/terms.astro
│   │   ├── legal/shipping-returns.astro
│   │   ├── legal/cookie-policy.astro
│   │   ├── contact.astro
│   │   ├── 404.astro
│   │   ├── 500.astro
│   │   ├── robots.txt.ts
│   │   ├── sitemap.xml.ts
│   │   └── api/
│   │       ├── auth/sign-in.ts
│   │       ├── auth/sign-up.ts
│   │       ├── auth/logout.ts
│   │       ├── auth/session.ts
│   │       ├── auth/refresh.ts
│   │       ├── auth/forgot-password.ts
│   │       ├── auth/reset-password.ts
│   │       ├── cart/index.ts
│   │       ├── cart/merge.ts
│   │       ├── cart/[itemId].ts
│   │       ├── wishlist/index.ts
│   │       ├── catalog/search.ts
│   │       ├── fit-recommendation.ts
│   │       └── checkout/submit.ts
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   ├── errors.ts
│   │   │   └── retry.ts
│   │   ├── server/
│   │   │   ├── backend.ts
│   │   │   ├── auth.ts
│   │   │   ├── csrf.ts
│   │   │   ├── redirect.ts
│   │   │   ├── sanitize.ts
│   │   │   ├── request-context.ts
│   │   │   ├── security-headers.ts
│   │   │   └── security-policy.ts
│   │   ├── consent/consent.store.ts
│   │   ├── feedback/toast.store.ts
│   │   ├── format/price.ts
│   │   ├── format/date.ts
│   │   ├── analytics/events.ts
│   │   ├── analytics/tracker.ts
│   │   ├── monitoring/error-reporter.ts
│   │   ├── monitoring/web-vitals.ts
│   │   ├── validation/api-response.ts
│   │   ├── browser/storage.ts
│   │   ├── ui/variants.ts
│   │   └── state/async-state.ts
│   │
│   ├── hooks/
│   │   ├── useFocusTrap.ts
│   │   ├── useScrollLock.ts
│   │   ├── useReducedMotion.ts
│   │   ├── useIsHydrated.ts
│   │   ├── useAbortableRequest.ts
│   │   └── useDebounce.ts
│   │
│   ├── styles/
│   │   ├── global.css
│   │   ├── variables.css
│   │   └── typography.css
│   │
│   └── env.d.ts
│
├── tests/
│   ├── fixtures/{products,categories,size-guides}/
│   ├── unit/{catalog,cart,wishlist,auth,search,checkout,money,retry,consent,analytics}/
│   ├── integration/{api,authentication,cart}/
│   └── e2e/
│       ├── homepage.spec.ts
│       ├── product-detail.spec.ts
│       ├── fit-finder.spec.ts
│       ├── size-guide.spec.ts
│       ├── filters.spec.ts
│       ├── cart.spec.ts
│       ├── wishlist.spec.ts
│       ├── search.spec.ts
│       ├── auth.spec.ts
│       ├── checkout.spec.ts
│       ├── payment-failure.spec.ts
│       ├── consent.spec.ts
│       ├── seo.spec.ts
│       ├── accessibility.spec.ts
│       ├── error-pages.spec.ts
│       └── mobile.spec.ts
│
├── scripts/generate-cloudflare-headers.ts
├── docs/adr/
│   ├── 001-frontend-architecture.md
│   ├── 002-rendering-strategy.md
│   ├── 003-state-management.md
│   ├── 004-api-and-bff.md
│   ├── 005-hydration-strategy.md
│   ├── 006-security-and-authentication.md
│   ├── 007-accessibility.md
│   └── 008-analytics-and-consent.md
│
├── .github/
│   ├── workflows/ci.yml
│   ├── dependabot.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── .husky/
├── astro.config.mjs
├── wrangler.jsonc
├── tsconfig.json
├── package.json
├── package-lock.json
├── eslint.config.js
├── prettier.config.js
├── vitest.config.ts
├── playwright.config.ts
├── lighthouserc.json
├── .nvmrc
├── .editorconfig
├── .env.example
├── README.md
└── .gitignore
```

---

## 4. File placement rules

The agent MUST use these ownership rules when adding or changing files.

### 4.1 `src/pages/`

- Contains route entry points and route-specific server data loading.
- Keep page files thin: resolve parameters, call the appropriate feature API/service, select a layout, and compose the page.
- Do not put reusable business logic, large UI implementations, or feature state directly in page files.
- Astro file-based routes determine URL paths. Do not create a second manual router.
- API endpoints belong under `src/pages/api/` and are server-side endpoints, not React components.

### 4.2 `src/features/<feature>/`

Use one folder per business capability: `home`, `catalog`, `cart`, `wishlist`, `search`, `auth`, `checkout`, `payment`, `orders`, `account`, and `consent`.

Inside a feature:

- `components/`: UI owned by that feature.
- `api/`: typed functions for that feature's API operations. Do not duplicate the shared HTTP transport here.
- `schemas/`: Zod request/response validation schemas where needed.
- `types/`: feature-owned domain and API types.
- `mappers/`: convert backend DTOs into frontend domain/view models.
- `store/`: only shared reactive feature state that is genuinely needed.
- `utils/`: pure feature-specific functions.
- `data/`: only non-production content or feature-owned local data that is intentionally shipped.

Do not add all these subfolders automatically. Create only those that the feature needs.

### 4.3 Shared `src/components/`

- `ui/`: reusable primitives such as buttons, form fields, dialogs, drawers, inputs and pagination.
- `layout/`: global site chrome and navigation.
- `navigation/`: reusable navigation elements such as breadcrumbs.
- `seo/`: reusable metadata and structured-data components.
- `feedback/`: empty, error, loading and toast presentation.

A component belongs here only when at least two independent features need it or it is truly a global application primitive. Otherwise keep it in its feature.

### 4.4 `src/lib/`

- `api/`: shared HTTP transport, error normalization and retry policy.
- `server/`: server-only auth, CSRF, BFF backend client, redirect validation, sanitization, request context and security policy.
- `consent/`: consent state and policy interfaces used by analytics and UI.
- `feedback/`: shared toast state.
- `format/`: cross-feature formatting such as money and dates.
- `analytics/`: typed event definitions and consent-aware tracking.
- `monitoring/`: error reporting and Web Vitals.
- `validation/`: generic API boundary helpers, not feature-specific schemas.
- `browser/`: safe browser utilities; never store session tokens here.
- `ui/`: shared class variants and presentation utilities.
- `state/`: shared async-state primitives.

**Dependency rule:** `lib/` must not import from `features/`, `pages/`, or application components. If a shared library needs feature-specific information, pass it in through an argument or a small interface.

### 4.5 `src/layouts/`

- `BaseLayout.astro`: HTML document shell, global styles, SEO head, skip link, global consent/analytics bootstrap where appropriate, and common document structure.
- `StorefrontLayout.astro`: storefront header/footer and public shopping shell.
- `AuthLayout.astro`: sign-in, sign-up, forgot-password and reset-password shell. Do not show authenticated account navigation here.
- `AccountLayout.astro`: authenticated account navigation and account shell only.
- `CheckoutLayout.astro`: focused checkout shell without unrelated storefront navigation where the design requires it.

Do not duplicate HTML document shells across layouts. Specialized layouts should build on `BaseLayout.astro`.

---

## 5. Strict change-control: adding anything new

This section is mandatory whenever a new page, feature, category, component, store, API endpoint, folder, dependency, or architectural pattern is proposed.

### 5.1 Required evaluation before adding

Before creating something new, the agent MUST answer internally and, when useful, report:

1. **What requirement does it satisfy?** Link it to the user request or a documented product requirement.
2. **Does an equivalent already exist?** Search the repository for existing components, utilities, stores, schemas, API functions, types and routes.
3. **Who owns it?** Identify the feature or shared layer responsible for it.
4. **Where does it belong?** Choose the correct location using Section 4.
5. **What runtime is it?** Mark it as server-only, browser-only, or safe for both.
6. **Astro or React?** Explain whether it is static/server content or requires browser state.
7. **What data contract does it use?** Identify the verified API endpoint, request/response schema, mapper and types. Do not invent missing contracts.
8. **What security, SEO, caching and accessibility rules apply?** Determine these before implementation.
9. **How will it be tested?** Identify unit, integration and/or E2E coverage.
10. **Does it change an approved architecture decision?** If yes, follow the ADR process below.

Do not create a folder just because a similar project has one. Do not create an abstraction that has only one trivial use unless it clearly isolates a volatile or security-sensitive responsibility.

### 5.2 New feature procedure

For a genuinely new feature:

1. Search for related existing features and shared capabilities.
2. Define its responsibility and public interface.
3. Add the smallest feature folder that fits the existing pattern.
4. Add only required subfolders (`components`, `api`, `schemas`, `types`, `mappers`, `store`, `utils`, `tests`).
5. Add its page route only under `src/pages/`.
6. Add API endpoints under `src/pages/api/` only when a same-origin BFF endpoint is required.
7. Update route access, render/cache, SEO, navigation and sitemap rules where relevant.
8. Add tests and documentation.
9. Update this file or an ADR only if the architecture itself changes—not for every ordinary component addition.

### 5.3 New category, collection, or product taxonomy

Do not assume `categories` and `collections` are interchangeable.

- A **category** classifies products (for example: shirts, trousers, jackets).
- A **collection** is a curated merchandising grouping (for example: New Arrivals, Autumn Edit, a campaign or an editorial selection).
- A product may belong to a category and one or more collections.
- Category and collection route conventions, canonical policy, API fields and navigation must be consistent with their separate meanings.
- Do not add a new taxonomy level (department, subcategory, season, brand, fit, style, etc.) without first checking the existing product/domain model and obtaining a clear requirement.

### 5.4 New file or component procedure

- Search before creating; extend an existing component where that is the correct responsibility.
- Use a descriptive name and match the existing naming convention.
- Do not create duplicate components with different names for the same behavior.
- Do not split a component into many tiny files unless each part has independent meaning, reuse, state, or test value.
- Do not merge components merely to reduce file count if it harms accessibility, reuse, or clarity.
- Do not create placeholder files, empty test files, or empty directories.
- Update imports and tests when moving a file. Do not leave compatibility duplicates unless explicitly required.

### 5.5 Architecture decision records

If a task requires changing a rule in this document, do not silently implement the change.

1. Explain the current rule and the conflict.
2. Propose the smallest alternative and its trade-offs.
3. Create or update the appropriate `docs/adr/` record with status (`Proposed`, `Accepted`, `Superseded`, or `Rejected`).
4. Obtain user approval before making a breaking architecture change, wholesale restructure, dependency replacement, or change to security/session ownership.
5. After approval, update `AGENTS.md`, the relevant ADR, and affected architecture references together.

An ordinary new feature that fits the approved architecture does not require approval for its folder creation.

---

## 6. Import boundaries and dependency direction

The permitted dependency direction is:

```text
src/pages/  ───────►  src/features/
     │                       │
     │                       ├────────► src/components/ui/
     │                       │
     │                       └────────► src/lib/
     │
     ├──────────────────────► src/components/
     └──────────────────────► src/layouts/

src/components/ui/ ─────────► src/lib/ui/ (and safe shared helpers)

src/lib/ ────────────────────► no imports from pages, features, or UI components
```

Additional rules:

- Features must not create circular imports with other features.
- A feature may consume a narrowly defined shared UI primitive, but shared UI must not know about product, cart, auth, or order domain rules.
- If two features need the same domain operation, expose a stable shared contract or move the genuinely shared capability to an appropriate lower-level layer after review.
- `config/` may be imported by layers that need it, but config must not import feature UI or page modules.
- Add ESLint import-boundary rules so these constraints are automated. Do not rely on memory alone.

---

## 7. Astro and React rules

### 7.1 When to use Astro

Use `.astro` for:

- Route/page composition and server data loading.
- Static or server-rendered editorial content.
- Product description and detail content that does not need browser state.
- SEO metadata and JSON-LD.
- Server-rendered order status when it is not live-updating.
- Presentational product cards, grids and content sections when their behavior can use native links/forms or small React controls.

Astro components do not become client-reactive. Do not place changing client state inside `.astro` and expect it to update after hydration.

### 7.2 When to use React

Use `.tsx` for:

- Forms with interactive validation and state.
- Dialogs, drawers and interactive navigation.
- Product gallery, lightbox and client-side zoom.
- Product color/size selection and purchase interactions.
- Cart totals, quantity changes and optimistic cart updates.
- Wishlist state and controls.
- Search combobox and live results.
- Checkout selections and recalculating order summary.
- Fit Finder form/results.
- Size Guide dialog interactions.

If a component is reactive in the browser, it must be implemented as React (or another explicitly approved client framework), not as an Astro component pretending to be reactive.

### 7.3 Islands and composition

- Astro pages may render Astro components and hydrate React islands.
- **Never render an `.astro` component inside a React component tree.** Astro components are not React children.
- For the product page, `ProductDetailExperience.tsx` is the coordinated React island containing the gallery and purchase interaction. Astro content sections such as description, details, Style It With and related products are siblings composed by `[slug].astro`.
- Keep color, selected variant, size, gallery state and add-to-cart interaction coordinated within the product React experience.
- Fit Finder and Size Guide belong to the catalog feature while they remain product-sizing capabilities. Lazy-load them when opened; do not create separate Astro islands inside a React tree.
- Use `client:load` only for immediately necessary interactivity. Use `client:visible`, `client:idle`, or `client:media` only when their behavior is appropriate and verified. Nested React components use React lazy loading/dynamic imports, not Astro `client:*` directives.
- Prefer CSS scroll-snap for simple carousels. Hydrate controls only when native scrolling is insufficient.
- Never hydrate an entire page just because one small control is interactive.

### 7.4 Shared components with Astro and React versions

`Button.astro` and `Button.tsx`, or `Input.astro` and `Input.tsx`, are allowed only when both server-rendered and React usages genuinely exist.

- Share the class-variant map from `src/lib/ui/variants.ts` where feasible.
- Do not duplicate styling rules between the two implementations.
- Do not import an Astro component into React.
- Avoid creating a second implementation if a native HTML element is sufficient.

---

## 8. Product, sizing, and purchasing architecture

### 8.1 Product detail experience

The approved product page composition is:

```text
src/pages/products/[slug].astro
├── ProductDetailExperience.tsx
│   ├── ProductGallery.tsx
│   ├── ProductLightbox.tsx
│   └── ProductPurchasePanel.tsx
│       ├── ProductColorSelector.tsx
│       ├── ProductSizeSelector.tsx
│       ├── ProductSizingActions.tsx
│       ├── FitFinderDialog.tsx (loaded on demand)
│       ├── SizeGuideDialog.tsx (loaded on demand)
│       └── AddToBagButton
├── ProductDescription.astro
├── ProductDetailsAccordion.astro
├── StyleItWith.astro
└── RelatedProducts.astro
```

Rules:

- The product route loads the correct product by slug and handles not-found responses.
- Server-render meaningful product name, description, price/offer information where safe, canonical metadata and structured data.
- Keep interactive gallery and purchase state in the same React island when those states depend on one another.
- Selecting a color must update the selected color/variant, relevant images and available sizes.
- Selecting a size must resolve to a real backend variant ID/SKU; never fabricate one.
- Add-to-cart must send a product/variant identifier and quantity, not trust client-supplied price or stock.
- `StyleItWith` and `RelatedProducts` are distinct merchandising roles. Do not collapse them without a product requirement.

### 8.2 Fit Finder

- Fit Finder is separate from Size Guide.
- It gathers only the inputs defined by the approved product and backend contract (e.g. gender, birth year, height, weight, fit preference, if actually required).
- The UI form, Zod schema, types, API client and result mapping must agree.
- The frontend must not invent the sizing algorithm or claim a recommendation is accurate without a verified provider/backend contract.
- Any external sizing provider integration and credentials belong on the backend, not in browser code.
- Treat measurement/profile data as personal data: collect only necessary fields, explain use, avoid unnecessary retention, and follow applicable privacy requirements.
- A recommendation is not proof of stock. Revalidate the selected variant with the backend.

### 8.3 Size Guide

- Size Guide is a reference chart, not a recommendation engine.
- Support both international size conversion and product-specific garment measurements.
- Do not hardcode trouser measurements for shirts, jackets or other garment types.
- The data model must describe measurement columns/units per garment type or product chart.
- Display units clearly and make wide tables usable on mobile (horizontal scroll or a suitable responsive alternative).

### 8.4 Categories and collections

- Category is product classification.
- Collection is a curated or campaign grouping.
- Use separate data concepts and routes unless an accepted ADR explicitly changes this.
- Filter, sort, pagination, color and size state should be serializable in URL query parameters when shareable.
- Parse and serialize listing parameters in `features/catalog/utils/listing-params.ts`.
- Validate query parameters; do not trust arbitrary values.

---

## 9. Cart, wishlist, checkout, and payment rules

### 9.1 Cart

- Nano Stores is the shared client-side cart state mechanism.
- The backend cart is the source of truth for quantities, variants, prices, promotions, tax, shipping and availability.
- Use optimistic updates only with rollback on failure and reconciliation from the backend response.
- Support guest cart and guest-to-authenticated cart merge if those flows are part of the product requirements.
- Do not expose a personalized cart count inside a publicly cached shared HTML response. Load it through a request/user-specific path or client hydration.
- Ensure the cart store is safe during SSR; do not access `window`, `document`, or browser storage at module initialization.

### 9.2 Wishlist

- Keep one `wishlist.store.ts` for shared state.
- Keep one `WishlistButton.tsx` implementation with a variant/size prop where placements differ.
- Support guest behavior only according to the agreed persistence model; do not assume localStorage is the source of truth for authenticated wishlists.
- The wishlist page/grid must be reactive if guest or authenticated wishlist state can change without navigation.

### 9.3 Checkout and orders

- Guest checkout is allowed unless the product owner explicitly changes that decision.
- Order totals must be recalculated/verified by the backend before order creation.
- Send an idempotency key for one logical order submission; reuse the same key for retries of that submission. The backend must enforce idempotency.
- Order confirmation pages must not disclose orders based only on enumerable IDs. Require the authenticated owner or a sufficiently protected signed/unguessable confirmation token.
- Payment failure and cancellation flows must recover safely and never imply an order/payment succeeded without backend confirmation.
- `CheckoutOrderSummary.tsx` is React because delivery/method selections can change totals in the browser.
- `OrderStatus.astro` is sufficient for server-rendered status. Convert to React only if a verified live-updating requirement exists.

### 9.4 Payments

- Use provider-hosted checkout or hosted payment fields.
- Raw card data must never enter frontend application state, logs, API payloads, or your backend unless a separately reviewed compliant integration explicitly requires it.
- Payment secrets and signature verification live on the backend.
- The frontend may display provider status but must not decide that payment is successful based on a browser redirect alone.

---

## 10. Authentication and server endpoint rules

### 10.1 Required pages

These four routes are explicitly required and must not be removed or renamed without approval:

| Route | Page | Layout | Access |
|---|---|---|---|
| `/account/sign-in` | Sign in | `AuthLayout.astro` | Public |
| `/account/sign-up` | Sign up / registration | `AuthLayout.astro` | Public |
| `/account/forgot-password` | Request password reset | `AuthLayout.astro` | Public |
| `/account/reset-password` | Set new password from a validated reset token | `AuthLayout.astro` | Public, token-validated |

Authenticated customer pages:

- `/account`
- `/account/profile`
- `/account/addresses`
- `/account/orders`
- `/account/orders/[orderId]`

These use `AccountLayout.astro` and require authentication.

Do not protect the entire `/account/*` prefix, because that would incorrectly block sign-in, sign-up, forgot-password, and reset-password.

### 10.2 Session rules

- Store session credentials in `HttpOnly`, `Secure` (production), appropriately `SameSite` cookies with deliberate `Path`, expiry and rotation behavior.
- Never store session/refresh tokens in `localStorage`, `sessionStorage`, IndexedDB, URLs, analytics, or logs.
- Use CSRF protection for cookie-authenticated state-changing requests. SameSite is useful defense-in-depth, not a reason to omit CSRF analysis.
- Validate `returnTo` as an allowed same-origin path. Reject protocol-relative URLs, external origins, malformed URLs and disallowed routes.
- Clear/rotate cookies correctly on logout, refresh, password reset and session changes.
- The Hono backend remains responsible for authentication and authorization decisions.

### 10.3 BFF endpoint rules

Default browser-facing route structure:

```text
src/pages/api/
├── auth/
│   ├── sign-in.ts
│   ├── sign-up.ts
│   ├── logout.ts
│   ├── session.ts
│   ├── refresh.ts
│   ├── forgot-password.ts
│   └── reset-password.ts
├── cart/
│   ├── index.ts
│   ├── merge.ts
│   └── [itemId].ts
├── wishlist/index.ts
├── catalog/search.ts
├── fit-recommendation.ts
└── checkout/submit.ts
```

- Validate HTTP method, content type, body size, input schema, session and CSRF as applicable.
- Use a server-only backend client to call Hono.
- Normalize errors; never forward raw internal stack traces or secrets to the browser.
- Do not build an unrestricted arbitrary-URL proxy.
- Do not duplicate business logic in Astro endpoints. The endpoint is a BFF/security boundary; Hono owns the business operation.
- If the deployment intentionally lets Hono own the same-site session cookie, document that in an accepted ADR and remove redundant cookie-proxy endpoints. Never create two competing session authorities.

---

## 11. Rendering, caching, routes, and SEO

### 11.1 Rendering policy

Use a hybrid approach: static prerendering for stable public content, cached SSR for changing public catalog pages when safe, and private SSR for personalized routes.

| Route | Rendering/cache | Indexing |
|---|---|---|
| `/` | Static or public cached | Index |
| `/products/[slug]` | Static or public cached SSR; separate freshness for live offers/stock | Index |
| `/categories/*` | Static or public cached SSR | Index according to SEO policy |
| `/collections/*` | Static or public cached SSR | Index according to SEO policy |
| `/search` | SSR; conservative no-store initially | Noindex |
| `/cart` | SSR/private/no-store or client-loaded private data | Noindex |
| `/wishlist` | SSR/private/no-store or client-loaded private data | Noindex |
| `/account/sign-in` | SSR/no-store | Noindex |
| `/account/sign-up` | SSR/no-store | Noindex |
| `/account/forgot-password` | SSR/no-store | Noindex |
| `/account/reset-password` | SSR/no-store | Noindex |
| Authenticated `/account/*` | SSR/private/no-store | Noindex |
| `/checkout/*` | SSR/private/no-store | Noindex |
| `/checkout/confirmation/[orderId]` | SSR/private/no-store and owner/token protected | Noindex |
| `/legal/*` | Static/public cache | Index |
| `/contact` | Static or SSR according to form needs | Index |
| Error pages | Correct error status and no private leakage | Noindex |

Rules:

- Middleware cannot protect a page already emitted as static HTML. Never statically prerender personalized or protected content.
- Do not cache responses that contain session-specific HTML, account information, cart contents, wishlist data, checkout data, or private order information.
- Public product cache must not make a purchase decision. Revalidate price, discount and stock on cart/checkout/order operations.
- If price and availability are fetched separately, make the displayed offer and JSON-LD consistent with the freshness policy.
- `no-store` is the safe default for private pages. Any more permissive strategy requires evidence that no private data can be shared.

### 11.2 Middleware and headers

`src/middleware.ts` is required for the SSR application and should:

- Establish or validate request ID and request context.
- Read/validate session where applicable.
- Apply route access policy without blocking public auth routes.
- Apply CSRF checks to relevant mutation paths (or ensure the BFF endpoint enforces them).
- Attach security headers to SSR responses.
- Avoid logging secrets, reset tokens, session cookies, measurements or payment data.

Static assets do not pass through Worker middleware in the same way as SSR responses. `public/_headers` must be generated from the same security policy used for SSR response headers.

- Source policy: `src/lib/server/security-policy.ts`.
- SSR application: `src/lib/server/security-headers.ts`.
- Static output generator: `scripts/generate-cloudflare-headers.ts`.
- Generated output: `public/_headers`.
- Do not hand-edit generated `_headers`; edit the source policy and regenerate.
- Test CSP against the production Astro build and real payment provider origins. Do not casually add broad `unsafe-inline`, `unsafe-eval`, or wildcard sources to make an error disappear.
- Apply HSTS only in the correct HTTPS production environment and verify subdomain implications before enabling `includeSubDomains` or preload.

### 11.3 Canonical and robots policy

- Product pages use their approved canonical product URL.
- Category/collection pages have an explicit indexability policy.
- Filter/sort/page/color/size parameters are parsed and serialized by `listing-params.ts`.
- Do not blindly canonicalize every filtered or paginated URL to the base category. Decide which combinations are indexable, noindex, or canonicalized based on duplicate/content value.
- Search, cart, wishlist, account, checkout and confirmation pages must be `noindex`.
- `robots.txt.ts` must be environment-aware. Staging/non-production must not be accidentally indexed; verify the actual emitted response.
- Generate product sitemap entries from a verified backend feed or endpoint if products are SSR routes. Do not assume a static sitemap integration automatically discovers dynamic server-rendered products.
- Structured data must reflect visible, current, verifiable page content. Do not fabricate price, review, availability, rating, SKU or brand data.

---

## 12. API contract, validation, mappers, money, and retries

### 12.1 API client

`src/lib/api/client.ts` and `server.ts` are the shared transport layer. Feature API modules define endpoint-specific calls.

The shared client should support as required:

- Explicit base URL and credentials policy.
- Timeout and `AbortSignal` cancellation.
- Request ID propagation.
- Normalized error shape.
- Zod validation at untrusted response boundaries.
- GET-only automatic retries with bounded attempts, backoff and cancellation.
- No automatic retry for mutations unless the endpoint has an explicit idempotency contract.

### 12.2 Schemas and mappers

- Backend DTO types/schemas must be separate from frontend domain/view-model types when shapes or semantics differ.
- Validate response payloads at the boundary.
- Map validated DTOs using feature-owned `*.mapper.ts` files.
- Components consume frontend domain/view models, not raw backend DTOs.
- Do not add a mapper that is merely a redundant identity function. Add it where it creates a meaningful boundary or stable frontend contract.
- Do not invent fields that are absent from the actual backend contract. If a required field is missing, report the contract gap.

### 12.3 Async state

Use `src/lib/state/async-state.ts` for suitable asynchronous resources (`idle/loading/success/error`). Do not force it on simple local UI booleans such as dialog open state or selected tab.

### 12.4 Money and dates

- Represent money as integer minor units plus currency where the backend contract allows it.
- Do not assume every currency has two fraction digits.
- Use one shared formatter in `src/lib/format/price.ts` backed by `Intl.NumberFormat` or a verified currency formatting utility.
- Use `src/lib/format/date.ts` for consistent order/date display and locale/time-zone handling.
- Do not perform financial calculations with floating-point display values in the browser as authoritative totals.

---

## 13. Accessibility requirements

Every interactive component must be accessible. At minimum:

- A visible-on-focus skip link in the base layout.
- Correct landmarks, headings, labels and form descriptions.
- `FormField.tsx` must associate label, hint and error with the input using stable IDs and `aria-describedby`.
- `Dialog.tsx` and `Drawer.tsx` must provide correct dialog semantics, initial focus, focus containment, focus restoration, Escape handling, and scroll lock. Account for nested/stacked dialogs if the design permits them.
- Search combobox must implement keyboard interaction and ARIA relationships correctly; do not imitate a combobox with only visual styling.
- Product gallery controls must work by keyboard and expose useful accessible names/alt text.
- Size/colour selection must expose selected and disabled states semantically, not only through color/borders.
- Toast region must use appropriate `aria-live`/`role` behavior without over-announcing.
- Respect `prefers-reduced-motion` for transitions and animations.
- Tables require meaningful headers and responsive handling; do not shrink text to unreadable sizes.
- Run automated accessibility checks (including axe where configured) and manually verify keyboard/focus flows for critical journeys.

Use shared hooks only when they are correct, tested, and needed: `useFocusTrap`, `useScrollLock`, `useReducedMotion`, `useIsHydrated`, and `useAbortableRequest`.

---

## 14. Images, fonts, and assets

- Use `src/assets/` for imported build-time images that benefit from Astro asset processing.
- Use `public/` for files that must be served unchanged at stable paths (favicons, robots/static files, selected brand assets, generated headers).
- Product images that are dynamic catalog content should normally be delivered from an approved object-storage/CDN source, not copied into the frontend repository as the production catalog database.
- Do not move every image into `src/assets` indiscriminately.
- Configure approved remote image origins/patterns for Astro image optimization where applicable.
- Verify the Cloudflare adapter image service and runtime behavior against the installed adapter version. Do not assume local build-time image optimization applies to every remote image.
- Provide explicit image dimensions/aspect ratios where possible to reduce layout shift.
- Prioritize only the true above-the-fold LCP image; do not set high priority on every image.
- Use responsive image sizes and modern formats where supported.
- Self-host subsetted WOFF2 fonts when licensed and technically appropriate. Use deliberate font-display and preload only critical fonts.
- Development fixtures and test-only images must not leak into production bundles or public routes.

---

## 15. Analytics, consent, and monitoring

- Define typed ecommerce events in `src/lib/analytics/events.ts`.
- Track meaningful events such as view item, view item list, select item, add to cart, remove from cart, begin checkout, add shipping/payment info, purchase, search, sign-up and login where applicable.
- Purchase must be deduplicated using a stable order/event identifier; do not fire merely because a confirmation page is reloaded.
- Do not send personal data, authentication tokens, reset tokens, addresses, measurements, card data, or sensitive order details to analytics.
- Analytics tracking must read consent through `src/lib/consent/consent.store.ts`; `lib/analytics` must never import from `features/consent`.
- The consent UI lives in `features/consent/` and delegates to the shared consent contract/store.
- Non-essential tracking must not run before the applicable consent is granted.
- Add error reporting and Web Vitals through `src/lib/monitoring/`.
- Call monitoring from appropriate error boundaries, server error handling and middleware without leaking private data.
- If a monitoring provider is not configured, do not invent its SDK or environment variables. Keep a documented provider-neutral interface or ask for the chosen provider.

---

## 16. Testing and CI requirements

Tests should validate behavior, not merely file existence.

### Unit tests

Cover at least the relevant feature logic for:

- Product/variant selection and product mappers.
- Listing query parsing and serialization.
- Cart calculations, optimistic update rollback and reconciliation.
- Wishlist state and guest behavior.
- Auth and form schemas.
- Fit recommendation input/result mapping.
- Size guide rendering/data.
- Money/date formatting.
- API retry and error normalization.
- Consent and analytics gating.

### Component tests

Test critical interactive primitives and components, including:

- Dialog and Drawer focus behavior.
- FormField validation/ARIA wiring.
- QuantitySelector.
- ProductColorSelector and ProductSizeSelector.
- Fit Finder and Size Guide open/close/submit behavior.
- Sign-in/sign-up/forgot/reset forms.

### E2E tests

Critical paths include:

1. Homepage navigation to a category and product.
2. Product gallery, color and size selection.
3. Fit Finder recommendation and selection.
4. Size Guide display and mobile usability.
5. Add-to-cart, update quantity, remove item and cart recovery.
6. Guest cart merge after login if implemented.
7. Sign-up, sign-in, logout, forgot password and reset password.
8. Search, filters and URL state.
9. Guest/authenticated checkout as supported.
10. Payment success, failure, retry and confirmation security.
11. Wishlist guest/authenticated behavior.
12. Consent gating, SEO metadata, canonical, noindex, JSON-LD and error pages.
13. Keyboard accessibility and mobile layout.

### CI

Before declaring a task complete, run the relevant checks available in the repository. The standard full CI should include:

- Formatting check.
- ESLint.
- `astro check` / TypeScript checks.
- Unit tests.
- Production build.
- Relevant Playwright tests.
- Accessibility checks where configured.
- Lighthouse CI according to measured budgets.

Do not claim a check passed unless it was actually run and its result observed. If a check cannot be run, state why.

---

## 17. Tooling and configuration rules

- Respect the package manager and lockfile already in the repository. The current baseline is npm with `package-lock.json`; do not introduce pnpm/yarn or a second lockfile without approval.
- Read installed package versions before using APIs or suggesting upgrades.
- Keep Astro, React integration, Cloudflare adapter, Tailwind and image integration versions compatible.
- Tailwind 3 and Tailwind 4 have different Astro integration approaches. Inspect the installed version; do not migrate or rewrite configuration based on assumptions.
- Keep `astro.config.mjs`, `wrangler.jsonc`, TypeScript, ESLint, Prettier, Vitest, Playwright and Lighthouse configuration consistent with installed versions.
- Keep `.nvmrc`, `.editorconfig`, Husky/lint-staged, Dependabot, GitHub workflow and root `README.md` aligned with the actual project.
- Never upgrade all dependencies as an incidental part of a feature task.
- Do not add a dependency when the installed stack or native browser/Astro capability already solves the problem adequately.

---

## 18. No-hallucination and evidence rules

These rules are strict.

1. Never claim a file, route, component, package, script, endpoint, test, environment variable, database field, provider capability, or configuration exists unless you inspected it or it is explicitly documented here.
2. Never fabricate Hono API routes or response shapes. Read the backend contract, OpenAPI spec, route definitions, or ask for the missing contract.
3. Never invent product data, size conversions, garment measurements, stock, prices, tax behavior, delivery promises, ratings, reviews, or payment status.
4. Never invent a third-party SDK, provider adapter, API method, configuration key or supported Cloudflare behavior. Check installed code/package documentation or official current documentation.
5. Distinguish clearly between:
   - **Verified:** observed in repository code/configuration or authoritative documentation.
   - **Assumption:** necessary but not yet confirmed.
   - **Recommendation:** a proposed improvement, not a current project fact.
   - **Blocker:** information or access required before safe implementation.
6. If backend contract details are missing, do not create speculative DTOs or fake endpoints. Implement only the independent UI shell with clearly marked mock fixtures in tests, or ask one targeted question if the missing information blocks the requested task.
7. If code cannot be inspected, say so. Do not pretend an architecture review is a code audit.
8. When uncertain, preserve current working behavior and request clarification for decisions that affect data contracts, session ownership, security, payment, routing, or architecture.
9. Do not silently reinterpret ambiguous user language as a new feature or change to the architecture.
10. Never report a production-readiness score as measured unless the implementation has actually been audited and the scoring method is stated.

---

## 19. Prohibited actions unless explicitly approved

The agent MUST NOT:

- Replace Astro with another framework or convert the app into a full React SPA.
- Replace Nano Stores with another state manager.
- Move every component into a new global `astro/` or `react/` folder.
- Move Fit Finder or Size Guide out of catalog without a documented reason and approval.
- Rename or restructure large parts of the repository as part of an unrelated feature.
- Introduce a monorepo, microfrontend, state-management framework, repository layer, service container, event bus, or generic plugin architecture without demonstrated need.
- Make private routes statically prerendered.
- Put session or refresh tokens in browser storage or URLs.
- Trust client-side prices, inventory, user roles, order ownership, or payment outcomes.
- Expose backend/provider secrets to client code.
- Send raw card data through the application.
- Bypass Zod/API boundary validation for external data.
- Add a second source of truth for product/cart/wishlist data.
- Add fake data to production catalog code to hide an absent backend contract.
- Suppress TypeScript, lint, accessibility or test errors with broad `any`, `@ts-ignore`, eslint disables, or skipped tests without a specific justified comment and approval.
- Delete tests, CI checks, lockfiles, ADRs, or security controls just to make a build pass.
- Change the visual design, brand identity, responsive behavior or existing interactions unless the task requests it.

---

## 20. Required workflow for every agent task

### Before implementation

1. Read this file.
2. Inspect repository status (`git status`) and do not overwrite unrelated user changes.
3. Inspect relevant code and tests.
4. Identify the owning feature and allowed dependency direction.
5. Identify SSR/browser boundaries, route access, caching, SEO, validation and accessibility implications.
6. State a short plan for multi-file or high-risk work.
7. If a requirement conflicts with this architecture, stop and propose the smallest compliant alternative or an ADR. Do not silently divert.

### During implementation

1. Work only on the requested scope.
2. Reuse existing code and patterns where correct.
3. Add/modify types, schemas, mappers, API functions and tests consistently.
4. Keep server-only code server-only.
5. Preserve responsive design and existing user-visible behavior unless asked to change it.
6. Avoid opportunistic refactors.
7. Keep a concise record of important decisions and any assumptions.

### After implementation

1. Review the diff for unrelated changes, duplicate implementations and architecture violations.
2. Run relevant formatter, lint, type/Astro checks, tests and build.
3. Inspect the final route/file placement.
4. Verify that no secrets, session values or personal data are exposed.
5. Verify loading, empty, error and success states where applicable.
6. Update tests and docs/ADRs when behavior or architecture changes.
7. Report exactly what changed, files added/modified, checks run and their actual results.
8. Explicitly list anything not verified or blocked.

### Required completion report format

```text
## Completed
- [What was implemented]

## Files changed
- [Path] — [purpose]

## Architecture compliance
- [How the change follows this AGENTS.md]
- [Any exception and its approved ADR, if applicable]

## Validation
- [Command/check] — PASS / FAIL / NOT RUN
- [Observed result]

## Assumptions or blockers
- [Only if applicable]

## Follow-up
- [Only concrete remaining work; do not invent future tasks]
```

---

## 21. Architecture change control and mandatory end-of-task updates

When this file is first introduced, treat the architecture in Section 3 and the rules in this document as the approved baseline.

For future approved architecture changes:

- Add an ADR under `docs/adr/`.
- Update the relevant part of this file.
- Update the project tree or route/rendering tables if affected.
- Update import-boundary and CI checks if the change affects enforcement.
- Update the corresponding architecture summary in `GEMINI.md` so both instruction files remain aligned.
- Do not leave contradictory old and new rules in either file.

### Mandatory instruction-file update after every code-generation task

At the end of **every task that creates, modifies, deletes, or moves application code/configuration/tests** (including a task where the implementation is completed but the architecture does not change), the agent MUST update both root instruction files: `AGENTS.md` and `GEMINI.md`.

This is a documentation and audit step, not permission to change the rules. The agent MUST:

1. Re-inspect the final repository tree and the final `git diff` after implementation and tests.
2. Update the `Current repository structure / implementation snapshot` section in **both** files with the verified final structure relevant to the project. Reflect new files, removed files, moved files, new routes/features/categories, and changed ownership. Never list a planned file as if it exists.
3. Update the `Implementation update log` in **both** files with the date, task summary, paths changed, validation commands and actual PASS/FAIL/NOT RUN outcomes, plus any unresolved blockers.
4. If no structural change occurred, explicitly record `No architecture or directory-structure change in this task`; do not invent a change just to make the update look substantial.
5. Keep the full approved architecture and rules intact. Do not replace, shorten, rewrite, weaken, or delete mandatory rules as part of routine updates.
6. Keep both files consistent. `AGENTS.md` remains the canonical detailed contract; `GEMINI.md` may summarize and point to it, but must include the verified current structure snapshot and implementation log as required.
7. If the task is interrupted before implementation or validation is complete, record it as incomplete and identify what was not run. Never mark unfinished work as completed.
8. If the agent cannot safely update either instruction file, it MUST say so in the final response and identify which file was not updated and why. It must not claim compliance.

The required completion report in Section 20 must state that both instruction files were updated and identify the sections changed. If they were not updated, state that explicitly as a failure/blocker.

### Current repository structure / implementation snapshot

- **Verification date:** 2026-11-11
- **Verification status:** Verified against active working repository
- **Framework & Stack:** Astro 4.16.18 + React 18.3.1 + TypeScript 5.6.3 + Tailwind CSS 3.4.14 + Nano Stores 0.11.3
- **Active Routes (`src/pages/`):**
  - `/` -> `src/pages/index.astro` (Homepage with hero, category grid, editorial duo, and product carousels)
  - `/products/[slug]` -> `src/pages/products/[slug].astro` (Product Detail Page with horizontal gallery, floating info card, lightbox, fit finder, size guide, style-it-with, and related suggestions)
  - `/search` -> `src/pages/search.astro` (Storefront search results page)
  - `/cart` -> `src/pages/cart.astro` (Shopping bag page)
  - `/checkout` -> `src/pages/checkout.astro` (Multi-step checkout page)
  - `/wishlist` -> `src/pages/wishlist.astro` (Wishlist page with breadcrumbs, item count, empty state, and wishlist grid)
  - `/contact` -> `src/pages/contact.astro` (Client concierge & salon contact page)
  - `/account/sign-in` (alias `/login`) -> `src/pages/account/sign-in.astro` (`src/pages/login.astro`)
  - `/account/sign-up` (alias `/signup`) -> `src/pages/account/sign-up.astro` (`src/pages/signup.astro`)
  - `/account/forgot-password` -> `src/pages/account/forgot-password.astro`
  - `/legal/{privacy-policy,shipping-returns,terms}` -> `src/pages/legal/*.astro`

```text
deynold-danny-ecommerce/
├── backend/                               # Separate Hono / Cloudflare Workers backend
├── public/
│   ├── hero-banner.jpg
│   ├── hero-banner.png
│   ├── logo.png
│   └── images/
│       ├── autumn-product-[1..5].jpg
│       ├── bordeaux-dress-[back,detail,model,side].jpg
│       ├── cady-trousers-[back,detail,fabric,model,model-3,model-4,product,swatch,waist].jpg
│       ├── cady-vest.jpg
│       ├── categories/[abiti,accessori,borse,camicie,capispalla,maglieria,pantaloni,scarpe].jpg
│       ├── category-*.jpg
│       ├── cleaned-inspection.png
│       ├── mastery-[1..5]-[back,detail,model,product].jpg
│       ├── mastery-men-[1..5].jpg & hover
│       ├── nappa-flat.jpg
│       ├── news-[1..5]-[back,detail,model,product].jpg
│       ├── news-men-[1..5].jpg & hover
│       ├── style-[1..5]-[back,detail,model,product].jpg
│       ├── style-space-[1..5].jpg & hover
│       ├── suggest-pants-[1..4].jpg
│       └── thread-mastery-[1..5].jpg
├── src/
│   ├── components/
│   │   └── layout/
│   │       ├── Footer.astro
│   │       └── Header.astro
│   ├── config/
│   │   ├── ecommerce.config.ts
│   │   ├── navigation.config.ts
│   │   ├── routes.ts
│   │   └── site.config.ts
│   ├── data/
│   │   └── products.ts
│   ├── features/
│   │   ├── auth/
│   │   │   ├── api/
│   │   │   │   └── auth.api.ts
│   │   │   ├── components/
│   │   │   │   ├── ForgotPasswordForm.tsx
│   │   │   │   ├── SignInForm.tsx
│   │   │   │   └── SignUpForm.tsx
│   │   │   └── types/
│   │   │       └── auth.types.ts
│   │   ├── cart/
│   │   │   ├── api/
│   │   │   │   └── cart.api.ts
│   │   │   ├── components/
│   │   │   │   ├── CartDrawer.tsx
│   │   │   │   └── CartTrigger.tsx
│   │   │   ├── store/
│   │   │   │   └── cart.store.ts
│   │   │   └── types/
│   │   │       └── cart.types.ts
│   │   ├── catalog/
│   │   │   ├── api/
│   │   │   │   └── catalog.api.ts
│   │   │   ├── components/
│   │   │   │   ├── ProductCard.tsx
│   │   │   │   ├── ProductCarousel.tsx
│   │   │   │   ├── ProductColorSelector.tsx
│   │   │   │   ├── ProductDetailExperience.tsx
│   │   │   │   ├── ProductGallery.tsx
│   │   │   │   ├── ProductLightbox.tsx
│   │   │   │   ├── ProductPurchasePanel.tsx
│   │   │   │   ├── ProductSizeSelector.tsx
│   │   │   │   ├── ProductSizingActions.tsx
│   │   │   │   ├── RelatedProducts.astro
│   │   │   │   └── StyleItWith.astro
│   │   │   ├── data/
│   │   │   │   └── products.ts
│   │   │   ├── fit-finder/
│   │   │   │   └── FitFinderDialog.tsx
│   │   │   ├── size-guide/
│   │   │   │   └── SizeGuideDialog.tsx
│   │   │   ├── types/
│   │   │   │   ├── fit-recommendation.types.ts
│   │   │   │   ├── product.types.ts
│   │   │   │   └── size-guide.types.ts
│   │   │   └── utils/
│   │   │       └── product.utils.ts
│   │   ├── checkout/
│   │   │   ├── api/
│   │   │   │   └── checkout.api.ts
│   │   │   └── components/
│   │   │       └── CheckoutExperience.tsx
│   │   ├── home/
│   │   │   ├── components/
│   │   │   │   ├── CategoryGrid.astro
│   │   │   │   ├── EditorialDuo.astro
│   │   │   │   └── HeroBanner.astro
│   │   │   └── data/
│   │   │       └── home-content.ts
│   │   ├── search/
│   │   │   ├── components/
│   │   │   │   ├── SearchDialog.tsx
│   │   │   │   └── SearchTrigger.tsx
│   │   │   └── store/
│   │   │       └── search.store.ts
│   │   └── wishlist/
│   │       ├── components/
│   │       │   ├── WishlistButton.tsx
│   │       │   └── WishlistExperience.tsx
│   │       ├── store/
│   │       │   └── wishlist.store.ts
│   │       └── types/
│   │           └── wishlist.types.ts
│   ├── layouts/
│   │   ├── AuthLayout.astro
│   │   ├── BaseLayout.astro
│   │   ├── Layout.astro
│   │   └── StorefrontLayout.astro
│   ├── lib/
│   │   └── api/
│   │       └── client.ts
│   ├── pages/
│   │   ├── account/
│   │   │   ├── forgot-password.astro
│   │   │   ├── sign-in.astro
│   │   │   └── sign-up.astro
│   │   ├── legal/
│   │   │   ├── privacy-policy.astro
│   │   │   ├── shipping-returns.astro
│   │   │   └── terms.astro
│   │   ├── products/
│   │   │   └── [slug].astro
│   │   ├── cart.astro
│   │   ├── checkout.astro
│   │   ├── contact.astro
│   │   ├── index.astro
│   │   ├── login.astro
│   │   ├── search.astro
│   │   ├── signup.astro
│   │   └── wishlist.astro
│   ├── stores/
│   │   └── cartStore.ts
│   ├── styles/
│   │   ├── global.css
│   │   ├── luxury-custom.css
│   │   ├── typography.css
│   │   └── variables.css
│   ├── types/
│   │   └── ecommerce.ts
│   └── env.d.ts
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
├── package.json
├── package-lock.json
├── README.md
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
  - **Structural change summary:** New `backend/` directory (adjacent to `src/`) with 4 config files, 2 migration SQL files, and 43 TypeScript source files across types, config, middleware, services, db, routes (public + admin), queues.
  - **Cloudflare bindings:** `CATALOG_KV` (KVNamespace), `MEDIA_BUCKET` (R2Bucket), `deynold-danny-db` (D1), `deynold-danny-emails` (Queue consumer + producer).
  - **Known deviations / open items:**
    - Category IDs in seed data differ from frontend `ecommerce.config.ts` — reconciliation pending.
    - Frontend auth forms (`SignInForm.tsx`, `SignUpForm.tsx`) still use email+password flow — need migration to OTP flow when user requests it.
    - Cloudflare resources need to be provisioned with `wrangler` CLI before production deploy.
  - **Validation:** `npx tsc --noEmit` (PASS: 0 errors), `npx wrangler d1 migrations apply deynold-danny-db --local` (PASS), all endpoint smoke tests (PASS).
  - **Blockers:** None — backend is fully operational locally. Production deploy requires Cloudflare resource provisioning and secret injection.

- **2026-11-10 — Cloudflare Remote Resource Provisioning and Production Deployment**:
  - **Status:** COMPLETE
  - **Summary:** Authenticated with Cloudflare via OAuth (`vemudanny@gmail.com`). Provisioned remote Cloudflare D1 SQL database (`e7a8af53-0174-4e60-8ef6-bf65acb5ae92`) and applied all migrations (`0001_initial_schema.sql` and `0002_seed_data.sql`). Provisioned remote KV catalog cache (`1714f27a97d74d86bf98e151adc00862`). Uploaded all 5 Cloudflare Secrets (`JWT_SECRET`, `ADMIN_EMAILS`, `RESEND_API_KEY`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`). Registered workers.dev subdomain `deynolddanny` and successfully deployed Worker `deynold-danny-backend` live to `https://deynold-danny-backend.deynolddanny.workers.dev` with scheduled cron trigger (`*/5 * * * *`). Pushed commit `c19c327` to GitHub `origin main`, triggering Vercel deployment to `https://deynolddanny.pixenox.com/wishlist`.
  - **Files Added:** `backend/.dev.vars.example`.
  - **Files Modified:** `backend/src/types/bindings.d.ts`, `backend/src/routes/admin/uploads.ts`, `backend/src/routes/auth.ts`, `backend/wrangler.toml`, `tsconfig.json`.
  - **Validation:** Live health endpoint query (200 OK ✅), Live products endpoint returning 12 luxury products (200 OK ✅), Live categories endpoint returning 8 categories (200 OK ✅), Frontend wishlist page at `https://deynolddanny.pixenox.com/wishlist` (200 OK ✅).
  - **Blockers:** None.

- **2026-11-10 — Frontend and Backend Integration (API Client, Catalog & Cart Wiring)**:
  - **Status:** COMPLETE
  - **Summary:** Connected the Astro frontend to the live Cloudflare Worker backend (`https://deynold-danny-backend.deynolddanny.workers.dev`). Created `src/lib/api/client.ts` with anonymous `x-session-id` generation and Bearer token support. Implemented typed feature API clients for catalog (`src/features/catalog/api/catalog.api.ts`), cart (`src/features/cart/api/cart.api.ts`), and auth (`src/features/auth/api/auth.api.ts`). Connected `src/features/cart/store/cart.store.ts` to sync with backend cart endpoints (`getCartApi`, `addToCartApi`, `updateCartItemApi`, `removeCartItemApi`) with optimistic UI response. Updated `src/pages/index.astro` and `src/pages/products/[slug].astro` to fetch live products dynamically from Cloudflare D1 with zero-crash local fallbacks. Updated backend CORS policy in `backend/src/middleware/cors.ts` to permit `https://deynolddanny.pixenox.com`.
  - **Files Added:**
    - `src/lib/api/client.ts`
    - `src/features/catalog/api/catalog.api.ts`
    - `src/features/cart/api/cart.api.ts`
    - `src/features/auth/api/auth.api.ts`
  - **Files Modified:**
    - `backend/src/middleware/cors.ts`
    - `src/features/cart/store/cart.store.ts`
    - `src/features/cart/types/cart.types.ts`
    - `src/pages/index.astro`
    - `src/pages/products/[slug].astro`
  - **Validation:** `npx astro check` (PASS: 62 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 19 static pages built with live D1 fetch in 2.81s), CORS verification with live domain (200 OK ✅), `git push origin main` (PASS: commit `d31e4d7`).
  - **Blockers:** None.

- **2026-11-10 — Product Gallery Image Alignment and Asset Resolution**:
  - **Status:** COMPLETE
  - **Summary:** Resolved broken image issue on live product detail page (`/products/tailored-virgin-wool-suit`). Created gallery image aliases in `public/images/` for all catalog sections (`mastery-1..5`, `style-1..5`, `news-1..5`, and `categories/`) matching backend D1 seed references (`model`, `product`, `detail`, `back`). Added `normalizeProduct` mapper in `src/features/catalog/api/catalog.api.ts` to attach full gallery image arrays to product colors.
  - **Files Added:** 68 gallery image assets under `public/images/` and `public/images/categories/`.
  - **Files Modified:** `src/features/catalog/api/catalog.api.ts`.
  - **Validation:** `npx astro check` (PASS: 62 files, 0 errors), `npm run build` (PASS: 19 static pages), live asset HTTP 200 check on Vercel (`mastery-1-model.jpg` returning 200 OK ✅), `git push origin main` (PASS: commit `7c2f7bf`).
  - **Blockers:** None.

- **2026-11-10 — Full End-to-End Storefront Functionality (Search, Checkout, Auth & Newsletter)**:
  - **Status:** COMPLETE
  - **Summary:** Enabled 100% full storefront interactive functionality with zero UI/styling alterations. Connected header search and hero search strip to live SQLite FTS5 search dialog and created dedicated `/search` page. Connected cart drawer actions to live multi-step `/checkout` and `/cart` pages. Wired client authentication forms (`SignInForm`, `SignUpForm`, `ForgotPasswordForm`) to the Cloudflare Worker passwordless OTP engine with Resend email dispatch, JWT access token persistence, and D1 profile synchronization. Connected footer newsletter form to live `POST /api/newsletter/subscribe` endpoint with real-time feedback. Created client concierge contact and legal policy pages (`/contact`, `/legal/privacy-policy`, `/legal/terms`, `/legal/shipping-returns`).
  - **Files Added:**
    - `src/features/checkout/api/checkout.api.ts`
    - `src/features/checkout/components/CheckoutExperience.tsx`
    - `src/features/search/store/search.store.ts`
    - `src/features/search/components/SearchTrigger.tsx`
    - `src/features/search/components/SearchDialog.tsx`
    - `src/pages/cart.astro`
    - `src/pages/checkout.astro`
    - `src/pages/contact.astro`
    - `src/pages/search.astro`
    - `src/pages/legal/privacy-policy.astro`
    - `src/pages/legal/terms.astro`
    - `src/pages/legal/shipping-returns.astro`
  - **Files Modified:**
    - `src/components/layout/Header.astro`
    - `src/components/layout/Footer.astro`
    - `src/features/auth/components/SignInForm.tsx`
    - `src/features/auth/components/SignUpForm.tsx`
    - `src/features/auth/components/ForgotPasswordForm.tsx`
    - `src/features/cart/components/CartDrawer.tsx`
    - `src/features/home/components/HeroBanner.astro`
  - **Validation:** `npx astro check` (PASS: 74 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 26 static pages built in 5.58s).
  - **Blockers:** None.

- **2026-11-10 — Removal of Unwanted Dividers and Dividing Lines**:
  - **Status:** COMPLETE
  - **Summary:** Identified and removed all visible dividing elements from the attached DevTools inspector image (`media_1794307268803_2ca71135.png`) and the corresponding storefront source implementation. Seamlessly removed the horizontal divider line next to ACCESSIBILITY, top edge border line, tooltip box border outline, and breadcrumb slash separators `/` without smudges or empty gaps, preserving original dimensions (377x327). In the website source files, eliminated `<li class="select-none">/</li>` breadcrumb slash dividers in `src/pages/products/[slug].astro` and `src/pages/search.astro`. Removed unwanted horizontal header divider lines (`box-shadow: 0 1px 0 var(--color-border)` and `border-bottom: 1px solid var(--color-border)`) in `src/styles/luxury-custom.css` so the header transitions seamlessly into page content.
  - **Files Added:** `public/images/cleaned-inspection.png`.
  - **Files Modified:** `src/pages/products/[slug].astro`, `src/pages/search.astro`, `src/styles/luxury-custom.css`.
  - **Validation:** `npx astro check` (PASS: 74 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 26 static pages built in 2.62s).
  - **Blockers:** None.

- **2026-11-10 — Removal of Product Detail Page Breadcrumb Navigation**:
  - **Status:** COMPLETE
  - **Summary:** Removed the entire breadcrumb navigation bar (`HOME COLLECTION [PRODUCT TITLE]`) from the product detail page template (`src/pages/products/[slug].astro`) as requested in the user-provided screenshot (`media_1794310647880_1b0f7fd8.png`). The split-screen interactive product experience now begins directly beneath the header in alignment with luxury fashion editorial layouts.
  - **Files Modified:** `src/pages/products/[slug].astro`.
  - **Structural change summary:** No architecture or directory-structure change in this task.
  - **Validation:** `npx astro check` (PASS: 74 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 26 static pages built in 7.79s).
  - **Blockers:** None.

- **2026-11-10 — Product Detail Page Image Dimensions and Aspect Ratio Alignment**:
  - **Status:** COMPLETE
  - **Summary:** Aligned the product detail gallery image container to the exact native aspect ratio `aspect-[1124/1546]` and attached intrinsic dimensions (`width={1124}`, `height={1546}`) in `src/features/catalog/components/ProductGallery.tsx`. This ensures the exact `561.92 × 773.18` rendered desktop viewport dimensions requested in the user's DevTools screenshot (`media_1794311868025_b7075c4c.png`) without any cropping, distortion, or CLS. Updated container width to `max-w-[1520px]` in `src/features/catalog/components/ProductDetailExperience.tsx` aligning with site chrome. Backend was untouched per user instruction.
  - **Files Modified:** `src/features/catalog/components/ProductGallery.tsx`, `src/features/catalog/components/ProductDetailExperience.tsx`.
  - **Structural change summary:** No architecture or directory-structure change in this task.
  - **Validation:** `npx astro check` (PASS: 74 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 26 static pages built in 3.16s).
  - **Blockers:** None.

- **2026-11-10 — Product Detail Purchase Panel 40px 20px 24px 24px Padding Alignment**:
  - **Status:** COMPLETE
  - **Summary:** Applied the exact box-model padding inspected in DevTools (`Padding: 40px 20px 24px 24px`, width `~396.93px`) from user-provided reference screenshots (`media_1794311920813_4ea0b5b2.png` and `media_1794312057748_23d6e9af.png`) to the purchase panel in `src/features/catalog/components/ProductPurchasePanel.tsx`. Enclosed upper purchase controls (title, price, color selector, sizing actions, size selector, and add to bag) inside a container configured with `padding: 40px 20px 24px 24px` and max width 400px. Wrapped lower editorial description and accordions in a matching container with `padding: 0 20px 40px 24px` for seamless vertical alignment. In `src/features/catalog/components/ProductSizingActions.tsx`, aligned "FIND YOUR SIZE" (with coiled tape measure icon) on the left and "SIZE GUIDE" on the right matching reference imagery. In `src/features/catalog/components/ProductSizeSelector.tsx`, centered the "SELECT SIZE" text. Preserved all left gallery dimensions (`aspect-[1124/1546]`, `561.92 × 773.18`) and kept all backend files completely untouched per user requirement.
  - **Files Modified:**
    - `src/features/catalog/components/ProductPurchasePanel.tsx`
    - `src/features/catalog/components/ProductDetailExperience.tsx`
    - `src/features/catalog/components/ProductSizingActions.tsx`
    - `src/features/catalog/components/ProductSizeSelector.tsx`
  - **Structural change summary:** No architecture or directory-structure change in this task.
  - **Validation:** `npx astro check` (PASS: 74 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 26 static pages built in 7.51s).
  - **Blockers:** None.

- **2026-11-10 — Product Detail 2-Column Seamless Image Grid (1123.86 × 2319.53) Alignment**:
  - **Status:** COMPLETE
  - **Summary:** Aligned the product detail gallery grid to the exact specifications inspected in DevTools (`div.ProductGallery__product-gallery__grid`, `1123.86 × 2319.53`) from the user's uploaded reference screenshot (`media_1794312506569_f06efeb1.jpg`). Replaced the gap spacing with seamless `gap-0` across rows and columns in `src/features/catalog/components/ProductGallery.tsx`, where each image occupies a single column cell with aspect ratio `1124 / 1546` (`561.93 × 773.18`), leaving odd-numbered trailing cells unoccupied with natural CSS Grid track hatching. In `src/features/catalog/components/ProductDetailExperience.tsx`, updated the split-screen container to `max-w-[1521px]` with `w-[calc(100%-396.93px)] xl:w-[1123.86px]` gallery and `396.93px` purchase panel (`gap-0` between them). In accordance with the user's explicit instruction, no changes were pushed to GitHub.
  - **Files Modified:**
    - `src/features/catalog/components/ProductGallery.tsx`
    - `src/features/catalog/components/ProductDetailExperience.tsx`
    - `src/features/catalog/components/ProductPurchasePanel.tsx`
  - **Structural change summary:** No architecture or directory-structure change in this task.
  - **Validation:** `npx astro check` (PASS: 74 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 26 static pages built in 3.35s).
  - **Blockers:** None.

- **2026-11-10 — Removal of Product Detail Split-Screen Outer Container Padding**:
  - **Status:** COMPLETE
  - **Summary:** Removed the outer container padding (`pt-4 pb-12 lg:pt-6 lg:pb-16 px-4 sm:px-6 lg:px-8` which caused `24px 32px 64px` padding) from `src/features/catalog/components/ProductDetailExperience.tsx` as inspected in DevTools screenshot (`media_1794312437180_2b7da302.png`). The container is now flush (`<div className="w-full max-w-[1521px] mx-auto">`), allowing the gallery images to sit edge-to-edge seamlessly. In accordance with the user's explicit instruction, no changes were pushed to GitHub.
  - **Files Modified:** `src/features/catalog/components/ProductDetailExperience.tsx`.
  - **Structural change summary:** No architecture or directory-structure change in this task.
  - **Validation:** `npx astro check` (PASS: 74 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 26 static pages built in 5.15s).
  - **Blockers:** None.

- **2026-11-10 — Product Title Heading Font Size Adjusted to 20px**:
  - **Status:** COMPLETE
  - **Summary:** Updated the product title heading (`h1`) in `src/features/catalog/components/ProductPurchasePanel.tsx` from `text-xl sm:text-2xl` (which rendered at 24px on desktop) to exact `text-[20px] font-normal leading-snug`, matching the user's specification (`media_1794312985029_694f2b66.png`).
  - **Files Modified:** `src/features/catalog/components/ProductPurchasePanel.tsx`.
  - **Structural change summary:** No architecture or directory-structure change in this task.
  - **Validation:** `npx astro check` (PASS: 74 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 26 static pages built in 7.33s).
  - **Blockers:** None.

- **2026-11-10 — Removal of 'VAT Inc.' Price Label**:
  - **Status:** COMPLETE
  - **Summary:** Removed the `span.text-[11px].uppercase.tracking-wider.text-neutral-500.font-mono` ("VAT Inc.") element adjacent to the price display in `src/features/catalog/components/ProductPurchasePanel.tsx` as requested in user-provided screenshot (`media_1794313165624_a5097034.png`).
  - **Files Modified:** `src/features/catalog/components/ProductPurchasePanel.tsx`.
  - **Structural change summary:** No architecture or directory-structure change in this task.
  - **Validation:** `npx astro check` (PASS: 74 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 26 static pages built in 7.06s).
  - **Blockers:** None.

- **2026-11-10 — Product Heading Container 0px 0px 16px Padding Alignment**:
  - **Status:** COMPLETE
  - **Summary:** Enclosed the product title row and price display inside a dedicated heading container (`div.ProductDetailDescription__product-detail-description__heading`) configured with exact `padding: 0px 0px 16px` (`352.93 × 65.6`) in `src/features/catalog/components/ProductPurchasePanel.tsx` matching the user-provided DevTools inspection screenshot (`media_1794314214958_6c072496.png`).
  - **Files Modified:** `src/features/catalog/components/ProductPurchasePanel.tsx`.
  - **Structural change summary:** No architecture or directory-structure change in this task.
  - **Validation:** `npx astro check` (PASS: 74 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 26 static pages built in 5.34s).
  - **Blockers:** None.

- **2026-11-10 — Product Color Selection 16px 0px Padding and Gap Alignment**:
  - **Status:** COMPLETE
  - **Summary:** Configured `div.ProductColorSelection__product-color-selection` in `src/features/catalog/components/ProductColorSelector.tsx` with exact `padding: 16px 0px` (`352.93 × 128`), `gap-3` (12px) between label and swatches, and height 128px matching the DevTools inspection screenshot (`media_1794314501033_ea6abe8e.png`). In `src/features/catalog/components/ProductPurchasePanel.tsx`, eliminated container `space-y-5` to let the precise box-model paddings govern vertical spacing between heading, color selection, and sizing utilities.
  - **Files Modified:**
    - `src/features/catalog/components/ProductColorSelector.tsx`
    - `src/features/catalog/components/ProductPurchasePanel.tsx`
  - **Structural change summary:** No architecture or directory-structure change in this task.
  - **Validation:** `npx astro check` (PASS: 74 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 26 static pages built in 7.70s).
  - **Blockers:** None.

- **2026-11-10 — Brand Provenance & Manufacturing Correction to 'Made in India'**:
  - **Status:** COMPLETE
  - **Summary:** Corrected all brand provenance, product descriptions, meta tags, and contact details from "Made in Italy / Italian brand" to "Made in India / Indian luxury brand":
    - Updated `src/config/site.config.ts` title and description to `DEYNOLD DANNY | Luxury Fashion House & Artisanal Tailoring — Made in India`.
    - In `src/features/catalog/components/ProductPurchasePanel.tsx`, updated product description default and care instructions to "Made in India through sustainable processes" and "Carefully crafted in India".
    - In `src/features/catalog/data/products.ts`, updated all product descriptions, compositions, craftsmanship notes, model size labels, and slugs across the catalog to reflect "Made in India" and artisanal Indian luxury tailoring.
    - In `src/pages/contact.astro`, updated Flagship Atelier to New Delhi, India with Indian concierge telephone assistance (`+91 11 4820 9000`).
    - In `src/pages/cart.astro`, updated description to "Review your selected DEYNOLD DANNY luxury garments. Handcrafted in India."
    - In `backend/migrations/0002_seed_data.sql`, updated description to "defines modern elegance. Made in India."
  - **Files Modified:**
    - `src/config/site.config.ts`
    - `src/features/catalog/components/ProductPurchasePanel.tsx`
    - `src/features/catalog/data/products.ts`
    - `src/features/catalog/fit-finder/FitFinderDialog.tsx`
    - `src/pages/cart.astro`
    - `src/pages/contact.astro`
    - `backend/migrations/0002_seed_data.sql`
  - **Structural change summary:** No architecture or directory-structure change in this task.
  - **Validation:** `npx astro check` (PASS: 74 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 26 static pages built in 5.46s).
  - **Blockers:** None.

- **2026-11-10 — Product Color Selection 16px 0px Padding and Vertical Rhythm Re-alignment**:
  - **Status:** COMPLETE
  - **Summary:** Applied the exact DevTools box-model padding inspected in `media_1794318665775_2fee9302.png` to `ProductColorSelection` (`div.ProductColorSelection__product-color-selection`, `352.93 × 128`, `Padding: 16px 0px`). Configured `style={{ padding: '16px 0px' }}` and `gap-3` (12px) with `leading-5` in `src/features/catalog/components/ProductColorSelector.tsx`. In `src/features/catalog/components/ProductPurchasePanel.tsx`, eliminated `space-y-5` from the parent container (`pt-[40px] pr-[20px] pb-[24px] pl-[24px]`), allowing heading bottom padding (16px) and color selection top padding (16px) to sit contiguously without extraneous margin-top. In accordance with the user's standing instruction, no changes were pushed to GitHub.
  - **Files Modified:**
    - `src/features/catalog/components/ProductColorSelector.tsx`
    - `src/features/catalog/components/ProductPurchasePanel.tsx`
  - **Structural change summary:** No architecture or directory-structure change in this task.
  - **Validation:** `npx astro check` (PASS: 74 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 26 static pages built in 5.49s).
  - **Blockers:** None.

- **2026-11-10 — Add to Bag Cart-Block and Button Padding, Margin & Font Size Alignment**:
  - **Status:** COMPLETE
  - **Summary:** Aligned the Add to Bag CTA and its enclosing cart-block container to the exact box model and typography inspected in user-provided DevTools screenshots (`media_1794318987426_56a4f694.png`, `media_1794319015170_5abc56cc.png`, `media_1794319031018_42282817.png`):
    - Wrapped the Add to Bag CTA inside `div.ProductDetailDescription__product-detail-description__cart-block` configured with `margin: 0px -16px`, `padding: 16px`, `width: calc(100% + 32px)`, and `backgroundColor: #FFFFFF` (`384.93 × 77.6`).
    - Styled `button.Button__btn.ProductAddToCart__product-add-to-cart` with `height: 45.6px`, `padding: 13px 24px 9px 24px`, and `backgroundColor: #424242` (`352.93 × 45.6`).
    - Styled `span.Button__btn__content.btn__content` with exact `text-[14px] leading-[22px] font-semibold text-white uppercase tracking-wider`, while preserving the project's native font style per user instruction.
    - Sizing utilities and size selector remain cleanly partitioned in an adjacent container.
    - In accordance with the user's standing instruction, no changes were pushed to GitHub.
  - **Files Modified:** `src/features/catalog/components/ProductPurchasePanel.tsx`.
  - **Structural change summary:** No architecture or directory-structure change in this task.
  - **Validation:** `npx astro check` (PASS: 74 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 26 static pages built in 3.51s).
  - **Blockers:** None.

- **2026-11-10 — Product Color Swatch Picture & Img Dimensions Alignment (40 × 59 / 40 × 55)**:
  - **Status:** COMPLETE
  - **Summary:** Aligned the color swatch thumbnail dimensions in `src/features/catalog/components/ProductColorSelector.tsx` to the exact DevTools inspection screenshots (`media_1794319442698_44a166bd.png` and `media_1794319479651_04413861.png`):
    - Replaced the generic wrapper with `picture.ProductColorSelection__product-color-selection__image` styled with exact `width: 40px`, `height: 59px` (`40 × 59`).
    - Configured the inner `img` with exact `width: 40px`, `height: 55px` (`40 × 55`) with `object-cover object-top`.
    - Applied 4px bottom border indicator (`border-b-[4px] border-neutral-900` when active, `border-b-[4px] border-transparent` when inactive) matching the 4px bottom difference (`59px - 55px = 4px`) shown in the reference inspection.
    - Preserved container dimensions `352.93 × 128` with `gap-[17px]` and `padding: 16px 0px`.
    - In accordance with the user's standing instruction, no changes were pushed to GitHub.
  - **Files Modified:** `src/features/catalog/components/ProductColorSelector.tsx`.
  - **Structural change summary:** No architecture or directory-structure change in this task.
  - **Validation:** `npx astro check` (PASS: 74 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 26 static pages built in 2.74s).
  - **Blockers:** None.

- **2026-11-10 — Select Size Button Box Model & Typography Alignment (352.93 × 45.6 / 311.33 × 22)**:
  - **Status:** COMPLETE
  - **Summary:** Aligned the "SELECT SIZE" button in `src/features/catalog/components/ProductSizeSelector.tsx` to the exact DevTools inspection screenshots (`media_1794320886067_e4cd3d95.png` and `media_1794320899524_863ce7d6.png`):
    - Configured `button.Button__btn.ProductDetailDescription__product-detail-description__size-selection-button` with exact dimensions `352.93 × 45.6`, `padding: 13px 20px 9px`, and `backgroundColor: #FFFFFF` with rounded pill borders.
    - Wrapped inner button text in `span.Button__btn__content.btn__content` with exact content dimensions `311.33 × 22` (`352.93px - 40px - borders = 311.33px`), configured with `text-[14px] leading-[22px] font-semibold tracking-wider uppercase`.
    - Preserved project typography styles without introducing external font families.
    - In accordance with the user's standing instruction, no changes were pushed to GitHub.
  - **Files Modified:** `src/features/catalog/components/ProductSizeSelector.tsx`.
  - **Structural change summary:** No architecture or directory-structure change in this task.
  - **Validation:** `npx astro check` (PASS: 74 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 5.95s).
  - **Blockers:** None.

- **2026-11-10 — Removal of Hero Search Strip Form (620 × 48)**:
  - **Status:** COMPLETE
  - **Summary:** Removed the redundant floating search strip form (`form#hero-search-form.hero-search-box`, `620 × 48`) and its inline event scripts and styles from `src/features/home/components/HeroBanner.astro`, as inspected in user-provided DevTools screenshot `media_1794321322188_60ec5915.jpg`. Global search functionality remains cleanly and fully accessible via the primary search trigger icon in the site header (`SearchTrigger`). In accordance with the user's standing instruction, no changes were pushed to GitHub.
  - **Files Modified:** `src/features/home/components/HeroBanner.astro`.
  - **Structural change summary:** No architecture or directory-structure change in this task.
  - **Validation:** `npx astro check` (PASS: 74 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 26 static pages built in 3.00s).
  - **Blockers:** None.

- **2026-11-10 — Product Detail Page Redesign to Rinascimento Horizontal Gallery & Floating Card Layout**:
  - **Status:** COMPLETE
  - **Summary:** Redesigned the Product Detail Page (`/products/[slug]`) to match the referenced luxury layout (`media_1794322333276_fcb9bd3a.png`, `media_1794322333277_eae166fb.png`, `media_1794322333277_05cb2ac1.png`):
    - Replaced vertical split-screen with a full-width horizontal image gallery track (`505.66 × 674.21` per image), horizontal scroll/snap navigation, left/right desktop controls, and a top-right slideshow pause button (`||`).
    - Implemented the floating product info card (`div.product-info-wrapper.bg-body.p-2.p-xl-4`, `526 × 354.1`, `padding: 20px`, `background: #FFFFFF`, rounded corners and shadow) anchored on the bottom-right of the gallery on desktop and responsive on mobile.
    - Card features uppercase breadcrumbs (`HOME > CLOTHING > DRESSES AND OUTFITS > SHORT DRESSES > ...`), `SOLD OUT` status badge (or price/selection for in-stock items), uppercase title, boxed `MADE IN INDIA` badge with thin border per explicit user instruction (*'BUT "MADE IN INDIA"'*), SKU label, `Color [Name]` heading, 4 square color swatches, divider, `Share this product` action, and floating bottom-right concierge chat bubble.
    - Added the reference product `bordeaux-sheath-dress-with-asymmetrical-draping` ("Bordeaux sheath dress with asymmetrical draping", SKU `CFC0130327003B098`, 4 color swatches, cropped images `/images/bordeaux-dress-[back,detail,model,side].jpg`) to `src/features/catalog/data/products.ts`, `allProducts`, and the homepage carousel.
    - Updated `src/features/catalog/api/catalog.api.ts` to combine remote D1 backend products with local catalog products.
    - In accordance with the user's standing instruction, no changes were pushed to GitHub.
  - **Files Added:**
    - `public/images/bordeaux-dress-back.jpg`
    - `public/images/bordeaux-dress-detail.jpg`
    - `public/images/bordeaux-dress-model.jpg`
    - `public/images/bordeaux-dress-side.jpg`
  - **Files Modified:**
    - `src/features/catalog/components/ProductDetailExperience.tsx`
    - `src/features/catalog/data/products.ts`
    - `src/features/catalog/types/product.types.ts`
    - `src/features/catalog/api/catalog.api.ts`
  - **Structural change summary:** Added 4 image assets for the reference Bordeaux dress; updated catalog and PDP experience component.
  - **Validation:** `npx astro check` (PASS: 74 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 40 static pages built in 7.45s).
  - **Blockers:** None.

- **2026-11-10 — Floating Product Info Card Box Model & Dimensions Alignment (Exact DevTools Measurements)**:
  - **Status:** COMPLETE
  - **Summary:** Aligned all child elements of the floating product info card (`div.product-info-wrapper.bg-body.p-2.p-xl-4`, `526 × 354.1`, `padding: 20px`, `inner width: 486px`) in `src/features/catalog/components/ProductDetailExperience.tsx` to the exact DevTools inspection screenshots:
    - Title (`span`): Configured `text-[16px] leading-[23.2px]` with exact box dimensions `364.39 × 46.4` and `color: #000000`.
    - Origin Badge (`div.p-1`): Configured exact box dimensions `101.15 × 22.24`, `font-size: 11px`, `padding: 4px`, `margin: -3px 0px 0px -3px`, `border: 1px solid #000000`, containing uppercase text `MADE IN INDIA` per explicit user instructions.
    - SKU (`div.product-sku.mt-1`): Configured box dimensions `381.16 × 10.5`, `font-size: 10px`, `color: #000000`, `margin: 4px 0px 0px` (`mt-1`).
    - Color Label (`span`): Configured dimensions `110.59 × 19.2`, `font-size: 14px`, `line-height: 19.2px`, `color: #000000`.
    - Color Swatches Container (`div.color-group.mt-2`): Configured dimensions `486 × 45.8`, `font-size: 14px`, `margin: 10px 0px 0px`.
    - Swatch Thumbnails (`div.variant-color.d-inline-block`): Configured exact `40 × 40` squares with `margin-right: 17px` (last item `0px`).
    - Divider (`div.w100.border-bottom.mt-5.mb-5.bordermb-none`): Configured dimensions `486 × 0.8` with `margin: 24px 0px`.
    - Share Section (`div.product-info-wishlist.d-flex.flex-column`): Configured dimensions `486 × 56`, `padding: 16px 0px`, `font-size: 14px`, `color: #000000`.
    - In accordance with the user's standing instruction, no changes were pushed to GitHub.
  - **Files Modified:** `src/features/catalog/components/ProductDetailExperience.tsx`.
  - **Structural change summary:** No architecture or directory-structure change in this task.
  - **Validation:** `npx astro check` (PASS: 74 files, 0 errors, 0 warnings, 0 hints), `npm run build` (PASS: 40 static pages built in 4.38s).
  - **Blockers:** None.

- **2026-11-11 — Removal of Floating Contact Concierge Chat Bubble from Product Detail Page**:
  - **Status:** COMPLETE
  - **Summary:** Removed the floating concierge chat bubble link (`<div className="fixed bottom-6 right-6 z-40">`, `a[aria-label="Contact Concierge"]`, `48 × 48` `w-12 h-12 rounded-full bg-neutral-900`) from `src/features/catalog/components/ProductDetailExperience.tsx` as requested in user-provided DevTools screenshot `media_1794384343984_8b00b180.png`. Client concierge access remains available via `/contact`, `Header.astro`, and `AuthLayout.astro`. Also deduplicated accidental uncommitted trailing log duplication from 2026-11-10 and refreshed the repository structure snapshot.
  - **Files Modified:** `src/features/catalog/components/ProductDetailExperience.tsx`, `AGENTS.md`, `GEMINI.md`.
  - **Structural change summary:** No architecture or directory-structure change in this task.
  - **Validation:**
    - `Get-ChildItem -Path "src" -Recurse -File | Select-String -Pattern "Contact Concierge","Concierge Chat Bubble"`: PASS (0 matches remaining in `src/`).
    - `npx astro check`: PASS (74 files checked: 0 errors, 0 warnings, 0 hints).
    - `npm run build`: PASS (40 static pages built in 3.26s).
  - **Blockers:** None.

- **2026-11-11 — Removal of Editorial Description & Specifications Section from Product Detail Page**:
  - **Status:** COMPLETE
  - **Summary:** Removed the 3-column lower section (`Description & Craftsmanship`, `Size & Fit`, `Composition & Care`, `div.max-w-[1200px].mx-auto.px-6.py-14.border-t.border-neutral-200/80`) from `src/features/catalog/components/ProductDetailExperience.tsx` as requested in user-provided screenshot `media_1794384540827_91856a79.png`. Preserved the horizontal gallery, floating product info card, lightbox, fit finder, size guide, and sibling sections (`StyleItWith.astro`, `RelatedProducts.astro`).
  - **Files Modified:** `src/features/catalog/components/ProductDetailExperience.tsx`, `AGENTS.md`, `GEMINI.md`.
  - **Structural change summary:** No architecture or directory-structure change in this task
  - **Validation:**
    - `$matches = Get-ChildItem -Path "src" -Recurse -File | Select-String -Pattern "Description & Craftsmanship","Luxury Editorial Description"; if ($matches) { $matches; exit 1 } else { Write-Output "0 matches" }`: PASS (0 matches remaining in `src/`).
    - `npx astro check`: PASS (74 files checked: 0 errors, 0 warnings, 0 hints).
    - `npm run build`: PASS (40 static pages built in 9.23s).
  - **Blockers:** None.

**The agent is expected to extend this architecture deliberately, not drift away from it.**
