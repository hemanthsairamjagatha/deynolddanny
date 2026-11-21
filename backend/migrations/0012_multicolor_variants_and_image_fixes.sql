-- =============================================================================
-- DEYNOLD DANNY COMMERCE OS — Migration 0012
-- 1. Repairs all 12 legacy product_images paths to verified high-res photos
-- 2. Adds multi-colour variants, colour-shift photography, colour-wise pricing,
--    and size-wise pricing across Best Sellers (mastery) & New Arrivals (style_space)
-- 3. Syncs Homepage Carousel category filter tabs & colour filter bar config
-- =============================================================================

-- 1. Fix legacy product_images URLs
UPDATE product_images SET image_url = '/images/mastery-2-detail.jpg' WHERE id = 'img-ms2-03';
UPDATE product_images SET image_url = '/images/mastery-3-back.jpg'   WHERE id = 'img-ms3-04';
UPDATE product_images SET image_url = '/images/mastery-5-detail.jpg' WHERE id = 'img-ms5-03';
UPDATE product_images SET image_url = '/images/style-1-detail.jpg'   WHERE id = 'img-st1-03';
UPDATE product_images SET image_url = '/images/style-2-detail.jpg'   WHERE id = 'img-st2-03';
UPDATE product_images SET image_url = '/images/style-5-detail.jpg'   WHERE id = 'img-st5-03';
UPDATE product_images SET image_url = '/images/news-2-detail.jpg'    WHERE id = 'img-nw2-03';
UPDATE product_images SET image_url = '/images/news-2-back.jpg'      WHERE id = 'img-nw2-04';
UPDATE product_images SET image_url = '/images/news-3-detail.jpg'    WHERE id = 'img-nw3-03';
UPDATE product_images SET image_url = '/images/news-4-detail.jpg'    WHERE id = 'img-nw4-03';
UPDATE product_images SET image_url = '/images/news-5-detail.jpg'    WHERE id = 'img-nw5-03';
UPDATE product_images SET image_url = '/images/news-5-back.jpg'      WHERE id = 'img-nw5-04';

-- 2. Multi-colour variants with colour-wise & size-wise pricing
-- cady-trousers: Butter (₹67,500), Nero Assoluto (₹69,500 / IT 48 ₹71,500), Sartorial Camel (₹72,500 / IT 48 ₹74,500)
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, price_paise, stock, reserved_stock, is_active, sort_order) VALUES
  ('cady-trousers-nero-IT38',  'cady-trousers', 'DD-CDY-NER-38', 'IT 38', 'Nero Assoluto',   '#1A1A1A', 6950000, 20, 0, 1, 7),
  ('cady-trousers-nero-IT40',  'cady-trousers', 'DD-CDY-NER-40', 'IT 40', 'Nero Assoluto',   '#1A1A1A', 6950000, 25, 0, 1, 8),
  ('cady-trousers-nero-IT42',  'cady-trousers', 'DD-CDY-NER-42', 'IT 42', 'Nero Assoluto',   '#1A1A1A', 6950000, 25, 0, 1, 9),
  ('cady-trousers-nero-IT44',  'cady-trousers', 'DD-CDY-NER-44', 'IT 44', 'Nero Assoluto',   '#1A1A1A', 6950000, 20, 0, 1, 10),
  ('cady-trousers-nero-IT46',  'cady-trousers', 'DD-CDY-NER-46', 'IT 46', 'Nero Assoluto',   '#1A1A1A', 6950000, 15, 0, 1, 11),
  ('cady-trousers-nero-IT48',  'cady-trousers', 'DD-CDY-NER-48', 'IT 48', 'Nero Assoluto',   '#1A1A1A', 7150000, 12, 0, 1, 12),
  ('cady-trousers-camel-IT38', 'cady-trousers', 'DD-CDY-CAM-38', 'IT 38', 'Sartorial Camel', '#BF9B7B', 7250000, 18, 0, 1, 13),
  ('cady-trousers-camel-IT40', 'cady-trousers', 'DD-CDY-CAM-40', 'IT 40', 'Sartorial Camel', '#BF9B7B', 7250000, 22, 0, 1, 14),
  ('cady-trousers-camel-IT42', 'cady-trousers', 'DD-CDY-CAM-42', 'IT 42', 'Sartorial Camel', '#BF9B7B', 7250000, 22, 0, 1, 15),
  ('cady-trousers-camel-IT44', 'cady-trousers', 'DD-CDY-CAM-44', 'IT 44', 'Sartorial Camel', '#BF9B7B', 7250000, 18, 0, 1, 16),
  ('cady-trousers-camel-IT46', 'cady-trousers', 'DD-CDY-CAM-46', 'IT 46', 'Sartorial Camel', '#BF9B7B', 7250000, 15, 0, 1, 17),
  ('cady-trousers-camel-IT48', 'cady-trousers', 'DD-CDY-CAM-48', 'IT 48', 'Sartorial Camel', '#BF9B7B', 7450000, 10, 0, 1, 18);

INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-cdy-nero-01',  'cady-trousers', 'Nero Assoluto',   '/images/cady-trousers-back.jpg',    'Cady Trousers — Nero Assoluto Model',  10),
  ('img-cdy-nero-02',  'cady-trousers', 'Nero Assoluto',   '/images/cady-trousers-detail.jpg',  'Cady Trousers — Nero Assoluto Detail', 11),
  ('img-cdy-camel-01', 'cady-trousers', 'Sartorial Camel', '/images/cady-trousers-model-3.jpg', 'Cady Trousers — Sartorial Camel',      12),
  ('img-cdy-camel-02', 'cady-trousers', 'Sartorial Camel', '/images/cady-trousers-model-4.jpg', 'Cady Trousers — Sartorial Camel Back', 13);

-- mastery-1 (Tailored Virgin Wool Suit): Charcoal (₹2,700 / IT 54 ₹2,950), Midnight Navy (₹2,950 / IT 54 ₹3,200), Sartorial Camel (₹3,150 / IT 54 ₹3,400)
UPDATE product_variants SET price_paise = 295000 WHERE id = 'mastery-1-IT54' AND price_paise IS NULL;
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, price_paise, stock, reserved_stock, is_active, sort_order) VALUES
  ('mastery-1-navy-IT46',  'mastery-1', 'DD-MS1-NVY-46', 'IT 46', 'Midnight Navy',   '#1C2434', 295000, 20, 0, 1, 6),
  ('mastery-1-navy-IT48',  'mastery-1', 'DD-MS1-NVY-48', 'IT 48', 'Midnight Navy',   '#1C2434', 295000, 25, 0, 1, 7),
  ('mastery-1-navy-IT50',  'mastery-1', 'DD-MS1-NVY-50', 'IT 50', 'Midnight Navy',   '#1C2434', 295000, 25, 0, 1, 8),
  ('mastery-1-navy-IT52',  'mastery-1', 'DD-MS1-NVY-52', 'IT 52', 'Midnight Navy',   '#1C2434', 295000, 18, 0, 1, 9),
  ('mastery-1-navy-IT54',  'mastery-1', 'DD-MS1-NVY-54', 'IT 54', 'Midnight Navy',   '#1C2434', 320000, 12, 0, 1, 10),
  ('mastery-1-camel-IT46', 'mastery-1', 'DD-MS1-CAM-46', 'IT 46', 'Sartorial Camel', '#C19A6B', 315000, 15, 0, 1, 11),
  ('mastery-1-camel-IT48', 'mastery-1', 'DD-MS1-CAM-48', 'IT 48', 'Sartorial Camel', '#C19A6B', 315000, 20, 0, 1, 12),
  ('mastery-1-camel-IT50', 'mastery-1', 'DD-MS1-CAM-50', 'IT 50', 'Sartorial Camel', '#C19A6B', 315000, 20, 0, 1, 13),
  ('mastery-1-camel-IT52', 'mastery-1', 'DD-MS1-CAM-52', 'IT 52', 'Sartorial Camel', '#C19A6B', 315000, 14, 0, 1, 14),
  ('mastery-1-camel-IT54', 'mastery-1', 'DD-MS1-CAM-54', 'IT 54', 'Sartorial Camel', '#C19A6B', 340000, 10, 0, 1, 15);

INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-ms1-navy-01',  'mastery-1', 'Midnight Navy',   '/images/mastery-men-1.jpg',       'Tailored Suit — Midnight Navy',        10),
  ('img-ms1-navy-02',  'mastery-1', 'Midnight Navy',   '/images/mastery-men-1-hover.jpg', 'Tailored Suit — Midnight Navy Detail', 11),
  ('img-ms1-camel-01', 'mastery-1', 'Sartorial Camel', '/images/mastery-1-back.jpg',      'Tailored Suit — Sartorial Camel',      12),
  ('img-ms1-camel-02', 'mastery-1', 'Sartorial Camel', '/images/mastery-1-detail.jpg',    'Tailored Suit — Sartorial Camel Lapel',13);

