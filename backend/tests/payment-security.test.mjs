import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTestWorker,
  authenticateUser,
  getSeedVariant,
  signHmacSha256Hex,
  signCashfreeWebhook,
} from './helpers/miniflare-harness.mjs';

test('Fail-closed defaults: checkout & courier block when unconfigured in staging/production', async () => {
  const worker = await createTestWorker({
    ENVIRONMENT: 'production',
    ENABLE_TEST_CHECKOUT_FALLBACK: 'false',
    COURIER_FAIL_OPEN: 'false',
  });
  try {
    const variant = await getSeedVariant(worker, 5);
    const user = await authenticateUser(worker, 'failclosed@deynolddanny.test');

    // Checkout must refuse when no payment gateway is configured in staging/prod
    const co = await worker.request('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.accessToken}`,
      },
      body: JSON.stringify({
        shippingName: 'Fail Closed Patron',
        shippingPhone: '9876543210',
        shippingLine1: '10 Apollo Bunder',
        shippingCity: 'Mumbai',
        shippingState: 'Maharashtra',
        shippingPincode: '400001',
        items: [{ variantId: variant.id, quantity: 1 }],
      }),
    });
    assert.equal(co.status, 503);

    // Pincode check must fail-closed with 503 when Shiprocket credentials are unset and COURIER_FAIL_OPEN=false
    const pin = await worker.request('/api/shipping/pincode-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryPincode: '400001' }),
    });
    assert.equal(pin.status, 503);
  } finally {
    await worker.dispose();
  }
});

