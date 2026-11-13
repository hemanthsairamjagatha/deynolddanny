// API request/response contract types

// ─── Standard Response Envelopes ───────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    status: number;
  };
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// ─── Money Helpers ──────────────────────────────────────────────────────────

export interface MoneyFields {
  price: string;      // "₹ 72,500.00"
  priceNum: number;   // 72500
  pricePaise: number; // 7250000
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
}

export interface TokenResponse {
  accessToken: string;
  user: AuthUser;
}

// ─── Product / Catalog ──────────────────────────────────────────────────────

export interface ApiVariant {
  id: string;
  size: string;
  colorName: string;
  colorHex: string;
  inStock: boolean;
  availableStock: number;
}

export interface ApiGalleryGroup {
  colorName: string;
  images: string[];
}

export interface ApiCrossSellItem {
  id: string;
  title: string;
  price: string;
  priceNum: number;
  image: string;
  link: string;
  badge?: string;
}

export interface ApiProductCard extends MoneyFields {
  id: string;
  slug: string;
  title: string;
  badge: string | null;
  defaultImg: string;
  hoverImg: string;
  sizes: string[];
  colors: { name: string; hex: string }[];
  link: string;
}

export interface ApiProductDetail extends ApiProductCard {
  description: string | null;
  material: string | null;
  careGuide: string | null;
  gender: string | null;
  tag: string | null;
  sizeAndFit: string[];
  compositionCare: string[];
  shippingReturns: string[];
  variants: ApiVariant[];
  gallery: ApiGalleryGroup[];
  crossSells: {
    styleItWith: ApiCrossSellItem[];
    related: ApiCrossSellItem[];
  };
}

// ─── Cart ───────────────────────────────────────────────────────────────────

export interface ApiCartItem extends MoneyFields {
  cartItemId: string;
  variantId: string;
  productId: string;
  title: string;
  size: string;
  color: string;
  img: string;
  qty: number;
  availableStock: number;
}

export interface ApiCartSummary {
  items: ApiCartItem[];
  subtotalPaise: number;
  subtotalNum: number;
  subtotalFormatted: string;
  qualifiesFreeShipping: boolean;
}

// ─── Checkout ───────────────────────────────────────────────────────────────

export interface ApiCheckoutResponse {
  orderId: string;
  orderNumber: string;
  totalPaise: number;
  totalFormatted?: string;
  // Razorpay integration
  razorpayOrderId?: string;
  razorpayKeyId?: string;
  amount?: number; // in paise for Razorpay Checkout
  currency?: string;
  // Cashfree integration
  cfOrderId?: string;
  paymentSessionId?: string;
  gateway?: 'razorpay' | 'cashfree' | 'test';
  cashfreeEnvironment?: 'sandbox' | 'production';
}

// ─── Tracking / Milestones ───────────────────────────────────────────────────

export interface TrackingMilestone {
  key: 'ORDER_PLACED' | 'ATELIER_INSPECTION' | 'DISPATCHED' | 'IN_TRANSIT' | 'DELIVERED';
  title: string;
  description: string;
  status: 'completed' | 'current' | 'upcoming';
  timestamp?: string | null;
}

export interface ApiOrderTrackingDetails {
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
  items: Array<{
    title: string;
    size: string;
    color: string;
    image: string;
    quantity: number;
    unitPriceFormatted: string;
  }>;
  timeline: TrackingMilestone[];
  liveActivities: Array<{
    date: string;
    status: string;
    activity: string;
    location: string;
  }>;
}

// ─── Logistics / Shiprocket ──────────────────────────────────────────────────

export interface ApiShiprocketTracking {
  orderId: string;
  awbCode: string;
  courierName: string;
  currentStatus: string;
  estimatedDeliveryDate: string | null;
  deliveredAt: string | null;
  activityHistory: Array<{
    date: string;
    status: string;
    activity: string;
    location: string;
  }>;
}

export interface ApiPincodeServiceability {
  pincode: string;
  serviceable: boolean;
  courierName?: string;
  courierCompanyId?: number;
  estimatedDeliveryDays?: number;
  codAvailable?: boolean;
}

// ─── Orders ─────────────────────────────────────────────────────────────────

export interface ApiOrderItem {
  id: string;
  title: string;
  sku: string;
  size: string;
  color: string;
  image: string;
  unitPrice: string;
  unitPricePaise: number;
  quantity: number;
  totalPaise: number;
}

export interface ApiOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  subtotalPaise: number;
  shippingPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  totalFormatted: string;
  items: ApiOrderItem[];
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    pincode: string;
  };
  couponCode: string | null;
  courierPartner: string | null;
  trackingNumber: string | null;
  shiprocketOrderId?: string | null;
  shiprocketAwb?: string | null;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
}

// ─── Email Queue Jobs ───────────────────────────────────────────────────────

export type EmailJobType = 'otp' | 'order_confirmed' | 'order_shipped';

export interface OtpEmailJob {
  type: 'otp';
  to: string;
  otp: string;
}

export interface OrderConfirmedEmailJob {
  type: 'order_confirmed';
  to: string;
  orderNumber: string;
  totalFormatted: string;
  items: ApiOrderItem[];
}

export interface OrderShippedEmailJob {
  type: 'order_shipped';
  to: string;
  orderNumber: string;
  courierPartner: string;
  trackingNumber: string;
}

export type EmailJob = OtpEmailJob | OrderConfirmedEmailJob | OrderShippedEmailJob;

