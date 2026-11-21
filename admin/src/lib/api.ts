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
      const rd = (await rr.json().catch(() => ({}))) as ApiResponse<{ accessToken: string }>;
      if (rd.success && rd.data?.accessToken) {
        _accessToken = rd.data.accessToken;
        headers['Authorization'] = `Bearer ${_accessToken}`;
        res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' });
      }
    } else {
      _accessToken = null;
    }
  }

  const text = await res.text();
  if (!text) {
    return (
      res.ok
        ? { success: true }
        : { success: false, error: { code: `HTTP_${res.status}`, message: res.statusText || 'Request failed.', status: res.status } }
    ) as ApiResponse<T>;
  }
  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return {
      success: false,
      error: {
        code: `HTTP_${res.status}`,
        message: res.status === 413 ? 'File is too large for upload.' : `Server error (${res.status}): ${res.statusText || 'Unexpected response'}`,
        status: res.status,
      },
    };
  }
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
  requestOtp: (email: string) => post('/api/auth/send-otp', { email }),
  verifyOtp: (email: string, otp: string) =>
    post<{ accessToken: string; mfaRequired?: boolean; user?: Record<string, unknown> }>('/api/auth/verify-otp', { email, otp }),
  verifyMfa: (code: string) => post<{ accessToken: string }>('/api/auth/admin/mfa/verify', { code }),
  refresh: () => post<{ accessToken: string }>('/api/auth/refresh'),
  logout: () => post('/api/auth/logout'),
  me: () =>
    get<{
      user?: {
        id: string;
        email: string;
        fullName?: string | null;
        role: string;
        adminAccess?: {
          roleSlug: string;
          permissions: string[];
          mfaEnabled: boolean;
          mfaSetupRequired?: boolean;
        };
      };
      id?: string;
      email?: string;
      name?: string | null;
      role?: string;
      permissions?: string[];
      mfaEnabled?: boolean;
    }>('/api/auth/me'),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboard = {
  get: (days = 30) => get<Record<string, unknown>>(`/api/admin/dashboard?days=${days}`),
};

// ─── Brand ────────────────────────────────────────────────────────────────────
export const brand = {
  get: () => get<Record<string, unknown>>('/api/admin/brand'),
  update: (d: Record<string, unknown>) => patch<Record<string, unknown>>('/api/admin/brand/draft', d),
  publish: () => post<Record<string, unknown>>('/api/admin/brand/publish'),
  revisions: () => get<{ items: Record<string, unknown>[] } | Record<string, unknown>[]>('/api/admin/brand/revisions'),
  restore: (revId: string) => post<Record<string, unknown>>(`/api/admin/brand/revisions/${revId}/restore`),
};

// ─── CMS ──────────────────────────────────────────────────────────────────────
export const cms = {
  pages: {
    list: () => get<{ items: Record<string, unknown>[] } | CmsPage[]>('/api/admin/cms/pages'),
    get: (id: string) => get<{ page: Record<string, unknown>; sections: Record<string, unknown>[] }>(`/api/admin/cms/pages/${id}`),
    create: (d: Record<string, unknown>) => post<Record<string, unknown>>('/api/admin/cms/pages', d),
    update: (id: string, d: Record<string, unknown>) => patch<Record<string, unknown>>(`/api/admin/cms/pages/${id}`, d),
    delete: (id: string) => del<void>(`/api/admin/cms/pages/${id}`),
    publish: (id: string) => post<{ publishedAt: string; status: string }>(`/api/admin/cms/pages/${id}/publish`),
    previewToken: (id: string) => post<{ token: string; previewPath: string; url?: string }>(`/api/admin/cms/pages/${id}/preview-token`),
    revisions: (id: string) => get<{ items: Record<string, unknown>[] } | Record<string, unknown>[]>(`/api/admin/cms/pages/${id}/revisions`),
    restore: (_pid: string, rid: string) => post<void>(`/api/admin/cms/revisions/${rid}/restore`),
  },
  sections: {
    add: (pid: string, d: Record<string, unknown>) => post<Record<string, unknown>>(`/api/admin/cms/pages/${pid}/sections`, d),
    update: (_pid: string, sid: string, d: Record<string, unknown>) => patch<Record<string, unknown>>(`/api/admin/cms/sections/${sid}`, d),
    delete: (_pid: string, sid: string) => del<void>(`/api/admin/cms/sections/${sid}`),
    duplicate: (_pid: string, sid: string) => post<Record<string, unknown>>(`/api/admin/cms/sections/${sid}/duplicate`),
    reorder: (pid: string, ids: string[]) => patch<void>(`/api/admin/cms/pages/${pid}/reorder`, { orderedSectionIds: ids }),
  },
};