test('Razorpay webhooks: signature verification, amount/currency match, webhook dedupe, late capture & duplicate capture', async () => {
  const worker = await createTestWorker({
    ENVIRONMENT: 'development',
    ENABLE_TEST_CHECKOUT_FALLBACK: 'true',
    AUTO_REFUND_DUPLICATE_CAPTURE: 'true',
  });
  try {
    const variant = await getSeedVariant(worker, 2);
    const patron = await authenticateUser(worker, 'webhooks@deynolddanny.test');

    // Create order #1 cleanly via checkout
    const co1 = await worker.request('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patron.accessToken}`,
      },
      body: JSON.stringify({
        shippingName: 'Webhook Patron',
        shippingPhone: '9876543210',
        shippingLine1: '21 Altamount Road',
        shippingCity: 'Mumbai',
        shippingState: 'Maharashtra',
        shippingPincode: '400026',
        items: [{ variantId: variant.id, quantity: 1 }],
      }),
    });
    assert.equal(co1.status, 201);
    const order1Id = co1.json.data.orderId;
    const totalPaise1 = co1.json.data.amount;

    // Bind gateway order id as Razorpay order for webhook testing
    await worker.db
      .prepare(`UPDATE orders SET cf_order_id = 'order_rzp_valid_1', payment_method = 'razorpay' WHERE id = ?1`)
      .bind(order1Id)
      .run();

    // 1. Tampered signature rejected
    const payload1 = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_rzp_1',
            order_id: 'order_rzp_valid_1',
            amount: totalPaise1,
            currency: 'INR',
            method: 'card',
          },
        },
      },
    });

    const badSig = await worker.request('/api/payments/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': 'deadbeef',
        'x-razorpay-event-id': 'evt_bad_1',
      },
      body: payload1,
    });
    assert.equal(badSig.status, 403);

    // 2. Amount mismatch is ignored safely without confirming order
    const mismatchPayload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_rzp_mismatch',
            order_id: 'order_rzp_valid_1',
            amount: 100, // INR 1.00 spoof!
            currency: 'INR',
            method: 'upi',
          },
        },
      },
    });
    const mismatchRes = await worker.request('/api/payments/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signHmacSha256Hex(worker.bindings.RAZORPAY_WEBHOOK_SECRET, mismatchPayload),
        'x-razorpay-event-id': 'evt_mismatch_1',
      },
      body: mismatchPayload,
    });
    assert.equal(mismatchRes.status, 200);
    assert.equal(mismatchRes.json.data.ignored, true);

    const orderStillPending = await worker.db
      .prepare('SELECT status, payment_status FROM orders WHERE id = ?1')
      .bind(order1Id)
      .first();
    assert.equal(orderStillPending.status, 'pending');
    assert.equal(orderStillPending.payment_status, 'pending');

    // 3. Valid capture commits stock atomically (stock 2 -> 1, reserved 1 -> 0)
    const validSig1 = signHmacSha256Hex(worker.bindings.RAZORPAY_WEBHOOK_SECRET, payload1);
    const capRes = await worker.request('/api/payments/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validSig1,
        'x-razorpay-event-id': 'evt_capture_1',
      },
      body: payload1,
    });
    assert.equal(capRes.status, 200);
    assert.equal(capRes.json.data.duplicate, undefined);

    const afterCapVar = await worker.db
      .prepare('SELECT stock, reserved_stock FROM product_variants WHERE id = ?1')
      .bind(variant.id)
      .first();
    assert.equal(afterCapVar.stock, 1);
    assert.equal(afterCapVar.reserved_stock, 0);

    const afterCapOrder = await worker.db
      .prepare('SELECT status, payment_status, stock_committed FROM orders WHERE id = ?1')
      .bind(order1Id)
      .first();
    assert.equal(afterCapOrder.status, 'confirmed');
    assert.equal(afterCapOrder.payment_status, 'paid');
    assert.equal(afterCapOrder.stock_committed, 1);

    // 4. Duplicate event-id is ignored idempotently without subtracting stock again
    const dupEventRes = await worker.request('/api/payments/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': validSig1,
        'x-razorpay-event-id': 'evt_capture_1',
      },
      body: payload1,
    });
    assert.equal(dupEventRes.status, 200);
    assert.equal(dupEventRes.json.data.deduplicated, true);

    // 5. Duplicate capture with a DIFFERENT payment id records duplicate capture handling & preserves stock
    const dupPayPayload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_rzp_duplicate_2',
            order_id: 'order_rzp_valid_1',
            amount: totalPaise1,
            currency: 'INR',
            method: 'card',
          },
        },
      },
    });
    const dupPayRes = await worker.request('/api/payments/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signHmacSha256Hex(worker.bindings.RAZORPAY_WEBHOOK_SECRET, dupPayPayload),
        'x-razorpay-event-id': 'evt_capture_duplicate_pay',
      },
      body: dupPayPayload,
    });
    assert.equal(dupPayRes.status, 200);

    const dupHistory = await worker.db
      .prepare(`SELECT action, detail FROM order_audit_logs WHERE order_id = ?1 AND action IN ('duplicate_capture_manual_review', 'duplicate_capture_refunded')`)
      .bind(order1Id)
      .all();
    assert.equal(dupHistory.results.length, 1, 'Duplicate payment capture must be recorded in order_audit_logs');

    // 6. Late capture after hold expiry & zero remaining stock escalates to `confirmed_needs_allocation`
    const co2 = await worker.request('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patron.accessToken}`,
      },
      body: JSON.stringify({
        shippingName: 'Late Capture Patron',
        shippingPhone: '9876543210',
        shippingLine1: '21 Altamount Road',
        shippingCity: 'Mumbai',
        shippingState: 'Maharashtra',
        shippingPincode: '400026',
        items: [{ variantId: variant.id, quantity: 1 }],
      }),
    });
    assert.equal(co2.status, 201);
    const order2Id = co2.json.data.orderId;
    const totalPaise2 = co2.json.data.amount;

    // Simulate hold timeout + stock sold out to 0
    await worker.db
      .prepare('UPDATE orders SET expires_epoch = 1000, cf_order_id = ?1, payment_method = ?2 WHERE id = ?3')
      .bind('order_rzp_late_2', 'razorpay', order2Id)
      .run();
    await worker.triggerCron();
    await worker.db
      .prepare('UPDATE product_variants SET stock = 0, reserved_stock = 0 WHERE id = ?1')
      .bind(variant.id)
      .run();

    const latePayload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_rzp_late_2',
            order_id: 'order_rzp_late_2',
            amount: totalPaise2,
            currency: 'INR',
            method: 'upi',
          },
        },
      },
    });
    const lateRes = await worker.request('/api/payments/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signHmacSha256Hex(worker.bindings.RAZORPAY_WEBHOOK_SECRET, latePayload),
        'x-razorpay-event-id': 'evt_late_capture_2',
      },
      body: latePayload,
    });
    assert.equal(lateRes.status, 200);

    const lateOrder = await worker.db
      .prepare('SELECT status, payment_status FROM orders WHERE id = ?1')
      .bind(order2Id)
      .first();
    assert.equal(lateOrder.status, 'confirmed_needs_allocation');
    assert.equal(lateOrder.payment_status, 'paid');

    const varZero = await worker.db
      .prepare('SELECT stock, reserved_stock FROM product_variants WHERE id = ?1')
      .bind(variant.id)
      .first();
    assert.equal(varZero.stock, 0);
    assert.equal(varZero.reserved_stock, 0);
  } finally {
    await worker.dispose();
  }
});

