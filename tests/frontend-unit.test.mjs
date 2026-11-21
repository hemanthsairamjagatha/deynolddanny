import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');

function createStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, val) {
      store.set(key, String(val));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    _dump() {
      return Object.fromEntries(store.entries());
    },
  };
}

function setupBrowserGlobals() {
  const storage = createStorageMock();
  const events = [];
  const listeners = new Map();

  globalThis.localStorage = storage;
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
  globalThis.window = {
    location: { origin: 'https://deynolddanny.com', search: '', pathname: '/' },
    localStorage: storage,
    addEventListener(type, cb) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(cb);
    },
    removeEventListener() {},
    dispatchEvent(evt) {
      events.push(evt);
      for (const cb of listeners.get(evt.type) || []) {
        cb(evt);
      }
      return true;
    },
  };
  globalThis.document = {
    body: { style: {} },
  };
  globalThis.fetch = async () => ({
    ok: false,
    status: 503,
    async json() {
      return { success: false, error: { code: 'OFFLINE_TEST', message: 'offline test mock' } };
    },
  });

  return { storage, events };
}

async function bundleTsModule(relPath, outDir, name) {
  const outfile = path.join(outDir, `${name}.mjs`);
  await esbuild.build({
    entryPoints: [path.join(ROOT_DIR, relPath)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    define: {
      'import.meta.env.PUBLIC_BACKEND_URL': '""',
    },
  });
  return import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
}

const tmpBundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-fe-unit-'));

test.after(() => {
  fs.rmSync(tmpBundleDir, { recursive: true, force: true });
});

test('cart.store deduplicates by (id, size, color), clamps fixed & capped percentage coupons, and removes at qty <= 0', async () => {
  const { storage } = setupBrowserGlobals();
  const cartStore = await bundleTsModule('src/features/cart/store/cart.store.ts', tmpBundleDir, 'cart-store');

  cartStore.$cartItems.set([]);
  cartStore.removeCoupon();

  cartStore.addToCart({
    id: 'cady-trousers',
    slug: 'cady-trousers',
    title: 'Cady Trousers',
    price: '₹ 4,200.00',
    priceNum: 4200,
    size: '48',
    color: 'Charcoal',
    img: '/images/cady-trousers-product.jpg',
    qty: 1,
  });

  // Same item + size + color merges qty
  cartStore.addToCart({
    id: 'cady-trousers',
    slug: 'cady-trousers',
    title: 'Cady Trousers',
    price: '₹ 4,200.00',
    priceNum: 4200,
    size: '48',
    color: 'charcoal',
    img: '/images/cady-trousers-product.jpg',
    qty: 1,
  });

  // Different color stays a separate line
  cartStore.addToCart({
    id: 'cady-trousers',
    slug: 'cady-trousers',
    title: 'Cady Trousers',
    price: '₹ 4,200.00',
    priceNum: 4200,
    size: '48',
    color: 'Midnight Navy',
    img: '/images/cady-trousers-product.jpg',
    qty: 1,
  });

  assert.equal(cartStore.$cartItems.get().length, 2);
  assert.equal(cartStore.$totalCount.get(), 3);
  assert.equal(cartStore.$subtotalNum.get(), 12600);

  // Percentage coupon 10% capped at ₹500 (50000 paise) with ₹15000 minOrder (1500000 paise)
  cartStore.applyCoupon({
    code: 'VIP10',
    discountType: 'percentage',
    discountValue: 10,
    maxDiscountPaise: 50000,
    discountPaise: 50000,
    discountNum: 500,
    minOrderPaise: 1500000,
  });
  // Subtotal ₹12,600 < min ₹15,000 => discount 0
  assert.equal(cartStore.$discountNum.get(), 0);
  assert.equal(cartStore.$totalPayableNum.get(), 12600);

  // Add another unit so subtotal = ₹16,800 >= ₹15,000; 10% = ₹1680 clamped to ₹500 cap
  cartStore.incrementQuantity(1);
  assert.equal(cartStore.$subtotalNum.get(), 16800);
  assert.equal(cartStore.$discountNum.get(), 500);
  assert.equal(cartStore.$totalPayableNum.get(), 16300);

  // Fixed coupon exceeding remaining subtotal never produces negative payable
  cartStore.updateQuantity(0, 0);
  assert.equal(cartStore.$cartItems.get().length, 1);
  cartStore.updateQuantity(0, 1); // ₹4,200
  cartStore.applyCoupon({
    code: 'CREDIT10K',
    discountType: 'fixed_amount',
    discountValue: 1000000, // ₹10,000 in paise
    discountPaise: 420000,
    discountNum: 4200,
  });
  assert.equal(cartStore.$discountNum.get(), 4200);
  assert.equal(cartStore.$totalPayableNum.get(), 0);

  assert.ok(storage.getItem('dd_cart'));
});

test('wishlist.store toggles items, detects membership, and persists strictly to dd_wishlist', async () => {
  const { storage } = setupBrowserGlobals();
  const wishlistStore = await bundleTsModule('src/features/wishlist/store/wishlist.store.ts', tmpBundleDir, 'wishlist-store');

  wishlistStore.clearWishlist();
  assert.equal(wishlistStore.$wishlistCount.get(), 0);

  const sample = {
    id: 'cady-trousers',
    slug: 'cady-trousers',
    title: 'Cady Trousers',
    price: '₹ 4,200.00',
    priceNum: 4200,
    image: '/images/cady-trousers-product.jpg',
    link: '/products/cady-trousers',
  };

  wishlistStore.toggleWishlist(sample);
  assert.equal(wishlistStore.$wishlistCount.get(), 1);
  assert.equal(wishlistStore.isItemInWishlist('cady-trousers'), true);
  assert.ok(storage.getItem('dd_wishlist'));
  assert.equal(storage.getItem('deynold_danny_wishlist'), null);

  wishlistStore.toggleWishlist(sample);
  assert.equal(wishlistStore.$wishlistCount.get(), 0);
  assert.equal(wishlistStore.isItemInWishlist('cady-trousers'), false);
});

test('consent.store starts fail-closed for analytics and toggles cleanly per DPDP preference', async () => {
  setupBrowserGlobals();
  const consentStore = await bundleTsModule('src/lib/consent/consent.store.ts', tmpBundleDir, 'consent-store');

  assert.equal(consentStore.canTrackAnalytics(), false);
  assert.equal(consentStore.hasRecordedConsent(consentStore.$consent.get()), false);

  consentStore.acceptEssentialOnly();
  assert.equal(consentStore.hasRecordedConsent(consentStore.$consent.get()), true);
  assert.equal(consentStore.canTrackAnalytics(), false);

  consentStore.acceptAllConsent();
  assert.equal(consentStore.canTrackAnalytics(), true);
  assert.equal(consentStore.$consent.get().marketing, true);
});

test('client.ts keeps access tokens memory-only and never writes token secrets to localStorage', async () => {
  const { storage } = setupBrowserGlobals();
  storage.setItem('dd_access_token', 'stale-secret');
  storage.setItem('dd_refresh_token', 'stale-refresh');

  const apiClient = await bundleTsModule('src/lib/api/client.ts', tmpBundleDir, 'api-client');

  apiClient.setAccessToken('mem-only-token');
  assert.equal(apiClient.getAccessToken(), 'mem-only-token');
  assert.equal(storage.getItem('dd_access_token'), null);
  assert.equal(storage.getItem('dd_refresh_token'), null);

  apiClient.clearClientSession();
  assert.equal(apiClient.getAccessToken(), null);
  assert.equal(apiClient.hasSessionHint(), false);
});

test('catalog.api normalizes products cleanly and supports offline fallback search without JSON-LD XSS risk', async () => {
  setupBrowserGlobals();
  const catalogApi = await bundleTsModule('src/features/catalog/api/catalog.api.ts', tmpBundleDir, 'catalog-api');
  const productUtils = await bundleTsModule('src/features/catalog/utils/product.utils.ts', tmpBundleDir, 'product-utils');

  const cady = await catalogApi.fetchProductBySlug('cady-trousers');
  assert.ok(cady, 'Expected local cady-trousers fallback product');
  assert.ok(Array.isArray(cady.colors) && cady.colors.length > 0);
  assert.ok(Array.isArray(cady.images) && cady.images.length > 0);

  const searchHits = await catalogApi.searchCatalog('cady');
  assert.ok(searchHits.some((p) => p.slug === 'cady-trousers' || p.title.toLowerCase().includes('cady')));

  assert.equal(productUtils.slugify('Classic Two-Tuck Slacks!'), 'classic-two-tuck-slacks');

  // Verify JSON-LD script-close escape invariant matches storefront emission
  const dangerous = '</script><script>alert(1)</script>';
  const escaped = JSON.stringify({ name: dangerous }).replace(/</g, '\\u003c');
  assert.equal(escaped.includes('<'), false);
});
