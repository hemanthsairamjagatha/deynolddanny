/**
 * DEYNOLD DANNY — Razorpay Payment Gateway Service
 *
 * Implements Razorpay Orders API, Webhook verification, and Payment validation
 * using standard Web Crypto API compatible with Cloudflare Workers.
 */

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

export interface RazorpayOrderInput {
  orderId: string;        // Internal DB order ID
  orderNumber: string;    // e.g. "DD-102938"
  amountPaise: number;    // In paise (e.g. 270000 = ₹2,700)
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface RazorpayOrderResult {
  razorpayOrderId: string;
  amount: number;         // In paise
  currency: string;       // "INR"
  receipt: string;
  status: string;
}

export interface RazorpayPaymentDetails {
  id: string;
  orderId: string;
  status: string;         // "captured", "failed", "authorized", "refunded"
  method: string;         // "upi", "card", "netbanking", "wallet"
  amount: number;
  currency: string;
  email?: string;
  contact?: string;
}

/**
 * Builds HTTP Basic Authentication header for Razorpay API
 */
function buildAuthHeader(keyId: string, keySecret: string): string {
  const token = btoa(`${keyId}:${keySecret}`);
  return `Basic ${token}`;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Computes HMAC-SHA256 hex string using Web Crypto API
 */
async function computeHmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signatureBytes = new Uint8Array(signatureBuffer);

  return Array.from(signatureBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Creates an order on Razorpay
 */
export async function createRazorpayOrder(
  input: RazorpayOrderInput,
  keyId: string,
  keySecret: string,
): Promise<RazorpayOrderResult> {
  const url = `${RAZORPAY_API_BASE}/orders`;

  const payload = {
    amount: input.amountPaise,
    currency: 'INR',
    receipt: input.orderNumber,
    notes: {
      internalOrderId: input.orderId,
      orderNumber: input.orderNumber,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      customerName: input.customerName,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: buildAuthHeader(keyId, keySecret),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Razorpay createOrder failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    id: string;
    amount: number;
    currency: string;
    receipt: string;
    status: string;
  };

  if (!data.id) {
    throw new Error('Razorpay createOrder returned response without order ID');
  }

  return {
    razorpayOrderId: data.id,
    amount: data.amount,
    currency: data.currency,
    receipt: data.receipt,
    status: data.status,
  };
}

/**
 * Verifies Razorpay webhook signature (x-razorpay-signature)
 * Razorpay signs the raw request payload using HMAC-SHA256 with the webhook secret.
 */
export async function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecret: string,
): Promise<boolean> {
  if (!signature || !webhookSecret) return false;
  try {
    const expectedHex = await computeHmacSha256Hex(webhookSecret, rawBody);
    return timingSafeEqual(expectedHex.toLowerCase(), signature.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Verifies Razorpay client payment signature after frontend checkout
 * Formula: HMAC-SHA256(`${razorpayOrderId}|${razorpayPaymentId}`, keySecret) === razorpaySignature
 */
export async function verifyRazorpayPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
  keySecret: string,
): Promise<boolean> {
  if (!razorpayOrderId || !razorpayPaymentId || !signature || !keySecret) return false;
  try {
    const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedHex = await computeHmacSha256Hex(keySecret, payload);
    return timingSafeEqual(expectedHex.toLowerCase(), signature.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Fetches order details directly from Razorpay
 */
export async function fetchRazorpayOrder(
  razorpayOrderId: string,
  keyId: string,
  keySecret: string,
): Promise<{ id: string; status: string; amount: number; attempts: number }> {
  const url = `${RAZORPAY_API_BASE}/orders/${razorpayOrderId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: buildAuthHeader(keyId, keySecret),
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Razorpay fetchOrder failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    id: string;
    status: string;
    amount: number;
    attempts: number;
  };

  return data;
}

/**
 * Fetches payment details from Razorpay by Payment ID
 */
export async function fetchRazorpayPayment(
  paymentId: string,
  keyId: string,
  keySecret: string,
): Promise<RazorpayPaymentDetails> {
  const url = `${RAZORPAY_API_BASE}/payments/${paymentId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: buildAuthHeader(keyId, keySecret),
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Razorpay fetchPayment failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    id: string;
    order_id: string;
    status: string;
    method: string;
    amount: number;
    currency: string;
    email?: string;
    contact?: string;
  };

  return {
    id: data.id,
    orderId: data.order_id,
    status: data.status,
    method: data.method,
    amount: data.amount,
    currency: data.currency,
    email: data.email,
    contact: data.contact,
  };
}
