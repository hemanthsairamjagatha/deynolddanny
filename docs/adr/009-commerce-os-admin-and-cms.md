# ADR 009 — Deynold Danny Commerce Operating System & Storefront CMS

- **Status:** Accepted
- **Date:** 2026-11-16
- **Scope:** Dedicated `admin/` control centre, `backend/` Hono + D1 + KV + R2 Commerce OS APIs, and dynamic `src/` storefront runtime publishing.

## Context

The Deynold Danny luxury ecommerce storefront (`src/`) previously relied on static Astro/TypeScript config (`src/config/*`, `src/features/home/data/home-content.ts`, hardcoded `CATEGORIES` map in `src/pages/categories/[slug].astro`, hardcoded `STYLE_LAYERING_LOOKS`, hardcoded contact/legal/footer strings) and had no implemented administration workspace under `admin/`. Business operators needed code deployments to change brand assets, homepage sections, merchandising layouts, email templates, or promotional pages.

## Decisions

1. **Dedicated `admin/` Workspace App:**
   - Implemented under root `admin/` as a modular React 18 + Vite + TypeScript + Tailwind CSS application matching `Deynold Danny Backend/FINAL_FILE_STRUCTURE.md`.
   - Organized strictly into modules (`modules/{studio,brand,navigation,media,catalog,inventory,orders,customers,promotions,administration,analytics,auth,dashboard}`), reusable UI/media primitives, typed service wrappers, layouts, and RBAC permission gates (`permissions/rbac.ts`).
   - Communicates exclusively with the established `backend/` Hono Worker API (`/api/admin/*` and `/api/auth/*`) — no parallel backend or duplicate domain logic.
   - Excluded from storefront root `tsconfig.json` and Astro bundle so zero admin code ever ships in customer bundles.

2. **Server-Side RBAC, Multi-Admin Grants & Privileged TOTP MFA:**
   - Preserves zero-bypass fail-closed protection on `ADMIN_EMAILS` while introducing D1 `admin_roles`, `admin_permissions`, `role_permissions`, `admin_staff_grants`, and `admin_mfa_secrets`.
   - Super Admins may invite and assign DB roles with granular 40+ permissions checked per endpoint via `requirePermission(...)`. Arbitrary users whose `users.role` is modified directly without `ADMIN_EMAILS` or an active Super-Admin grant remain blocked (`403`).
   - TOTP Authenticator (RFC 6238 WebCrypto HMAC-SHA1) + SHA-256 recovery codes protect privileged access and sensitive operations when MFA is enabled or required by role policy.
   - Tokens in `admin/` follow the same memory-only access token + `HttpOnly` refresh cookie + `token_version` revocation contract as `src/`.

3. **Instant No-Rebuild Storefront Publishing + Private Draft Previews:**
   - Brand Identity, Navigation Menus, Global Settings, Announcements, Active Categories/Collections, Redirects, and Published CMS Pages/Sections are compiled into Cloudflare KV (`storefront:published:v1`) on publish and served via `GET /api/storefront/published`.
   - Public storefront pages (`src/`) render static SEO defaults as fallback and synchronize immediately with the published KV snapshot on boot without developer rebuilds.
   - Custom pages (`/pages/:slug`), dynamic collections (`/collections/:slug`), and new categories resolve dynamically via edge/Vite rewrites to `_view.astro` shells.
   - Drafts remain strictly private and require a signed short-lived HMAC preview token (`?dd_preview=...` -> `GET /api/cms/preview`, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`).

4. **Media Library & R2 / Local Blob Serving:**
   - Adds public `GET /media/*` asset serving in `backend/` supporting Cloudflare R2 (`MEDIA_BUCKET`) as primary binary storage with safe D1 `media_blobs` fallback when `MEDIA_BUCKET` is not bound in local/test runtimes, plus pre-indexed storefront imagery under `/images/*`, `/hero-banner.jpg`, and `/logo.png`.

## Consequences

- Storefront owners can edit brand identity, reorder/schedule homepage and landing page sections with desktop/mobile imagery and focal points, manage categories/collections/products/returns/disputes/coupons/reviews/templates/redirects/users, and inspect live audits directly from `admin/`.
- Future migration to full Astro Cloudflare Workers SSR (`@astrojs/cloudflare`) requires no schema or CMS contract changes because all content resolves through the same published KV/Hono layer.
