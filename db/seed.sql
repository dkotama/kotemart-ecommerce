-- ============================================================
-- Kotemart Jastip Catalog — Development Seed Data v02
-- ============================================================

INSERT OR REPLACE INTO settings(key, value) VALUES
  ('gate_status',        'Open'),
  ('jpy_to_idr_rate',    '110.0'),
  ('global_fee_pct',     '5.0'),
  ('telegram_link',      'https://t.me/YOUR_GROUP'),
  ('product_categories', '["Elektronik","Figure","Snack","Pakaian","Skincare","Suplemen"]');

INSERT OR REPLACE INTO users(id, email, name, avatar_url, role, is_active, whatsapp_number) VALUES
  ('admin-001',  'admin@example.com',  'Admin Kotemart', NULL, 'admin', 1, NULL),
  ('buyer-001',  'buyer@example.com',  'Budi Santoso',   NULL, 'buyer', 1, '628111222333'),
  ('buyer-002',  'buyer2@example.com', 'Siti Rahayu',    NULL, 'buyer', 1, NULL),
  ('buyer-dis',  'disabled@example.com','Disabled User', NULL, 'buyer', 0, NULL);

-- Products (no price_jpy — moved to variants)
INSERT OR REPLACE INTO products(id, name, category, description, images) VALUES
  ('prod-001',
   'Keychron K3 Pro Low Profile Wireless Keyboard',
   'Elektronik',
   'Keyboard mekanis nirkabel low-profile dengan QMK/VIA. Layout 75%, cocok untuk produktivitas.',
   json_array('https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&q=80&w=800')),

  ('prod-002',
   'Gundam Aerial Rebuild HG 1/144',
   'Figure',
   'High Grade Gundam dari serial The Witch from Mercury. Detail tinggi, material premium Bandai.',
   json_array('https://images.unsplash.com/photo-1612404730960-5c71577fca11?auto=format&fit=crop&q=80&w=800')),

  ('prod-003',
   'Biore UV Aqua Rich Watery Essence SPF50+',
   'Skincare',
   'Sunscreen ringan best-seller Jepang. Tekstur gel berair, tidak lengket, cocok untuk kulit berminyak.',
   json_array('https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&q=80&w=800')),

  ('prod-004',
   'DHC Deep Cleansing Oil',
   'Skincare',
   'Pembersih makeup terlaris DHC. Formula minyak zaitun membersihkan pori tanpa iritasi.',
   json_array('https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=800')),

  ('prod-005',
   'Chocola BB Plus',
   'Suplemen',
   'Suplemen vitamin B2 populer untuk kesehatan kulit dan stamina. Formula aktif Eisai.',
   json_array('https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&q=80&w=800')),

  ('prod-deleted',
   'Deleted Product (Test)',
   'Elektronik',
   'This product is soft-deleted for testing purposes.',
   '[]');

UPDATE products SET is_deleted = 1 WHERE id = 'prod-deleted';

-- Variants
INSERT OR REPLACE INTO product_variants(id, product_id, variant_name, price_jpy, price_idr_estimate, product_url, sort_order) VALUES
  -- Keychron K3 Pro: Switch options (17600 * 110 * 1.05 = 2,032,800 → ceil 2,033,000)
  ('var-001-1', 'prod-001', 'Red Switch (Linear)',    17600, 2033000, NULL, 0),
  ('var-001-2', 'prod-001', 'Brown Switch (Tactile)', 17600, 2033000, NULL, 1),
  ('var-001-3', 'prod-001', 'Blue Switch (Clicky)',   17600, 2033000, NULL, 2),

  -- Gundam: single variant (1870 * 110 * 1.05 = 215,985 → ceil 216,000)
  ('var-002-1', 'prod-002', 'Standard Box', 1870, 216000, NULL, 0),

  -- Biore: size variants
  ('var-003-1', 'prod-003', '50g Tube',   1088, 126000, NULL, 0),
  ('var-003-2', 'prod-003', '100g Tube',  1182, 137000, NULL, 1),
  ('var-003-3', 'prod-003', '120g Pouch', 1650, 191000, NULL, 2),

  -- DHC: size variants
  ('var-004-1', 'prod-004', '70ml',  1200, 139000, NULL, 0),
  ('var-004-2', 'prod-004', '120ml', 1800, 208000, NULL, 1),
  ('var-004-3', 'prod-004', '200ml', 2600, 301000, NULL, 2),

  -- Chocola BB: quantity pack variants
  ('var-005-1', 'prod-005', '60 Tablet',           1160, 134000, NULL, 0),
  ('var-005-2', 'prod-005', '60 Tablet × 2 Pack',  2200, 255000, NULL, 1),
  ('var-005-3', 'prod-005', '60 Tablet × 4 Pack',  4200, 486000, NULL, 2);

-- Sample orders (use variant IDs)
INSERT OR REPLACE INTO orders(
  id, user_id, product_id, variant_id, type, name, qty, status,
  price_jpy, jpy_rate_snapshot, fee_pct_snapshot, price_idr_estimate, price_idr_final, created_at
) VALUES
  ('KTM-8472', 'buyer-001', 'prod-001', 'var-001-1', 'catalog',
   'Keychron K3 Pro Low Profile Wireless Keyboard',
   1, 'Draft', 17600, 110.0, 5.0, CAST(17600*110.0*1.05 AS INTEGER), NULL,
   datetime('now', '-1 day')),

  ('KTM-8470', 'buyer-001', NULL, NULL, 'custom',
   'Amazon JP: Artbook Cyberpunk 2077 Complete Edition',
   2, 'Pending', 4500, 110.0, 5.0, CAST(4500*110.0*1.05 AS INTEGER), NULL,
   datetime('now', '-2 days')),

  ('KTM-8455', 'buyer-001', 'prod-003', 'var-003-1', 'catalog',
   'Biore UV Aqua Rich Watery Essence SPF50+',
   2, 'Bought', 1088, 110.0, 5.0, CAST(1088*110.0*1.05 AS INTEGER), NULL,
   datetime('now', '-7 days')),

  ('KTM-8412', 'buyer-001', 'prod-004', 'var-004-2', 'catalog',
   'DHC Deep Cleansing Oil',
   1, 'Bought', 1800, 110.0, 5.0, CAST(1800*110.0*1.05 AS INTEGER), 215000,
   datetime('now', '-20 days')),

  ('KTM-8399', 'buyer-001', 'prod-005', 'var-005-1', 'catalog',
   'Chocola BB Plus',
   1, 'Cancelled', 1160, 110.0, 5.0, CAST(1160*110.0*1.05 AS INTEGER), NULL,
   datetime('now', '-28 days')),

  ('KTM-8500', 'buyer-002', 'prod-002', 'var-002-1', 'catalog',
   'Gundam Aerial Rebuild HG 1/144',
   2, 'Pending', 1870, 110.0, 5.0, CAST(1870*110.0*1.05 AS INTEGER), NULL,
   datetime('now', '-3 days'));

UPDATE orders SET cancelled_at = datetime('now', '-25 days'),
  cancellation_reason = 'Barang tidak tersedia di toko saat pengambilan.'
WHERE id = 'KTM-8399';

UPDATE orders SET settled_at = datetime('now', '-15 days'), bought_price_jpy = 1800 WHERE id = 'KTM-8412';