-- mastery-2 (Virgin Wool Overcoat): Camel (₹4,500), Charcoal Melange (₹4,850 / IT 54 ₹5,100)
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, price_paise, stock, reserved_stock, is_active, sort_order) VALUES
  ('mastery-2-char-IT46', 'mastery-2', 'DD-MS2-CHR-46', 'IT 46', 'Charcoal Melange', '#3A3A3C', 485000, 18, 0, 1, 6),
  ('mastery-2-char-IT48', 'mastery-2', 'DD-MS2-CHR-48', 'IT 48', 'Charcoal Melange', '#3A3A3C', 485000, 22, 0, 1, 7),
  ('mastery-2-char-IT50', 'mastery-2', 'DD-MS2-CHR-50', 'IT 50', 'Charcoal Melange', '#3A3A3C', 485000, 25, 0, 1, 8),
  ('mastery-2-char-IT52', 'mastery-2', 'DD-MS2-CHR-52', 'IT 52', 'Charcoal Melange', '#3A3A3C', 485000, 15, 0, 1, 9),
  ('mastery-2-char-IT54', 'mastery-2', 'DD-MS2-CHR-54', 'IT 54', 'Charcoal Melange', '#3A3A3C', 510000, 10, 0, 1, 10);

INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-ms2-char-01', 'mastery-2', 'Charcoal Melange', '/images/mastery-men-2.jpg',       'Overcoat — Charcoal Melange',        10),
  ('img-ms2-char-02', 'mastery-2', 'Charcoal Melange', '/images/mastery-men-2-hover.jpg', 'Overcoat — Charcoal Melange Detail', 11);

-- mastery-3 (Dress Shirts Trio): White/Blue/White (₹1,980), Sky Blue Bengal (₹2,180)
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, price_paise, stock, reserved_stock, is_active, sort_order) VALUES
  ('mastery-3-sky-C38', 'mastery-3', 'DD-MS3-SKY-38', 'Collar 38', 'Sky Blue Bengal', '#C5D8E8', 218000, 18, 0, 1, 8),
  ('mastery-3-sky-C39', 'mastery-3', 'DD-MS3-SKY-39', 'Collar 39', 'Sky Blue Bengal', '#C5D8E8', 218000, 22, 0, 1, 9),
  ('mastery-3-sky-C40', 'mastery-3', 'DD-MS3-SKY-40', 'Collar 40', 'Sky Blue Bengal', '#C5D8E8', 218000, 25, 0, 1, 10),
  ('mastery-3-sky-C41', 'mastery-3', 'DD-MS3-SKY-41', 'Collar 41', 'Sky Blue Bengal', '#C5D8E8', 218000, 22, 0, 1, 11),
  ('mastery-3-sky-C42', 'mastery-3', 'DD-MS3-SKY-42', 'Collar 42', 'Sky Blue Bengal', '#C5D8E8', 218000, 18, 0, 1, 12),
  ('mastery-3-sky-C43', 'mastery-3', 'DD-MS3-SKY-43', 'Collar 43', 'Sky Blue Bengal', '#C5D8E8', 218000, 14, 0, 1, 13),
  ('mastery-3-sky-C44', 'mastery-3', 'DD-MS3-SKY-44', 'Collar 44', 'Sky Blue Bengal', '#C5D8E8', 235000, 10, 0, 1, 14);

INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-ms3-sky-01', 'mastery-3', 'Sky Blue Bengal', '/images/mastery-men-3.jpg',       'Dress Shirts — Sky Blue Bengal',        10),
  ('img-ms3-sky-02', 'mastery-3', 'Sky Blue Bengal', '/images/mastery-men-3-hover.jpg', 'Dress Shirts — Sky Blue Bengal Detail', 11);

