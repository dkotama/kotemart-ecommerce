-- ============================================================
-- Kotemart Jastip — Migration v03
-- Adds: whatsapp_number on users
--       bought_price_jpy (actual cost admin paid, in ¥) on orders
--       custom_fee_idr   (admin's per-order custom IDR fee override) on orders
-- ============================================================

-- WhatsApp number for buyers so admin can contact them
ALTER TABLE users ADD COLUMN whatsapp_number TEXT;

-- Actual JPY the admin paid when buying the item (used for real HPP / PnL)
ALTER TABLE orders ADD COLUMN bought_price_jpy INTEGER;

-- Admin-set custom IDR fee per order (overrides the formula-based fee)
ALTER TABLE orders ADD COLUMN custom_fee_idr INTEGER;
