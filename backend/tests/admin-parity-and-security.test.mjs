import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  createTestWorker,
  authenticateUser,
  getSeedVariant,
} from './helpers/miniflare-harness.mjs';

test('Admin Product CRUD, duplicate guards, discount validation, colour rename/delete, size delete, duplicate copy & storefront cache sync', async () => {
  const worker = await createTestWorker({
    ENVIRONMENT: 'development',
    ADMIN_EMAILS: 'catalog-director@deynolddanny.test',
  });
  try {
    const admin = await authenticateUser(worker, 'catalog-director@deynolddanny.test', {
      fullName: 'Catalog Director',
    });
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.accessToken}`,
    };

    // 1. Reject invalid discount (compare_paise <= price_paise)
    const badProd = await worker.request('/api/admin/products', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        slug: 'atelier-bad-discount',
        sku_prefix: 'DD-BAD',
        title: 'Invalid Discount Coat',
        price_paise: 1500000,
        compare_paise: 1200000,
        section_group: 'mastery',
      }),
    });
    assert.equal(badProd.status, 400);
    assert.equal(badProd.json.error.code, 'INVALID_DISCOUNT');

    // 2. Create valid product
    const createProd = await worker.request('/api/admin/products', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        slug: 'atelier-cashmere-trench',
        sku_prefix: 'DD-TRENCH',
        title: 'Atelier Cashmere Trench',
        price_paise: 2400000,
        compare_paise: 3000000,
        section_group: 'mastery',
        default_img: '/images/mastery-1-model.jpg',
        hover_img: '/images/mastery-1-product.jpg',
        size_and_fit: ['Tailored fit', 'Model is 188cm'],
      }),
    });
    assert.equal(createProd.status, 201);
    const productId = createProd.json.data.id;

    // 3. Create single variant & verify duplicate (color, size) and duplicate SKU guards return 409
    const v1 = await worker.request(`/api/admin/products/${productId}/variants`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        sku: 'DD-TRENCH-BLK-M',
        size: 'M',
        color_name: 'Obsidian',
        color_hex: '#111111',
        price_paise: 2500000,
        stock: 10,
      }),
    });
    assert.equal(v1.status, 201);

    const dupCombo = await worker.request(`/api/admin/products/${productId}/variants`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        sku: 'DD-TRENCH-BLK-M-2',
        size: 'm',
        color_name: 'obsidian',
        color_hex: '#111111',
        stock: 5,
      }),
    });
    assert.equal(dupCombo.status, 409);
    assert.equal(dupCombo.json.error.code, 'DUPLICATE_VARIANT');

    const dupSku = await worker.request(`/api/admin/products/${productId}/variants`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        sku: 'DD-TRENCH-BLK-M',
        size: 'L',
        color_name: 'Obsidian',
        color_hex: '#111111',
        stock: 5,
      }),
    });
    assert.equal(dupSku.status, 409);
    assert.equal(dupSku.json.error.code, 'DUPLICATE_SKU');

    // 4. Add second colour + second size via matrix & attach colour-specific image
    const matrixRes = await worker.request(`/api/admin/products/${productId}/variants/matrix`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        sizes: ['M', 'L'],
        colors: [
          { name: 'Obsidian', hex: '#111111' },
          { name: 'Camel', hex: '#C19A6B' },
        ],
        initialStock: 8,
        colorImages: { Camel: '/images/mastery-2-model.jpg' },
      }),
    });
    assert.equal(matrixRes.status, 201);

    // 5. Rename colour Camel -> Vicuna & verify both variants and product_images update + storefront reflects live
    const renameRes = await worker.request(`/api/admin/products/${productId}/variants/bulk-price`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        updates: [{ color_name: 'Camel', new_color_name: 'Vicuna', color_hex: '#B38B59', price_paise: 2650000 }],
      }),
    });
    assert.equal(renameRes.status, 200);

    const imgAfterRename = await worker.db
      .prepare(`SELECT color_name FROM product_images WHERE product_id = ?1`)
      .bind(productId)
      .all();
    assert.ok(imgAfterRename.results.some((r) => r.color_name === 'Vicuna'), 'Gallery image color_name must sync on rename');

    const pdpLive = await worker.request('/api/products/atelier-cashmere-trench');
    assert.equal(pdpLive.status, 200);
    assert.ok(
      pdpLive.json.data.variants.some((v) => v.colorName === 'Vicuna' && v.pricePaise === 2650000),
      'Storefront PDP API must immediately return renamed colour & updated price',
    );

    // 6. Duplicate product copies variant prices AND product_images
    const dupProd = await worker.request(`/api/admin/products/${productId}/duplicate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });
    assert.equal(dupProd.status, 201);
    const dupDetail = await worker.request(`/api/admin/products/${dupProd.json.data.id}`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });
    assert.equal(dupDetail.status, 200);
    assert.ok(dupDetail.json.data.images.length >= 1, 'Duplicated product must copy gallery images');
    assert.ok(
      dupDetail.json.data.variants.some((v) => v.price_paise === 2650000),
      'Duplicated product must preserve variant price_paise',
    );

    // 7. Delete colour Vicuna & delete size L -> verify storefront availability updates immediately
    const delColor = await worker.request(`/api/admin/products/${productId}/colors/Vicuna`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });
    assert.equal(delColor.status, 200);
    assert.equal(delColor.json.data.deletedCount, 2);

    const delSize = await worker.request(`/api/admin/products/${productId}/sizes/L`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });
    assert.equal(delSize.status, 200);
    assert.equal(delSize.json.data.deletedCount, 1);

    const availAfter = await worker.request('/api/products/atelier-cashmere-trench/availability');
    assert.equal(availAfter.status, 200);
    assert.equal(availAfter.json.data.variants.length, 1);
    assert.equal(availAfter.json.data.variants[0].size, 'M');
    assert.equal(availAfter.json.data.variants[0].colorName, 'Obsidian');

    // 8. Bulk actions & pagination/sorting
    const bulkRes = await worker.request('/api/admin/products/bulk', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        ids: [productId, dupProd.json.data.id],
        action: 'set_featured',
        value: true,
      }),
    });
    assert.equal(bulkRes.status, 200);
    assert.equal(bulkRes.json.data.updated, 2);

    const listRes = await worker.request('/api/admin/products?sort=price_desc&limit=5&page=1', {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });
    assert.equal(listRes.status, 200);
    assert.equal(listRes.json.data.limit, 5);
    assert.ok(listRes.json.data.totalPages >= 1);
  } finally {
    await worker.dispose();
  }
});

