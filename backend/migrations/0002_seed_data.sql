-- =============================================================================
-- DEYNOLD DANNY — Seed Data
-- Migration: 0002_seed_data.sql
-- Safe to re-run: all statements use INSERT OR IGNORE
-- Money columns: INTEGER PAISE (₹1 = 100 paise)
-- =============================================================================

PRAGMA foreign_keys = ON;

-- =============================================================================
-- SECTION 1: CATEGORIES  (8 categories, IDs match frontend nav config)
-- =============================================================================

INSERT OR IGNORE INTO categories (id, slug, title, subtitle, tagline, image_url, sort_order, is_active) VALUES
  ('cat-abiti',      'abiti',      'Abiti',      'Eleganza senza sforzo',          'SCOPRI ORA', '/images/categories/abiti.jpg',      1, 1),
  ('cat-capispalla', 'capispalla', 'Capispalla',  'Outerwear di carattere',         'SCOPRI ORA', '/images/categories/capispalla.jpg', 2, 1),
  ('cat-camicie',    'camicie',    'Camicie',     'Precisione sartoriale',          'SCOPRI ORA', '/images/categories/camicie.jpg',    3, 1),
  ('cat-maglieria',  'maglieria',  'Maglieria',   'Comfort di lusso',               'SCOPRI ORA', '/images/categories/maglieria.jpg',  4, 1),
  ('cat-pantaloni',  'pantaloni',  'Pantaloni',   'Taglio impeccabile',             'SCOPRI ORA', '/images/categories/pantaloni.jpg',  5, 1),
  ('cat-accessori',  'accessori',  'Accessori',   'Dettagli che fanno la differenza','SCOPRI ORA', '/images/categories/accessori.jpg',  6, 1),
  ('cat-scarpe',     'scarpe',     'Scarpe',      'Calzature su misura',            'SCOPRI ORA', '/images/categories/scarpe.jpg',     7, 1),
  ('cat-borse',      'borse',      'Borse',       'Pelletteria esclusiva',          'SCOPRI ORA', '/images/categories/borse.jpg',      8, 1);

-- =============================================================================
-- SECTION 2: PRODUCTS  (16 products: 15 blueprint + cady-trousers flagship PDP)
-- Slugs verified against src/features/catalog/data/products.ts
-- price_paise = price_EUR * 90 * 100  (approx INR at 1 EUR ≈ ₹90)
-- =============================================================================

-- ------------------------------------
-- MASTERY GROUP  (section_group = 'mastery')
-- ------------------------------------

-- mastery-1  (slug from frontend: tailored-virgin-wool-suit)
INSERT OR IGNORE INTO products
  (id, slug, sku_prefix, title, description, material, care_guide, gender, tag,
   size_and_fit_json, composition_care_json, shipping_returns_json,
   price_paise, compare_paise, badge, section_group, category_id,
   default_img, hover_img, is_active, is_featured, sort_order)
VALUES (
  'mastery-1',
  'tailored-virgin-wool-suit',
  'DD-MS1-01',
  'Tailored Virgin Wool Suit',
  'A masterpiece of sartorial craft. Cut from pure virgin wool with a structured shoulder and slim silhouette that defines modern Italian elegance.',
  '100% Virgin Wool',
  'Dry clean only. Store on a wide-shouldered wooden hanger.',
  'Men',
  'NEW',
  '["Model is 187 cm / 6''1\" and wears size IT 50","Slim fit — we recommend sizing up for a relaxed drape","Shoulder: structured; Chest: 108 cm in size IT 50"]',
  '["Outer: 100% Virgin Wool","Lining: 55% Viscose, 45% Acetate","Dry clean only","Do not bleach, tumble dry or iron at high temperature"]',
  '["Free express shipping on orders over ₹10,000","Returns accepted within 14 days of delivery","Items must be unworn, unaltered and in original packaging","Final-sale items are non-returnable"]',
  270000,  -- ₹2,700  (€300 × 90)
  NULL,
  'BESTSELLER',
  'mastery',
  'cat-abiti',
  '/images/mastery-1-model.jpg',
  '/images/mastery-1-product.jpg',
  1, 1, 1
);

-- mastery-2  (CORRECTED slug: tailored-virgin-wool-overcoat-with-cashmere-scarf)
INSERT OR IGNORE INTO products
  (id, slug, sku_prefix, title, description, material, care_guide, gender, tag,
   size_and_fit_json, composition_care_json, shipping_returns_json,
   price_paise, compare_paise, badge, section_group, category_id,
   default_img, hover_img, is_active, is_featured, sort_order)
VALUES (
  'mastery-2',
  'tailored-virgin-wool-overcoat-with-cashmere-scarf',
  'DD-MS2-01',
  'Tailored Virgin Wool Overcoat with Cashmere Scarf',
  'An overcoat of commanding presence. Sculpted in virgin wool with a full canvas interlining, paired with a complimentary cashmere scarf.',
  '90% Virgin Wool, 10% Cashmere (scarf)',
  'Dry clean only. Store folded in a breathable garment bag.',
  'Men',
  'NEW',
  '["Model is 187 cm / 6''1\" and wears size IT 50","Regular fit with generous chest and shoulder","Scarf dimensions: 180 × 30 cm"]',
  '["Coat outer: 90% Virgin Wool, 10% Cashmere","Coat lining: 100% Viscose","Scarf: 100% Cashmere","Dry clean only"]',
  '["Free express shipping on orders over ₹10,000","Returns accepted within 14 days of delivery","Items must be unworn, unaltered and in original packaging","Final-sale items are non-returnable"]',
  450000,  -- ₹4,500  (€500 × 90)
  NULL,
  NULL,
  'mastery',
  'cat-capispalla',
  '/images/mastery-2-model.jpg',
  '/images/mastery-2-product.jpg',
  1, 1, 2
);

-- mastery-3  (CORRECTED slug: sartorial-poplin-and-twill-dress-shirts-trio)
INSERT OR IGNORE INTO products
  (id, slug, sku_prefix, title, description, material, care_guide, gender, tag,
   size_and_fit_json, composition_care_json, shipping_returns_json,
   price_paise, compare_paise, badge, section_group, category_id,
   default_img, hover_img, is_active, is_featured, sort_order)
