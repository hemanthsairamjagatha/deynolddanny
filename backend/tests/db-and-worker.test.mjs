import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  createTestWorker,
  authenticateUser,
  getSeedVariant,
} from './helpers/miniflare-harness.mjs';

test('D1 migrations (0001..0005), FK integrity, FTS5 update/delete triggers & stock CHECK triggers', async () => {
  const worker = await createTestWorker();
  try {
    // 1. Foreign key integrity check must be empty across all seeded rows
    const fkResult = await worker.db.prepare('PRAGMA foreign_key_check').all();
    assert.equal(fkResult.results.length, 0, 'Expected zero foreign key violations');

    // 2. Verify FTS5 triggers on UPDATE & DELETE do not throw SQLite external-content errors
    const prod = await worker.db
      .prepare('SELECT id, title, slug FROM products WHERE is_active = 1 LIMIT 1')
      .first();
    assert.ok(prod, 'Seeded product must exist');

    await worker.db
      .prepare('UPDATE products SET title = ?1 WHERE id = ?2')
      .bind('Updated Cashmere Heritage Blazer', prod.id)
      .run();

    const ftsMatch = await worker.db
      .prepare(`SELECT rowid FROM products_fts WHERE products_fts MATCH 'Heritage'`)
      .all();
    assert.ok(ftsMatch.results.length >= 1, 'Updated title must be searchable in FTS5');

    // Delete a synthetic disposable product to validate FTS5 delete trigger
    const tempProdId = `prod_tmp_${Date.now()}`;
    await worker.db
      .prepare(
        `INSERT INTO products (id, slug, sku_prefix, title, price_paise, section_group, default_img, hover_img, is_active, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'Disposable Garment', 100000, 'mastery', '/images/placeholder.jpg', '/images/placeholder-hover.jpg', 1, datetime('now'), datetime('now'))`,
      )
      .bind(tempProdId, tempProdId, `SKU-${Date.now()}`)
      .run();
    await worker.db.prepare('DELETE FROM products WHERE id = ?1').bind(tempProdId).run();

    // 3. Stock triggers reject negative stock, negative reserved_stock, and reserved_stock > stock
    const variant = await getSeedVariant(worker, 4);

    await assert.rejects(
      () => worker.db.prepare('UPDATE product_variants SET reserved_stock = 5 WHERE id = ?1').bind(variant.id).run(),
      /STOCK_INVARIANT_VIOLATION|CHECK constraint/i,
    );
    await assert.rejects(
      () => worker.db.prepare('UPDATE product_variants SET stock = -1 WHERE id = ?1').bind(variant.id).run(),
      /STOCK_INVARIANT_VIOLATION|CHECK constraint/i,
    );
    await assert.rejects(
      () => worker.db.prepare('UPDATE product_variants SET reserved_stock = -1 WHERE id = ?1').bind(variant.id).run(),
      /STOCK_INVARIANT_VIOLATION|CHECK constraint/i,
    );

    const freshVar = await worker.db
      .prepare('SELECT stock, reserved_stock FROM product_variants WHERE id = ?1')
      .bind(variant.id)
      .first();
    assert.equal(freshVar.stock, 4);
    assert.equal(freshVar.reserved_stock, 0);
  } finally {
    await worker.dispose();
  }
});