// ─── Navigation ───────────────────────────────────────────────────────────────
export const navigation = {
  list: () => get<{ items: Record<string, unknown>[] } | NavMenu[]>('/api/admin/navigation'),
  update: (key: string, draft: unknown, title?: string) =>
    patch<Record<string, unknown>>(`/api/admin/navigation/${key}`, title ? { draft, title } : { draft }),
  publish: (key: string) => post<Record<string, unknown>>(`/api/admin/navigation/${key}/publish`),
};

// ─── Media ────────────────────────────────────────────────────────────────────
export const media = {
  list: (folderId?: string, q?: string) =>
    get<{ items?: Record<string, unknown>[]; assets?: MediaAsset[]; folders: Record<string, unknown>[] }>(
      `/api/admin/media/library${qs({ folderId, q })}`,
    ),
  createFolder: (name: string, parentId?: string) =>
    post<MediaFolder>('/api/admin/media/library/folders', { name, parentId: parentId ?? null }),
  deleteFolder: (folderId: string) => del<void>(`/api/admin/media/library/folders/${folderId}`),
  upload: (formData: FormData) => request<Record<string, unknown>>('/api/admin/media/library/upload', { method: 'POST', body: formData }),
  update: (id: string, d: { altText?: string; defaultFocalX?: number; defaultFocalY?: number; folderId?: string | null; tags?: string[] }) =>
    patch<Record<string, unknown>>(`/api/admin/media/library/assets/${id}`, d),
  delete: (id: string, force = true) =>
    del<void>(`/api/admin/media/library/assets/${id}${force ? '?force=true' : ''}`),
};

// ─── Products ─────────────────────────────────────────────────────────────────
export const products = {
  list: (p?: {
    search?: string;
    q?: string;
    status?: string;
    category?: string;
    categoryId?: string;
    sectionGroup?: string;
    color?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }) =>
    get<{
      items: Record<string, unknown>[];
      availableColors?: Array<{ name: string; hex: string }>;
      total: number;
      page?: number;
      limit?: number;
      totalPages?: number;
    }>(
      `/api/admin/products${qs({
        q: p?.q ?? p?.search,
        status: p?.status,
        categoryId: p?.categoryId ?? p?.category,
        sectionGroup: p?.sectionGroup,
        color: p?.color,
        sort: p?.sort,
        page: p?.page,
        limit: p?.limit,
      })}`,
    ),
  get: (id: string) => get<Record<string, unknown>>(`/api/admin/products/${id}`),
  create: (d: Record<string, unknown>) => post<Record<string, unknown>>('/api/admin/products', d),
  update: (id: string, d: Record<string, unknown>) => patch<Record<string, unknown>>(`/api/admin/products/${id}`, d),
  bulk: (ids: string[], action: 'activate' | 'archive' | 'set_section_group' | 'set_category' | 'set_featured', value?: string | number | boolean | null) =>
    post<{ updated: number }>('/api/admin/products/bulk', { ids, action, value }),
  archive: (id: string) => del<void>(`/api/admin/products/${id}`),
  restore: (id: string) => post<void>(`/api/admin/products/${id}/restore`),
  duplicate: (id: string) => post<Record<string, unknown>>(`/api/admin/products/${id}/duplicate`),
  updateImages: (id: string, images: unknown[]) => put<void>(`/api/admin/products/${id}/images`, { images }),
  updateCrossSells: (id: string, items: Array<{ target_product_id: string; relation_type: 'style_it_with' | 'related'; sort_order: number }>) =>
    put<{ count: number }>(`/api/admin/products/${id}/cross-sells`, { items }),
  removeColor: (pid: string, colorName: string) =>
    del<{ colorName: string; deletedCount: number; deactivatedCount: number }>(`/api/admin/products/${pid}/colors/${encodeURIComponent(colorName)}`),
  removeSize: (pid: string, size: string) =>
    del<{ size: string; deletedCount: number; deactivatedCount: number }>(`/api/admin/products/${pid}/sizes/${encodeURIComponent(size)}`),
  variants: {
    create: (pid: string, d: unknown) => post<unknown>(`/api/admin/products/${pid}/variants`, d),
    update: (pid: string, vid: string, d: unknown) => patch<unknown>(`/api/admin/products/${pid}/variants/${vid}`, d),
    matrix: (pid: string, d: {
      sizes: string[];
      colors: { name: string; hex: string }[];
      initialStock: number;
      sizePrices?: Record<string, number | null>;
      sizeComparePrices?: Record<string, number | null>;
      colorPrices?: Record<string, number | null>;
      colorImages?: Record<string, string>;
    }) => post<{ count: number; variantIds: string[] }>(`/api/admin/products/${pid}/variants/matrix`, d),
    bulkPrice: (pid: string, updates: Array<{
      variantId?: string;
      size?: string;
      color_name?: string;
      new_color_name?: string;
      color_hex?: string;
      price_paise?: number | null;
      compare_paise?: number | null;
      stock?: number;
      is_active?: 0 | 1;
    }>) => patch<{ updatedCount: number }>(`/api/admin/products/${pid}/variants/bulk-price`, { updates }),
    delete: (pid: string, vid: string) => del<void>(`/api/admin/products/${pid}/variants/${vid}`),
  },
};