-- mastery-4 (Merino Turtleneck): Ivory (₹1,440), Castagno Brown (₹1,640), Slate Blue (₹1,590)
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, price_paise, stock, reserved_stock, is_active, sort_order) VALUES
  ('mastery-4-brn-S',   'mastery-4', 'DD-MS4-BRN-S',   'S',   'Castagno Brown', '#4A2E1B', 164000, 20, 0, 1, 7),
  ('mastery-4-brn-M',   'mastery-4', 'DD-MS4-BRN-M',   'M',   'Castagno Brown', '#4A2E1B', 164000, 25, 0, 1, 8),
  ('mastery-4-brn-L',   'mastery-4', 'DD-MS4-BRN-L',   'L',   'Castagno Brown', '#4A2E1B', 164000, 25, 0, 1, 9),
  ('mastery-4-brn-XL',  'mastery-4', 'DD-MS4-BRN-XL',  'XL',  'Castagno Brown', '#4A2E1B', 174000, 18, 0, 1, 10),
  ('mastery-4-slt-S',   'mastery-4', 'DD-MS4-SLT-S',   'S',   'Slate Blue',     '#4E6D82', 159000, 18, 0, 1, 11),
  ('mastery-4-slt-M',   'mastery-4', 'DD-MS4-SLT-M',   'M',   'Slate Blue',     '#4E6D82', 159000, 22, 0, 1, 12),
  ('mastery-4-slt-L',   'mastery-4', 'DD-MS4-SLT-L',   'L',   'Slate Blue',     '#4E6D82', 159000, 22, 0, 1, 13),
  ('mastery-4-slt-XL',  'mastery-4', 'DD-MS4-SLT-XL',  'XL',  'Slate Blue',     '#4E6D82', 169000, 15, 0, 1, 14);

INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-ms4-brn-01', 'mastery-4', 'Castagno Brown', '/images/mastery-men-4.jpg',       'Merino Turtleneck — Castagno Brown',        10),
  ('img-ms4-brn-02', 'mastery-4', 'Castagno Brown', '/images/mastery-men-4-hover.jpg', 'Merino Turtleneck — Castagno Brown Detail', 11),
  ('img-ms4-slt-01', 'mastery-4', 'Slate Blue',     '/images/mastery-4-back.jpg',      'Merino Turtleneck — Slate Blue',            12),
  ('img-ms4-slt-02', 'mastery-4', 'Slate Blue',     '/images/mastery-4-detail.jpg',    'Merino Turtleneck — Slate Blue Detail',     13);

-- mastery-5 (Peak Lapel Dinner Jacket): Midnight Black (₹3,600), Bordeaux Velvet (₹3,950)
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, price_paise, stock, reserved_stock, is_active, sort_order) VALUES
  ('mastery-5-bdx-IT46', 'mastery-5', 'DD-MS5-BDX-46', 'IT 46', 'Bordeaux Velvet', '#6B2144', 395000, 12, 0, 1, 6),
  ('mastery-5-bdx-IT48', 'mastery-5', 'DD-MS5-BDX-48', 'IT 48', 'Bordeaux Velvet', '#6B2144', 395000, 16, 0, 1, 7),
  ('mastery-5-bdx-IT50', 'mastery-5', 'DD-MS5-BDX-50', 'IT 50', 'Bordeaux Velvet', '#6B2144', 395000, 18, 0, 1, 8),
  ('mastery-5-bdx-IT52', 'mastery-5', 'DD-MS5-BDX-52', 'IT 52', 'Bordeaux Velvet', '#6B2144', 395000, 12, 0, 1, 9),
  ('mastery-5-bdx-IT54', 'mastery-5', 'DD-MS5-BDX-54', 'IT 54', 'Bordeaux Velvet', '#6B2144', 420000,  8, 0, 1, 10);

INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-ms5-bdx-01', 'mastery-5', 'Bordeaux Velvet', '/images/mastery-men-5.jpg',       'Dinner Jacket — Bordeaux Velvet',        10),
  ('img-ms5-bdx-02', 'mastery-5', 'Bordeaux Velvet', '/images/mastery-men-5-hover.jpg', 'Dinner Jacket — Bordeaux Velvet Detail', 11);

