import type { Env } from '../types/bindings.d.ts';

// Type-safe env accessor with fallback defaults
export function getEnv(env: Env) {
  return {
    db: env.DB,
    kv: env.CATALOG_KV,
    r2: env.MEDIA_BUCKET,
    emailQueue: env.EMAIL_QUEUE,
    jwtSecret: env.JWT_SECRET,
    resendApiKey: env.RESEND_API_KEY,
    cashfreeAppId: env.CASHFREE_APP_ID,
    cashfreeSecretKey: env.CASHFREE_SECRET_KEY,
    adminEmails: env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) ?? [],
    frontendUrl: env.FRONTEND_URL ?? 'https://deynolddanny.com',
    adminUrl: env.ADMIN_URL ?? 'https://admin.deynolddanny.com',
    cashfreeApiUrl: env.CASHFREE_API_URL ?? 'https://api.cashfree.com/pg',
    cashfreeApiVersion: env.CASHFREE_API_VERSION ?? '2023-08-01',
    isProduction: env.ENVIRONMENT === 'production',
  } as const;
}

export type AppEnv = ReturnType<typeof getEnv>;
