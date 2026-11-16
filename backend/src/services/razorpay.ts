/**
 * DEYNOLD DANNY — Razorpay Payment Gateway Service
 *
 * Implements Razorpay Orders API, Webhook verification, Payment fetching, Refunds API,
 * and constant-time signature validation with explicit network timeouts.
 */

import { GATEWAY_FETCH_TIMEOUT_MS } from '../config/constants.js';
import { timingSafeEqualStrings } from './crypto.js';

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

export interface RazorpayOrderInput {
  orderId: string;
  orderNumber: string;
  amountPaise: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface RazorpayOrderResult {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export interface RazorpayPaymentDetails {
  id: string;
  orderId: string;
  status: string; // "captured", "failed", "authorized", "refunded"
  method: string;
  amount: number;
  currency: string;
  email?: string;
  contact?: string;
}

export interface RazorpayRefundResult {
  id: string;
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
}

function buildAuthHeader(keyId: string, keySecret: string): string {
  const token = btoa(`${keyId}:${keySecret}`);
  return `Basic ${token}`;
}

async function computeHmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

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
    signal: AbortSignal.timeout(GATEWAY_FETCH_TIMEOUT_MS),
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

export async function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecret: string,
): Promise<boolean> {
  if (!signature || !webhookSecret) return false;
  try {
    const expectedHex = await computeHmacSha256Hex(webhookSecret, rawBody);
    return timingSafeEqualStrings(expectedHex.toLowerCase(), signature.toLowerCase());
  } catch {
    return false;
  }
}

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
    return timingSafeEqualStrings(expectedHex.toLowerCase(), signature.toLowerCase());
  } catch {
    return false;
  }
}

export async function fetchRazorpayOrder(
  razorpayOrderId: string,
  keyId: string,
  keySecret: string,
): Promise<{ id: string; status: string; amount: number; currency: string; attempts: number }> {
  const url = `${RAZORPAY_API_BASE}/orders/${encodeURIComponent(razorpayOrderId)}`;

  const response = await fetch(url, {
    method: 'GET',
    signal: AbortSignal.timeout(GATEWAY_FETCH_TIMEOUT_MS),
    headers: {
      Authorization: buildAuthHeader(keyId, keySecret),
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Razorpay fetchOrder failed (${response.status}): ${errorBody}`);
  }

  return (await response.json()) as {
    id: string;
    status: string;
    amount: number;
    currency: string;
    attempts: number;
  };
}

export async function fetchRazorpayOrderPayments(
  razorpayOrderId: string,
  keyId: string,
  keySecret: string,
): Promise<RazorpayPaymentDetails[]> {
  const url = `${RAZORPAY_API_BASE}/orders/${encodeURIComponent(razorpayOrderId)}/payments`;
  const response = await fetch(url, {
    method: 'GET',
    signal: AbortSignal.timeout(GATEWAY_FETCH_TIMEOUT_MS),
    headers: {
      Authorization: buildAuthHeader(keyId, keySecret),
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Razorpay fetchOrderPayments failed (${response.status}): ${errorBody}`);
  }

  const json = (await response.json()) as { items?: any[] };
  return (json.items ?? []).map((data) => ({
    id: data.id,
    orderId: data.order_id,
    status: data.status,
    method: data.method,
    amount: data.amount,
    currency: data.currency,
    email: data.email,
    contact: data.contact,
  }));
}

export async function fetchRazorpayPayment(
  paymentId: string,
  keyId: string,
  keySecret: string,
): Promise<RazorpayPaymentDetails> {
  const url = `${RAZORPAY_API_BASE}/payments/${encodeURIComponent(paymentId)}`;

  const response = await fetch(url, {
    method: 'GET',
    signal: AbortSignal.timeout(GATEWAY_FETCH_TIMEOUT_MS),
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

/**
 * Initiates a full or partial refund through Razorpay Refunds API.
 */
export async function createRazorpayRefund(
  paymentId: string,
  amountPaise: number,
  notes: Record<string, string>,
  keyId: string,
  keySecret: string,
): Promise<RazorpayRefundResult> {
  const url = `${RAZORPAY_API_BASE}/payments/${encodeURIComponent(paymentId)}/refund`;

  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(GATEWAY_FETCH_TIMEOUT_MS),
    headers: {
      Authorization: buildAuthHeader(keyId, keySecret),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      amount: amountPaise,
      speed: 'normal',
      notes,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Razorpay refund failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    id: string;
    payment_id: string;
    amount: number;
    currency: string;
    status: string;
  };

  return {
    id: data.id,
    paymentId: data.payment_id,
    amount: data.amount,
    currency: data.currency,
    status: data.status,
  };
}
