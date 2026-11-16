/**
 * DEYNOLD DANNY — Shiprocket Logistics & Courier Integration
 *
 * Implements authentication (with KV caching), order creation, AWB generation,
 * pickup requests, cancellation, live tracking, and pincode serviceability checks
 * with strict network timeouts and fail-closed defaults.
 */

import { GATEWAY_FETCH_TIMEOUT_MS } from '../config/constants.js';

const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external';

export interface ShiprocketItem {
  name: string;
  sku: string;
  units: number;
  selling_price: number; // Net unit selling price in rupees (after line-item discount)
  discount?: number;
  tax?: number;
  hsn?: string;
}

export interface ShiprocketCreateOrderPayload {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  channelId?: string;
  pickupLocation?: string;
  billingCustomerName: string;
  billingLastName?: string;
  billingAddress: string;
  billingAddress2?: string;
  billingCity: string;
  billingPincode: string;
  billingState: string;
  billingCountry: string;
  billingEmail: string;
  billingPhone: string;
  shippingCustomerName: string;
  shippingLastName?: string;
  shippingAddress: string;
  shippingAddress2?: string;
  shippingCity: string;
  shippingPincode: string;
  shippingState: string;
  shippingCountry: string;
  shippingEmail: string;
  shippingPhone: string;
  orderItems: ShiprocketItem[];
  paymentMethod: 'Prepaid' | 'COD';
  subTotalRupees: number;
  totalDiscountRupees?: number;
  shippingChargesRupees?: number;
  lengthCm?: number;
  breadthCm?: number;
  heightCm?: number;
  weightKg?: number;
}

export interface ShiprocketTrackingActivity {
  date: string;
  status: string;
  activity: string;
  location: string;
}

export interface ShiprocketTrackingResult {
  awbCode: string;
  courierName: string;
  currentStatus: string;
  estimatedDeliveryDate: string | null;
  deliveredAt: string | null;
  activityHistory: ShiprocketTrackingActivity[];
}