VALUES (
  'mastery-3',
  'sartorial-poplin-and-twill-dress-shirts-trio',
  'DD-MS3-01',
  'Sartorial Poplin and Twill Dress Shirts Trio',
  'Three exquisitely crafted dress shirts — two poplin and one twill — each cut to a precise slim profile with single-needle stitching throughout.',
  '100% Egyptian Cotton',
  'Machine wash at 30°C. Iron while damp on high heat.',
  'Men',
  'SET',
  '["Model is 187 cm / 6''1\" and wears size IT 40 / M","Slim fit — refer to collar size guide","Sleeve length: standard and long available"]',
  '["Poplin shirts: 100% Egyptian Cotton","Twill shirt: 100% Egyptian Cotton","Machine wash at 30°C, do not bleach","Iron on high heat while slightly damp"]',
  '["Free express shipping on orders over ₹10,000","Returns accepted within 14 days of delivery","Items must be unworn, unaltered and in original packaging","Final-sale items are non-returnable"]',
  198000,  -- ₹1,980  (€220 × 90)
  NULL,
  'SET OF 3',
  'mastery',
  'cat-camicie',
  '/images/mastery-3-model.jpg',
  '/images/mastery-3-product.jpg',
  1, 1, 3
);

-- mastery-4
INSERT OR IGNORE INTO products
  (id, slug, sku_prefix, title, description, material, care_guide, gender, tag,
   size_and_fit_json, composition_care_json, shipping_returns_json,
   price_paise, compare_paise, badge, section_group, category_id,
   default_img, hover_img, is_active, is_featured, sort_order)
VALUES (
  'mastery-4',
  'merino-wool-ribbed-turtleneck',
  'DD-MS4-01',
  'Merino Wool Ribbed Turtleneck',
  'Spun from superfine merino wool, this turtleneck is ribbed for structure and warmth without weight, finished with a double-folded neck roll.',
  '100% Superfine Merino Wool',
  'Hand wash cold or dry clean. Dry flat to retain shape.',
  'Men',
  NULL,
  '["Model is 187 cm / 6''1\" and wears size M","Regular fit with relaxed body and fitted sleeves","Neck roll height: 16 cm"]',
  '["100% Superfine Merino Wool (18.5 micron)","Hand wash cold or dry clean only","Do not tumble dry","Dry flat, away from direct sunlight"]',
  '["Free express shipping on orders over ₹10,000","Returns accepted within 14 days of delivery","Items must be unworn, unaltered and in original packaging","Final-sale items are non-returnable"]',
  144000,  -- ₹1,440  (€160 × 90)
  NULL,
  NULL,
  'mastery',
  'cat-maglieria',
  '/images/mastery-4-model.jpg',
  '/images/mastery-4-product.jpg',
  1, 1, 4
);

-- mastery-5
INSERT OR IGNORE INTO products
  (id, slug, sku_prefix, title, description, material, care_guide, gender, tag,
   size_and_fit_json, composition_care_json, shipping_returns_json,
   price_paise, compare_paise, badge, section_group, category_id,
   default_img, hover_img, is_active, is_featured, sort_order)
VALUES (
  'mastery-5',
  'full-canvas-peak-lapel-dinner-jacket',
  'DD-MS5-01',
  'Full-Canvas Peak Lapel Dinner Jacket',
  'Black tie redefined. A full-canvas dinner jacket with silk-faced peak lapels, hand-padded chest and a silhouette that commands every room.',
  '100% Virgin Wool with Silk Lapel Facing',
  'Dry clean only. Store in a breathable garment cover.',
  'Men',
  'FORMAL',
  '["Model is 187 cm / 6''1\" and wears size IT 50","Slim fit — structured shoulder","Lapel facing: 100% Silk grosgrain"]',
  '["Outer: 100% Virgin Wool","Lapel facing: 100% Silk","Canvas: Linen/Horsehair blend","Lining: 100% Cupro","Dry clean only"]',
  '["Free express shipping on orders over ₹10,000","Returns accepted within 14 days of delivery","Items must be unworn, unaltered and in original packaging","Final-sale items are non-returnable"]',
  360000,  -- ₹3,600  (€400 × 90)
  NULL,
  NULL,
  'mastery',
  'cat-abiti',
  '/images/mastery-5-model.jpg',
  '/images/mastery-5-product.jpg',
  1, 1, 5
);

-- ------------------------------------
-- STYLE SPACE GROUP  (section_group = 'style_space')
-- ------------------------------------

-- style-1
INSERT OR IGNORE INTO products
  (id, slug, sku_prefix, title, description, material, care_guide, gender, tag,
   size_and_fit_json, composition_care_json, shipping_returns_json,
   price_paise, compare_paise, badge, section_group, category_id,
   default_img, hover_img, is_active, is_featured, sort_order)
VALUES (
  'style-1',
  'nappa-leather-chelsea-flat',
  'DD-ST1-01',
  'Nappa Leather Chelsea Flat',
  'The definitive Chelsea flat. Supple nappa leather upper, elastic side gussets, and a featherweight crepe sole that walks as beautifully as it looks.',
  '100% Nappa Leather upper; Crepe sole',
  'Wipe with a soft damp cloth. Condition with leather cream. Store in dust bag.',
  'Women',
  'ICON',
  '["True to size — order your usual EU size","Heel height: flat (10 mm sole)","Available in full EU sizes 35–41"]',
  '["Upper: 100% Nappa Leather","Lining: 100% Leather","Sole: Natural Crepe","Spot clean only; condition with leather cream"]',
  '["Free express shipping on orders over ₹10,000","Returns accepted within 14 days of delivery","Items must be unworn, unaltered and in original packaging","Final-sale items are non-returnable"]',
  117000,  -- ₹1,170  (€130 × 90)
  NULL,
  NULL,
  'style_space',
  'cat-scarpe',
  '/images/style-1-model.jpg',
  '/images/style-1-product.jpg',
  1, 1, 1
);

-- style-2  (CORRECTED slug: stand-collar-virgin-wool-tailored-car-coat)
INSERT OR IGNORE INTO products
  (id, slug, sku_prefix, title, description, material, care_guide, gender, tag,
   size_and_fit_json, composition_care_json, shipping_returns_json,
   price_paise, compare_paise, badge, section_group, category_id,
   default_img, hover_img, is_active, is_featured, sort_order)
VALUES (
  'style-2',
  'stand-collar-virgin-wool-tailored-car-coat',
  'DD-ST2-01',
  'Stand-Collar Virgin Wool Tailored Car Coat',
  'A refined car coat with a distinctive stand collar, full-canvas interlining and an effortless mid-thigh length that elevates every commute.',
  '100% Virgin Wool',
  'Dry clean only. Hang on a wide hanger to preserve shoulder shape.',
  'Women',
  'NEW',
  '["Model is 175 cm / 5''9\" and wears size IT 40","Regular fit — relaxed through body","Length: mid-thigh; shoulder: structured"]',
  '["Outer: 100% Virgin Wool","Lining: 100% Viscose","Canvas: Linen interlining","Dry clean only"]',
  '["Free express shipping on orders over ₹10,000","Returns accepted within 14 days of delivery","Items must be unworn, unaltered and in original packaging","Final-sale items are non-returnable"]',
  333000,  -- ₹3,330  (€370 × 90)
  NULL,
  NULL,
  'style_space',
  'cat-capispalla',
  '/images/style-2-model.jpg',
  '/images/style-2-product.jpg',
  1, 1, 2
);

