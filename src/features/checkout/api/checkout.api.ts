import { apiFetch } from '../../../lib/api/client';

export interface CheckoutItemPayload {
  variantId?: string;
  productId?: string;
  size?: string;
  quantity: number;
}

export interface CheckoutPayload {
  shippingAddressId?: string;
  shippingName: string;
  shippingPhone: string;
  shippingLine1: string;
  shippingLine2?: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  shippingCountry?: string;
  couponCode?: string;
  customerNotes?: string;
  clientExpectedTotalPaise?: number;
  items?: CheckoutItemPayload[];
}

export interface CheckoutResponse {
  orderId: string;
  orderNumber: string;
  totalPaise: number;
  totalFormatted?: string;
  gateway?: 'razorpay' | 'cashfree' | 'test';
  // Razorpay fields
  razorpayOrderId?: string;
  razorpayKeyId?: string;
  amount?: number;
  currency?: string;
  // Cashfree fields
  paymentSessionId?: string;
  cfOrderId?: string;
  cashfreeOrderId?: string;
  cashfreeEnvironment?: 'sandbox' | 'production';
}

export interface VerifyPaymentPayload {
  orderId: string;
  // Razorpay fields
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  // Cashfree fields
  cfOrderId?: string;
}

export interface VerifyPaymentResponse {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
}

export interface StorefrontConfig {
  freeShippingThresholdPaise: number;
  standardShippingPaise: number;
  returnWindowDays: number;
  upiMaxPaise: number;
  panVerificationThresholdPaise: number;
  courierCheckEnabled: boolean;
  razorpayEnabled?: boolean;
  cashfreeEnabled?: boolean;
  testFallbackEnabled?: boolean;
}

export async function submitCheckoutApi(payload: CheckoutPayload, idempotencyKey?: string) {
  const headers: Record<string, string> = {};
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  return apiFetch<CheckoutResponse>('/api/checkout', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...payload,
      shippingCountry: payload.shippingCountry || 'India',
    }),
  });
}

export async function verifyPaymentApi(payload: VerifyPaymentPayload) {
  return apiFetch<VerifyPaymentResponse>('/api/payments/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function pollPaymentStatusApi(orderId: string) {
  return apiFetch<VerifyPaymentResponse>(`/api/payments/verify/${encodeURIComponent(orderId)}`);
}

export async function fetchStorefrontConfigApi() {
  return apiFetch<StorefrontConfig>('/api/config/storefront', { skipAuthRefresh: true });
}

export async function checkServiceablePincodeApi(deliveryPincode: string) {
  return apiFetch<{
    serviceable: boolean;
    estimatedDays?: number | null;
    courierName?: string | null;
    codAvailable?: boolean;
    message?: string;
  }>('/api/shipping/pincode-check', {
    method: 'POST',
    skipAuthRefresh: true,
    body: JSON.stringify({ deliveryPincode }),
  });
}

export async function lookupPincodeApi(pincode: string) {
  return apiFetch<{
    postOffices: Array<{
      name: string;
      district: string;
      state: string;
      pincode: string;
    }>;
  }>(`/api/shipping/pincode-lookup?pincode=${encodeURIComponent(pincode)}`, {
    skipAuthRefresh: true,
  });
}

export async function searchAddressApi(params: {
  q?: string;
  country?: string;
  lat?: number;
  lon?: number;
}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.country) qs.set('country', params.country);
  if (typeof params.lat === 'number' && typeof params.lon === 'number') {
    qs.set('lat', String(params.lat));
    qs.set('lon', String(params.lon));
  }
  return apiFetch<{
    result?: any;
    suggestions?: any[];
  }>(`/api/shipping/address-search?${qs.toString()}`, { skipAuthRefresh: true });
}