// ─── Categories ───────────────────────────────────────────────────────────────
export const categories = {
  list: () => get<{ items: Record<string, unknown>[] } | Record<string, unknown>[]>('/api/admin/categories'),
  get: (id: string) => get<Record<string, unknown>>(`/api/admin/categories/${id}`),
  create: (d: unknown) => post<Record<string, unknown>>('/api/admin/categories', d),
  update: (id: string, d: unknown) => patch<Record<string, unknown>>(`/api/admin/categories/${id}`, d),
  restore: (id: string) => post<void>(`/api/admin/categories/${id}/restore`),
  delete: (id: string) => del<void>(`/api/admin/categories/${id}`),
};

// ─── Collections ─────────────────────────────────────────────────────────────
export const collections = {
  list: () => get<{ items: Record<string, unknown>[] } | Record<string, unknown>[]>('/api/admin/collections'),
  get: (id: string) => get<Record<string, unknown>>(`/api/admin/collections/${id}`),
  create: (d: unknown) => post<Record<string, unknown>>('/api/admin/collections', d),
  update: (id: string, d: unknown) => patch<Record<string, unknown>>(`/api/admin/collections/${id}`, d),
  delete: (id: string) => del<void>(`/api/admin/collections/${id}`),
  assignProducts: (id: string, productIds: string[]) => put<void>(`/api/admin/collections/${id}/products`, { productIds }),
};

// ─── Inventory ────────────────────────────────────────────────────────────────
export const inventory = {
  matrix: () => get<Record<string, unknown>>('/api/admin/inventory'),
  lowStock: (threshold = 5) => get<Record<string, unknown>>(`/api/admin/inventory/low-stock${qs({ threshold })}`),
  movements: (variantId?: string, limit = 80) =>
    get<Record<string, unknown>>(`/api/admin/inventory/movements${qs({ variantId, limit })}`),
  adjust: (variantId: string, delta: number, reason: string) =>
    patch<void>(`/api/admin/inventory/${variantId}`, { delta, reason }),
  setStock: (variantId: string, stock: number, reason: string) =>
    patch<void>(`/api/admin/inventory/${variantId}`, { stock, reason }),
  restockSubscriptions: () => get<{ items: Record<string, unknown>[] }>('/api/admin/inventory/restock-subscriptions'),
  notifyRestock: (variantId: string) =>
    post<{ notifiedCount: number; message?: string }>('/api/admin/inventory/restock-subscriptions/notify', { variantId }),
};

