import { apiFetch } from '../../../lib/api/client';

export interface CheckoutPayload {
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

export async function submitCheckoutApi(payload: CheckoutPayload) {
  return apiFetch<CheckoutResponse>('/api/checkout', {
    method: 'POST',
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