-- style-3
INSERT OR IGNORE INTO products
  (id, slug, sku_prefix, title, description, material, care_guide, gender, tag,
   size_and_fit_json, composition_care_json, shipping_returns_json,
   price_paise, compare_paise, badge, section_group, category_id,
   default_img, hover_img, is_active, is_featured, sort_order)
VALUES (
  'style-3',
  'cady-crepe-tailored-vest',
  'DD-ST3-01',
  'Cady Crêpe Tailored Vest',
  'Cut from structured cady crêpe in a double-breasted silhouette, this vest blurs the line between tailoring and effortless day dressing.',
  '100% Cady Crêpe (Viscose blend)',
  'Dry clean recommended. Iron on low heat inside-out.',
  'Women',
  NULL,
  '["Model is 175 cm / 5''9\" and wears size IT 40","Slim fit; we suggest sizing up one for a relaxed look","Length: hip-grazing"]',
  '["Outer: 72% Viscose, 28% Polyester (Cady Crêpe)","Lining: 100% Viscose","Dry clean recommended","Iron on low heat, reverse side only"]',
  '["Free express shipping on orders over ₹10,000","Returns accepted within 14 days of delivery","Items must be unworn, unaltered and in original packaging","Final-sale items are non-returnable"]',
  90000,  -- ₹900  (€100 × 90)
  NULL,
  NULL,
  'style_space',
  'cat-abiti',
  '/images/style-3-model.jpg',
  '/images/style-3-product.jpg',
  1, 1, 3
);

-- style-4
INSERT OR IGNORE INTO products
  (id, slug, sku_prefix, title, description, material, care_guide, gender, tag,
   size_and_fit_json, composition_care_json, shipping_returns_json,
   price_paise, compare_paise, badge, section_group, category_id,
   default_img, hover_img, is_active, is_featured, sort_order)
VALUES (
  'style-4',
  'cashmere-blend-ribbed-beanie',
  'DD-ST4-01',
  'Cashmere Blend Ribbed Beanie',
  'An heirloom-quality beanie knitted from a cashmere-merino blend in a fine 2×2 rib. Effortlessly warm, impeccably understated.',
  '70% Cashmere, 30% Merino Wool',
  'Hand wash cold. Dry flat.',
  'Unisex',
  NULL,
  '["One size fits most","Depth: 24 cm; width: 22 cm (unstretched)","Roll brim for a more compact fit"]',
  '["70% Cashmere, 30% Merino Wool","Hand wash cold, do not wring","Dry flat away from direct heat","Do not tumble dry or bleach"]',
  '["Free express shipping on orders over ₹10,000","Returns accepted within 14 days of delivery","Items must be unworn, unaltered and in original packaging","Final-sale items are non-returnable"]',
  54000,  -- ₹540  (€60 × 90)
  NULL,
  NULL,
  'style_space',
  'cat-accessori',
  '/images/style-4-model.jpg',
  '/images/style-4-product.jpg',
  1, 1, 4
);

-- style-5
INSERT OR IGNORE INTO products
  (id, slug, sku_prefix, title, description, material, care_guide, gender, tag,
   size_and_fit_json, composition_care_json, shipping_returns_json,
   price_paise, compare_paise, badge, section_group, category_id,
   default_img, hover_img, is_active, is_featured, sort_order)
VALUES (
  'style-5',
  'grain-leather-structured-tote',
  'DD-ST5-01',
  'Grain Leather Structured Tote',
  'A precisely constructed tote in full-grain vegetable-tanned leather, featuring a removable zip pouch and solid brass fittings.',
  '100% Full-Grain Vegetable-Tanned Leather',
  'Condition with leather balm. Avoid prolonged exposure to water or sunlight. Store stuffed in dust bag.',
  'Women',
  NULL,
  '["Dimensions: 38 W × 30 H × 14 D cm","Handles drop: 22 cm","Detachable zip inner pouch included"]',
  '["Exterior: 100% Full-Grain Vegetable-Tanned Leather","Lining: 100% Cotton canvas","Hardware: Solid brass","Spot clean only; condition with leather balm"]',
  '["Free express shipping on orders over ₹10,000","Returns accepted within 14 days of delivery","Items must be unworn, unaltered and in original packaging","Final-sale items are non-returnable"]',
  225000,  -- ₹2,250  (€250 × 90)
  NULL,
  NULL,
  'style_space',
  'cat-borse',
  '/images/style-5-model.jpg',
  '/images/style-5-product.jpg',
  1, 1, 5
);

-- ------------------------------------
-- NEWS GROUP  (section_group = 'news')
-- ------------------------------------

-- news-1
INSERT OR IGNORE INTO products
  (id, slug, sku_prefix, title, description, material, care_guide, gender, tag,
   size_and_fit_json, composition_care_json, shipping_returns_json,
   price_paise, compare_paise, badge, section_group, category_id,
   default_img, hover_img, is_active, is_featured, sort_order)
VALUES (
  'news-1',
  'silk-satin-bias-cut-slip-dress',
  'DD-NW1-01',
  'Silk Satin Bias-Cut Slip Dress',
  'The slip dress, elevated. Bias-cut from pure silk satin, it falls in liquid lines along the body with adjustable spaghetti straps and a subtle cowl neckline.',
  '100% Silk Satin',
  'Hand wash cold with silk detergent or dry clean. Never wring. Dry flat.',
  'Women',
  'NEW',
  '["Model is 175 cm / 5''9\" and wears size IT 38","Slim cut; size up for a more draped silhouette","Available in sizes IT 34–IT 46"]',
  '["100% Silk Satin (22 momme)","Hand wash cold with silk detergent","Do not bleach or tumble dry","Dry flat, away from direct sunlight"]',
  '["Free express shipping on orders over ₹10,000","Returns accepted within 14 days of delivery","Items must be unworn, unaltered and in original packaging","Final-sale items are non-returnable"]',
  180000,  -- ₹1,800  (€200 × 90)
  NULL,
  'NEW IN',
  'news',
  'cat-abiti',
  '/images/news-1-model.jpg',
  '/images/news-1-product.jpg',
  1, 1, 1
);

-- news-2
INSERT OR IGNORE INTO products
  (id, slug, sku_prefix, title, description, material, care_guide, gender, tag,
   size_and_fit_json, composition_care_json, shipping_returns_json,
   price_paise, compare_paise, badge, section_group, category_id,
   default_img, hover_img, is_active, is_featured, sort_order)
