import type { Env } from '../types/bindings.js';
import {
  DEFAULT_GST_RATE_BPS,
  FREE_SHIPPING_THRESHOLD_PAISE,
  STANDARD_SHIPPING_PAISE,
} from './constants.js';

function parseOptionalInt(val: string | undefined, fallback: number): number {
  if (val === undefined || val === '') return fallback;
  const n = Number(val);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

function parseOptionalPositiveInt(val: string | undefined): number | null {
  if (!val) return null;
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseBool(val: string | undefined, fallback: boolean): boolean {
  if (val === undefined || val === '') return fallback;
  return val.toLowerCase() === 'true';
}

export interface StorePolicy {
  environment: 'development' | 'staging' | 'production';
  isProductionLike: boolean;
  freeShippingThresholdPaise: number;
  standardShippingPaise: number;
  defaultGstRateBps: number;
  taxInclusive: boolean;
  allowTestCheckoutFallback: boolean;
  autoRefundDuplicateCapture: boolean;
  courierFailOpen: boolean;
  singleUseCouponsPerUser: boolean;
  returnWindowDays: number;
  upiMaxPaise: number | null;
  panVerificationThresholdPaise: number | null;
  ewayBillThresholdPaise: number | null;
  invoiceRetentionYears: number | null;
  shiprocketPickupPincode: string | null;
}

/**
 * Resolves configurable runtime store policy from Worker environment variables.
 * Any statutory, tax, provider cap, or courier default awaiting external confirmation
 * remains safely disabled or non-hardcoded unless explicitly set in Env.
 */
export function resolveStorePolicy(env: Env): StorePolicy {
  const environment = (env.ENVIRONMENT || 'production') as StorePolicy['environment'];
  const isProductionLike = environment === 'production' || environment === 'staging';
  const rawPickup = (env.SHIPROCKET_PICKUP_PINCODE || '').replace(/\D/g, '');
  const shiprocketPickupPincode = /^\d{6}$/.test(rawPickup) ? rawPickup : null;

  return {
    environment,
    isProductionLike,
    freeShippingThresholdPaise: parseOptionalInt(
      env.FREE_SHIPPING_THRESHOLD_PAISE,
      FREE_SHIPPING_THRESHOLD_PAISE,
    ),
    standardShippingPaise: parseOptionalInt(
      env.STANDARD_SHIPPING_PAISE,
      STANDARD_SHIPPING_PAISE,
    ),
    defaultGstRateBps: parseOptionalInt(env.DEFAULT_GST_RATE_BPS, DEFAULT_GST_RATE_BPS),
    taxInclusive: parseBool(env.TAX_INCLUSIVE, true),
    // Never permit mock/test gateway auto-paid confirmation in staging or production
    allowTestCheckoutFallback:
      !isProductionLike && parseBool(env.ENABLE_TEST_CHECKOUT_FALLBACK, false),
    autoRefundDuplicateCapture: parseBool(env.AUTO_REFUND_DUPLICATE_CAPTURE, false),
    courierFailOpen: parseBool(env.COURIER_FAIL_OPEN, false),
    singleUseCouponsPerUser: parseBool(env.SINGLE_USE_COUPONS_PER_USER, true),
    returnWindowDays: Math.max(0, parseOptionalInt(env.RETURN_WINDOW_DAYS, 14)),
    upiMaxPaise: parseOptionalPositiveInt(env.PAYMENT_UPI_MAX_PAISE),
    panVerificationThresholdPaise: parseOptionalPositiveInt(env.PAN_VERIFICATION_THRESHOLD_PAISE),
    ewayBillThresholdPaise: parseOptionalPositiveInt(env.EWAY_BILL_THRESHOLD_PAISE),
    invoiceRetentionYears: parseOptionalPositiveInt(env.INVOICE_RETENTION_YEARS),
    shiprocketPickupPincode,
  };
}

/**
 * Validates that production/staging Workers are never accidentally deployed with
 * placeholder credentials or insecure fallback values.
 */
export function assertSafeRuntimeSecrets(env: Env): string[] {
  const issues: string[] = [];
  const environment = env.ENVIRONMENT || 'production';
  if (environment === 'development') return issues;

  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || env.JWT_SECRET.includes('replace')) {
    issues.push('JWT_SECRET missing or insecure');
  }
  if (env.RAZORPAY_KEY_ID?.includes('placeholder')) {
    issues.push('RAZORPAY_KEY_ID contains placeholder value');
  }
  if (env.MEDIA_BUCKET_PUBLIC_URL?.includes('localhost')) {
    issues.push('MEDIA_BUCKET_PUBLIC_URL points to localhost');
  }
  if (!env.FRONTEND_URL || env.FRONTEND_URL.includes('localhost')) {
    issues.push('FRONTEND_URL invalid for non-dev runtime');
  }
  if (env.ENABLE_TEST_CHECKOUT_FALLBACK === 'true') {
    issues.push('ENABLE_TEST_CHECKOUT_FALLBACK must never be true in staging/production');
  }

  return issues;
}