test('Cashfree webhook 300s timestamp replay guard', async () => {
  const worker = await createTestWorker({
    ENVIRONMENT: 'development',
    ENABLE_TEST_CHECKOUT_FALLBACK: 'true',
  });
  try {
    const variant = await getSeedVariant(worker, 3);
    const patron = await authenticateUser(worker, 'cashfree@deynolddanny.test');

    const co = await worker.request('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patron.accessToken}`,
      },
      body: JSON.stringify({
        shippingName: 'Cashfree Patron',
        shippingPhone: '9876543210',
        shippingLine1: '5 Cuffe Parade',
        shippingCity: 'Mumbai',
        shippingState: 'Maharashtra',
        shippingPincode: '400005',
        items: [{ variantId: variant.id, quantity: 1 }],
      }),
    });
    assert.equal(co.status, 201);
    const orderId = co.json.data.orderId;
    const totalPaise = co.json.data.amount;

    await worker.db
      .prepare(`UPDATE orders SET cf_order_id = 'cf_ord_test_1', payment_method = 'cashfree' WHERE id = ?1`)
      .bind(orderId)
      .run();

    const cfBody = JSON.stringify({
      type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: {
        order: {
          order_id: 'cf_ord_test_1',
          order_amount: Number((totalPaise / 100).toFixed(2)),
          order_currency: 'INR',
        },
        payment: {
          cf_payment_id: 'cf_pay_1',
          payment_method: { upi: {} },
        },
      },
    });

    // Stale timestamp (10 minutes old) must be rejected even with mathematically valid HMAC
    const staleTs = String(Math.floor(Date.now() / 1000) - 600);
    const staleSig = signCashfreeWebhook(staleTs, cfBody, worker.bindings.CASHFREE_SECRET_KEY);
    const staleRes = await worker.request('/api/payments/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-timestamp': staleTs,
        'x-webhook-signature': staleSig,
      },
      body: cfBody,
    });
    assert.equal(staleRes.status, 403);

    // Fresh timestamp passes and confirms order
    const freshTs = String(Math.floor(Date.now() / 1000));
    const freshSig = signCashfreeWebhook(freshTs, cfBody, worker.bindings.CASHFREE_SECRET_KEY);
    const freshRes = await worker.request('/api/payments/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-timestamp': freshTs,
        'x-webhook-signature': freshSig,
      },
      body: cfBody,
    });
    assert.equal(freshRes.status, 200);

    const updatedOrder = await worker.db
      .prepare('SELECT status, payment_status FROM orders WHERE id = ?1')
      .bind(orderId)
      .first();
    assert.equal(updatedOrder.status, 'confirmed');
    assert.equal(updatedOrder.payment_status, 'paid');
  } finally {
    await worker.dispose();
  }
});