VALUES (
  'news-2',
  'hand-stitched-suede-loafer',
  'DD-NW2-01',
  'Hand-Stitched Suede Loafer',
  'Hand-lasted on a classic round toe last, this suede loafer features a hand-stitched apron toe and a lightweight leather sole with a subtle heel.',
  '100% Suede upper; Leather sole',
  'Brush gently with suede brush to restore nap. Protect with suede spray. Store in dust bag.',
  'Men',
  'NEW',
  '["True to size — order your usual EU size","Available in full EU sizes 39–46","Heel height: 20 mm"]',
  '["Upper: 100% Kid Suede","Lining: 100% Leather","Sole: Leather with rubber heel tap","Spot clean with suede brush only"]',
  '["Free express shipping on orders over ₹10,000","Returns accepted within 14 days of delivery","Items must be unworn, unaltered and in original packaging","Final-sale items are non-returnable"]',
  144000,  -- ₹1,440  (€160 × 90)
  NULL,
  'NEW IN',
  'news',
  'cat-scarpe',
  '/images/news-2-model.jpg',
  '/images/news-2-product.jpg',
  1, 1, 2
);

-- news-3
INSERT OR IGNORE INTO products
  (id, slug, sku_prefix, title, description, material, care_guide, gender, tag,
   size_and_fit_json, composition_care_json, shipping_returns_json,
   price_paise, compare_paise, badge, section_group, category_id,
   default_img, hover_img, is_active, is_featured, sort_order)
VALUES (
  'news-3',
  'pleated-high-rise-wool-trousers',
  'DD-NW3-01',
  'Pleated High-Rise Wool Trousers',
  'Double-pleated and cut high at the rise in a soft-structured wool blend. A quietly assertive silhouette for every setting.',
  '80% Wool, 20% Polyester',
  'Dry clean only. Press with a damp cloth and iron cloth.',
  'Men',
  'NEW',
  '["Model is 187 cm / 6''1\" and wears size IT 50","Regular fit at the waist and hip, tapered from the knee","Inseam: 82 cm in size IT 50"]',
  '["80% Wool, 20% Polyester","Dry clean only","Press with a damp cloth and pressing cloth","Do not wring or tumble dry"]',
  '["Free express shipping on orders over ₹10,000","Returns accepted within 14 days of delivery","Items must be unworn, unaltered and in original packaging","Final-sale items are non-returnable"]',
  126000,  -- ₹1,260  (€140 × 90)
  NULL,
  'NEW IN',
  'news',
  'cat-pantaloni',
  '/images/news-3-model.jpg',
  '/images/news-3-product.jpg',
  1, 1, 3
);

-- news-4
INSERT OR IGNORE INTO products
  (id, slug, sku_prefix, title, description, material, care_guide, gender, tag,
   size_and_fit_json, composition_care_json, shipping_returns_json,
   price_paise, compare_paise, badge, section_group, category_id,
   default_img, hover_img, is_active, is_featured, sort_order)
VALUES (
  'news-4',
  'lambskin-crossbody-mini-bag',
  'DD-NW4-01',
  'Lambskin Crossbody Mini Bag',
  'A miniature statement. Quilted lambskin with gold-tone chain strap, magnetic snap closure and a suede-lined interior.',
  '100% Lambskin',
  'Store stuffed with tissue in dust bag. Avoid contact with water and sharp objects.',
  'Women',
  'NEW',
  '["Dimensions: 20 W × 14 H × 7 D cm","Chain drop: 55 cm (crossbody); 27 cm (shoulder)","Interior: one main compartment with slip pocket"]',
  '["Exterior: 100% Lambskin (quilted)","Chain: Gold-tone brass","Lining: 100% Suede","Spot clean with specialist leather cloth only"]',
  '["Free express shipping on orders over ₹10,000","Returns accepted within 14 days of delivery","Items must be unworn, unaltered and in original packaging","Final-sale items are non-returnable"]',
  198000,  -- ₹1,980  (€220 × 90)
  NULL,
  'NEW IN',
  'news',
  'cat-borse',
  '/images/news-4-model.jpg',
  '/images/news-4-product.jpg',
  1, 1, 4
);

-- news-5  (CORRECTED slug: automatic-chronograph-timepiece-with-alligator-strap)
INSERT OR IGNORE INTO products
  (id, slug, sku_prefix, title, description, material, care_guide, gender, tag,
   size_and_fit_json, composition_care_json, shipping_returns_json,
   price_paise, compare_paise, badge, section_group, category_id,
   default_img, hover_img, is_active, is_featured, sort_order)
VALUES (
  'news-5',
  'automatic-chronograph-timepiece-with-alligator-strap',
  'DD-NW5-01',
  'Automatic Chronograph Timepiece with Alligator Strap',
  'A self-winding chronograph with a sunbrushed dial, 60-hour power reserve, and a hand-stitched alligator strap with deployant clasp.',
  'Stainless Steel case; Sapphire crystal; Alligator strap',
  'Service every 5 years. Keep away from magnets and extreme temperatures. Store in provided watch box.',
  'Unisex',
  'LIMITED',
  '["Case diameter: 40 mm","Lug-to-lug: 47 mm","Water resistance: 50 m","Strap width: 20 mm"]',
  '["Case: 316L Stainless Steel","Crystal: Anti-reflective sapphire","Movement: Automatic chronograph, 28,800 vph","Strap: Grade A Alligator; Deployant clasp in stainless steel"]',
  '["Free express shipping on orders over ₹10,000","Returns accepted within 14 days of delivery","Items must be unworn, unaltered and in original packaging","Final-sale items are non-returnable"]',
  720000,  -- ₹7,200  (€800 × 90)
  NULL,
  'LIMITED',
  'news',
  'cat-accessori',
  '/images/news-5-model.jpg',
  '/images/news-5-product.jpg',
  1, 1, 5
);

-- ------------------------------------
-- CADY-TROUSERS  (Flagship PDP product)
-- section_group = 'mastery' | sort_order = 0 (renders first)
-- ------------------------------------
INSERT OR IGNORE INTO products
  (id, slug, sku_prefix, title, description, material, care_guide, gender, tag,
   size_and_fit_json, composition_care_json, shipping_returns_json,
   price_paise, compare_paise, badge, section_group, category_id,
   default_img, hover_img, is_active, is_featured, sort_order)
