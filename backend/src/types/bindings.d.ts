// Cloudflare Worker environment bindings & secrets
export interface Env {
  // Cloudflare Bindings
  DB: D1Database;
  CATALOG_KV: KVNamespace;        // KV namespace for catalog read-cache and ephemeral tokens
  MEDIA_BUCKET?: R2Bucket;        // R2 bucket for product images (optional until enabled in dashboard)
  EMAIL_QUEUE?: Queue;            // Queue for email jobs (optional, ctx.waitUntil used as primary fallback)

  // Core Env vars
  ENVIRONMENT: 'development' | 'production';
  FRONTEND_URL: string;           // e.g. https://deynolddanny.com or http://localhost:4321
  BACKEND_URL: string;            // e.g. https://api.deynolddanny.com or http://localhost:8787
  ADMIN_URL: string;              // e.g. https://admin.deynolddanny.com
  MEDIA_BUCKET_PUBLIC_URL: string; // e.g. https://media.deynolddanny.com

  // Razorpay Payments (Primary Gateway)
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;

  // Shiprocket Logistics & Courier Aggregator
  SHIPROCKET_EMAIL: string;
  SHIPROCKET_PASSWORD: string;
  SHIPROCKET_CHANNEL_ID?: string;
  SHIPROCKET_PICKUP_PINCODE?: string; // Origin warehouse pincode (default '400001')

  // Cashfree (Optional / Legacy Fallback)
  CASHFREE_API_URL?: string;
  CASHFREE_API_VERSION?: string;
  CASHFREE_APP_ID?: string;
  CASHFREE_SECRET_KEY?: string;

  // Auth & Communication Secrets (set via wrangler secret put)
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  ADMIN_EMAILS: string;           // comma-separated list of admin email addresses
}
