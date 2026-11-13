/**
 * DEYNOLD DANNY — Shiprocket Logistics & Courier Integration
 *
 * Implements authentication (with KV caching), order creation, AWB generation,
 * pickup requests, live tracking, and pincode serviceability checks.
 */

const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external';

export interface ShiprocketItem {
  name: string;
  sku: string;
  units: number;
  selling_price: number; // in rupees
  discount?: number;
  tax?: number;
}

export interface ShiprocketCreateOrderPayload {
  orderId: string;          // Our internal DB order ID
  orderNumber: string;      // e.g. "DD-102938"
  orderDate: string;        // "YYYY-MM-DD HH:mm"
  channelId?: string;       // Custom channel ID if configured
  pickupLocation?: string;  // Default 'Primary'
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
  lengthCm?: number;        // default 30
  breadthCm?: number;       // default 25
  heightCm?: number;        // default 5
  weightKg?: number;        // default 0.5
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

/**
 * Retrieves Shiprocket authentication token, cached in KV for 23 hours
 */
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
    // KV read fail is non-fatal: proceed to fresh auth
  }

  const response = await fetch(`${SHIPROCKET_API_BASE}/auth/login`, {
    method: 'POST',
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
    // Cache for 23 hours (tokens expire after 24h)
    await kv.put(cacheKey, data.token, { expirationTtl: 23 * 3600 });
  } catch {
    // Non-fatal
  }

  return data.token;
}

/**
 * Creates an order on Shiprocket
 */
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
    sub_total: payload.subTotalRupees,
    length: payload.lengthCm || 30,
    breadth: payload.breadthCm || 25,
    height: payload.heightCm || 5,
    weight: payload.weightKg || 0.5,
  };

  const response = await fetch(url, {
    method: 'POST',
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
    status_code?: number;
  };

  if (!data.shipment_id) {
    throw new Error('Shiprocket order creation returned no shipment_id');
  }

  return {
    orderId: data.order_id,
    shipmentId: data.shipment_id,
  };
}

/**
 * Assigns AWB code to an existing shipment
 */
export async function assignShiprocketAWB(
  token: string,
  shipmentId: number,
  courierId?: number,
): Promise<{ awbCode: string; courierName: string }> {
  const url = `${SHIPROCKET_API_BASE}/courier/assign/awb`;

  const payload: Record<string, unknown> = {
    shipment_id: shipmentId,
  };
  if (courierId) {
    payload.courier_id = courierId;
  }

  const response = await fetch(url, {
    method: 'POST',
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
    awb_assign_status?: number;
  };

  const awbCode = data.response?.data?.awb_code;
  const courierName = data.response?.data?.courier_name || 'Shiprocket Express';

  if (!awbCode) {
    throw new Error('Shiprocket AWB assignment returned no AWB code');
  }

  return { awbCode, courierName };
}

/**
 * Schedules a courier pickup request for the shipment
 */
export async function generateShiprocketPickup(
  token: string,
  shipmentIds: number[],
): Promise<{ success: boolean; pickupStatus?: number }> {
  const url = `${SHIPROCKET_API_BASE}/courier/generate/pickup`;

  const response = await fetch(url, {
    method: 'POST',
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

  const data = (await response.json()) as { pickup_status?: number };
  return { success: true, pickupStatus: data.pickup_status };
}

/**
 * Tracks shipment by AWB code
 */
export async function trackShiprocketShipment(
  token: string,
  awbCode: string,
): Promise<ShiprocketTrackingResult> {
  const url = `${SHIPROCKET_API_BASE}/courier/track/awb/${encodeURIComponent(awbCode)}`;

  const response = await fetch(url, {
    method: 'GET',
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
  const trackUrl = trackingData?.track_url;
  const shipmentTrack = trackingData?.shipment_track?.[0] || {};
  const activities: ShiprocketTrackingActivity[] = (trackingData?.shipment_track_activities || []).map((act: any) => ({
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

/**
 * Checks delivery pincode serviceability and estimated delivery
 */
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
  const url = `${SHIPROCKET_API_BASE}/courier/serviceability/?pickup_postcode=${encodeURIComponent(
    pickupPostcode,
  )}&delivery_postcode=${encodeURIComponent(deliveryPostcode)}&weight=${weightKg}&cod=${isCod ? 1 : 0}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return { serviceable: false };
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
    estimatedDeliveryDays: recommendedCourier.etd_hours ? Math.ceil(recommendedCourier.etd_hours / 24) : 3,
  };
}