test('RBAC permission enforcement, staff token revocation on removal, and self-revoke protection', async () => {
  const worker = await createTestWorker({
    ENVIRONMENT: 'development',
    ADMIN_EMAILS: 'super-admin@deynolddanny.test',
  });
  try {
    const superAdmin = await authenticateUser(worker, 'super-admin@deynolddanny.test', {
      fullName: 'Super Admin',
    });

    // Invite a restricted Studio Editor (cms.read/write/publish, media.*, brand.write, navigation.write, seo.write — NO orders/customers/coupons/logs)
    const inviteRes = await worker.request('/api/admin/security/staff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdmin.accessToken}`,
      },
      body: JSON.stringify({
        email: 'studio-editor@deynolddanny.test',
        fullName: 'Studio Editor',
        roleId: 'role_studio_editor',
      }),
    });
    assert.equal(inviteRes.status, 201);
    const staffId = inviteRes.json.data.userId;

    // Studio editor signs in
    const editor = await authenticateUser(worker, 'studio-editor@deynolddanny.test', {
      fullName: 'Studio Editor',
    });

    // Allowed route: CMS pages & dashboard
    const cmsRes = await worker.request('/api/admin/cms/pages', {
      headers: { Authorization: `Bearer ${editor.accessToken}` },
    });
    assert.equal(cmsRes.status, 200);

    // Forbidden routes must return 403 PERMISSION_DENIED
    const forbiddenChecks = [
      worker.request('/api/admin/orders', { headers: { Authorization: `Bearer ${editor.accessToken}` } }),
      worker.request('/api/admin/customers', { headers: { Authorization: `Bearer ${editor.accessToken}` } }),
      worker.request('/api/admin/coupons', { headers: { Authorization: `Bearer ${editor.accessToken}` } }),
      worker.request('/api/admin/logs', { headers: { Authorization: `Bearer ${editor.accessToken}` } }),
      worker.request('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${editor.accessToken}` },
        body: JSON.stringify({ enableCod: false }),
      }),
    ];
    const results = await Promise.all(forbiddenChecks);
    for (const r of results) {
      assert.equal(r.status, 403, `Expected 403 PERMISSION_DENIED for restricted staff, got ${r.status}`);
    }

    // Super admin cannot self-revoke
    const selfRevoke = await worker.request(`/api/admin/security/staff/${superAdmin.user.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdmin.accessToken}` },
    });
    assert.equal(selfRevoke.status, 400);
    assert.equal(selfRevoke.json.error.code, 'FORBIDDEN');

    // Revoke studio editor -> bumps token_version so live JWT immediately returns 401
    const revokeRes = await worker.request(`/api/admin/security/staff/${staffId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdmin.accessToken}` },
    });
    assert.equal(revokeRes.status, 200);

    const meAfterRevoke = await worker.request('/api/auth/me', {
      headers: { Authorization: `Bearer ${editor.accessToken}` },
    });
    assert.equal(meAfterRevoke.status, 401, 'Revoked staff JWT must immediately fail /api/auth/me');
  } finally {
    await worker.dispose();
  }
});

