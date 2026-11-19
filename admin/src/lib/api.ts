import type { ApiResponse, BrandSettings, CmsPage, CmsSection, MediaAsset, MediaFolder, Product, Coupon, NavMenu } from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

let _accessToken: string | null = null;
export function setAccessToken(t: string | null) { _accessToken = t; }
export function getAccessToken() { return _accessToken; }

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const isFormData = init.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(init.headers as Record<string, string> ?? {}),
  };
  if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;

  let res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' });

  if (res.status === 401 && path !== '/api/auth/refresh') {
    const rr = await fetch(`${BASE}/api/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (rr.ok) {
      const rd = await rr.json() as ApiResponse<{ accessToken: string }>;
      if (rd.success && rd.data?.accessToken) {
        _accessToken = rd.data.accessToken;
        headers['Authorization'] = `Bearer ${_accessToken}`;
        res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' });
      }
    } else { _accessToken = null; }
  }
  return res.json() as Promise<ApiResponse<T>>;
}

const get = <T>(p: string) => request<T>(p);
const post = <T>(p: string, b?: unknown) => request<T>(p, { method: 'POST', body: b !== undefined ? JSON.stringify(b) : undefined });
const patch = <T>(p: string, b?: unknown) => request<T>(p, { method: 'PATCH', body: b !== undefined ? JSON.stringify(b) : undefined });
const del = <T>(p: string) => request<T>(p, { method: 'DELETE' });
const put = <T>(p: string, b?: unknown) => request<T>(p, { method: 'PUT', body: b !== undefined ? JSON.stringify(b) : undefined });

function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const auth = {
  requestOtp: (email: string) => post('/api/auth/sign-in', { email }),
  verifyOtp: (email: string, otp: string) => post<{ accessToken: string; mfaRequired?: boolean }>('/api/auth/verify-otp', { email, otp }),
  verifyMfa: (code: string) => post<{ accessToken: string }>('/api/auth/mfa/verify', { code }),
  refresh: () => post<{ accessToken: string }>('/api/auth/refresh'),
  logout: () => post('/api/auth/logout'),
  me: () => get<{ id: string; email: string; name: string | null; role: string; permissions: string[]; mfaEnabled: boolean }>('/api/auth/session'),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboard = {
  get: (days = 30) => get<Record<string, unknown>>(`/api/admin/dashboard?days=${days}`),
};

// ─── Brand ────────────────────────────────────────────────────────────────────
export const brand = {
  get: () => get<BrandSettings>('/api/admin/brand'),
  update: (d: Partial<BrandSettings>) => patch<BrandSettings>('/api/admin/brand', d),
  publish: () => post<void>('/api/admin/brand/publish'),
  revisions: () => get<Record<string, unknown>[]>('/api/admin/brand/revisions'),
  restore: (revId: string) => post<BrandSettings>(`/api/admin/brand/revisions/${revId}/restore`),
};

// ─── CMS ──────────────────────────────────────────────────────────────────────
export const cms = {
  pages: {
    list: () => get<CmsPage[]>('/api/admin/cms/pages'),
    get: (id: string) => get<CmsPage>(`/api/admin/cms/pages/${id}`),
    create: (d: Partial<CmsPage>) => post<CmsPage>('/api/admin/cms/pages', d),
    update: (id: string, d: Partial<CmsPage>) => patch<CmsPage>(`/api/admin/cms/pages/${id}`, d),
    delete: (id: string) => del<void>(`/api/admin/cms/pages/${id}`),
    publish: (id: string) => post<void>(`/api/admin/cms/pages/${id}/publish`),
    previewToken: (id: string) => post<{ token: string; url: string }>(`/api/admin/cms/pages/${id}/preview-token`),
    revisions: (id: string) => get<Record<string, unknown>[]>(`/api/admin/cms/pages/${id}/revisions`),
    restore: (pid: string, rid: string) => post<void>(`/api/admin/cms/pages/${pid}/revisions/${rid}/restore`),
  },
  sections: {
    add: (pid: string, d: Partial<CmsSection>) => post<CmsSection>(`/api/admin/cms/pages/${pid}/sections`, d),
    update: (pid: string, sid: string, d: Partial<CmsSection>) => patch<CmsSection>(`/api/admin/cms/pages/${pid}/sections/${sid}`, d),
    delete: (pid: string, sid: string) => del<void>(`/api/admin/cms/pages/${pid}/sections/${sid}`),
    duplicate: (pid: string, sid: string) => post<CmsSection>(`/api/admin/cms/pages/${pid}/sections/${sid}/duplicate`),
    reorder: (pid: string, ids: string[]) => post<void>(`/api/admin/cms/pages/${pid}/sections/reorder`, { orderedIds: ids }),
  },
};

// ─── Navigation ───────────────────────────────────────────────────────────────
export const navigation = {
  list: () => get<NavMenu[]>('/api/admin/navigation'),
  update: (key: string, items: unknown) => patch<void>(`/api/admin/navigation/${key}`, { items }),
  publish: (key: string) => post<void>(`/api/admin/navigation/${key}/publish`),
};

// ─── Media ────────────────────────────────────────────────────────────────────
export const media = {
  list: (folderId?: string, search?: string) =>
    get<{ assets: MediaAsset[]; folders: MediaFolder[] }>(`/api/admin/media/library${qs({ folder_id: folderId, search })}`),
  createFolder: (name: string, parentId?: string) => post<MediaFolder>('/api/admin/media/library/folders', { name, parent_id: parentId }),
  upload: (formData: FormData) => request<MediaAsset>('/api/admin/media/library/upload', { method: 'POST', body: formData }),
  update: (id: string, d: { alt_text?: string; focal_x?: number; focal_y?: number }) => patch<MediaAsset>(`/api/admin/media/library/${id}`, d),
  delete: (id: string) => del<void>(`/api/admin/media/library/${id}`),
};

// ─── Products ─────────────────────────────────────────────────────────────────
export const products = {
  list: (p?: { search?: string; status?: string; category?: string; page?: number }) =>
    get<{ items: Product[]; total: number }>(`/api/admin/products${qs(p)}`),
  get: (id: string) => get<Product>(`/api/admin/products/${id}`),
  create: (d: Partial<Product>) => post<Product>('/api/admin/products', d),
  update: (id: string, d: Partial<Product>) => patch<Product>(`/api/admin/products/${id}`, d),
  archive: (id: string) => post<void>(`/api/admin/products/${id}/archive`),
  restore: (id: string) => post<void>(`/api/admin/products/${id}/restore`),
  duplicate: (id: string) => post<Product>(`/api/admin/products/${id}/duplicate`),
  updateImages: (id: string, images: string[]) => put<void>(`/api/admin/products/${id}/images`, { images }),
  updateCrossSells: (id: string, ids: string[]) => put<void>(`/api/admin/products/${id}/cross-sells`, { ids }),
  variants: {
    create: (pid: string, d: unknown) => post<unknown>(`/api/admin/products/${pid}/variants`, d),
    update: (pid: string, vid: string, d: unknown) => patch<unknown>(`/api/admin/products/${pid}/variants/${vid}`, d),
    delete: (pid: string, vid: string) => del<void>(`/api/admin/products/${pid}/variants/${vid}`),
  },
};

// ─── Categories ───────────────────────────────────────────────────────────────
export const categories = {
  list: () => get<Record<string, unknown>[]>('/api/admin/categories'),
  get: (id: string) => get<Record<string, unknown>>(`/api/admin/categories/${id}`),
  create: (d: unknown) => post<Record<string, unknown>>('/api/admin/categories', d),
  update: (id: string, d: unknown) => patch<Record<string, unknown>>(`/api/admin/categories/${id}`, d),
  delete: (id: string) => del<void>(`/api/admin/categories/${id}`),
};

// ─── Collections ─────────────────────────────────────────────────────────────
export const collections = {
  list: () => get<Record<string, unknown>[]>('/api/admin/collections'),
  get: (id: string) => get<Record<string, unknown>>(`/api/admin/collections/${id}`),
  create: (d: unknown) => post<Record<string, unknown>>('/api/admin/collections', d),
  update: (id: string, d: unknown) => patch<Record<string, unknown>>(`/api/admin/collections/${id}`, d),
  delete: (id: string) => del<void>(`/api/admin/collections/${id}`),
  assignProducts: (id: string, productIds: string[]) => put<void>(`/api/admin/collections/${id}/products`, { productIds }),
};

// ─── Inventory ────────────────────────────────────────────────────────────────
export const inventory = {
  matrix: () => get<Record<string, unknown>>('/api/admin/inventory'),
  lowStock: () => get<Record<string, unknown>>('/api/admin/inventory/low-stock'),
  movements: (variantId?: string) => get<Record<string, unknown>>(`/api/admin/inventory/movements${qs({ variant_id: variantId })}`),
  adjust: (variantId: string, delta: number, reason: string) => patch<void>(`/api/admin/inventory/${variantId}`, { delta, reason }),
};

// ─── Orders ───────────────────────────────────────────────────────────────────
export const orders = {
  list: (p?: { status?: string; page?: number; search?: string }) => get<Record<string, unknown>>(`/api/admin/orders${qs(p)}`),
  get: (id: string) => get<Record<string, unknown>>(`/api/admin/orders/${id}`),
  updateStatus: (id: string, status: string, awbCode?: string) => patch<void>(`/api/admin/orders/${id}/status`, { status, awbCode }),
  cancel: (id: string, reason: string) => post<void>(`/api/admin/orders/${id}/cancel`, { reason }),
  refund: (id: string, amountPaise: number, reason: string) => post<void>(`/api/admin/orders/${id}/refund`, { amountPaise, reason }),
};

// ─── Customers ────────────────────────────────────────────────────────────────
export const customers = {
  list: (p?: { search?: string; page?: number }) => get<Record<string, unknown>>(`/api/admin/customers${qs(p)}`),
  get: (id: string) => get<Record<string, unknown>>(`/api/admin/customers/${id}`),
};

// ─── Returns ──────────────────────────────────────────────────────────────────
export const returns = {
  list: (status?: string) => get<Record<string, unknown>>(`/api/admin/returns${qs({ status })}`),
  get: (id: string) => get<Record<string, unknown>>(`/api/admin/returns/${id}`),
  review: (id: string, action: 'approve' | 'reject' | 'complete', note?: string, restock?: boolean) =>
    patch<void>(`/api/admin/returns/${id}`, { action, note, restock }),
};

// ─── Disputes ─────────────────────────────────────────────────────────────────
export const disputes = {
  list: (status?: string) => get<Record<string, unknown>>(`/api/admin/disputes${qs({ status })}`),
  resolve: (id: string, resolution: string, refundPaise?: number) => patch<void>(`/api/admin/disputes/${id}`, { resolution, refundPaise }),
};

// ─── Payments ─────────────────────────────────────────────────────────────────
export const payments = {
  attempts: (orderId?: string) => get<Record<string, unknown>>(`/api/admin/payments/attempts${qs({ order_id: orderId })}`),
  refunds: () => get<Record<string, unknown>>('/api/admin/payments/refunds'),
  stats: () => get<Record<string, unknown>>('/api/admin/payments/stats'),
};

// ─── Reviews ──────────────────────────────────────────────────────────────────
export const reviews = {
  list: (status?: string) => get<Record<string, unknown>>(`/api/admin/reviews${qs({ status })}`),
  moderate: (id: string, status: 'approved' | 'rejected') => patch<void>(`/api/admin/reviews/${id}`, { status }),
  feature: (id: string, featured: boolean) => patch<void>(`/api/admin/reviews/${id}`, { is_featured: featured }),
  reply: (id: string, reply: string) => patch<void>(`/api/admin/reviews/${id}`, { admin_reply: reply }),
  delete: (id: string) => del<void>(`/api/admin/reviews/${id}`),
};

// ─── Coupons ──────────────────────────────────────────────────────────────────
export const coupons = {
  list: () => get<Record<string, unknown>>('/api/admin/coupons'),
  get: (id: string) => get<Record<string, unknown>>(`/api/admin/coupons/${id}`),
  create: (d: Partial<Coupon>) => post<Coupon>('/api/admin/coupons', d),
  update: (id: string, d: Partial<Coupon>) => patch<Coupon>(`/api/admin/coupons/${id}`, d),
  delete: (id: string) => del<void>(`/api/admin/coupons/${id}`),
};

// ─── Inquiries ────────────────────────────────────────────────────────────────
export const inquiries = {
  list: (status?: string) => get<Record<string, unknown>>(`/api/admin/inquiries${qs({ status })}`),
  get: (id: string) => get<Record<string, unknown>>(`/api/admin/inquiries/${id}`),
  update: (id: string, d: { status?: string; internal_note?: string }) => patch<void>(`/api/admin/inquiries/${id}`, d),
  reply: (id: string, body: string) => post<void>(`/api/admin/inquiries/${id}/reply`, { body }),
};

// ─── Size Guides ──────────────────────────────────────────────────────────────
export const sizeGuides = {
  list: () => get<Record<string, unknown>[]>('/api/admin/size-guides'),
  get: (id: string) => get<Record<string, unknown>>(`/api/admin/size-guides/${id}`),
  create: (d: unknown) => post<Record<string, unknown>>('/api/admin/size-guides', d),
  update: (id: string, d: unknown) => patch<Record<string, unknown>>(`/api/admin/size-guides/${id}`, d),
  delete: (id: string) => del<void>(`/api/admin/size-guides/${id}`),
};

// ─── Templates ────────────────────────────────────────────────────────────────
export const templates = {
  list: () => get<Record<string, unknown>>('/api/admin/templates'),
  get: (id: string) => get<Record<string, unknown>>(`/api/admin/templates/${id}`),
  update: (id: string, d: { subject?: string; html_body?: string; variables_doc?: string }) =>
    patch<Record<string, unknown>>(`/api/admin/templates/${id}`, d),
  testSend: (id: string, toEmail: string, vars: Record<string, string>) =>
    post<void>(`/api/admin/templates/${id}/test-send`, { toEmail, vars }),
  outbox: (page?: number) => get<Record<string, unknown>>(`/api/admin/templates/outbox${qs({ page })}`),
};

// ─── SEO ──────────────────────────────────────────────────────────────────────
export const seo = {
  redirects: {
    list: () => get<Record<string, unknown>>('/api/admin/seo/redirects'),
    create: (d: { source_path: string; target_path: string; status_code?: number; note?: string }) =>
      post<Record<string, unknown>>('/api/admin/seo/redirects', d),
    update: (id: string, d: unknown) => patch<void>(`/api/admin/seo/redirects/${id}`, d),
    delete: (id: string) => del<void>(`/api/admin/seo/redirects/${id}`),
  },
};

// ─── Settings ─────────────────────────────────────────────────────────────────
export const settings = {
  get: () => get<Record<string, unknown>>('/api/admin/settings'),
  update: (d: Record<string, unknown>) => patch<Record<string, unknown>>('/api/admin/settings', d),
  flushCache: () => post<void>('/api/admin/settings/cache/flush'),
};

// ─── Security ─────────────────────────────────────────────────────────────────
export const security = {
  staff: {
    list: () => get<Record<string, unknown>>('/api/admin/security/staff'),
    invite: (d: { email: string; name: string; roleId: string }) => post<Record<string, unknown>>('/api/admin/security/staff', d),
    updateRole: (uid: string, roleId: string) => patch<void>(`/api/admin/security/staff/${uid}/role`, { roleId }),
    deactivate: (uid: string) => del<void>(`/api/admin/security/staff/${uid}`),
  },
  mfa: {
    status: () => get<{ enabled: boolean; verified: boolean }>('/api/admin/security/mfa/status'),
    setup: () => post<{ secret: string; uri: string; qrDataUrl: string }>('/api/admin/security/mfa/setup'),
    enable: (code: string) => post<{ backupCodes: string[] }>('/api/admin/security/mfa/enable', { code }),
    disable: (code: string) => post<void>('/api/admin/security/mfa/disable', { code }),
  },
  sessions: {
    list: () => get<Record<string, unknown>>('/api/admin/security/sessions'),
    revoke: (jti: string) => del<void>(`/api/admin/security/sessions/${jti}`),
    revokeAll: () => del<void>('/api/admin/security/sessions'),
  },
  auditLogs: (p?: { action?: string; page?: number }) =>
    get<Record<string, unknown>>(`/api/admin/security/audit-logs${qs(p)}`),
};

// ─── Analytics ────────────────────────────────────────────────────────────────
export const analytics = {
  dashboard: (days = 30) => get<Record<string, unknown>>(`/api/admin/analytics/dashboard?days=${days}`),
  events: (p?: { event_type?: string; limit?: number }) =>
    get<Record<string, unknown>>(`/api/admin/analytics/events${qs(p)}`),
};
