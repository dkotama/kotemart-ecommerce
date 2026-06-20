-- Kotemart Jastip Catalog — Migration v06
-- Add Stationery category + 2026 Japan Stationery Awards batch

-- 1. Add Stationery to product categories
INSERT OR REPLACE INTO settings (key, value)
SELECT 'product_categories', json_insert(value, '$[#]', 'Stationery')
FROM settings WHERE key = 'product_categories';

-- ============================================================
-- Product 1: Pilot Kire-Na Double-Sided Highlighters (2025 Grand Prize)
-- Amazon: ¥299/ea single, 5-color ~¥1,500
-- ============================================================
INSERT OR REPLACE INTO products (id, name, category, description, images)
VALUES ('prod-006', 'Pilot Kire-Na Double-Sided Highlighters', 'Stationery',
'Pemenang Grand Prize Japan Stationery Awards 2025. Highlighter dual-tip (fine+bold) dengan desain plastik pengarah unik yang membuat garis highlight selalu rapi. Tinta cepat kering anti-noda. Tersedia 5 warna.',
'["/images/products/pilot-kire-na-highlighters.jpg"]');

INSERT OR REPLACE INTO product_variants (id, product_id, variant_name, price_jpy, price_idr_estimate, product_url, sort_order)
VALUES
  ('var-006-1', 'prod-006', 'Single Yellow', 299, NULL, 'https://www.amazon.co.jp/-/en/dp/B0DMNRQ4QR', 0),
  ('var-006-2', 'prod-006', 'Single Orange', 299, NULL, 'https://www.amazon.co.jp/-/en/dp/B0DKXFP2SF', 1),
  ('var-006-3', 'prod-006', 'Single Pink',   299, NULL, 'https://www.amazon.co.jp/-/en/dp/B0DMNT3HQ6', 2),
  ('var-006-4', 'prod-006', 'Single Blue',   299, NULL, 'https://www.amazon.co.jp/-/en/dp/B0DL4XFPD5', 3),
  ('var-006-5', 'prod-006', '5-Color Set',  1500, NULL, NULL, 4);

-- ============================================================
-- Product 2: Pilot Juice+ Gel Pens (2026 Ball Pen Award)
-- Amazon: ¥121/ea single, ¥495/3-set, ¥1,500/8-set
-- ============================================================
INSERT OR REPLACE INTO products (id, name, category, description, images)
VALUES ('prod-007', 'Pilot Juice+ Gel Pens', 'Stationery',
'Pemenang Ball Pen Award Japan Stationery Awards 2026. Versi upgrade Juice Up dengan synergy tip 0.4mm untuk tulisan halus & presisi. Warna unik seperti Sakura, Nemophila. Tersedia single, 3-set, 8-set.',
'["/images/products/pilot-juice-plus-gel-pens.jpg"]');

INSERT OR REPLACE INTO product_variants (id, product_id, variant_name, price_jpy, price_idr_estimate, product_url, sort_order)
VALUES
  ('var-007-1', 'prod-007', '0.4mm Black',    121, NULL, 'https://www.amazon.co.jp/-/en/dp/B0FW4RZC5K', 0),
  ('var-007-2', 'prod-007', '0.4mm 3-Color',  495, NULL, 'https://www.amazon.co.jp/-/en/dp/B0FW4S44LD', 1),
  ('var-007-3', 'prod-007', '0.4mm 8-Color', 1500, NULL, 'https://www.amazon.co.jp/-/en/dp/B0FYNM3H1S', 2);

-- ============================================================
-- Product 3: Pilot FriXion Synergy 3-Color Multi Pen (2026 Functionality Award)
-- Amazon: ¥821
-- ============================================================
INSERT OR REPLACE INTO products (id, name, category, description, images)
VALUES ('prod-008', 'Pilot FriXion Synergy 3 Color Multi Pen', 'Stationery',
'Pemenang Functionality Award Japan Stationery Awards 2026. Tinta termo-sensitif FriXion (bisa dihapus). 3 warna (hitam-biru-merah). Synergy tip halus & presisi. Body ramping cocok untuk planner & catatan.',
'["/images/products/pilot-frixion-synergy-multi-pen.jpg"]');