export async function getShiprocketToken(
  kv: KVNamespace,
  email: string,
  password: string,
): Promise<string> {
  const cacheKey = `shiprocket:token:${email.toLowerCase()}`;

  try {
    const cached = await kv.get(cacheKey, 'text');
    if (cached) return cached;
  } catch {
    // KV read fail is non-fatal
  }

  const response = await fetch(`${SHIPROCKET_API_BASE}/auth/login`, {
    method: 'POST',
    signal: AbortSignal.timeout(GATEWAY_FETCH_TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Shiprocket auth failed (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as { token?: string };
  if (!data.token) {
    throw new Error('Shiprocket auth returned no token');
  }

  try {
    await kv.put(cacheKey, data.token, { expirationTtl: 23 * 3600 });
  } catch {
    // Non-fatal
  }

  return data.token;
}

export async function createShiprocketOrder(
  token: string,
  payload: ShiprocketCreateOrderPayload,
): Promise<{ shipmentId: number; orderId: number }> {
  const url = `${SHIPROCKET_API_BASE}/orders/create/adhoc`;

  const body = {
    order_id: payload.orderNumber,
    order_date: payload.orderDate,
    pickup_location: payload.pickupLocation || 'Primary',
    channel_id: payload.channelId || '',
    billing_customer_name: payload.billingCustomerName,
    billing_last_name: payload.billingLastName || '',
    billing_address: payload.billingAddress,
    billing_address_2: payload.billingAddress2 || '',
    billing_city: payload.billingCity,
    billing_pincode: payload.billingPincode,
    billing_state: payload.billingState,
    billing_country: payload.billingCountry || 'India',
    billing_email: payload.billingEmail,
    billing_phone: payload.billingPhone,
    shipping_is_billing: true,
    shipping_customer_name: payload.shippingCustomerName,
    shipping_last_name: payload.shippingLastName || '',
    shipping_address: payload.shippingAddress,
    shipping_address_2: payload.shippingAddress2 || '',
    shipping_city: payload.shippingCity,
    shipping_pincode: payload.shippingPincode,
    shipping_state: payload.shippingState,
    shipping_country: payload.shippingCountry || 'India',
    shipping_email: payload.shippingEmail,
    shipping_phone: payload.shippingPhone,
    order_items: payload.orderItems,
    payment_method: payload.paymentMethod,
    shipping_charges: payload.shippingChargesRupees ?? 0,
    total_discount: payload.totalDiscountRupees ?? 0,
    sub_total: payload.subTotalRupees,
    length: payload.lengthCm || 30,
    breadth: payload.breadthCm || 25,
    height: payload.heightCm || 5,
    weight: payload.weightKg || 0.5,
  };

  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(GATEWAY_FETCH_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Shiprocket createOrder failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    order_id: number;
    shipment_id: number;
    status: string;
  };

  if (!data.shipment_id) {
    throw new Error('Shiprocket order creation returned no shipment_id');
  }

  return {
    orderId: data.order_id,
    shipmentId: data.shipment_id,
  };
}

export async function assignShiprocketAWB(
  token: string,
  shipmentId: number,
  courierId?: number,
): Promise<{ awbCode: string; courierName: string }> {
  const url = `${SHIPROCKET_API_BASE}/courier/assign/awb`;
  const payload: Record<string, unknown> = { shipment_id: shipmentId };
  if (courierId) payload.courier_id = courierId;

  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(GATEWAY_FETCH_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Shiprocket assignAWB failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    response?: {
      data?: {
        awb_code?: string;
        courier_name?: string;
      };
    };
  };

  const awbCode = data.response?.data?.awb_code;
  const courierName = data.response?.data?.courier_name || 'Shiprocket Express';

  if (!awbCode) {
    throw new Error('Shiprocket AWB assignment returned no AWB code');
  }

  return { awbCode, courierName };
}

export async function generateShiprocketPickup(
  token: string,
  shipmentIds: number[],
): Promise<{ success: boolean; pickupStatus?: number }> {
  const url = `${SHIPROCKET_API_BASE}/courier/generate/pickup`;

  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(GATEWAY_FETCH_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ shipment_id: shipmentIds }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Shiprocket generatePickup failed (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as { pickup_status?: number; response?: { data?: string } };
  const isOk = data.pickup_status === 1;
  if (!isOk) {
    throw new Error(`Shiprocket pickup rejected (pickup_status=${data.pickup_status ?? 'unknown'})`);
  }
  return { success: true, pickupStatus: data.pickup_status };
}

export async function cancelShiprocketOrder(
  token: string,
  shiprocketOrderIds: number[],
): Promise<{ success: boolean }> {
  const url = `${SHIPROCKET_API_BASE}/orders/cancel`;
  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(GATEWAY_FETCH_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids: shiprocketOrderIds }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Shiprocket cancelOrder failed (${response.status}): ${errorBody}`);
  }
  return { success: true };
}

export async function trackShiprocketShipment(
  token: string,
  awbCode: string,
): Promise<ShiprocketTrackingResult> {
  const url = `${SHIPROCKET_API_BASE}/courier/track/awb/${encodeURIComponent(awbCode)}`;

  const response = await fetch(url, {
    method: 'GET',
    signal: AbortSignal.timeout(GATEWAY_FETCH_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Shiprocket trackShipment failed (${response.status}): ${errorBody}`);
  }

  const json = (await response.json()) as any;
  const trackingData = json?.tracking_data;
  const shipmentTrack = trackingData?.shipment_track?.[0] || {};
  const activities: ShiprocketTrackingActivity[] = (
    trackingData?.shipment_track_activities || []
  ).map((act: any) => ({
    date: act.date || '',
    status: act.status || '',
    activity: act.activity || '',
    location: act.location || '',
  }));

  return {
    awbCode,
    courierName: shipmentTrack.courier_name || 'Express Courier',
    currentStatus: shipmentTrack.current_status || 'IN_TRANSIT',
    estimatedDeliveryDate: shipmentTrack.edd || null,
    deliveredAt: shipmentTrack.delivered_date || null,
    activityHistory: activities,
  };
}

export async function checkShiprocketPincode(
  token: string,
  pickupPostcode: string,
  deliveryPostcode: string,
  weightKg = 0.5,
  isCod = false,
): Promise<{
  serviceable: boolean;
  courierName?: string;
  courierCompanyId?: number;
  estimatedDeliveryDays?: number;
}> {
  if (!/^\d{6}$/.test(pickupPostcode) || !/^\d{6}$/.test(deliveryPostcode)) {
    throw new Error('Both pickup and delivery pincodes must be 6-digit Indian pincodes');
  }

  const url = `${SHIPROCKET_API_BASE}/courier/serviceability/?pickup_postcode=${encodeURIComponent(
    pickupPostcode,
  )}&delivery_postcode=${encodeURIComponent(deliveryPostcode)}&weight=${weightKg}&cod=${isCod ? 1 : 0}`;

  const response = await fetch(url, {
    method: 'GET',
    signal: AbortSignal.timeout(GATEWAY_FETCH_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Shiprocket serviceability HTTP ${response.status}`);
  }

  const json = (await response.json()) as any;
  const recommendedCourier = json?.data?.available_courier_companies?.[0];

  if (!recommendedCourier) {
    return { serviceable: false };
  }

  return {
    serviceable: true,
    courierName: recommendedCourier.courier_name,
    courierCompanyId: recommendedCourier.courier_company_id,
    estimatedDeliveryDays: recommendedCourier.etd_hours
      ? Math.ceil(recommendedCourier.etd_hours / 24)
      : 3,
  };
}