VALUES (
  'cady-trousers',
  'cady-trousers',
  'DD-CDY-01',
  'Cady Trousers',
  'Precision-cut from a structured cady weave with a flat front and straight leg, these trousers define effortless sophistication. Finished with an invisible side zip and tailored waistband.',
  '72% Viscose, 28% Polyester (Cady)',
  'Dry clean recommended. Iron on low heat inside-out using a pressing cloth.',
  'Women',
  'JOGGING',
  '["Model is 175 cm / 5''9\" and wears size IT 40","Slim straight fit — true to size","Inseam: 78 cm in size IT 40","Rise: mid-high (28 cm)"]',
  '["72% Viscose, 28% Polyester (Cady weave)","Lining: 100% Viscose","Dry clean recommended","Iron on low heat, reverse side, using a pressing cloth","Do not bleach or tumble dry"]',
  '["Free express shipping on orders over ₹10,000","Returns accepted within 14 days of delivery","Items must be unworn, unaltered and in original packaging","Final-sale items are non-returnable"]',
  6750000,  -- ₹67,500  (€750 × 90)
  NULL,
  NULL,
  'mastery',
  'cat-pantaloni',
  '/images/cady-trousers-model.jpg',
  '/images/cady-trousers-product.jpg',
  1, 1, 0
);

-- =============================================================================
-- SECTION 3: PRODUCT VARIANTS
-- Naming: <product-id>-<size-normalized>
-- All prices live on products; variants carry stock only.
-- =============================================================================

-- ---- mastery-1 : Tailored Virgin Wool Suit — sizes IT 46–54 ----
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, stock, reserved_stock) VALUES
  ('mastery-1-IT46', 'mastery-1', 'DD-MS1-01-IT46', 'IT 46', 'Charcoal', '#36454F', 25, 0),
  ('mastery-1-IT48', 'mastery-1', 'DD-MS1-01-IT48', 'IT 48', 'Charcoal', '#36454F', 30, 0),
  ('mastery-1-IT50', 'mastery-1', 'DD-MS1-01-IT50', 'IT 50', 'Charcoal', '#36454F', 35, 0),
  ('mastery-1-IT52', 'mastery-1', 'DD-MS1-01-IT52', 'IT 52', 'Charcoal', '#36454F', 20, 0),
  ('mastery-1-IT54', 'mastery-1', 'DD-MS1-01-IT54', 'IT 54', 'Charcoal', '#36454F', 10, 0);

-- ---- mastery-2 : Wool Overcoat — sizes IT 46–54 ----
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, stock, reserved_stock) VALUES
  ('mastery-2-IT46', 'mastery-2', 'DD-MS2-01-IT46', 'IT 46', 'Camel', '#C19A6B', 20, 0),
  ('mastery-2-IT48', 'mastery-2', 'DD-MS2-01-IT48', 'IT 48', 'Camel', '#C19A6B', 25, 0),
  ('mastery-2-IT50', 'mastery-2', 'DD-MS2-01-IT50', 'IT 50', 'Camel', '#C19A6B', 30, 0),
  ('mastery-2-IT52', 'mastery-2', 'DD-MS2-01-IT52', 'IT 52', 'Camel', '#C19A6B', 15, 0),
  ('mastery-2-IT54', 'mastery-2', 'DD-MS2-01-IT54', 'IT 54', 'Camel', '#C19A6B',  8, 0);

-- ---- mastery-3 : Shirt Trio — collar sizes 38–44 ----
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, stock, reserved_stock) VALUES
  ('mastery-3-C38', 'mastery-3', 'DD-MS3-01-C38', 'Collar 38', 'White/Blue/White', '#FFFFFF', 20, 0),
  ('mastery-3-C39', 'mastery-3', 'DD-MS3-01-C39', 'Collar 39', 'White/Blue/White', '#FFFFFF', 25, 0),
  ('mastery-3-C40', 'mastery-3', 'DD-MS3-01-C40', 'Collar 40', 'White/Blue/White', '#FFFFFF', 30, 0),
  ('mastery-3-C41', 'mastery-3', 'DD-MS3-01-C41', 'Collar 41', 'White/Blue/White', '#FFFFFF', 25, 0),
  ('mastery-3-C42', 'mastery-3', 'DD-MS3-01-C42', 'Collar 42', 'White/Blue/White', '#FFFFFF', 20, 0),
  ('mastery-3-C43', 'mastery-3', 'DD-MS3-01-C43', 'Collar 43', 'White/Blue/White', '#FFFFFF', 15, 0),
  ('mastery-3-C44', 'mastery-3', 'DD-MS3-01-C44', 'Collar 44', 'White/Blue/White', '#FFFFFF', 10, 0);

-- ---- mastery-4 : Merino Turtleneck — sizes XS–XXL ----
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, stock, reserved_stock) VALUES
  ('mastery-4-XS',  'mastery-4', 'DD-MS4-01-XS',  'XS',  'Ivory', '#FFFFF0', 15, 0),
  ('mastery-4-S',   'mastery-4', 'DD-MS4-01-S',   'S',   'Ivory', '#FFFFF0', 20, 0),
  ('mastery-4-M',   'mastery-4', 'DD-MS4-01-M',   'M',   'Ivory', '#FFFFF0', 30, 0),
  ('mastery-4-L',   'mastery-4', 'DD-MS4-01-L',   'L',   'Ivory', '#FFFFF0', 25, 0),
  ('mastery-4-XL',  'mastery-4', 'DD-MS4-01-XL',  'XL',  'Ivory', '#FFFFF0', 20, 0),
  ('mastery-4-XXL', 'mastery-4', 'DD-MS4-01-XXL', 'XXL', 'Ivory', '#FFFFF0', 10, 0);

-- ---- mastery-5 : Dinner Jacket — sizes IT 46–54 ----
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, stock, reserved_stock) VALUES
  ('mastery-5-IT46', 'mastery-5', 'DD-MS5-01-IT46', 'IT 46', 'Midnight Black', '#111111', 10, 0),
  ('mastery-5-IT48', 'mastery-5', 'DD-MS5-01-IT48', 'IT 48', 'Midnight Black', '#111111', 15, 0),
  ('mastery-5-IT50', 'mastery-5', 'DD-MS5-01-IT50', 'IT 50', 'Midnight Black', '#111111', 20, 0),
  ('mastery-5-IT52', 'mastery-5', 'DD-MS5-01-IT52', 'IT 52', 'Midnight Black', '#111111', 10, 0),
  ('mastery-5-IT54', 'mastery-5', 'DD-MS5-01-IT54', 'IT 54', 'Midnight Black', '#111111',  5, 0);

-- ---- style-1 : Nappa Chelsea Flat — EU 35–41 ----
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, stock, reserved_stock) VALUES
  ('style-1-EU35', 'style-1', 'DD-ST1-01-EU35', 'EU 35', 'Black', '#111111', 10, 0),
  ('style-1-EU36', 'style-1', 'DD-ST1-01-EU36', 'EU 36', 'Black', '#111111', 15, 0),
  ('style-1-EU37', 'style-1', 'DD-ST1-01-EU37', 'EU 37', 'Black', '#111111', 20, 0),
  ('style-1-EU38', 'style-1', 'DD-ST1-01-EU38', 'EU 38', 'Black', '#111111', 25, 0),
  ('style-1-EU39', 'style-1', 'DD-ST1-01-EU39', 'EU 39', 'Black', '#111111', 20, 0),
  ('style-1-EU40', 'style-1', 'DD-ST1-01-EU40', 'EU 40', 'Black', '#111111', 15, 0),
  ('style-1-EU41', 'style-1', 'DD-ST1-01-EU41', 'EU 41', 'Black', '#111111', 10, 0);