INSERT OR REPLACE INTO product_variants (id, product_id, variant_name, price_jpy, price_idr_estimate, product_url, sort_order)
VALUES
  ('var-008-1', 'prod-008', '0.4mm Navy', 821, NULL, NULL, 0);

-- ============================================================
-- Product 4: Seed Kado Loop Eraser (2026 Eraser Award)
-- Amazon: ¥415
-- ============================================================
INSERT OR REPLACE INTO products (id, name, category, description, images)
VALUES ('prod-009', 'Seed Kado Loop Eraser', 'Stationery',
'Pemenang Eraser Award Japan Stationery Awards 2026. Penghapus unik yang bisa dibentuk ulang dengan air panas. Saat ujung tumpul, rendam di air panas & cetak ulang—kembali seperti baru! Karya inovasi kolaborasi dengan SD di Nagano.',
'["/images/products/seed-kado-loop-eraser.jpg"]');

INSERT OR REPLACE INTO product_variants (id, product_id, variant_name, price_jpy, price_idr_estimate, product_url, sort_order)
VALUES
  ('var-009-1', 'prod-009', 'Single', 415, NULL, 'https://www.amazon.co.jp/-/en/dp/B0F4PQL788', 0);

-- ============================================================
-- Product 5: Uni Kuru Toga Metal Mechanical Pencil (2025 Mechanical Pencil Award)
-- Amazon: ¥2,200
-- ============================================================
INSERT OR REPLACE INTO products (id, name, category, description, images)
VALUES ('prod-010', 'Uni Kuru Toga Metal Mechanical Pencil', 'Stationery',
'Pemenang Mechanical Pencil Award Japan Stationery Awards 2025. Mekanisme rotasi lead otomatis—ujung selalu tajam. Body alumunium kokoh dengan grip ergonomis. Sangat populer, sering habis.',
'["/images/products/uni-kuru-toga-metal-pencil.jpg"]');

INSERT OR REPLACE INTO product_variants (id, product_id, variant_name, price_jpy, price_idr_estimate, product_url, sort_order)
VALUES
  ('var-010-1', 'prod-010', '0.5mm Phantom Gray',  2200, NULL, 'https://www.amazon.co.jp/-/en/dp/B0D2BKQDC2', 0),
  ('var-010-2', 'prod-010', '0.5mm Silent Blue',   2200, NULL, 'https://www.amazon.co.jp/-/en/dp/B0D2BKKRP9', 1),
  ('var-010-3', 'prod-010', '0.5mm Nocturne Black', 2200, NULL, 'https://www.amazon.co.jp/-/en/dp/B0D2BLKHVG', 2);

-- ============================================================
-- Product 6: KOKUYO Campus Book Clips (2026 Clip Award)
-- Amazon: ~¥650
-- ============================================================
INSERT OR REPLACE INTO products (id, name, category, description, images)
VALUES ('prod-011', 'KOKUYO Campus Book Clips', 'Stationery',
'Pemenang Clip Award Japan Stationery Awards 2026. Dua klip terpisah, tahan kertas hingga 2.5cm. Bagian transparan tidak mengaburkan teks. Bisa dilipat dan disimpan di kotak pena. Warna hijau, mint, ungu tersedia.',
'["/images/products/kokuyo-campus-book-clips.jpg"]');

INSERT OR REPLACE INTO product_variants (id, product_id, variant_name, price_jpy, price_idr_estimate, product_url, sort_order)
VALUES
  ('var-011-1', 'prod-011', 'Single Green', 650, NULL, 'https://www.amazon.co.jp/-/en/dp/B0FLCG7G7X', 0);
