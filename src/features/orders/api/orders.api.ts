import { apiFetch } from '../../../lib/api/client';

export interface TrackingMilestone {
  key: 'ORDER_PLACED' | 'ATELIER_INSPECTION' | 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED';
  title: string;
  description: string;
  status: 'completed' | 'current' | 'upcoming';
  timestamp?: string | null;
}

export interface TrackingItem {
  id?: string;
  title: string;
  size: string;
  color: string;
  image: string;
  quantity: number;
  unitPriceFormatted: string;
}

export interface LiveActivity {
  date: string;
  status: string;
  activity: string;
  location: string;
}

export interface OrderTrackingDetails {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  paidAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  estimatedDeliveryDate?: string | null;
  shippingName: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  shippingCountry: string;
  courierPartner?: string | null;
  trackingNumber?: string | null;
  subtotalFormatted: string;
  shippingFormatted: string;
  discountFormatted: string;
  discountPaise: number;
  totalFormatted: string;
  timeline: TrackingMilestone[];
  items: TrackingItem[];
  liveTrackingAvailable?: boolean;
  liveActivities?: LiveActivity[];
}

export interface PatronOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  refundedPaise?: number;
  totalFormatted?: string;
  createdAt: string;
  deliveredAt?: string | null;
  trackingNumber?: string | null;
  courierPartner?: string | null;
  items?: TrackingItem[];
}

export async function trackOrderApi(orderNumber: string, emailOrPhone: string) {
  const cleanOrder = orderNumber.trim();
  const val = emailOrPhone.trim();
  if (!val) {
    return {
      success: false,
      error: {
        code: 'VERIFICATION_REQUIRED',
        message: 'Please provide the email address or mobile number used on this order.',
        status: 400,
      },
    };
  }
  const param = val.includes('@')
    ? `email=${encodeURIComponent(val.toLowerCase())}`
    : `phone=${encodeURIComponent(val)}`;
  return apiFetch<OrderTrackingDetails>(`/api/orders/track/${encodeURIComponent(cleanOrder)}?${param}`, {
    skipAuthRefresh: true,
  });
}

export async function fetchMyOrdersApi(page = 1, limit = 20) {
  return apiFetch<{
    items: PatronOrderSummary[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>(`/api/orders?page=${page}&limit=${limit}`);
}

export async function fetchOrderDetailApi(orderId: string) {
  return apiFetch<any>(`/api/orders/${encodeURIComponent(orderId)}`);
}

export async function cancelOrderApi(orderId: string, reason: string) {
  return apiFetch<{ orderId: string; status: string; refundedPaise?: number }>(
    `/api/orders/${encodeURIComponent(orderId)}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  );
}

export async function requestReturnApi(
  orderId: string,
  payload: {
    reason: string;
    resolution?: 'refund' | 'exchange';
    items?: Array<{ orderItemId: string; quantity: number }>;
  },
) {
  return apiFetch<{ returnId: string; orderId: string; status: string }>(
    `/api/orders/${encodeURIComponent(orderId)}/returns`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function fetchOrderInvoiceApi(orderId: string) {
  return apiFetch<{
    invoiceNumber: string;
    orderNumber: string;
    issuedAt: string;
    currency: string;
    subtotalPaise: number;
    discountPaise: number;
    shippingPaise: number;
    taxPaise: number;
    totalPaise: number;
    refundedPaise?: number;
    paymentStatus: string;
    billingName: string;
    shippingAddress: {
      line1: string;
      line2?: string | null;
      city: string;
      state: string;
      pincode: string;
      country: string;
    };
    items: Array<{
      title: string;
      sku?: string | null;
      hsnCode?: string | null;
      quantity: number;
      unitPricePaise: number;
      discountPaise?: number;
      taxablePaise?: number;
      taxPaise?: number;
      gstRateBps?: number;
      totalPaise: number;
    }>;
  }>(`/api/orders/${encodeURIComponent(orderId)}/invoice`);
}