-- ---- style-2 : Car Coat — sizes IT 36–44 ----
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, stock, reserved_stock) VALUES
  ('style-2-IT36', 'style-2', 'DD-ST2-01-IT36', 'IT 36', 'Stone', '#B0A898', 10, 0),
  ('style-2-IT38', 'style-2', 'DD-ST2-01-IT38', 'IT 38', 'Stone', '#B0A898', 15, 0),
  ('style-2-IT40', 'style-2', 'DD-ST2-01-IT40', 'IT 40', 'Stone', '#B0A898', 20, 0),
  ('style-2-IT42', 'style-2', 'DD-ST2-01-IT42', 'IT 42', 'Stone', '#B0A898', 15, 0),
  ('style-2-IT44', 'style-2', 'DD-ST2-01-IT44', 'IT 44', 'Stone', '#B0A898', 10, 0);

-- ---- style-3 : Cady Vest — sizes IT 36–46 ----
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, stock, reserved_stock) VALUES
  ('style-3-IT36', 'style-3', 'DD-ST3-01-IT36', 'IT 36', 'Butter', '#F9F5EC', 15, 0),
  ('style-3-IT38', 'style-3', 'DD-ST3-01-IT38', 'IT 38', 'Butter', '#F9F5EC', 20, 0),
  ('style-3-IT40', 'style-3', 'DD-ST3-01-IT40', 'IT 40', 'Butter', '#F9F5EC', 25, 0),
  ('style-3-IT42', 'style-3', 'DD-ST3-01-IT42', 'IT 42', 'Butter', '#F9F5EC', 20, 0),
  ('style-3-IT44', 'style-3', 'DD-ST3-01-IT44', 'IT 44', 'Butter', '#F9F5EC', 15, 0),
  ('style-3-IT46', 'style-3', 'DD-ST3-01-IT46', 'IT 46', 'Butter', '#F9F5EC', 10, 0);

-- ---- style-4 : Cashmere Beanie — One Size ----
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, stock, reserved_stock) VALUES
  ('style-4-OS', 'style-4', 'DD-ST4-01-OS', 'One Size', 'Ecru', '#F5F0E8', 50, 0);

-- ---- style-5 : Grain Leather Tote — One Size ----
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, stock, reserved_stock) VALUES
  ('style-5-OS', 'style-5', 'DD-ST5-01-OS', 'One Size', 'Cognac', '#9B4722', 20, 0);

-- ---- news-1 : Silk Slip Dress — sizes IT 34–46 ----
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, stock, reserved_stock) VALUES
  ('news-1-IT34', 'news-1', 'DD-NW1-01-IT34', 'IT 34', 'Champagne', '#F7E7CE', 10, 0),
  ('news-1-IT36', 'news-1', 'DD-NW1-01-IT36', 'IT 36', 'Champagne', '#F7E7CE', 15, 0),
  ('news-1-IT38', 'news-1', 'DD-NW1-01-IT38', 'IT 38', 'Champagne', '#F7E7CE', 20, 0),
  ('news-1-IT40', 'news-1', 'DD-NW1-01-IT40', 'IT 40', 'Champagne', '#F7E7CE', 20, 0),
  ('news-1-IT42', 'news-1', 'DD-NW1-01-IT42', 'IT 42', 'Champagne', '#F7E7CE', 15, 0),
  ('news-1-IT44', 'news-1', 'DD-NW1-01-IT44', 'IT 44', 'Champagne', '#F7E7CE', 10, 0),
  ('news-1-IT46', 'news-1', 'DD-NW1-01-IT46', 'IT 46', 'Champagne', '#F7E7CE',  8, 0);

-- ---- news-2 : Suede Loafer — EU 39–46 ----
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, stock, reserved_stock) VALUES
  ('news-2-EU39', 'news-2', 'DD-NW2-01-EU39', 'EU 39', 'Cognac', '#9B4722', 10, 0),
  ('news-2-EU40', 'news-2', 'DD-NW2-01-EU40', 'EU 40', 'Cognac', '#9B4722', 15, 0),
  ('news-2-EU41', 'news-2', 'DD-NW2-01-EU41', 'EU 41', 'Cognac', '#9B4722', 20, 0),
  ('news-2-EU42', 'news-2', 'DD-NW2-01-EU42', 'EU 42', 'Cognac', '#9B4722', 20, 0),
  ('news-2-EU43', 'news-2', 'DD-NW2-01-EU43', 'EU 43', 'Cognac', '#9B4722', 15, 0),
  ('news-2-EU44', 'news-2', 'DD-NW2-01-EU44', 'EU 44', 'Cognac', '#9B4722', 10, 0),
  ('news-2-EU45', 'news-2', 'DD-NW2-01-EU45', 'EU 45', 'Cognac', '#9B4722',  8, 0),
  ('news-2-EU46', 'news-2', 'DD-NW2-01-EU46', 'EU 46', 'Cognac', '#9B4722',  5, 0);

-- ---- news-3 : Pleated Wool Trousers — sizes IT 46–54 ----
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, stock, reserved_stock) VALUES
  ('news-3-IT46', 'news-3', 'DD-NW3-01-IT46', 'IT 46', 'Slate Grey', '#708090', 15, 0),
  ('news-3-IT48', 'news-3', 'DD-NW3-01-IT48', 'IT 48', 'Slate Grey', '#708090', 20, 0),
  ('news-3-IT50', 'news-3', 'DD-NW3-01-IT50', 'IT 50', 'Slate Grey', '#708090', 25, 0),
  ('news-3-IT52', 'news-3', 'DD-NW3-01-IT52', 'IT 52', 'Slate Grey', '#708090', 15, 0),
  ('news-3-IT54', 'news-3', 'DD-NW3-01-IT54', 'IT 54', 'Slate Grey', '#708090', 10, 0);

-- ---- news-4 : Lambskin Crossbody — One Size ----
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, stock, reserved_stock) VALUES
  ('news-4-OS', 'news-4', 'DD-NW4-01-OS', 'One Size', 'Ecru', '#F5F0E8', 30, 0);

-- ---- news-5 : Chronograph Watch — One Size ----
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, stock, reserved_stock) VALUES
  ('news-5-OS', 'news-5', 'DD-NW5-01-OS', 'One Size', 'Steel/Black', '#36454F', 15, 0);

