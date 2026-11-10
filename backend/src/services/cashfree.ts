// Cashfree Payments integration for DEYNOLD DANNY

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CashfreeOrderPayload {
  orderId: string;          // our internal order ID used as cf order_id reference
  orderAmount: number;      // in rupees (float) — Cashfree accepts decimal rupees
  customerPhone: string;
  customerEmail: string;
  customerName: string;
  returnUrl: string;        // redirect after payment
  notifyUrl: string;        // webhook URL
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
  payments?: {
    cf_payment_id: string;
    payment_status: string;
    payment_method?: { [key: string]: unknown };
    [key: string]: unknown;
  }[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function buildHeaders(appId: string, secretKey: string, apiVersion: string): Headers {
  const headers = new Headers();
  headers.set('x-client-id', appId);
  headers.set('x-client-secret', secretKey);
  headers.set('x-api-version', apiVersion);
  headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'application/json');
  return headers;
}

function extractPaymentMethod(
  payments: CashfreeOrderResponse['payments'],
): string | null {
  if (!payments || payments.length === 0) return null;
  const latest = payments[payments.length - 1];
  if (!latest?.payment_method) return null;
  // payment_method is an object whose key is the method name, e.g. { upi: {...} }
  const methodKey = Object.keys(latest.payment_method)[0];
  return methodKey ?? null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a Cashfree order and returns the cf_order_id and payment_session_id
 * required by the Cashfree JS SDK to open the payment sheet.
 */
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
    cfOrderId: data.cf_order_id,
    paymentSessionId: data.payment_session_id,
  };
}

/**
 * Fetches a Cashfree order status and the latest payment details.
 * Returns a normalised status string and payment identifiers.
 */
export async function fetchCashfreeOrder(
  cfOrderId: string,
  appId: string,
  secretKey: string,
  apiUrl: string,
  apiVersion: string,
): Promise<{ status: string; paymentId: string | null; paymentMethod: string | null }> {
  const response = await fetch(`${apiUrl}/orders/${cfOrderId}`, {
    method: 'GET',
    headers: buildHeaders(appId, secretKey, apiVersion),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cashfree fetchOrder error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as CashfreeOrderResponse;

  const payments = data.payments ?? [];
  const latestPayment = payments.length > 0 ? payments[payments.length - 1] : null;

  return {
    status: data.order_status ?? 'UNKNOWN',
    paymentId: latestPayment?.cf_payment_id ?? null,
    paymentMethod: extractPaymentMethod(payments),
  };
}

/**
 * Verifies a Cashfree webhook signature.
 * Signature: Base64( HMAC-SHA256( timestamp + rawBody, secretKey ) )
 * Returns true if the computed signature matches the received one.
 */
export async function verifyCashfreeSignature(
  rawBody: string,
  timestamp: string,
  receivedSignature: string,
  secretKey: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(timestamp + rawBody);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);

  // Base64-encode the resulting HMAC bytes
  const signatureBytes = new Uint8Array(signatureBuffer);
  const base64Signature = btoa(String.fromCharCode(...signatureBytes));

  // Constant-time comparison to prevent timing attacks
  if (base64Signature.length !== receivedSignature.length) return false;
  let result = 0;
  for (let i = 0; i < base64Signature.length; i++) {
    result |= base64Signature.charCodeAt(i) ^ receivedSignature.charCodeAt(i);
  }
  return result === 0;
}