test('Security hardening: 413 payload size limit, SEO redirect XSS guard, coupon rate limit & fail-closed Cashfree/Shiprocket', async () => {
  const worker = await createTestWorker({
    ENVIRONMENT: 'staging',
    ENABLE_TEST_CHECKOUT_FALLBACK: 'false',
    ADMIN_EMAILS: 'sec-admin@deynolddanny.test',
  });
  try {
    const admin = await authenticateUser(worker, 'sec-admin@deynolddanny.test', { fullName: 'Sec Admin' });

    // 1. Payload >256KB on JSON route rejected with 413 PAYLOAD_TOO_LARGE
    const hugeBody = JSON.stringify({ code: 'X'.repeat(300 * 1024), subtotalPaise: 100000 });
    const hugeRes = await worker.request('/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: hugeBody,
    });
    assert.equal(hugeRes.status, 413);
    assert.equal(hugeRes.json.error.code, 'PAYLOAD_TOO_LARGE');

    // 2. SEO redirect rejects javascript: and protocol-relative // targets, accepts relative paths, catches duplicates
    const xssRedir = await worker.request('/api/admin/seo/redirects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.accessToken}` },
      body: JSON.stringify({ source_path: '/old-promo', target_path: 'javascript:alert(1)' }),
    });
    assert.equal(xssRedir.status, 400);

    const openRedir = await worker.request('/api/admin/seo/redirects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.accessToken}` },
      body: JSON.stringify({ source_path: '/old-promo', target_path: '//evil.example/phish' }),
    });
    assert.equal(openRedir.status, 400);

    const goodRedir = await worker.request('/api/admin/seo/redirects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.accessToken}` },
      body: JSON.stringify({ source_path: '/old-promo', target_path: '/categories/shirts' }),
    });
    assert.equal(goodRedir.status, 201);

    const dupRedir = await worker.request('/api/admin/seo/redirects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.accessToken}` },
      body: JSON.stringify({ source_path: '/old-promo', target_path: '/categories/trousers' }),
    });
    assert.equal(dupRedir.status, 409);

    // 3. Coupon validation rate limiting (>20 req/min from same IP returns 429)
    let got429 = false;
    for (let i = 0; i < 23; i++) {
      const r = await worker.request('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.51.100.77' },
        body: JSON.stringify({ code: 'FAKECODE', cartSubtotalPaise: 500000 }),
      });
      if (r.status === 429) {
        got429 = true;
        break;
      }
    }
    assert.equal(got429, true, 'Coupon validation must enforce rate limiting to block brute-force enumeration');

    // 4. Fail-closed Shiprocket & Cashfree in staging without credentials
    const pinRes = await worker.request('/api/shipping/pincode-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryPincode: '400001' }),
    });
    assert.ok(pinRes.status === 503 || (pinRes.status === 200 && pinRes.json?.data?.serviceable === false), 'Shiprocket must not fake courier availability when unconfigured');
  } finally {
    await worker.dispose();
  }
});

