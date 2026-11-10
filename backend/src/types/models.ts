// Database entity interfaces — match D1 column names exactly

export interface DbUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: 'customer' | 'admin' | 'superadmin';
  is_active: 0 | 1;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbOtp {
  id: string;
  email: string;
  otp_hash: string;
  purpose: 'login' | 'admin_login' | 'update_email';
  expires_at: string;
  attempts: number;
  consumed: 0 | 1;
  ip_address: string | null;
  created_at: string;
}

export interface DbAddress {
  id: string;
  user_id: string;
  address_type: 'Home' | 'Office' | 'Other';
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  is_default: 0 | 1;
  created_at: string;
  updated_at: string;
}

export interface DbCategory {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  tagline: string | null;
  image_url: string;
  sort_order: number;
  is_active: 0 | 1;
  created_at: string;
  updated_at: string;
}

export interface DbProduct {
  id: string;
  slug: string;
  sku_prefix: string;
  title: string;
  description: string | null;
  material: string | null;
  care_guide: string | null;
  gender: string | null;
  tag: string | null;
  size_and_fit_json: string | null;     // JSON array
  composition_care_json: string | null; // JSON array
  shipping_returns_json: string | null; // JSON array
  price_paise: number;
  compare_paise: number | null;
  badge: string | null;
  section_group: 'mastery' | 'style_space' | 'news';
  category_id: string | null;
  default_img: string;
  hover_img: string;
  is_active: 0 | 1;
  is_featured: 0 | 1;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DbProductVariant {
  id: string;        // e.g. 'mastery-1-48'
  product_id: string;
  sku: string;
  size: string;
  color_name: string;
  color_hex: string;
  stock: number;
  reserved_stock: number;
  is_active: 0 | 1;
  created_at: string;
  updated_at: string;
}

export interface DbProductImage {
  id: string;
  product_id: string;
  color_name: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
}

export interface DbCart {
  id: string;
  user_id: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbCartItem {
  id: string;
  cart_id: string;
  variant_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface DbOrder {
  id: string;
  order_number: string;
  user_id: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  subtotal_paise: number;
  shipping_paise: number;
  discount_paise: number;
  tax_paise: number;
  total_paise: number;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'user_dropped';
  cf_order_id: string | null;
  cf_payment_id: string | null;
  payment_method: string | null;
  paid_at: string | null;
  shipping_name: string;
  shipping_phone: string;
  shipping_line1: string;
  shipping_line2: string | null;
  shipping_city: string;
  shipping_state: string;
  shipping_pincode: string;
  shipping_country: string;
  courier_partner: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  coupon_code: string | null;
  customer_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbOrderItem {
  id: string;
  order_id: string;
  variant_id: string;
  product_id: string;
  title_snapshot: string;
  sku_snapshot: string;
  size_snapshot: string;
  color_snapshot: string;
  image_snapshot: string;
  unit_price_paise: number;
  quantity: number;
  total_paise: number;
}

export interface DbWishlist {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
}

export interface DbNewsletter {
  id: string;
  email: string;
  status: 'active' | 'unsubscribed';
  unsub_token: string;
  created_at: string;
}

export interface DbCoupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  min_order_paise: number;
  max_discount_paise: number | null;
  usage_limit: number | null;
  used_count: number;
  is_active: 0 | 1;
  expires_at: string | null;
  created_at: string;
}

export interface DbAdminLog {
  id: string;
  admin_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: string | null; // JSON
  ip_address: string | null;
  created_at: string;
}

export interface DbProductCrossSell {
  product_id: string;
  target_product_id: string;
  relation_type: 'style_it_with' | 'related';
}