test('Auth security: OTP revocation, HttpOnly refresh cookie only, reuse family revocation & token_version check', async () => {
  const worker = await createTestWorker();
  try {
    // Send OTP revokes prior pending OTPs for same email
    const email = 'patron@deynolddanny.test';
    const send1 = await worker.request('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    assert.equal(send1.status, 200);

    const send2 = await worker.request('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    assert.equal(send2.status, 200);

    const activeOtps = await worker.db
      .prepare('SELECT COUNT(*) AS cnt FROM otps WHERE email = ?1 AND consumed = 0')
      .bind(email)
      .first();
    assert.equal(activeOtps.cnt, 1, 'Only the latest OTP may remain active after resend');

    // Wrong OTP must fail
    const badVerify = await worker.request('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp: '000000' }),
    });
    assert.equal(badVerify.status, 400);

    // Real auth must NOT leak refreshToken in JSON body; only via HttpOnly cookie
    const auth = await authenticateUser(worker, email);
    assert.ok(auth.accessToken);
    assert.ok(auth.refreshCookie.startsWith('dd_refresh='), 'Refresh cookie must be set');

    // First refresh succeeds and rotates cookie
    const r1 = await worker.request('/api/auth/refresh', {
      method: 'POST',
      headers: { Cookie: auth.refreshCookie },
    });
    assert.equal(r1.status, 200);
    assert.equal(r1.json.data.refreshToken, undefined, 'Refresh token must never be in JSON response');
    const rotatedSetCookie = r1.headers.get('set-cookie') || '';
    const match = rotatedSetCookie.match(/dd_refresh=([^;]+)/);
    assert.ok(match, 'Rotated refresh cookie must be issued');
    const rotatedCookie = `dd_refresh=${match[1]}`;

    // Replaying already-used refresh token triggers TOKEN_REUSE_DETECTED and invalidates rotated cookie too
    const replay = await worker.request('/api/auth/refresh', {
      method: 'POST',
      headers: { Cookie: auth.refreshCookie },
    });
    assert.equal(replay.status, 401);
    assert.equal(replay.json?.error?.code, 'TOKEN_REUSE_DETECTED');

    const followUp = await worker.request('/api/auth/refresh', {
      method: 'POST',
      headers: { Cookie: rotatedCookie },
    });
    assert.equal(followUp.status, 401, 'Entire token family must be revoked after replay detection');

    // Token version increment immediately revokes access token on /api/auth/me
    const freshAuth = await authenticateUser(worker, 'revoked@deynolddanny.test');
    const meBefore = await worker.request('/api/auth/me', {
      headers: { Authorization: `Bearer ${freshAuth.accessToken}` },
    });
    assert.equal(meBefore.status, 200);

    await worker.db
      .prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?1')
      .bind(freshAuth.user.id)
      .run();

    const meAfter = await worker.request('/api/auth/me', {
      headers: { Authorization: `Bearer ${freshAuth.accessToken}` },
    });
    assert.equal(meAfter.status, 401, 'Incremented token_version must invalidate live JWTs');
  } finally {
    await worker.dispose();
  }
});

test('Strict CORS, storefront config, and PII-protected guest order tracking', async () => {
  const worker = await createTestWorker();
  try {
    // Reject unauthorized *.pages.dev origin
    const evilCors = await worker.request('/api/config/storefront', {
      headers: { Origin: 'https://phishing-preview.pages.dev' },
    });
    assert.equal(evilCors.headers.get('access-control-allow-origin'), null);

    // Allow exact configured origin
    const goodCors = await worker.request('/api/config/storefront', {
      headers: { Origin: 'https://deynolddanny.com' },
    });
    assert.equal(goodCors.status, 200);
    assert.equal(goodCors.headers.get('access-control-allow-origin'), 'https://deynolddanny.com');
    assert.equal(goodCors.json.data.courierCheckEnabled, false);

    // Short tracking prefix must be rejected
    const shortTrack = await worker.request('/api/orders/track/DD2026');
    assert.equal(shortTrack.status, 400);

    // Unverified tracking (no email or phone query param) must be rejected
    const unverifiedTrack = await worker.request('/api/orders/track/DD-20261115-NONEXISTENT');
    assert.equal(unverifiedTrack.status, 400);
  } finally {
    await worker.dispose();
  }
});

test('20-way concurrent checkout race prevents overselling & Idempotency-Key deduplicates retries', async () => {
  const worker = await createTestWorker({
    ENVIRONMENT: 'development',
    ENABLE_TEST_CHECKOUT_FALLBACK: 'true',
  });
  try {
    const variant = await getSeedVariant(worker, 3);

    // Pre-provision 20 distinct authenticated customers with unique IPs so rate limiter doesn't conflate racers
    const sessions = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        authenticateUser(worker, `racer${i}@deynolddanny.test`, {
          fullName: `Racer ${i}`,
          ip: `203.0.113.${10 + i}`,
        }),
      ),
    );

    const makeCheckoutBody = (i) =>
      JSON.stringify({
        shippingName: `Racer ${i}`,
        shippingPhone: '9876543210',
        shippingLine1: `${10 + i} Savile Courtyard`,
        shippingCity: 'Mumbai',
        shippingState: 'Maharashtra',
        shippingPincode: '400001',
        items: [{ variantId: variant.id, quantity: 1 }],
      });

    const responses = await Promise.all(
      sessions.map((s, i) =>
        worker.request('/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${s.accessToken}`,
            'CF-Connecting-IP': `203.0.113.${10 + i}`,
          },
          body: makeCheckoutBody(i),
        }),
      ),
    );

    const successes = responses.filter((r) => r.status === 200 || r.status === 201);
    const conflicts = responses.filter((r) => r.status === 409);

    assert.equal(successes.length, 3, `Expected exactly 3 successful holds for 3 units, got ${successes.length}`);
    assert.equal(conflicts.length, 17, `Expected 17 409 conflicts, got ${conflicts.length}`);

    const postRaceVariant = await worker.db
      .prepare('SELECT stock, reserved_stock FROM product_variants WHERE id = ?1')
      .bind(variant.id)
      .first();
    assert.equal(postRaceVariant.stock, 3);
    assert.equal(postRaceVariant.reserved_stock, 3);

    // Now test Idempotency-Key deduplication on a fresh variant with stock = 2
    const allVars = await worker.db
      .prepare('SELECT id FROM product_variants WHERE id != ?1 AND is_active = 1 LIMIT 1')
      .bind(variant.id)
      .first();
    await worker.db
      .prepare('UPDATE product_variants SET stock = 2, reserved_stock = 0 WHERE id = ?1')
      .bind(allVars.id)
      .run();

    const idemUser = await authenticateUser(worker, 'idempotent@deynolddanny.test');
    const idemKey = `idem_${crypto.randomUUID()}`;
    const idemHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idemUser.accessToken}`,
      'Idempotency-Key': idemKey,
    };
    const idemBody = JSON.stringify({
      shippingName: 'Idem Patron',
      shippingPhone: '9876543210',
      shippingLine1: '10 Marine Drive',
      shippingCity: 'Mumbai',
      shippingState: 'Maharashtra',
      shippingPincode: '400020',
      items: [{ variantId: allVars.id, quantity: 1 }],
    });

    const firstTry = await worker.request('/api/checkout', { method: 'POST', headers: idemHeaders, body: idemBody });
    const secondTry = await worker.request('/api/checkout', { method: 'POST', headers: idemHeaders, body: idemBody });
    assert.equal(firstTry.status, 201);
    assert.equal(secondTry.status, 200);
    assert.equal(
      firstTry.json.data.orderId,
      secondTry.json.data.orderId,
      'Idempotent retry must return the exact same orderId without double reservation',
    );

    const idemVariant = await worker.db
      .prepare('SELECT reserved_stock FROM product_variants WHERE id = ?1')
      .bind(allVars.id)
      .first();
    assert.equal(idemVariant.reserved_stock, 1, 'Idempotent retry must reserve only 1 unit');

    // Cron hold expiration test: force expires_epoch into the past and run scheduled handler twice
    await worker.db
      .prepare('UPDATE orders SET expires_epoch = 1000 WHERE id = ?1')
      .bind(firstTry.json.data.orderId)
      .run();

    await worker.triggerCron();
    await worker.triggerCron(); // second run must be an idempotent no-op

    const afterCronOrder = await worker.db
      .prepare('SELECT status, stock_released FROM orders WHERE id = ?1')
      .bind(firstTry.json.data.orderId)
      .first();
    assert.equal(afterCronOrder.status, 'cancelled');
    assert.equal(afterCronOrder.stock_released, 1);

    const afterCronVariant = await worker.db
      .prepare('SELECT stock, reserved_stock FROM product_variants WHERE id = ?1')
      .bind(allVars.id)
      .first();
    assert.equal(afterCronVariant.stock, 2);
    assert.equal(afterCronVariant.reserved_stock, 0);
  } finally {
    await worker.dispose();
  }
});

test('DPDP export & erasure controls: block active order deletion, anonymize completed account', async () => {
  const worker = await createTestWorker({
    ENVIRONMENT: 'development',
    ENABLE_TEST_CHECKOUT_FALLBACK: 'true',
  });
  try {
    const variant = await getSeedVariant(worker, 5);
    const customer = await authenticateUser(worker, 'dpdp-patron@deynolddanny.test', {
      fullName: 'Vikram Singhania',
    });

    // Place a pending order
    const co = await worker.request('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer.accessToken}`,
      },
      body: JSON.stringify({
        shippingName: 'Vikram Singhania',
        shippingPhone: '9876543210',
        shippingLine1: '42 Pedder Road',
        shippingCity: 'Mumbai',
        shippingState: 'Maharashtra',
        shippingPincode: '400026',
        items: [{ variantId: variant.id, quantity: 1 }],
      }),
    });
    assert.equal(co.status, 201);

    // Export returns profile & orders
    const exp = await worker.request('/api/users/me/export', {
      headers: { Authorization: `Bearer ${customer.accessToken}` },
    });
    assert.equal(exp.status, 200);
    assert.equal(exp.json.data.profile.email, 'dpdp-patron@deynolddanny.test');
    assert.equal(exp.json.data.orders.length, 1);

    // Cannot delete while pending order exists
    const delBlocked = await worker.request('/api/users/me', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${customer.accessToken}` },
    });
    assert.equal(delBlocked.status, 409);

    // Cancel order first, then deletion succeeds and anonymizes PII + revokes tokens
    const cancel = await worker.request(`/api/orders/${co.json.data.orderId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer.accessToken}`,
      },
      body: JSON.stringify({ reason: 'Changed mind before dispatch' }),
    });
    assert.equal(cancel.status, 200);

    const delOk = await worker.request('/api/users/me', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${customer.accessToken}` },
    });
    assert.equal(delOk.status, 200);

    const dbUser = await worker.db
      .prepare('SELECT email, full_name, is_active, deleted_at FROM users WHERE id = ?1')
      .bind(customer.user.id)
      .first();
    assert.equal(dbUser.is_active, 0);
    assert.ok(dbUser.deleted_at);
    assert.ok(dbUser.email.startsWith('erased_'), 'PII email must be anonymized');

    const mePostDelete = await worker.request('/api/auth/me', {
      headers: { Authorization: `Bearer ${customer.accessToken}` },
    });
    assert.equal(mePostDelete.status, 401);
  } finally {
    await worker.dispose();
  }
});

