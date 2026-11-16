// Cloudflare Worker environment bindings & secrets
export interface Env {
  // Cloudflare Bindings
  DB: D1Database;
  CATALOG_KV: KVNamespace;        // KV namespace for catalog read-cache and ephemeral courier auth tokens
  MEDIA_BUCKET?: R2Bucket;        // R2 bucket for product images
  EMAIL_QUEUE?: Queue;            // Optional Queue for email jobs

  // Core Env vars
  ENVIRONMENT: 'development' | 'staging' | 'production';
  FRONTEND_URL: string;           // e.g. https://deynolddanny.com or http://localhost:4321
  BACKEND_URL: string;            // e.g. https://api.deynolddanny.com or http://127.0.0.1:8787
  ADMIN_URL: string;              // e.g. https://admin.deynolddanny.com
  ALLOWED_ORIGINS?: string;       // Comma-separated extra exact CORS origins (never wildcards)
  MEDIA_BUCKET_PUBLIC_URL: string; // e.g. https://media.deynolddanny.com

  // Configurable Business / Statutory / Provider Policy Vars (BD-03..BD-13)
  FREE_SHIPPING_THRESHOLD_PAISE?: string;
  STANDARD_SHIPPING_PAISE?: string;
  DEFAULT_GST_RATE_BPS?: string;
  TAX_INCLUSIVE?: string;
  ENABLE_TEST_CHECKOUT_FALLBACK?: string;
  AUTO_REFUND_DUPLICATE_CAPTURE?: string;
  COURIER_FAIL_OPEN?: string;
  SINGLE_USE_COUPONS_PER_USER?: string;
  RETURN_WINDOW_DAYS?: string;
  PAYMENT_UPI_MAX_PAISE?: string;
  PAN_VERIFICATION_THRESHOLD_PAISE?: string;
  EWAY_BILL_THRESHOLD_PAISE?: string;
  INVOICE_RETENTION_YEARS?: string;

  // Razorpay Payments (Primary Gateway)
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;

  // Shiprocket Logistics & Courier Aggregator
  SHIPROCKET_EMAIL: string;
  SHIPROCKET_PASSWORD: string;
  SHIPROCKET_CHANNEL_ID?: string;
  SHIPROCKET_PICKUP_PINCODE?: string;
  SHIPROCKET_WEBHOOK_TOKEN?: string;

  // Cashfree (Optional Legacy Fallback)
  CASHFREE_API_URL?: string;
  CASHFREE_API_VERSION?: string;
  CASHFREE_APP_ID?: string;
  CASHFREE_SECRET_KEY?: string;

  // Auth, Privacy & Communication Secrets (set via wrangler secret put)
  JWT_SECRET: string;
  JWT_SECRET_PREV?: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL?: string;
  ADMIN_EMAILS: string;
  CLOUDFLARE_ACCESS_AUD?: string;
  CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string;
}
