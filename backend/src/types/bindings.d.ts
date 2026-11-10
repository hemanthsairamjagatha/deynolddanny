// Cloudflare Worker environment bindings & secrets
export interface Env {
  // Cloudflare Bindings
  DB: D1Database;
  CATALOG_KV: KVNamespace;        // KV namespace for catalog read-cache only
  MEDIA_BUCKET?: R2Bucket;        // R2 bucket for product images (optional until enabled in dashboard)
  EMAIL_QUEUE?: Queue;            // Queue for email jobs (optional, ctx.waitUntil used as primary fallback)

  // Env vars
  ENVIRONMENT: 'development' | 'production';
  FRONTEND_URL: string;           // e.g. https://deynolddanny.com
  BACKEND_URL: string;            // e.g. https://api.deynolddanny.com
  ADMIN_URL: string;              // e.g. https://admin.deynolddanny.com
  MEDIA_BUCKET_PUBLIC_URL: string; // e.g. https://media.deynolddanny.com
  CASHFREE_API_URL: string;       // https://sandbox.cashfree.com/pg or https://api.cashfree.com/pg
  CASHFREE_API_VERSION: string;   // e.g. 2023-08-01

  // Secrets (set via wrangler secret put)
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  CASHFREE_APP_ID: string;
  CASHFREE_SECRET_KEY: string;
  ADMIN_EMAILS: string;           // comma-separated list of admin email addresses
}
