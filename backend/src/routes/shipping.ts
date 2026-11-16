import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../types/bindings.js';
import { GATEWAY_FETCH_TIMEOUT_MS } from '../config/constants.js';
import { resolveStorePolicy } from '../config/policy.js';
import { checkD1RateLimit, createRateLimitResponse } from '../middleware/rateLimit.js';
import { checkShiprocketPincode, getShiprocketToken } from '../services/shiprocket.js';
import { nowIso } from '../db/client.js';

const shipping = new Hono<{ Bindings: Env }>();

const pincodeSchema = z.object({
  deliveryPincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
});

/**
 * POST /api/shipping/pincode-check
 * Public serviceability check backed by D1 cache & Shiprocket API (fail-closed unless configured).
 */
shipping.post('/pincode-check', zValidator('json', pincodeSchema), async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const rl = await checkD1RateLimit(c.env.DB, `pincode_ip:${ip}`, 30, 60);
  if (!rl.allowed) {
    return c.json(createRateLimitResponse(), 429);
  }

  const { deliveryPincode } = c.req.valid('json');
  const policy = resolveStorePolicy(c.env);

  const cached = await c.env.DB
    .prepare(`SELECT * FROM pincode_cache WHERE pincode = ?1`)
    .bind(deliveryPincode)
    .first<{ pincode: string; serviceable: number; courier_data: string | null; cached_at: string }>();

  if (cached) {
    const ageHours = (Date.now() - new Date(cached.cached_at).getTime()) / (1000 * 3600);
    if (ageHours < 24) {
      let courierData: any = {};
      try {
        courierData = cached.courier_data ? JSON.parse(cached.courier_data) : {};
      } catch {}
      return c.json({
        success: true,
        data: {
          pincode: deliveryPincode,
          serviceable: cached.serviceable === 1,
          courierName: courierData.courierName,
          estimatedDeliveryDays: courierData.estimatedDeliveryDays,
          cached: true,
        },
      });
    }
  }

  if (!policy.shiprocketPickupPincode || !c.env.SHIPROCKET_EMAIL || !c.env.SHIPROCKET_PASSWORD) {
    if (policy.courierFailOpen) {
      return c.json({
        success: true,
        data: {
          pincode: deliveryPincode,
          serviceable: true,
          courierName: 'Express Courier',
          estimatedDeliveryDays: 4,
          fallback: true,
        },
      });
    }
    return c.json(
      {
        success: false,
        error: {
          code: 'SERVICEABILITY_UNCONFIGURED',
          message: 'Courier origin warehouse pincode or Shiprocket credentials are not yet configured.',
          status: 503,
        },
      },
      503,
    );
  }

  try {
    const token = await getShiprocketToken(
      c.env.CATALOG_KV,
      c.env.SHIPROCKET_EMAIL,
      c.env.SHIPROCKET_PASSWORD,
    );
    const result = await checkShiprocketPincode(
      token,
      policy.shiprocketPickupPincode,
      deliveryPincode,
    );

    await c.env.DB
      .prepare(
        `INSERT OR REPLACE INTO pincode_cache (pincode, serviceable, courier_data, cached_at)
         VALUES (?1, ?2, ?3, ?4)`,
      )
      .bind(
        deliveryPincode,
        result.serviceable ? 1 : 0,
        JSON.stringify({
          courierName: result.courierName,
          estimatedDeliveryDays: result.estimatedDeliveryDays,
        }),
        nowIso(),
      )
      .run();

    return c.json({
      success: true,
      data: {
        pincode: deliveryPincode,
        serviceable: result.serviceable,
        courierName: result.courierName,
        estimatedDeliveryDays: result.estimatedDeliveryDays,
        cached: false,
      },
    });
  } catch (err) {
    if (policy.courierFailOpen) {
      return c.json({
        success: true,
        data: {
          pincode: deliveryPincode,
          serviceable: true,
          courierName: 'Standard Express',
          estimatedDeliveryDays: 4,
          fallback: true,
        },
      });
    }
    return c.json(
      {
        success: false,
        error: {
          code: 'COURIER_UNAVAILABLE',
          message: `Serviceability check temporarily unavailable: ${err instanceof Error ? err.message : 'timeout'}`,
          status: 502,
        },
      },
      502,
    );
  }
});

/**
 * GET /api/shipping/pincode-lookup?pincode=XXXXXX
 * BFF proxy to India Post lookup so browser doesn't expose client requests directly.
 */
shipping.get('/pincode-lookup', async (c) => {
  const pincode = (c.req.query('pincode') || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(pincode)) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid 6-digit pincode.', status: 400 } },
      400,
    );
  }

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      signal: AbortSignal.timeout(GATEWAY_FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return c.json({ success: true, data: { postOffices: [] } });
    }
    const json = (await res.json()) as any[];
    const postOffices =
      json?.[0]?.Status === 'Success' && Array.isArray(json?.[0]?.PostOffice)
        ? json[0].PostOffice.slice(0, 5).map((po: any) => ({
            name: po.Name,
            district: po.District,
            state: po.State,
            pincode: po.Pincode,
          }))
        : [];
    return c.json({ success: true, data: { postOffices } });
  } catch {
    return c.json({ success: true, data: { postOffices: [] } });
  }
});

/**
 * GET /api/shipping/address-search?q=... or ?lat=...&lon=...
 * BFF proxy for Nominatim/Photon geocoding with rate-limit & timeout safety.
 */
shipping.get('/address-search', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const rl = await checkD1RateLimit(c.env.DB, `addr_search:${ip}`, 30, 60);
  if (!rl.allowed) {
    return c.json(createRateLimitResponse(), 429);
  }

  const lat = c.req.query('lat');
  const lon = c.req.query('lon');
  const q = c.req.query('q')?.trim();
  const country = c.req.query('country')?.trim();

  if (lat && lon) {
    const latNum = Number(lat);
    const lonNum = Number(lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
      return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid coordinates.', status: 400 } }, 400);
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latNum}&lon=${lonNum}&addressdetails=1`,
        {
          signal: AbortSignal.timeout(GATEWAY_FETCH_TIMEOUT_MS),
          headers: { 'Accept-Language': 'en', 'User-Agent': 'DEYNOLD-DANNY-Storefront/1.0' },
        },
      );
      if (!res.ok) return c.json({ success: true, data: { result: null } });
      const data = await res.json();
      return c.json({ success: true, data: { result: data } });
    } catch {
      return c.json({ success: true, data: { result: null } });
    }
  }

  if (!q || q.length < 3) {
    return c.json({ success: true, data: { suggestions: [] } });
  }

  try {
    const countryCodeParam = country === 'India' ? '&countrycodes=in' : '';
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6${countryCodeParam}`,
      {
        signal: AbortSignal.timeout(GATEWAY_FETCH_TIMEOUT_MS),
        headers: { 'Accept-Language': 'en', 'User-Agent': 'DEYNOLD-DANNY-Storefront/1.0' },
      },
    );
    const suggestions = res.ok ? await res.json() : [];
    return c.json({ success: true, data: { suggestions } });
  } catch {
    return c.json({ success: true, data: { suggestions: [] } });
  }
});

export default shipping;
