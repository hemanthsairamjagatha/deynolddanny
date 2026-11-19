// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  permissions: string[];
  mfaEnabled: boolean;
  mfaVerified: boolean;
}

// ─── Generic ──────────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code?: string; message: string; status?: number };
}

// ─── Brand ────────────────────────────────────────────────────────────────────
export interface BrandSettings {
  businessName: string;
  displayName: string;
  tagline: string;
  logoUrl: string;
  logoAltUrl: string;
  faviconUrl: string;
  primaryColor: string;
  accentColor: string;
  bodyFont: string;
  displayFont: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  gstNumber: string;
  instagramUrl: string;
  twitterUrl: string;
  pinterestUrl: string;
  youtubeUrl: string;
  footerTagline: string;
  copyrightText: string;
  metaTitle: string;
  metaDescription: string;
}

// ─── CMS ──────────────────────────────────────────────────────────────────────
export type SectionType =
  | 'hero_banner' | 'product_carousel' | 'category_grid' | 'editorial_duo'
  | 'style_layering' | 'legal_document' | 'contact_page' | 'pdp_template'
  | 'announcement' | 'newsletter_cta';

export interface CmsSection {
  id: string;
  page_id: string;
  section_type: SectionType;
  label: string;
  sort_order: number;
  config_json: Record<string, unknown>;
  is_visible: number;
  schedule_start: string | null;
  schedule_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  page_type: string;
  status: 'draft' | 'published';
  seo_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  sections?: CmsSection[];
}

// ─── Media ────────────────────────────────────────────────────────────────────
export interface MediaAsset {
  id: string;
  folder_id: string | null;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  url: string;
  focal_x: number;
  focal_y: number;
  created_at: string;
}

export interface MediaFolder {
  id: string;
  name: string;
  parent_id: string | null;
}

// ─── Product ──────────────────────────────────────────────────────────────────
export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  color: string | null;
  size: string | null;
  price_paise: number;
  compare_price_paise: number | null;
  stock: number;
  reserved: number;
  is_active: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category_id: string | null;
  description: string | null;
  care_instructions: string | null;
  material: string | null;
  country_of_origin: string | null;
  status: 'draft' | 'active' | 'archived';
  images: string[];
  variants?: ProductVariant[];
  created_at: string;
  updated_at: string;
}

// ─── Coupon ───────────────────────────────────────────────────────────────────
export interface Coupon {
  id: string;
  code: string;
  discount_type: 'flat' | 'percent';
  discount_value: number;
  min_order_paise: number | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: number;
}

// ─── Navigation ───────────────────────────────────────────────────────────────
export interface NavMenu {
  id: string;
  menu_key: string;
  label: string;
  items_json: NavItem[];
  status: 'draft' | 'published';
}

export interface NavItem {
  id: string;
  label: string;
  url?: string;
  children?: NavItem[];
}

// ─── Category & Size Guide ────────────────────────────────────────────────────
export interface Category {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  hero_title?: string | null;
  eyebrow?: string | null;
  focal_x?: number;
  focal_y?: number;
  sort_order?: number;
}

export interface SizeGuide {
  id: string;
  name: string;
  category_id: string | null;
  unit_system?: string;
  size_data?: unknown[];
  measurements_json?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── Order & Customer ─────────────────────────────────────────────────────────
export interface Order {
  id: string;
  display_id?: string;
  user_id?: string | null;
  customer_email?: string | null;
  customer_name?: string | null;
  status: string;
  subtotal_paise?: number;
  shipping_paise?: number;
  discount_paise?: number;
  total_paise?: number;
  coupon_code?: string | null;
  awb_code?: string | null;
  delivery_address?: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    phone?: string;
  } | null;
  items?: Array<{
    id?: string;
    name: string;
    sku?: string;
    color?: string;
    size?: string;
    quantity: number;
    unit_price_paise: number;
    image_url?: string;
  }>;
  created_at: string;
  updated_at?: string;
}

export interface Customer {
  id: string;
  email: string;
  full_name?: string | null;
  name?: string | null;
  phone?: string | null;
  orders_count?: number;
  created_at: string;
}
