// ============================================================
// Kotemart Jastip Catalog — Shared TypeScript Types
// ============================================================

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: 'buyer' | 'admin';
  is_active: number;
  whatsapp_number: string | null;
  created_at?: string;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_name: string;
  price_jpy: number;
  product_url: string | null;
  sort_order: number;
  is_deleted: number;
  created_at: string;
  price_idr_estimate?: number;
  images: string[];
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  images: string[];
  is_deleted: number;
  created_at: string;
  updated_at: string;
  // Joined fields — present on API responses
  variants: ProductVariant[];
  min_price_jpy: number;
  max_price_jpy: number;
  tags?: { id: string; name: string }[];
  notes: string[];
}

export type OrderStatus = 'Draft' | 'Pending' | 'Bought' | 'Cancelled';
export type OrderType = 'catalog' | 'custom';

export interface Order {
  id: string;
  user_id: string;
  product_id: string | null;
  variant_id: string | null;
  type: OrderType;
  name: string;
  description: string | null;
  reference_url: string | null;
  qty: number;
  status: OrderStatus;
  price_jpy: number | null;
  jpy_rate_snapshot: number;
  fee_pct_snapshot: number;
  price_idr_estimate: number | null;
  price_idr_final: number | null;
  manual_idr_override: number | null;
  bought_price_jpy: number | null;
  custom_fee_idr: number | null;
  down_payment_idr: number | null;
  paid_amount_idr: number;
  notes: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  settled_at: string | null;
  created_at: string;
}

export interface Settings {
  gate_status: 'Open' | 'Closed';
  jpy_to_idr_rate: number;
  global_fee_pct: number;
  telegram_link: string;
  product_categories: string[];
  arrival_notification?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  note_templates: string[];
}

// Extended order row from admin/profit queries (joined with buyer info)
export interface OrderRow extends Order {
  buyer_name: string;
  buyer_email: string;
  buyer_whatsapp?: string | null;
  buy_url?: string | null;
}

export const MASTER_CATEGORIES = ['Elektronik', 'Figure', 'Snack', 'Pakaian'] as const;
export type ProductCategory = typeof MASTER_CATEGORIES[number];

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  APP_BASE_URL: string;
}
