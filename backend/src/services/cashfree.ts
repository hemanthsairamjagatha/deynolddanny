// Cashfree Payments integration for DEYNOLD DANNY

import {
  CASHFREE_WEBHOOK_MAX_AGE_SECONDS,
  GATEWAY_FETCH_TIMEOUT_MS,
} from '../config/constants.js';
import { timingSafeEqualStrings } from './crypto.js';

export interface CashfreeOrderPayload {
  orderId: string;
  orderAmount: number;
  customerPhone: string;
  customerEmail: string;
  customerName: string;
  returnUrl: string;
  notifyUrl: string;
}

interface CashfreeCreateResponse {
  cf_order_id: string;
  payment_session_id: string;
  order_status: string;
  [key: string]: unknown;
}

interface CashfreeOrderResponse {
  cf_order_id: string;
  order_status: string;
  order_amount?: number;
  order_currency?: string;
  payments?: {
    cf_payment_id: string;
    payment_status: string;
    payment_amount?: number;
    payment_currency?: string;
    payment_method?: { [key: string]: unknown };
    [key: string]: unknown;
  }[];
  [key: string]: unknown;
}

function buildHeaders(appId: string, secretKey: string, apiVersion: string): Headers {
  const headers = new Headers();
  headers.set('x-client-id', appId);
  headers.set('x-client-secret', secretKey);
  headers.set('x-api-version', apiVersion);
  headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'application/json');
  return headers;
}

function extractPaymentMethod(payments: CashfreeOrderResponse['payments']): string | null {
  if (!payments || payments.length === 0) return null;
  const latest = payments[payments.length - 1];
  if (!latest?.payment_method) return null;
  const methodKey = Object.keys(latest.payment_method)[0];
  return methodKey ?? null;
}

export async function createCashfreeOrder(
  payload: CashfreeOrderPayload,
  appId: string,
  secretKey: string,
  apiUrl: string,
  apiVersion: string,
): Promise<{ cfOrderId: string; paymentSessionId: string }> {
  const body = {
    order_id: payload.orderId,
    order_amount: payload.orderAmount,
    order_currency: 'INR',
    customer_details: {
      customer_id: payload.orderId,
      customer_phone: payload.customerPhone,
      customer_email: payload.customerEmail,
      customer_name: payload.customerName,
    },
    order_meta: {
      return_url: payload.returnUrl,
      notify_url: payload.notifyUrl,
    },
  };

  const response = await fetch(`${apiUrl}/orders`, {
    method: 'POST',
    signal: AbortSignal.timeout(GATEWAY_FETCH_TIMEOUT_MS),
    headers: buildHeaders(appId, secretKey, apiVersion),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cashfree createOrder error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as CashfreeCreateResponse;

  if (!data.cf_order_id || !data.payment_session_id) {
    throw new Error('Cashfree createOrder: missing cf_order_id or payment_session_id in response');
  }

  return {
    cfOrderId: String(data.cf_order_id),
    paymentSessionId: data.payment_session_id,
  };
}

export async function fetchCashfreeOrder(
  cfOrderId: string,
  appId: string,
  secretKey: string,
  apiUrl: string,
  apiVersion: string,
): Promise<{
  status: string;
  paymentId: string | null;
  paymentMethod: string | null;
  amountPaise: number | null;
  currency: string | null;
}> {
  const response = await fetch(`${apiUrl}/orders/${encodeURIComponent(cfOrderId)}`, {
    method: 'GET',
    signal: AbortSignal.timeout(GATEWAY_FETCH_TIMEOUT_MS),
    headers: buildHeaders(appId, secretKey, apiVersion),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cashfree fetchOrder error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as CashfreeOrderResponse;
  const payments = data.payments ?? [];
  const latestPayment = payments.length > 0 ? payments[payments.length - 1] : null;
  const amountNum =
    typeof data.order_amount === 'number'
      ? data.order_amount
      : typeof latestPayment?.payment_amount === 'number'
        ? latestPayment.payment_amount
        : null;

  return {
    status: data.order_status ?? 'UNKNOWN',
    paymentId: latestPayment?.cf_payment_id ? String(latestPayment.cf_payment_id) : null,
    paymentMethod: extractPaymentMethod(payments),
    amountPaise: amountNum !== null ? Math.round(amountNum * 100) : null,
    currency: (data.order_currency ?? latestPayment?.payment_currency ?? 'INR') as string,
  };
}

export async function createCashfreeRefund(
  orderId: string,
  refundId: string,
  amountRupeesFloat: string,
  note: string,
  appId: string,
  secretKey: string,
  apiUrl: string,
  apiVersion: string,
): Promise<{ cfRefundId: string; status: string }> {
  const response = await fetch(`${apiUrl}/orders/${encodeURIComponent(orderId)}/refunds`, {
    method: 'POST',
    signal: AbortSignal.timeout(GATEWAY_FETCH_TIMEOUT_MS),
    headers: buildHeaders(appId, secretKey, apiVersion),
    body: JSON.stringify({
      refund_amount: parseFloat(amountRupeesFloat),
      refund_id: refundId,
      refund_note: note,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cashfree createRefund error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { cf_refund_id?: string; refund_status?: string };
  return {
    cfRefundId: String(data.cf_refund_id || refundId),
    status: data.refund_status || 'PENDING',
  };
}

/**
 * Verifies a Cashfree webhook signature AND enforces replay freshness (<= 300s).
 * Signature: Base64( HMAC-SHA256( timestamp + rawBody, secretKey ) )
 */
export async function verifyCashfreeSignature(
  rawBody: string,
  timestamp: string,
  receivedSignature: string,
  secretKey: string,
): Promise<boolean> {
  if (!timestamp || !receivedSignature || !secretKey) return false;

  const rawTs = Number(timestamp);
  if (!Number.isFinite(rawTs) || rawTs <= 0) return false;
  // Support Cashfree seconds or milliseconds epochs
  const tsSeconds = rawTs > 1e12 ? Math.floor(rawTs / 1000) : Math.floor(rawTs);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - tsSeconds) > CASHFREE_WEBHOOK_MAX_AGE_SECONDS) {
    return false;
  }

  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(timestamp + rawBody),
  );

  const signatureBytes = new Uint8Array(signatureBuffer);
  const base64Signature = btoa(String.fromCharCode(...signatureBytes));
  return timingSafeEqualStrings(base64Signature, receivedSignature);
}