-- ---- cady-trousers : Flagship PDP — sizes IT 38–48 ----
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, stock, reserved_stock) VALUES
  ('cady-trousers-IT38', 'cady-trousers', 'DD-CDY-01-IT38', 'IT 38', 'Butter', '#F9F5EC', 30, 0),
  ('cady-trousers-IT40', 'cady-trousers', 'DD-CDY-01-IT40', 'IT 40', 'Butter', '#F9F5EC', 30, 0),
  ('cady-trousers-IT42', 'cady-trousers', 'DD-CDY-01-IT42', 'IT 42', 'Butter', '#F9F5EC', 30, 0),
  ('cady-trousers-IT44', 'cady-trousers', 'DD-CDY-01-IT44', 'IT 44', 'Butter', '#F9F5EC', 30, 0),
  ('cady-trousers-IT46', 'cady-trousers', 'DD-CDY-01-IT46', 'IT 46', 'Butter', '#F9F5EC', 30, 0),
  ('cady-trousers-IT48', 'cady-trousers', 'DD-CDY-01-IT48', 'IT 48', 'Butter', '#F9F5EC', 30, 0);

-- =============================================================================
-- SECTION 4: PRODUCT IMAGES
-- =============================================================================

-- mastery-1
INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-ms1-01', 'mastery-1', 'Charcoal', '/images/mastery-1-model.jpg',    'Tailored Virgin Wool Suit — front view',    0),
  ('img-ms1-02', 'mastery-1', 'Charcoal', '/images/mastery-1-product.jpg',  'Tailored Virgin Wool Suit — product view',  1),
  ('img-ms1-03', 'mastery-1', 'Charcoal', '/images/mastery-1-detail.jpg',   'Tailored Virgin Wool Suit — lapel detail',  2),
  ('img-ms1-04', 'mastery-1', 'Charcoal', '/images/mastery-1-back.jpg',     'Tailored Virgin Wool Suit — rear view',     3);

-- mastery-2
INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-ms2-01', 'mastery-2', 'Camel', '/images/mastery-2-model.jpg',   'Virgin Wool Overcoat — front view',   0),
  ('img-ms2-02', 'mastery-2', 'Camel', '/images/mastery-2-product.jpg', 'Virgin Wool Overcoat — product view', 1),
  ('img-ms2-03', 'mastery-2', 'Camel', '/images/mastery-2-scarf.jpg',   'Cashmere Scarf — detail view',        2),
  ('img-ms2-04', 'mastery-2', 'Camel', '/images/mastery-2-back.jpg',    'Virgin Wool Overcoat — rear view',    3);

-- mastery-3
INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-ms3-01', 'mastery-3', 'White/Blue/White', '/images/mastery-3-model.jpg',   'Dress Shirts Trio — model view',    0),
  ('img-ms3-02', 'mastery-3', 'White/Blue/White', '/images/mastery-3-product.jpg', 'Dress Shirts Trio — product view',  1),
  ('img-ms3-03', 'mastery-3', 'White/Blue/White', '/images/mastery-3-detail.jpg',  'Poplin Shirt — collar detail',      2),
  ('img-ms3-04', 'mastery-3', 'White/Blue/White', '/images/mastery-3-spread.jpg',  'All three shirts — flat lay',       3);

-- mastery-4
INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-ms4-01', 'mastery-4', 'Ivory', '/images/mastery-4-model.jpg',   'Merino Turtleneck — front view',   0),
  ('img-ms4-02', 'mastery-4', 'Ivory', '/images/mastery-4-product.jpg', 'Merino Turtleneck — product view', 1),
  ('img-ms4-03', 'mastery-4', 'Ivory', '/images/mastery-4-detail.jpg',  'Merino Turtleneck — rib detail',   2);

-- mastery-5
INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-ms5-01', 'mastery-5', 'Midnight Black', '/images/mastery-5-model.jpg',   'Peak Lapel Dinner Jacket — front view',   0),
  ('img-ms5-02', 'mastery-5', 'Midnight Black', '/images/mastery-5-product.jpg', 'Peak Lapel Dinner Jacket — product view', 1),
  ('img-ms5-03', 'mastery-5', 'Midnight Black', '/images/mastery-5-lapel.jpg',   'Peak Lapel Dinner Jacket — lapel detail', 2),
  ('img-ms5-04', 'mastery-5', 'Midnight Black', '/images/mastery-5-back.jpg',    'Peak Lapel Dinner Jacket — rear view',    3);

-- style-1
INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-st1-01', 'style-1', 'Black', '/images/style-1-model.jpg',   'Nappa Chelsea Flat — side view',    0),
  ('img-st1-02', 'style-1', 'Black', '/images/style-1-product.jpg', 'Nappa Chelsea Flat — product view', 1),
  ('img-st1-03', 'style-1', 'Black', '/images/style-1-sole.jpg',    'Nappa Chelsea Flat — sole detail',  2);

-- style-2
INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-st2-01', 'style-2', 'Stone', '/images/style-2-model.jpg',   'Stand-Collar Car Coat — front view',   0),
  ('img-st2-02', 'style-2', 'Stone', '/images/style-2-product.jpg', 'Stand-Collar Car Coat — product view', 1),
  ('img-st2-03', 'style-2', 'Stone', '/images/style-2-collar.jpg',  'Stand-Collar Car Coat — collar detail',2),
  ('img-st2-04', 'style-2', 'Stone', '/images/style-2-back.jpg',    'Stand-Collar Car Coat — rear view',    3);

-- style-3
INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-st3-01', 'style-3', 'Butter', '/images/style-3-model.jpg',   'Cady Crêpe Tailored Vest — front view',   0),
  ('img-st3-02', 'style-3', 'Butter', '/images/style-3-product.jpg', 'Cady Crêpe Tailored Vest — product view', 1),
  ('img-st3-03', 'style-3', 'Butter', '/images/style-3-detail.jpg',  'Cady Crêpe Tailored Vest — button detail',2);

-- style-4
INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-st4-01', 'style-4', 'Ecru', '/images/style-4-model.jpg',   'Cashmere Blend Beanie — worn view',    0),
  ('img-st4-02', 'style-4', 'Ecru', '/images/style-4-product.jpg', 'Cashmere Blend Beanie — product view', 1);

-- style-5
INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-st5-01', 'style-5', 'Cognac', '/images/style-5-model.jpg',   'Grain Leather Tote — front view',    0),
  ('img-st5-02', 'style-5', 'Cognac', '/images/style-5-product.jpg', 'Grain Leather Tote — product view',  1),
  ('img-st5-03', 'style-5', 'Cognac', '/images/style-5-open.jpg',    'Grain Leather Tote — interior view', 2);