-- style-1 (Nappa Leather Chelsea Flat): Black (₹1,170), Cognac (₹1,320)
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, price_paise, stock, reserved_stock, is_active, sort_order) VALUES
  ('style-1-cog-EU36', 'style-1', 'DD-ST1-COG-36', 'EU 36', 'Cognac', '#9B4722', 132000, 15, 0, 1, 8),
  ('style-1-cog-EU37', 'style-1', 'DD-ST1-COG-37', 'EU 37', 'Cognac', '#9B4722', 132000, 20, 0, 1, 9),
  ('style-1-cog-EU38', 'style-1', 'DD-ST1-COG-38', 'EU 38', 'Cognac', '#9B4722', 132000, 22, 0, 1, 10),
  ('style-1-cog-EU39', 'style-1', 'DD-ST1-COG-39', 'EU 39', 'Cognac', '#9B4722', 132000, 20, 0, 1, 11),
  ('style-1-cog-EU40', 'style-1', 'DD-ST1-COG-40', 'EU 40', 'Cognac', '#9B4722', 132000, 15, 0, 1, 12),
  ('style-1-cog-EU41', 'style-1', 'DD-ST1-COG-41', 'EU 41', 'Cognac', '#9B4722', 142000, 10, 0, 1, 13);

INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-st1-cog-01', 'style-1', 'Cognac', '/images/style-space-4.jpg',       'Nappa Chelsea Flat — Cognac',        10),
  ('img-st1-cog-02', 'style-1', 'Cognac', '/images/style-space-4-hover.jpg', 'Nappa Chelsea Flat — Cognac Detail', 11);

-- style-2 (Stand-Collar Car Coat): Stone (₹3,330), Anthracite (₹3,580)
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, price_paise, stock, reserved_stock, is_active, sort_order) VALUES
  ('style-2-ant-IT36', 'style-2', 'DD-ST2-ANT-36', 'IT 36', 'Anthracite', '#2B2E33', 358000, 12, 0, 1, 6),
  ('style-2-ant-IT38', 'style-2', 'DD-ST2-ANT-38', 'IT 38', 'Anthracite', '#2B2E33', 358000, 16, 0, 1, 7),
  ('style-2-ant-IT40', 'style-2', 'DD-ST2-ANT-40', 'IT 40', 'Anthracite', '#2B2E33', 358000, 20, 0, 1, 8),
  ('style-2-ant-IT42', 'style-2', 'DD-ST2-ANT-42', 'IT 42', 'Anthracite', '#2B2E33', 358000, 16, 0, 1, 9),
  ('style-2-ant-IT44', 'style-2', 'DD-ST2-ANT-44', 'IT 44', 'Anthracite', '#2B2E33', 378000, 10, 0, 1, 10);

INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-st2-ant-01', 'style-2', 'Anthracite', '/images/style-space-2.jpg',       'Car Coat — Anthracite',        10),
  ('img-st2-ant-02', 'style-2', 'Anthracite', '/images/style-space-2-hover.jpg', 'Car Coat — Anthracite Detail', 11);

-- style-3 (Cady Crêpe Tailored Vest): Butter (₹900), Taupe Melange (₹1,050)
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, price_paise, stock, reserved_stock, is_active, sort_order) VALUES
  ('style-3-tpe-IT38', 'style-3', 'DD-ST3-TPE-38', 'IT 38', 'Taupe Melange', '#8A7E72', 105000, 18, 0, 1, 7),
  ('style-3-tpe-IT40', 'style-3', 'DD-ST3-TPE-40', 'IT 40', 'Taupe Melange', '#8A7E72', 105000, 22, 0, 1, 8),
  ('style-3-tpe-IT42', 'style-3', 'DD-ST3-TPE-42', 'IT 42', 'Taupe Melange', '#8A7E72', 105000, 20, 0, 1, 9),
  ('style-3-tpe-IT44', 'style-3', 'DD-ST3-TPE-44', 'IT 44', 'Taupe Melange', '#8A7E72', 112000, 14, 0, 1, 10);

INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-st3-tpe-01', 'style-3', 'Taupe Melange', '/images/style-space-3.jpg',       'Cady Vest — Taupe Melange',        10),
  ('img-st3-tpe-02', 'style-3', 'Taupe Melange', '/images/style-space-3-hover.jpg', 'Cady Vest — Taupe Melange Detail', 11);

-- style-4 (Cashmere Blend Ribbed Beanie): Ecru (₹540), Espresso (₹620)
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, price_paise, stock, reserved_stock, is_active, sort_order) VALUES
  ('style-4-esp-OS', 'style-4', 'DD-ST4-ESP-OS', 'One Size', 'Espresso', '#32221A', 62000, 35, 0, 1, 2);

INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-st4-esp-01', 'style-4', 'Espresso', '/images/style-4-back.jpg',   'Cashmere Beanie — Espresso',        10),
  ('img-st4-esp-02', 'style-4', 'Espresso', '/images/style-4-detail.jpg', 'Cashmere Beanie — Espresso Detail', 11);

