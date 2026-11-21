-- =============================================================================
-- DEYNOLD DANNY — Category Slug & Product Alignment Migration
-- Migration: 0013_category_slug_and_product_alignment.sql
-- 1. Ensure cat-clothing exists with canonical slug 'clothing'
-- 2. Align English canonical categories with primary sort order (1..16)
-- 3. Update products to point directly to English canonical categories
-- =============================================================================

PRAGMA foreign_keys = ON;

-- 1. Insert cat-clothing if not present
INSERT OR IGNORE INTO categories (id, slug, title, subtitle, tagline, image_url, sort_order, is_active)
VALUES (
  'cat-clothing',
  'clothing',
  'Clothing & Dresses',
  'Collezione Abiti & Eveningwear',
  'SCOPRI ORA',
  '/images/category-abiti.jpg',
  10,
  1
);

-- 2. Re-prioritize sort_order so English canonical categories appear first on storefront
UPDATE categories SET sort_order = 1 WHERE id = 'cat-tailoring';
UPDATE categories SET sort_order = 2 WHERE id = 'cat-suits';
UPDATE categories SET sort_order = 3 WHERE id = 'cat-coats';
UPDATE categories SET sort_order = 4 WHERE id = 'cat-jackets';
UPDATE categories SET sort_order = 5 WHERE id = 'cat-knitwear';
UPDATE categories SET sort_order = 6 WHERE id = 'cat-sweaters';
UPDATE categories SET sort_order = 7 WHERE id = 'cat-shirts';
UPDATE categories SET sort_order = 8 WHERE id = 'cat-denim-shirts';
UPDATE categories SET sort_order = 9 WHERE id = 'cat-trousers';
UPDATE categories SET sort_order = 10 WHERE id = 'cat-clothing';
UPDATE categories SET sort_order = 11 WHERE id = 'cat-polo-t-shirts';
UPDATE categories SET sort_order = 12 WHERE id = 'cat-hoodies';
UPDATE categories SET sort_order = 13 WHERE id = 'cat-footwear';
UPDATE categories SET sort_order = 14 WHERE id = 'cat-accessories';
UPDATE categories SET sort_order = 15 WHERE id = 'cat-denim-jackets';
UPDATE categories SET sort_order = 16 WHERE id = 'cat-leather-jackets';

-- Secondary/Italian alias sort_orders moved after English categories
UPDATE categories SET sort_order = 21 WHERE id = 'cat-abiti';
UPDATE categories SET sort_order = 22 WHERE id = 'cat-capispalla';
UPDATE categories SET sort_order = 23 WHERE id = 'cat-camicie';
UPDATE categories SET sort_order = 24 WHERE id = 'cat-maglieria';
UPDATE categories SET sort_order = 25 WHERE id = 'cat-pantaloni';
UPDATE categories SET sort_order = 26 WHERE id = 'cat-scarpe';
UPDATE categories SET sort_order = 27 WHERE id = 'cat-accessori';
UPDATE categories SET sort_order = 28 WHERE id = 'cat-borse';

-- 3. Align products to point to the canonical English categories matching site navigation
UPDATE products SET category_id = 'cat-tailoring' WHERE id = 'mastery-1';
UPDATE products SET category_id = 'cat-tailoring' WHERE id = 'style-3';
UPDATE products SET category_id = 'cat-coats'     WHERE id = 'mastery-2';
UPDATE products SET category_id = 'cat-coats'     WHERE id = 'style-2';
UPDATE products SET category_id = 'cat-shirts'    WHERE id = 'mastery-3';
UPDATE products SET category_id = 'cat-knitwear'  WHERE id = 'mastery-4';
UPDATE products SET category_id = 'cat-trousers'  WHERE id = 'cady-trousers';
UPDATE products SET category_id = 'cat-trousers'  WHERE id = 'news-3';
UPDATE products SET category_id = 'cat-footwear'  WHERE id = 'style-1';
UPDATE products SET category_id = 'cat-footwear'  WHERE id = 'news-2';
UPDATE products SET category_id = 'cat-accessories' WHERE id = 'style-4';
UPDATE products SET category_id = 'cat-clothing'  WHERE id = 'news-1';