// ─── Orders ───────────────────────────────────────────────────────────────────
export const orders = {
  list: (p?: { status?: string; page?: number; search?: string; limit?: number }) => get<Record<string, unknown>>(`/api/admin/orders${qs(p)}`),
  get: (id: string) => get<Record<string, unknown>>(`/api/admin/orders/${id}`),
  updateStatus: (id: string, status: string, reason?: string) => patch<void>(`/api/admin/orders/${id}/status`, { status, reason }),
  updateTracking: (id: string, courierPartner: string, trackingNumber: string) =>
    patch<void>(`/api/admin/orders/${id}/tracking`, { courierPartner, trackingNumber }),
  ship: (id: string, d?: { lengthCm?: number; breadthCm?: number; heightCm?: number; weightKg?: number }) =>
    post<Record<string, unknown>>(`/api/admin/orders/${id}/ship`, d ?? {}),
  reconcile: (id: string) => post<Record<string, unknown>>(`/api/admin/orders/${id}/reconcile`),
  cancel: (id: string, reason: string) => post<void>(`/api/admin/orders/${id}/cancel`, { reason }),
  refund: (id: string, amountPaise: number, reason: string, restockItems = false) =>
    post<Record<string, unknown>>(`/api/admin/orders/${id}/refund`, { amountPaise, reason, restockItems }),
};

// ─── Customers ────────────────────────────────────────────────────────────────
export const customers = {
  list: (p?: { search?: string; page?: number }) => get<Record<string, unknown>>(`/api/admin/customers${qs(p)}`),
  get: (id: string) => get<Record<string, unknown>>(`/api/admin/customers/${id}`),
  updateStatus: (id: string, isActive: boolean) =>
    patch<{ id: string; isActive: boolean }>(`/api/admin/customers/${id}/status`, { isActive }),
};

// ─── Returns ──────────────────────────────────────────────────────────────────
export const returns = {
  list: (status?: string) => get<Record<string, unknown>>(`/api/admin/returns${qs({ status })}`),
  get: (id: string) => get<Record<string, unknown>>(`/api/admin/returns/${id}`),
  review: (id: string, action: 'approve' | 'reject' | 'complete', note?: string, restock?: boolean) => {
    const statusMap = { approve: 'approved', reject: 'rejected', complete: 'completed' } as const;
    return patch<void>(`/api/admin/returns/${id}/review`, { status: statusMap[action], adminNotes: note, restock });
  },
};

// ─── Disputes ─────────────────────────────────────────────────────────────────
export const disputes = {
  list: (status?: string) => get<Record<string, unknown>>(`/api/admin/disputes${qs({ status })}`),
  resolve: (id: string, resolution: string, refundPaise?: number, status: 'under_review' | 'won' | 'lost' | 'closed' = 'closed') =>
    patch<void>(`/api/admin/disputes/${id}`, { status, evidenceNotes: resolution, refundPaise }),
};

// ─── Payments ─────────────────────────────────────────────────────────────────
export const payments = {
  attempts: (p?: { order_id?: string; gateway?: string; status?: string; q?: string; limit?: number }) =>
    get<{ items: Record<string, unknown>[]; total: number }>(`/api/admin/payments/attempts${qs(p)}`),
  refunds: () => get<{ items: Record<string, unknown>[] }>('/api/admin/payments/refunds'),
  stats: () => get<Record<string, unknown>>('/api/admin/payments/stats'),
  health: () => get<Record<string, unknown>>('/api/admin/payments/health'),
  testGateway: () => post<Record<string, unknown>>('/api/admin/payments/test-gateway'),
  markPaid: (orderId: string, d: { paymentMethod: string; referenceNumber: string; reason: string }) =>
    post<Record<string, unknown>>(`/api/admin/payments/orders/${orderId}/mark-paid`, d),
  adjustAmount: (orderId: string, d: { adjustmentPaise?: number; shippingPaise?: number; discountPaise?: number; reason: string }) =>
    post<Record<string, unknown>>(`/api/admin/payments/orders/${orderId}/adjust-amount`, d),
  statusOverride: (orderId: string, d: { paymentStatus: string; referenceNumber?: string; reason: string }) =>
    post<Record<string, unknown>>(`/api/admin/payments/orders/${orderId}/status-override`, d),
  adjustments: () => get<{ items: Record<string, unknown>[] }>('/api/admin/payments/adjustments'),
  webhooks: (p?: { gateway?: string; status?: string }) =>
    get<{ items: Record<string, unknown>[] }>(`/api/admin/payments/webhooks${qs(p)}`),
};

