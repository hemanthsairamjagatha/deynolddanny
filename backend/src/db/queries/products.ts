import type { D1Database } from '@cloudflare/workers-types';
import type { DbProduct, DbProductVariant, DbProductImage, DbProductCrossSell } from '../../types/models.js';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../config/constants.js';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ProductListOptions {
  section?: string;
  categoryId?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'featured';
  page?: number;
  limit?: number;
  featured?: boolean;
}

export interface ProductListResult {
  products: DbProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── List / Paginated ───────────────────────────────────────────────────────

export async function getProducts(
  db: D1Database,
  options: ProductListOptions = {},
): Promise<ProductListResult> {
  const {
    section,
    categoryId,
    sort = 'featured',
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
    featured,
  } = options;

  const pageSize = Math.min(limit, MAX_PAGE_SIZE);
  const offset = (Math.max(page, 1) - 1) * pageSize;

  const conditions: string[] = ['p.is_active = 1'];
  const bindings: (string | number)[] = [];

  if (section) {
    conditions.push(`p.section_group = ?${bindings.length + 1}`);
    bindings.push(section);
  }
  if (categoryId) {
    conditions.push(`p.category_id = ?${bindings.length + 1}`);
    bindings.push(categoryId);
  }
  if (featured === true) {
    conditions.push(`p.is_featured = 1`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const orderMap: Record<string, string> = {
    newest: 'p.created_at DESC',
    price_asc: 'p.price_paise ASC',
    price_desc: 'p.price_paise DESC',
    featured: 'p.sort_order ASC, p.is_featured DESC, p.created_at DESC',
  };
  const orderBy = orderMap[sort] ?? orderMap.featured;

  const countSql = `SELECT COUNT(*) as cnt FROM products p ${where}`;
  const dataSql = `
    SELECT p.* FROM products p
    ${where}
    ORDER BY ${orderBy}
    LIMIT ?${bindings.length + 1} OFFSET ?${bindings.length + 2}
  `;

  const [countResult, dataResult] = await db.batch([
    db.prepare(countSql).bind(...bindings),
    db.prepare(dataSql).bind(...bindings, pageSize, offset),
  ]);

  const total = (countResult.results?.[0] as { cnt: number })?.cnt ?? 0;
  const products = (dataResult.results ?? []) as DbProduct[];

  return {
    products,
    total,
    page: Math.max(page, 1),
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ─── Single Product ─────────────────────────────────────────────────────────

export async function getProductBySlug(
  db: D1Database,
  slug: string,
): Promise<DbProduct | null> {
  return db
    .prepare(`SELECT * FROM products WHERE slug = ?1 AND is_active = 1`)
    .bind(slug)
    .first<DbProduct>();
}

export async function getProductById(
  db: D1Database,
  id: string,
): Promise<DbProduct | null> {
  return db
    .prepare(`SELECT * FROM products WHERE id = ?1 AND is_active = 1`)
    .bind(id)
    .first<DbProduct>();
}

// ─── Variants ───────────────────────────────────────────────────────────────

export async function getProductVariants(
  db: D1Database,
  productId: string,
): Promise<DbProductVariant[]> {
  const result = await db
    .prepare(
      `SELECT * FROM product_variants
       WHERE product_id = ?1 AND is_active = 1
       ORDER BY size ASC`,
    )
    .bind(productId)
    .all<DbProductVariant>();
  return result.results ?? [];
}

export async function getVariantById(
  db: D1Database,
  variantId: string,
): Promise<DbProductVariant | null> {
  return db
    .prepare(`SELECT * FROM product_variants WHERE id = ?1 AND is_active = 1`)
    .bind(variantId)
    .first<DbProductVariant>();
}

// ─── Images ─────────────────────────────────────────────────────────────────

export async function getProductImages(
  db: D1Database,
  productId: string,
): Promise<DbProductImage[]> {
  const result = await db
    .prepare(
      `SELECT * FROM product_images
       WHERE product_id = ?1
       ORDER BY sort_order ASC`,
    )
    .bind(productId)
    .all<DbProductImage>();
  return result.results ?? [];
}

// ─── Cross-sells ─────────────────────────────────────────────────────────────

export interface CrossSellProduct extends DbProduct {
  relation_type: 'style_it_with' | 'related';
}

export async function getProductCrossSells(
  db: D1Database,
  productId: string,
  relationType?: 'style_it_with' | 'related',
): Promise<CrossSellProduct[]> {
  let sql = `
    SELECT p.*, pcs.relation_type FROM products p
    INNER JOIN product_cross_sells pcs ON pcs.target_product_id = p.id
    WHERE pcs.product_id = ?1
      AND p.is_active = 1
  `;
  const bindings: (string)[] = [productId];

  if (relationType) {
    sql += ` AND pcs.relation_type = ?2`;
    bindings.push(relationType);
  }

  const result = await db.prepare(sql).bind(...bindings).all<CrossSellProduct>();
  return result.results ?? [];
}

// ─── FTS Search ─────────────────────────────────────────────────────────────

export async function searchProducts(
  db: D1Database,
  query: string,
  limit = 12,
): Promise<DbProduct[]> {
  // products_fts is an FTS5 content table linked to products via rowid
  const result = await db
    .prepare(
      `SELECT p.* FROM products p
       INNER JOIN products_fts f ON f.rowid = p.rowid
       WHERE products_fts MATCH ?1
         AND p.is_active = 1
       ORDER BY rank
       LIMIT ?2`,
    )
    .bind(`${query}*`, limit)
    .all<DbProduct>();
  return result.results ?? [];
}

// ─── Admin helpers ──────────────────────────────────────────────────────────

export async function getAllProductsAdmin(db: D1Database): Promise<DbProduct[]> {
  const result = await db
    .prepare(`SELECT * FROM products ORDER BY sort_order ASC, created_at DESC`)
    .all<DbProduct>();
  return result.results ?? [];
}

export async function upsertProduct(
  db: D1Database,
  p: Partial<DbProduct> & { id: string },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO products (
         id, slug, sku_prefix, title, description, material, care_guide, gender, tag,
         size_and_fit_json, composition_care_json, shipping_returns_json,
         price_paise, compare_paise, badge, section_group, category_id,
         default_img, hover_img, is_active, is_featured, sort_order,
         created_at, updated_at
       ) VALUES (
         ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,
         strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
       )
       ON CONFLICT(id) DO UPDATE SET
         slug=excluded.slug, title=excluded.title, description=excluded.description,
         material=excluded.material, care_guide=excluded.care_guide,
         price_paise=excluded.price_paise, compare_paise=excluded.compare_paise,
         badge=excluded.badge, section_group=excluded.section_group, category_id=excluded.category_id,
         default_img=excluded.default_img, hover_img=excluded.hover_img,
         is_active=excluded.is_active, is_featured=excluded.is_featured,
         sort_order=excluded.sort_order,
         updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    )
    .bind(
      p.id, p.slug, p.sku_prefix, p.title, p.description ?? null, p.material ?? null,
      p.care_guide ?? null, p.gender ?? null, p.tag ?? null,
      p.size_and_fit_json ?? null, p.composition_care_json ?? null, p.shipping_returns_json ?? null,
      p.price_paise, p.compare_paise ?? null, p.badge ?? null, p.section_group, p.category_id ?? null,
      p.default_img, p.hover_img, p.is_active ?? 1, p.is_featured ?? 0, p.sort_order ?? 0,
    )
    .run();
}