-- style-5 (Grain Leather Structured Tote): Cognac (₹2,250), Havana Amber (₹2,450)
INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color_name, color_hex, price_paise, stock, reserved_stock, is_active, sort_order) VALUES
  ('style-5-hav-OS', 'style-5', 'DD-ST5-HAV-OS', 'One Size', 'Havana Amber', '#754C24', 245000, 18, 0, 1, 2);

INSERT OR IGNORE INTO product_images (id, product_id, color_name, image_url, alt_text, sort_order) VALUES
  ('img-st5-hav-01', 'style-5', 'Havana Amber', '/images/style-space-5.jpg',       'Grain Leather Tote — Havana Amber',        10),
  ('img-st5-hav-02', 'style-5', 'Havana Amber', '/images/style-space-5-hover.jpg', 'Grain Leather Tote — Havana Amber Detail', 11);

-- 3. Sync Homepage Carousel Sections with 8 Category Filter Tabs & Colour Filter Bar
UPDATE cms_sections
SET draft_props_json = '{"sectionId":"mastery","eyebrow":"SIGNATURE SELECTION","title":"Our Best Sellers","sourceMode":"section","sectionGroup":"mastery","limit":12,"showModelView":true,"defaultModelView":true,"showColorFilter":true,"ctaLabel":"Shop Our Best Sellers","ctaUrl":"/categories","categories":[{"label":"ALL","value":"all"},{"label":"TAILORING","value":"tailoring"},{"label":"SHIRTS","value":"shirts"},{"label":"TROUSERS","value":"trousers"},{"label":"KNITWEAR","value":"knitwear"},{"label":"OUTERWEAR","value":"outerwear"},{"label":"FOOTWEAR","value":"footwear"},{"label":"ACCESSORIES","value":"accessories"}]}',
    published_props_json = '{"sectionId":"mastery","eyebrow":"SIGNATURE SELECTION","title":"Our Best Sellers","sourceMode":"section","sectionGroup":"mastery","limit":12,"showModelView":true,"defaultModelView":true,"showColorFilter":true,"ctaLabel":"Shop Our Best Sellers","ctaUrl":"/categories","categories":[{"label":"ALL","value":"all"},{"label":"TAILORING","value":"tailoring"},{"label":"SHIRTS","value":"shirts"},{"label":"TROUSERS","value":"trousers"},{"label":"KNITWEAR","value":"knitwear"},{"label":"OUTERWEAR","value":"outerwear"},{"label":"FOOTWEAR","value":"footwear"},{"label":"ACCESSORIES","value":"accessories"}]}'
WHERE id = 'sec_home_best_sellers';

UPDATE cms_sections
SET draft_props_json = '{"sectionId":"new-collection","eyebrow":"SEASONAL RELEASE","title":"NEW ARRIVAL","sourceMode":"section","sectionGroup":"style_space","limit":12,"showModelView":true,"defaultModelView":true,"showColorFilter":true,"ctaLabel":"Shop NEW ARRIVAL","ctaUrl":"/categories","categories":[{"label":"ALL","value":"all"},{"label":"TAILORING","value":"tailoring"},{"label":"SHIRTS","value":"shirts"},{"label":"TROUSERS","value":"trousers"},{"label":"KNITWEAR","value":"knitwear"},{"label":"OUTERWEAR","value":"outerwear"},{"label":"FOOTWEAR","value":"footwear"},{"label":"ACCESSORIES","value":"accessories"}]}',
    published_props_json = '{"sectionId":"new-collection","eyebrow":"SEASONAL RELEASE","title":"NEW ARRIVAL","sourceMode":"section","sectionGroup":"style_space","limit":12,"showModelView":true,"defaultModelView":true,"showColorFilter":true,"ctaLabel":"Shop NEW ARRIVAL","ctaUrl":"/categories","categories":[{"label":"ALL","value":"all"},{"label":"TAILORING","value":"tailoring"},{"label":"SHIRTS","value":"shirts"},{"label":"TROUSERS","value":"trousers"},{"label":"KNITWEAR","value":"knitwear"},{"label":"OUTERWEAR","value":"outerwear"},{"label":"FOOTWEAR","value":"footwear"},{"label":"ACCESSORIES","value":"accessories"}]}'
WHERE id = 'sec_home_new_arrival';