// ─── Newsletter ───────────────────────────────────────────────────────────────
export const newsletter = {
  list: (p?: { status?: string; q?: string }) =>
    get<{ items: Record<string, unknown>[]; stats: { total: number; active: number; unsubscribed: number } }>(
      `/api/admin/newsletter${qs(p)}`,
    ),
  updateStatus: (id: string, status: 'active' | 'unsubscribed') => patch<void>(`/api/admin/newsletter/${id}`, { status }),
  delete: (id: string) => del<void>(`/api/admin/newsletter/${id}`),
};

// ─── System Health ────────────────────────────────────────────────────────────
export const system = {
  health: () => get<Record<string, unknown>>('/api/admin/system/health'),
  reapHolds: () => post<{ cancelledOrders: number; releasedItems: number }>('/api/admin/system/reap-holds'),
  flushCache: () => post<{ flushed: boolean; at: string }>('/api/admin/system/flush-cache'),
};

// ─── Reviews ──────────────────────────────────────────────────────────────────
export const reviews = {
  list: (status?: string) => get<Record<string, unknown>>(`/api/admin/reviews${qs({ status })}`),
  moderate: (id: string, status: 'approved' | 'rejected') => patch<void>(`/api/admin/reviews/${id}`, { status }),
  feature: (id: string, featured: boolean) => patch<void>(`/api/admin/reviews/${id}`, { isFeatured: featured }),
  reply: (id: string, reply: string) => patch<void>(`/api/admin/reviews/${id}`, { adminReply: reply }),
  delete: (id: string) => del<void>(`/api/admin/reviews/${id}`),
};

// ─── Coupons ──────────────────────────────────────────────────────────────────
export const coupons = {
  list: () => get<Record<string, unknown>>('/api/admin/coupons'),
  get: (id: string) => get<Record<string, unknown>>(`/api/admin/coupons/${id}`),
  create: (d: Record<string, unknown>) => post<Coupon>('/api/admin/coupons', d),
  update: (id: string, d: Record<string, unknown>) => patch<Coupon>(`/api/admin/coupons/${id}`, d),
  delete: (id: string) => del<void>(`/api/admin/coupons/${id}`),
};

// ─── Inquiries ────────────────────────────────────────────────────────────────
export const inquiries = {
  list: (status?: string) => get<Record<string, unknown>>(`/api/admin/inquiries${qs({ status })}`),
  get: (id: string) => get<Record<string, unknown>>(`/api/admin/inquiries/${id}`),
  update: (id: string, d: { status?: string; internalNotes?: string; internal_note?: string }) =>
    patch<void>(`/api/admin/inquiries/${id}`, { status: d.status, internalNotes: d.internalNotes ?? d.internal_note }),
  reply: (id: string, body: string, subject?: string) =>
    post<void>(`/api/admin/inquiries/${id}/reply`, { replyMessage: body, replySubject: subject }),
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
  list: () => get<{ items: Record<string, unknown>[] }>('/api/admin/templates'),
  get: (key: string) => get<Record<string, unknown>>(`/api/admin/templates/${key}`),
  update: (key: string, d: { subjectTemplate?: string; htmlTemplate?: string; textTemplate?: string; isActive?: boolean }) =>
    patch<Record<string, unknown>>(`/api/admin/templates/${key}`, d),
  testSend: (key: string, targetEmail: string, sampleVars: Record<string, string>) =>
    post<void>(`/api/admin/templates/${key}/test-send`, { targetEmail, sampleVars }),
  outbox: (status?: string) => get<{ items: Record<string, unknown>[] }>(`/api/admin/templates/outbox${qs({ status })}`),
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
  getFx: () => get<Record<string, unknown>>('/api/admin/settings/fx'),
  refreshFx: () => post<Record<string, unknown>>('/api/admin/settings/fx/refresh'),
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