test('Refunds, over-refund protection, dispute freeze & Shiprocket logistics webhooks', async () => {
  const worker = await createTestWorker({
    ENVIRONMENT: 'development',
    ENABLE_TEST_CHECKOUT_FALLBACK: 'true',
    ADMIN_EMAILS: 'admin@deynolddanny.test',
  });
  try {
    const variant = await getSeedVariant(worker, 5);
    // Verify admin allowlist enforcement: DB role=admin outside ADMIN_EMAILS gets 403
    const rogueAdmin = await authenticateUser(worker, 'rogue-admin@deynolddanny.test', {
      role: 'admin',
      fullName: 'Unlisted Admin',
    });
    const blockedPing = await worker.request('/api/admin/ping', {
      headers: { Authorization: `Bearer ${rogueAdmin.accessToken}` },
    });
    assert.equal(blockedPing.status, 403);

    const admin = await authenticateUser(worker, 'admin@deynolddanny.test', {
      role: 'admin',
      fullName: 'Atelier Admin',
    });

    // Place a test order and mark it paid via Razorpay webhook
    const co = await worker.request('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${admin.accessToken}`,
      },
      body: JSON.stringify({
        shippingName: 'Refund Patron',
        shippingPhone: '9876543210',
        shippingLine1: '18Worli Sea Face',
        shippingCity: 'Mumbai',
        shippingState: 'Maharashtra',
        shippingPincode: '400018',
        items: [{ variantId: variant.id, quantity: 1 }],
      }),
    });
    assert.equal(co.status, 201);
    const orderId = co.json.data.orderId;
    const totalPaise = co.json.data.amount;

    await worker.db
      .prepare(
        `UPDATE orders
         SET cf_order_id = 'order_rzp_ref_1',
             cf_payment_id = 'pay_rzp_ref_1',
             payment_method = 'razorpay',
             status = 'confirmed',
             payment_status = 'paid',
             stock_committed = 1,
             tracking_number = 'AWB999888777'
         WHERE id = ?1`,
      )
      .bind(orderId)
      .run();

    // Mark cf_order_id as test_ to avoid external Razorpay HTTP call during partial refund test OR test dispute lock cleanly:
    // First test dispute lock via Razorpay dispute webhook!
    const disputeOpenBody = JSON.stringify({
      event: 'payment.dispute.created',
      payload: {
        dispute: {
          entity: {
            id: 'disp_1',
            payment_id: 'pay_rzp_ref_1',
            amount: totalPaise,
            reason_code: 'fraud',
            phase: 'chargeback',
          },
        },
      },
    });
    const d1 = await worker.request('/api/payments/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signHmacSha256Hex(worker.bindings.RAZORPAY_WEBHOOK_SECRET, disputeOpenBody),
        'x-razorpay-event-id': 'evt_disp_open_1',
      },
      body: disputeOpenBody,
    });
    assert.equal(d1.status, 200);

    const frozenOrder = await worker.db
      .prepare('SELECT dispute_frozen, payment_status FROM orders WHERE id = ?1')
      .bind(orderId)
      .first();
    assert.equal(frozenOrder.dispute_frozen, 1);
    assert.equal(frozenOrder.payment_status, 'disputed');

    // Admin refund MUST be blocked while dispute_frozen = 1
    const blockedRefund = await worker.request(`/api/admin/orders/${orderId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${admin.accessToken}`,
      },
      body: JSON.stringify({ amountPaise: 1000, reason: 'Attempt refund during active chargeback' }),
    });
    assert.ok(blockedRefund.status === 409 || blockedRefund.status === 400);

    // Resolve dispute as WON -> unfreezes order
    const disputeWonBody = JSON.stringify({
      event: 'payment.dispute.won',
      payload: {
        dispute: {
          entity: {
            id: 'disp_1',
            payment_id: 'pay_rzp_ref_1',
            amount: totalPaise,
            status: 'won',
          },
        },
      },
    });
    const d2 = await worker.request('/api/payments/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signHmacSha256Hex(worker.bindings.RAZORPAY_WEBHOOK_SECRET, disputeWonBody),
        'x-razorpay-event-id': 'evt_disp_won_1',
      },
      body: disputeWonBody,
    });
    assert.equal(d2.status, 200);

    // Switch cf_order_id to simulated prefix to test partial + over-refund math deterministically
    await worker.db
      .prepare(`UPDATE orders SET cf_order_id = 'test_ref_order_1', payment_status = 'paid' WHERE id = ?1`)
      .bind(orderId)
      .run();

    const partialAmt = Math.floor(totalPaise / 2);
    const partialRes = await worker.request(`/api/admin/orders/${orderId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${admin.accessToken}`,
      },
      body: JSON.stringify({ amountPaise: partialAmt, reason: 'Partial sleeve alteration adjustment' }),
    });
    assert.equal(partialRes.status, 200);
    assert.equal(partialRes.json.data.paymentStatus, 'partially_refunded');

    // Over-refund exceeding remaining balance must fail
    const overRes = await worker.request(`/api/admin/orders/${orderId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${admin.accessToken}`,
      },
      body: JSON.stringify({ amountPaise: totalPaise, reason: 'Over refund attempt' }),
    });
    assert.equal(overRes.status, 400);

    // Shiprocket webhook requires valid x-api-key; wrong key gets 403
    const srPayload = JSON.stringify({
      awb: 'AWB999888777',
      current_status: 'IN TRANSIT',
    });
    const badSr = await worker.request('/api/webhooks/shiprocket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'wrong-token',
      },
      body: srPayload,
    });
    assert.equal(badSr.status, 403);

    const goodSrTransit = await worker.request('/api/webhooks/shiprocket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': worker.bindings.SHIPROCKET_WEBHOOK_TOKEN,
      },
      body: srPayload,
    });
    assert.equal(goodSrTransit.status, 200);

    // NDR update moves shipped -> ndr_pending
    const ndrRes = await worker.request('/api/webhooks/shiprocket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': worker.bindings.SHIPROCKET_WEBHOOK_TOKEN,
      },
      body: JSON.stringify({ awb: 'AWB999888777', current_status: 'NDR' }),
    });
    assert.equal(ndrRes.status, 200);

    const ndrOrder = await worker.db
      .prepare('SELECT status FROM orders WHERE id = ?1')
      .bind(orderId)
      .first();
    assert.equal(ndrOrder.status, 'ndr_pending');

    // Delivered update closes shipment cleanly
    const delivRes = await worker.request('/api/webhooks/shiprocket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': worker.bindings.SHIPROCKET_WEBHOOK_TOKEN,
      },
      body: JSON.stringify({ awb: 'AWB999888777', current_status: 'DELIVERED' }),
    });
    assert.equal(delivRes.status, 200);

    const deliveredOrder = await worker.db
      .prepare('SELECT status, delivered_at FROM orders WHERE id = ?1')
      .bind(orderId)
      .first();
    assert.equal(deliveredOrder.status, 'delivered');
    assert.ok(deliveredOrder.delivered_at);
  } finally {
    await worker.dispose();
  }
});