test('Size-wise variant pricing propagates to availability, cart & checkout + audited admin payment manipulation', async () => {
  const worker = await createTestWorker({
    ENVIRONMENT: 'development',
    ENABLE_TEST_CHECKOUT_FALLBACK: 'true',
    ADMIN_EMAILS: 'admin-ops@deynolddanny.test',
  });
  try {
    const admin = await authenticateUser(worker, 'admin-ops@deynolddanny.test', {
      fullName: 'Atelier Director',
    });
    const customer = await authenticateUser(worker, 'vip-client@deynolddanny.test', {
      fullName: 'Aarav Mehta',
    });

    // Pick a seeded product and its first active variant
    const prod = await worker.db
      .prepare('SELECT id, slug, price_paise FROM products WHERE is_active = 1 LIMIT 1')
      .first();
    assert.ok(prod);
    const variant = await worker.db
      .prepare('SELECT id, size FROM product_variants WHERE product_id = ?1 AND is_active = 1 LIMIT 1')
      .bind(prod.id)
      .first();
    assert.ok(variant);

    const customSizePricePaise = prod.price_paise + 500000; // +₹5,000 for this size

    // 1. Admin sets size-wise custom price via bulk-price endpoint
    const bulkRes = await worker.request(`/api/admin/products/${prod.id}/variants/bulk-price`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${admin.accessToken}`,
      },
      body: JSON.stringify({
        updates: [{ variantId: variant.id, price_paise: customSizePricePaise }],
      }),
    });
    assert.equal(bulkRes.status, 200);

    // 2. Storefront /availability returns the size-specific price
    const availRes = await worker.request(`/api/products/${prod.slug}/availability`);
    assert.equal(availRes.status, 200);
    const matchedVar = availRes.json.data.variants.find((v) => v.id === variant.id);
    assert.equal(matchedVar.pricePaise, customSizePricePaise);
    assert.equal(matchedVar.hasCustomPrice, true);

    // 3. Checkout authoritatively charges the size-wise price from D1
    const coRes = await worker.request('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer.accessToken}`,
      },
      body: JSON.stringify({
        shippingName: 'Aarav Mehta',
        shippingPhone: '9876543210',
        shippingLine1: '18 Altamount Road',
        shippingCity: 'Mumbai',
        shippingState: 'Maharashtra',
        shippingPincode: '400026',
        items: [{ variantId: variant.id, quantity: 1 }],
      }),
    });
    assert.equal(coRes.status, 201);
    const orderId = coRes.json.data.orderId;
    const initialTotalPaise = coRes.json.data.totalPaise;
    const orderRow = await worker.db
      .prepare('SELECT subtotal_paise, shipping_paise, total_paise FROM orders WHERE id = ?1')
      .bind(orderId)
      .first();
    assert.equal(orderRow.subtotal_paise, customSizePricePaise);
    assert.equal(initialTotalPaise, customSizePricePaise + orderRow.shipping_paise);

    // 4. Admin Payment Check-Up health endpoint responds with diagnostic checks
    const healthRes = await worker.request('/api/admin/payments/health', {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });
    assert.equal(healthRes.status, 200);
    assert.ok(Array.isArray(healthRes.json.data.checks));
    assert.ok(healthRes.json.data.checks.length >= 5);

    // 5. Admin applies VIP courtesy discount (-₹2,000) to unpaid order
    const adjRes = await worker.request(`/api/admin/payments/orders/${orderId}/adjust-amount`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${admin.accessToken}`,
      },
      body: JSON.stringify({
        adjustmentPaise: -200000,
        reason: 'VIP private client courtesy discount',
      }),
    });
    assert.equal(adjRes.status, 200);
    assert.equal(adjRes.json.data.newTotalPaise, initialTotalPaise - 200000);

    // 6. Admin marks order manually paid (UPI UTR) & audit ledger records both actions
    const markPaidRes = await worker.request(`/api/admin/payments/orders/${orderId}/mark-paid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${admin.accessToken}`,
      },
      body: JSON.stringify({
        paymentMethod: 'upi_manual',
        referenceNumber: 'UTR998877665544',
        reason: 'Verified direct UPI receipt in HDFC current account',
      }),
    });
    assert.equal(markPaidRes.status, 200);
    assert.equal(markPaidRes.json.data.paymentStatus, 'paid');

    const auditRes = await worker.request('/api/admin/payments/adjustments', {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });
    assert.equal(auditRes.status, 200);
    assert.ok(auditRes.json.data.items.length >= 2);
  } finally {
    await worker.dispose();
  }
});

test('Admin local media upload (chunked >500KB PNG without R2), live serving, deletion, gallery sync & inventory delta', async () => {
  const worker = await createTestWorker({
    ENVIRONMENT: 'development',
    ADMIN_EMAILS: 'media-admin@deynolddanny.test',
  });
  try {
    const admin = await authenticateUser(worker, 'media-admin@deynolddanny.test', {
      fullName: 'Creative Director',
    });

    // Build a synthetic ~520 KB valid-magic PNG buffer (forces multi-chunk D1 storage + KV caching without R2)
    const pngBytes = new Uint8Array(520 * 1024);
    pngBytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    for (let i = 8; i < pngBytes.length; i += 1024) {
      pngBytes[i] = i % 251;
    }

    // 1. Upload via multipart FormData with empty MIME type (simulates Windows browser missing MIME)
    const form = new FormData();
    form.append('file', new Blob([pngBytes], { type: '' }), 'atelier-lookbook.png');
    form.append('altText', 'Atelier Lookbook Shot');

    const uploadRes = await worker.mf.dispatchFetch(
      'https://api.deynolddanny.com/api/admin/media/library/upload',
      {
        method: 'POST',
        headers: {
          Origin: 'https://deynolddanny.com',
          Authorization: `Bearer ${admin.accessToken}`,
        },
        body: form,
      },
    );
    const uploadJson = await uploadRes.json();
    assert.equal(uploadRes.status, 201, `Upload failed: ${JSON.stringify(uploadJson)}`);
    assert.equal(uploadJson.success, true);
    assert.equal(uploadJson.data.mimeType, 'image/png');
    assert.ok(uploadJson.data.url.startsWith('/api/media/file/'));

    // 2. Serve uploaded binary over public /api/media/file/* route
    const serveRes = await worker.mf.dispatchFetch(
      `https://api.deynolddanny.com${uploadJson.data.url}`,
      { headers: { Origin: 'https://deynolddanny.com' } },
    );
    assert.equal(serveRes.status, 200);
    assert.equal(serveRes.headers.get('content-type'), 'image/png');
    const servedBuf = new Uint8Array(await serveRes.arrayBuffer());
    assert.equal(servedBuf.byteLength, pngBytes.byteLength);
    assert.equal(servedBuf[0], 0x89);
    assert.equal(servedBuf[1024], pngBytes[1024]);

    // 3. Evict KV entry to verify durable D1 chunk re-assembly fallback
    await worker.kv.delete(`media:bin:${uploadJson.data.objectKey}`);
    const serveD1Res = await worker.mf.dispatchFetch(
      `https://api.deynolddanny.com${uploadJson.data.url}`,
      { headers: { Origin: 'https://deynolddanny.com' } },
    );
    assert.equal(serveD1Res.status, 200, 'D1 chunked fallback must serve uploaded binary even after KV eviction');
    const servedD1Buf = new Uint8Array(await serveD1Res.arrayBuffer());
    assert.equal(servedD1Buf.byteLength, pngBytes.byteLength);

    // 4. Attach uploaded image to a product gallery via { url } alias & verify GET /api/products/:slug reflects it
    const prod = await worker.db
      .prepare('SELECT id, slug FROM products WHERE is_active = 1 LIMIT 1')
      .first();
    assert.ok(prod);

    const galRes = await worker.request(`/api/admin/products/${prod.id}/images`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${admin.accessToken}`,
      },
      body: JSON.stringify({
        images: [{ url: uploadJson.data.url, alt_text: 'Lookbook hero', sort_order: 0 }],
      }),
    });
    assert.equal(galRes.status, 200);

    const pdpRes = await worker.request(`/api/products/${prod.slug}`);
    assert.equal(pdpRes.status, 200);
    assert.ok(
      pdpRes.json.data.images.includes(uploadJson.data.url),
      'Live storefront PDP API must return newly attached admin gallery image',
    );

    // 5. Inventory delta adjustment endpoint works with { delta, reason }
    const variant = await getSeedVariant(worker, 5);
    const invRes = await worker.request(`/api/admin/inventory/${variant.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${admin.accessToken}`,
      },
      body: JSON.stringify({ delta: 3, reason: 'Atelier restock' }),
    });
    assert.equal(invRes.status, 200);
    assert.equal(invRes.json.data.stock, 8);

    // 6. Delete media asset & verify binary returns 404
    const delRes = await worker.request(
      `/api/admin/media/library/assets/${uploadJson.data.id}?force=true`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${admin.accessToken}` },
      },
    );
    assert.equal(delRes.status, 200);

    const serveAfterDel = await worker.mf.dispatchFetch(
      `https://api.deynolddanny.com${uploadJson.data.url}`,
      { headers: { Origin: 'https://deynolddanny.com' } },
    );
    assert.equal(serveAfterDel.status, 404, 'Deleted media asset must no longer be served');
  } finally {
    await worker.dispose();
  }
});