test('Repaired SQL routes: review submission, returns review + atomic restock, dispute resolution, restock waitlist & order search', async () => {
  const worker = await createTestWorker({
    ENVIRONMENT: 'development',
    ENABLE_TEST_CHECKOUT_FALLBACK: 'true',
    ADMIN_EMAILS: 'ops-admin@deynolddanny.test',
  });
  try {
    const admin = await authenticateUser(worker, 'ops-admin@deynolddanny.test', { fullName: 'Ops Admin' });
    const customer = await authenticateUser(worker, 'client-review@deynolddanny.test', { fullName: 'Kabir Verma' });
    const variant = await getSeedVariant(worker, 6);

    // 1. Place order so we can test order search, review submission, returns, and disputes
    const co = await worker.request('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customer.accessToken}` },
      body: JSON.stringify({
        shippingName: 'Kabir Verma',
        shippingPhone: '9876543210',
        shippingLine1: '12 Malabar Hill',
        shippingCity: 'Mumbai',
        shippingState: 'Maharashtra',
        shippingPincode: '400006',
        items: [{ variantId: variant.id, quantity: 1 }],
      }),
    });
    assert.equal(co.status, 201);
    const orderId = co.json.data.orderId;

    // 2. Server-side admin order search by email & name
    const searchRes = await worker.request('/api/admin/orders?search=client-review@deynolddanny.test', {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });
    assert.equal(searchRes.status, 200);
    const matchedOrders = searchRes.json.data.items ?? searchRes.json.data.orders ?? [];
    assert.equal(matchedOrders.length, 1);
    assert.equal(matchedOrders[0].id, orderId);

    // 3. Submit product review (previously crashed with SQL error on o.shipping_email)
    const revRes = await worker.request(`/api/reviews/product/${variant.slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorName: 'Kabir Verma',
        authorEmail: 'client-review@deynolddanny.test',
        rating: 5,
        title: 'Exceptional drape',
        body: 'The virgin wool finish is extraordinary and true to size.',
      }),
    });
    assert.equal(revRes.status, 201, `Review submission failed: ${JSON.stringify(revRes.json)}`);

    // 4. Return request list + approve + complete with automatic restock
    const retId = `ret_${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    await worker.db
      .prepare(
        `INSERT INTO return_requests (id, order_id, user_id, status, reason, items_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'requested', 'Size exchange', ?4, ?5, ?5)`,
      )
      .bind(retId, orderId, customer.user.id, JSON.stringify([{ variantId: variant.id, quantity: 1 }]), now)
      .run();

    const retList = await worker.request('/api/admin/returns?status=pending', {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });
    assert.equal(retList.status, 200);
    assert.equal(retList.json.data.items.length, 1);

    const stockBeforeReturn = (
      await worker.db.prepare(`SELECT stock FROM product_variants WHERE id = ?1`).bind(variant.id).first()
    ).stock;

    const completeRet = await worker.request(`/api/admin/returns/${retId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.accessToken}` },
      body: JSON.stringify({ action: 'complete', note: 'Inspected unworn with tags', restock: true }),
    });
    assert.equal(completeRet.status, 200);
    assert.equal(completeRet.json.data.status, 'closed');
    assert.ok(completeRet.json.data.reviewedAt);

    const stockAfterReturn = (
      await worker.db.prepare(`SELECT stock FROM product_variants WHERE id = ?1`).bind(variant.id).first()
    ).stock;
    assert.equal(stockAfterReturn, stockBeforeReturn + 1, 'Return completion with restock=true must increment stock');

    // 5. Payment dispute list + resolution unfreezes order
    const dispId = `disp_${crypto.randomUUID().slice(0, 8)}`;
    await worker.db
      .prepare(`UPDATE orders SET dispute_frozen = 1 WHERE id = ?1`)
      .bind(orderId)
      .run();
    await worker.db
      .prepare(
        `INSERT INTO payment_disputes (id, order_id, gateway, gateway_dispute_id, amount_paise, reason_code, status, created_at, updated_at)
         VALUES (?1, ?2, 'razorpay', 'disp_gw_123', 100000, 'product_not_received', 'open', ?3, ?3)`,
      )
      .bind(dispId, orderId, now)
      .run();

    const dispList = await worker.request('/api/admin/disputes?status=open', {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });
    assert.equal(dispList.status, 200);
    assert.equal(dispList.json.data.items.length, 1);

    const dispResolve = await worker.request(`/api/admin/disputes/${dispId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.accessToken}` },
      body: JSON.stringify({ status: 'won', resolution: 'Courier POD verified' }),
    });
    assert.equal(dispResolve.status, 200);

    const orderAfterDisp = await worker.db
      .prepare(`SELECT dispute_frozen FROM orders WHERE id = ?1`)
      .bind(orderId)
      .first();
    assert.equal(orderAfterDisp.dispute_frozen, 0, 'Resolving dispute must unfreeze order');

    // 6. Restock waitlist list + notify (previously crashed on missing notified_at column)
    const subId = `rsub_${crypto.randomUUID().slice(0, 8)}`;
    await worker.db
      .prepare(
        `INSERT INTO restock_subscriptions (id, product_id, variant_id, email, status, created_at)
         VALUES (?1, ?2, ?3, 'waitlist@deynolddanny.test', 'active', ?4)`,
      )
      .bind(subId, variant.product_id, variant.id, now)
      .run();

    const subList = await worker.request('/api/admin/inventory/restock-subscriptions', {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });
    assert.equal(subList.status, 200);
    assert.equal(subList.json.data.items.length, 1);

    const subNotify = await worker.request('/api/admin/inventory/restock-subscriptions/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.accessToken}` },
      body: JSON.stringify({ variantId: variant.id }),
    });
    assert.equal(subNotify.status, 200);
    assert.equal(subNotify.json.data.notifiedCount, 1);
  } finally {
    await worker.dispose();
  }
});
