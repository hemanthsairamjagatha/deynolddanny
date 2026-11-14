import { apiFetch } from '../../../lib/api/client';

export interface TrackingMilestone {
  key: 'ORDER_PLACED' | 'ATELIER_INSPECTION' | 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED';
  title: string;
  description: string;
  status: 'completed' | 'current' | 'upcoming';
  timestamp?: string | null;
}

export interface TrackingItem {
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
  courierPartner: string;
  trackingNumber?: string | null;
  shiprocketAwb?: string | null;
  totalPaise: number;
  totalFormatted: string;
  subtotalPaise: number;
  subtotalFormatted: string;
  discountPaise: number;
  discountFormatted: string;
  shippingFormatted: string;
  items: TrackingItem[];
  timeline: TrackingMilestone[];
  liveActivities: LiveActivity[];
}

/**
 * Public tracking lookup by order number and optional email / phone
 */
export async function trackOrderApi(orderNumber: string, emailOrPhone?: string) {
  let url = `/api/orders/track/${encodeURIComponent(orderNumber.trim())}`;
  if (emailOrPhone?.trim()) {
    const val = emailOrPhone.trim();
    if (val.includes('@')) {
      url += `?email=${encodeURIComponent(val.toLowerCase())}`;
    } else {
      url += `?phone=${encodeURIComponent(val)}`;
    }
  }
  return apiFetch<OrderTrackingDetails>(url);
}

