// Application-wide constants derived from wrangler.toml vars + business rules

export const COOKIE_REFRESH_TOKEN = 'dd_refresh';
export const COOKIE_PATH = '/api/auth';
export const ACCESS_TOKEN_EXPIRY = '30d';
export const REFRESH_TOKEN_EXPIRY_SECONDS = 60 * 60 * 24 * 90; // 90 days

// Paise constants (all monetary values stored as integer paise)
export const FREE_SHIPPING_THRESHOLD_PAISE = 500_000;  // ₹5,000
export const STANDARD_SHIPPING_PAISE = 25_000;          // ₹250
export const TAX_RATE = 0.12;                           // 12% GST

// OTP
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_RATE_LIMIT_WINDOW_MINUTES = 15;
export const OTP_RATE_LIMIT_MAX = 3;

// Stock reservation
export const STOCK_RESERVATION_MINUTES = 15;

// KV TTL
export const KV_CATALOG_TTL_SECONDS = 300; // 5 minutes
export const KV_PRODUCT_TTL_SECONDS = 60;  // 1 minute

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 48;

// Order number prefix
export const ORDER_NUMBER_PREFIX = 'DD-2026-';

// Currency formatting
export const CURRENCY_SYMBOL = '₹';
export const CURRENCY_CODE = 'INR';
export const CURRENCY_LOCALE = 'en-IN';

// ID prefixes
export const PREFIX_USER = 'usr_';
export const PREFIX_OTP = 'otp_';
export const PREFIX_ADDRESS = 'addr_';
export const PREFIX_CART = 'crt_';
export const PREFIX_CART_ITEM = 'cit_';
export const PREFIX_ORDER = 'ord_';
export const PREFIX_ORDER_ITEM = 'oit_';
export const PREFIX_WISHLIST = 'wsh_';
export const PREFIX_NEWSLETTER = 'nws_';
export const PREFIX_IMG = 'img_';