-- news-1
INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-nw1-01', 'news-1', 'Champagne', '/images/news-1-model.jpg',   'Silk Satin Slip Dress — model view',   0),
  ('img-nw1-02', 'news-1', 'Champagne', '/images/news-1-product.jpg', 'Silk Satin Slip Dress — product view', 1),
  ('img-nw1-03', 'news-1', 'Champagne', '/images/news-1-back.jpg',    'Silk Satin Slip Dress — back view',    2),
  ('img-nw1-04', 'news-1', 'Champagne', '/images/news-1-detail.jpg',  'Silk Satin Slip Dress — strap detail', 3);

-- news-2
INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-nw2-01', 'news-2', 'Cognac', '/images/news-2-model.jpg',   'Hand-Stitched Suede Loafer — side view',    0),
  ('img-nw2-02', 'news-2', 'Cognac', '/images/news-2-product.jpg', 'Hand-Stitched Suede Loafer — product view', 1),
  ('img-nw2-03', 'news-2', 'Cognac', '/images/news-2-sole.jpg',    'Hand-Stitched Suede Loafer — sole detail',  2),
  ('img-nw2-04', 'news-2', 'Cognac', '/images/news-2-stitch.jpg',  'Hand-Stitched Suede Loafer — apron stitch', 3);

-- news-3
INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-nw3-01', 'news-3', 'Slate Grey', '/images/news-3-model.jpg',   'Pleated High-Rise Trousers — front view',   0),
  ('img-nw3-02', 'news-3', 'Slate Grey', '/images/news-3-product.jpg', 'Pleated High-Rise Trousers — product view', 1),
  ('img-nw3-03', 'news-3', 'Slate Grey', '/images/news-3-pleat.jpg',   'Pleated High-Rise Trousers — pleat detail', 2);

-- news-4
INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-nw4-01', 'news-4', 'Ecru', '/images/news-4-model.jpg',    'Lambskin Crossbody Mini Bag — worn view',     0),
  ('img-nw4-02', 'news-4', 'Ecru', '/images/news-4-product.jpg',  'Lambskin Crossbody Mini Bag — product view',  1),
  ('img-nw4-03', 'news-4', 'Ecru', '/images/news-4-interior.jpg', 'Lambskin Crossbody Mini Bag — interior view', 2);

-- news-5
INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-nw5-01', 'news-5', 'Steel/Black', '/images/news-5-model.jpg',   'Automatic Chronograph — wrist view',    0),
  ('img-nw5-02', 'news-5', 'Steel/Black', '/images/news-5-product.jpg', 'Automatic Chronograph — product view',  1),
  ('img-nw5-03', 'news-5', 'Steel/Black', '/images/news-5-dial.jpg',    'Automatic Chronograph — dial detail',   2),
  ('img-nw5-04', 'news-5', 'Steel/Black', '/images/news-5-strap.jpg',   'Automatic Chronograph — strap detail',  3);

-- cady-trousers (flagship PDP)
INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-cdy-01', 'cady-trousers', 'Butter', '/images/cady-trousers-model.jpg',   'Cady Trousers — model front view',    0),
  ('img-cdy-02', 'cady-trousers', 'Butter', '/images/cady-trousers-product.jpg', 'Cady Trousers — product flat view',   1),
  ('img-cdy-03', 'cady-trousers', 'Butter', '/images/cady-trousers-back.jpg',    'Cady Trousers — model rear view',     2),
  ('img-cdy-04', 'cady-trousers', 'Butter', '/images/cady-trousers-waist.jpg',   'Cady Trousers — waistband detail',    3),
  ('img-cdy-05', 'cady-trousers', 'Butter', '/images/cady-trousers-fabric.jpg',  'Cady Trousers — fabric texture',      4);

-- =============================================================================
-- SECTION 5: PRODUCT CROSS-SELLS
-- NOTE: Cross-sells for cady-trousers reference:
--   style_it_with -> 'cady-vest' (style-3) and 'nappa-flat' (style-1)
--   related       -> suggest-pants-1..4 (not yet in DB; add when those products
--                    are seeded in a future migration)
-- Only cross-sells with both products present in this seed are inserted.
-- =============================================================================

-- cady-trousers × cady-vest (style-3) — style_it_with
INSERT OR IGNORE INTO product_cross_sells (product_id, target_product_id, relation_type, sort_order) VALUES
  ('cady-trousers', 'style-3', 'style_it_with', 0);

-- cady-trousers × nappa-flat (style-1) — style_it_with
INSERT OR IGNORE INTO product_cross_sells (product_id, target_product_id, relation_type, sort_order) VALUES
  ('cady-trousers', 'style-1', 'style_it_with', 1);

-- mastery-1 suit × mastery-5 dinner jacket — related (complementary suiting)
INSERT OR IGNORE INTO product_cross_sells (product_id, target_product_id, relation_type, sort_order) VALUES
  ('mastery-1', 'mastery-5', 'related', 0),
  ('mastery-5', 'mastery-1', 'related', 0);

-- mastery-1 suit × mastery-3 shirts — style_it_with
INSERT OR IGNORE INTO product_cross_sells (product_id, target_product_id, relation_type, sort_order) VALUES
  ('mastery-1', 'mastery-3', 'style_it_with', 0),
  ('mastery-5', 'mastery-3', 'style_it_with', 0);

-- mastery-2 overcoat × mastery-4 turtleneck — style_it_with
INSERT OR IGNORE INTO product_cross_sells (product_id, target_product_id, relation_type, sort_order) VALUES
  ('mastery-2', 'mastery-4', 'style_it_with', 0);

-- style-2 car coat × style-3 vest — style_it_with
INSERT OR IGNORE INTO product_cross_sells (product_id, target_product_id, relation_type, sort_order) VALUES
  ('style-2', 'style-3', 'style_it_with', 0),
  ('style-3', 'style-2', 'related', 0);

-- news-3 trousers × cady-trousers — related
INSERT OR IGNORE INTO product_cross_sells (product_id, target_product_id, relation_type, sort_order) VALUES
  ('news-3', 'cady-trousers', 'related', 0),
  ('cady-trousers', 'news-3', 'related', 0);

-- =============================================================================
-- SECTION 6: COUPON — WELCOME10
-- 10% off, min order ₹5,000 (500000 paise), max discount ₹1,000 (100000 paise)
-- =============================================================================

INSERT OR IGNORE INTO coupons
  (id, code, discount_type, discount_value, min_order_paise, max_discount_paise, usage_limit, used_count, is_active, expires_at)
VALUES (
  'coupon-welcome10',
  'WELCOME10',
  'percentage',
  10,          -- 10%
  500000,      -- ₹5,000 minimum order
  100000,      -- ₹1,000 maximum discount
  1000,        -- 1,000 total uses
  0,
  1,
  NULL         -- no expiry
);
