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
  customerNotes?: string;
}

export interface CheckoutResponse {
  orderId: string;
  orderNumber: string;
  totalPaise: number;
  totalFormatted: string;
  paymentSessionId?: string;
  cashfreeOrderId?: string;
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

