// ============================================================
// Kotemart Jastip Catalog — Hono API
// src/pages/api/[...path].ts
// ============================================================

import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { APIRoute } from 'astro';
import { env as cfEnv } from 'cloudflare:workers';

import { createSession, validateSession, deleteSession, generateToken } from '../../lib/session';
import { calcIdrEstimate, generateOrderId, getSettings } from '../../lib/pricing';
import type { Env, User, Order, OrderStatus, ProductVariant } from '../../lib/types';

// ============================================================
// Hono app bootstrap
// ============================================================

const app = new Hono<{ Bindings: Env; Variables: { user: User } }>().basePath('/api');

async function sha256(str: string): Promise<string> {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================
// Auth middleware factory
// ============================================================

const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: { user: User };
}>(async (c, next) => {
  // Check Authorization header first
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const rawToken = authHeader.substring(7).trim();
    const hash = await sha256(rawToken);

    const tokenRow = await c.env.DB.prepare(
      `SELECT * FROM api_tokens WHERE token_hash = ?1 AND revoked_at IS NULL`
    ).bind(hash).first<{ user_id: string; id: string }>();

    if (tokenRow) {
      const user = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?1 AND is_active = 1`)
        .bind(tokenRow.user_id).first<User>();
      if (user) {
        c.env.DB.prepare(`UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?1`)
          .bind(tokenRow.id).run().catch(() => {});
        c.set('user', user);
        return await next();
      }
    }
    return c.json({ error: 'Unauthorized: Invalid token' }, 401);
  }

  const token = getCookie(c, 'session');
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const user = await validateSession(c.env.DB, token);
  if (!user) {
    deleteCookie(c, 'session', { path: '/' });
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('user', user as User);
  await next();
});

const adminMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: { user: User };
}>(async (c, next) => {
  const user = c.get('user');
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }
  await next();
});

// ============================================================
// Helper: parse images JSON from DB
// ============================================================

function parseImages(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

// ============================================================
// Order status transition guard
// ============================================================

const STATUS_ORDER: Record<OrderStatus, number> = {
  Draft: 0,
  Pending: 1,
  Bought: 2,
  Cancelled: 99,
};

function isForwardTransition(current: OrderStatus, next: OrderStatus): boolean {
  if (next === 'Cancelled') return current !== 'Bought' && current !== 'Cancelled';
  return STATUS_ORDER[next] > STATUS_ORDER[current];
}

// ============================================================
// AUTH ROUTES
// ============================================================

const authRouter = new Hono<{ Bindings: Env; Variables: { user: User } }>();

// GET /api/auth/login — redirect to Google OAuth2
authRouter.get('/login', (c) => {
  const state = generateToken().slice(0, 32);
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${c.env.APP_BASE_URL}/api/auth/callback`,
    response_type: 'code',
    scope: 'openid profile email',
    state,
  });
  return c.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    302,
  );
});

// GET /api/auth/callback — exchange code, upsert user, create session
authRouter.get('/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) {
    return c.json({ error: 'Missing authorization code' }, 400);
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${c.env.APP_BASE_URL}/api/auth/callback`,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error('Token exchange failed:', body);
    return c.json({ error: 'Token exchange failed' }, 502);
  }

  const tokenData = await tokenRes.json<{ access_token: string }>();

  // Fetch user info
  const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) {
    return c.json({ error: 'Failed to fetch user info' }, 502);
  }

  const userInfo = await userRes.json<{
    sub: string;
    email: string;
    name: string;
    picture?: string;
  }>();

  // Upsert user in D1
  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, avatar_url, role, is_active)
     VALUES (?1, ?2, ?3, ?4, 'buyer', 1)
     ON CONFLICT(id) DO UPDATE SET
       email      = excluded.email,
       name       = excluded.name,
       avatar_url = excluded.avatar_url`,
  )
    .bind(userInfo.sub, userInfo.email, userInfo.name, userInfo.picture ?? null)
    .run();

  // Check if user is still active (could have been disabled)
  const dbUser = await c.env.DB.prepare(
    `SELECT is_active FROM users WHERE id = ?1`,
  )
    .bind(userInfo.sub)
    .first<{ is_active: number }>();

  if (!dbUser || dbUser.is_active !== 1) {
    return c.redirect('/disabled', 302);
  }

  // Create session and set cookie
  const sessionToken = await createSession(c.env.DB, userInfo.sub);
  setCookie(c, 'session', sessionToken, {
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: 86400,
    path: '/',
  });

  return c.redirect('/', 302);
});

// GET /api/auth/mock-login?role=buyer|admin — LOCAL DEV ONLY
authRouter.get('/mock-login', async (c) => {
  const baseUrl = c.env.APP_BASE_URL ?? '';
  if (!baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) {
    return c.json({ error: 'Not available in production' }, 403);
  }

  const role = c.req.query('role') === 'admin' ? 'admin' : 'buyer';
  const userId = role === 'admin' ? 'admin-001' : 'buyer-001';

  const sessionToken = await createSession(c.env.DB, userId);
  setCookie(c, 'session', sessionToken, {
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: 86400,
    path: '/',
  });

  return c.redirect('/', 302);
});

// POST /api/auth/logout
authRouter.post('/logout', async (c) => {
  const token = getCookie(c, 'session');
  if (token) {
    await deleteSession(c.env.DB, token);
  }
  deleteCookie(c, 'session', { path: '/' });
  return c.redirect('/', 303);
});

// GET /api/auth/me — requires auth
authRouter.get('/me', authMiddleware, (c) => {
  const user = c.get('user');
  return c.json(user);
});

// ============================================================
// GATE ROUTES
// ============================================================

const gateRouter = new Hono<{ Bindings: Env; Variables: { user: User } }>();

// GET /api/gate/status — public
gateRouter.get('/status', async (c) => {
  const settings = await getSettings(c.env.DB);
  return c.json({ status: settings.gate_status });
});

// POST /api/gate/toggle — admin only
gateRouter.post('/toggle', authMiddleware, adminMiddleware, async (c) => {
  const settings = await getSettings(c.env.DB);
  const newStatus = settings.gate_status === 'Open' ? 'Closed' : 'Open';
  await c.env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES ('gate_status', ?1, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(newStatus)
    .run();
  return c.json({ status: newStatus });
});

// ============================================================
// TAG ROUTES
// ============================================================

const tagRouter = new Hono<{ Bindings: Env; Variables: { user: User } }>();

// GET /api/tags
tagRouter.get('/', authMiddleware, async (c) => {
  const result = await c.env.DB.prepare(`SELECT * FROM tags ORDER BY name ASC`).all();
  return c.json(result.results || []);
});

// ============================================================
// PRODUCT ROUTES
// ============================================================

const productRouter = new Hono<{ Bindings: Env; Variables: { user: User } }>();

// Helper: fetch variants for a product (active only)
async function getVariants(db: D1Database, productId: string): Promise<ProductVariant[]> {
  const result = await db.prepare(
    `SELECT * FROM product_variants WHERE product_id = ?1 AND is_deleted = 0 ORDER BY sort_order ASC`
  ).bind(productId).all<Record<string, unknown>>();

  return (result.results || []).map(v => ({
    ...v,
    images: parseImages(v.images),
  })) as unknown as ProductVariant[];
}

async function getProductTags(db: D1Database, productId: string) {
  const result = await db.prepare(
    `SELECT t.id, t.name FROM tags t
     JOIN product_tags pt ON pt.tag_id = t.id
     WHERE pt.product_id = ?1`
  ).bind(productId).all();
  return result.results || [];
}

// Helper: build full product response
async function buildProductResponse(db: D1Database, p: Record<string, unknown>) {
  const [variants, tags] = await Promise.all([
    getVariants(db, p.id as string),
    getProductTags(db, p.id as string),
  ]);
  const prices = variants.map(v => v.price_jpy);
  const idrEstimates = variants.map(v => v.price_idr_estimate ?? 0);
  const min_price_jpy = prices.length ? Math.min(...prices) : 0;
  const max_price_jpy = prices.length ? Math.max(...prices) : 0;
  const min_price_idr_estimate = idrEstimates.length ? Math.min(...idrEstimates) : 0;
  const max_price_idr_estimate = idrEstimates.length ? Math.max(...idrEstimates) : 0;
  return {
    ...p,
    images: parseImages(p.images),
    notes: parseImages(p.notes),
    variants,
    tags,
    min_price_jpy,
    max_price_jpy,
    min_price_idr_estimate,
    max_price_idr_estimate,
  };
}

// GET /api/products
productRouter.get('/', authMiddleware, async (c) => {
  const category = c.req.query('category');
  const settings = await getSettings(c.env.DB);

  let query = `SELECT * FROM products WHERE is_deleted = 0`;
  const bindings: string[] = [];
  if (category) {
    query += ` AND category = ?1`;
    bindings.push(category);
  }
  query += ` ORDER BY created_at DESC`;

  const result = bindings.length
    ? await c.env.DB.prepare(query).bind(...bindings).all<Record<string, unknown>>()
    : await c.env.DB.prepare(query).all<Record<string, unknown>>();

  const products = await Promise.all(
    result.results.map(p => buildProductResponse(c.env.DB, p))
  );
  return c.json(products);
});

// GET /api/products/:id
productRouter.get('/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const settings = await getSettings(c.env.DB);

  const p = await c.env.DB.prepare(`SELECT * FROM products WHERE id = ?1 AND is_deleted = 0`)
    .bind(id).first<Record<string, unknown>>();

  if (!p) return c.json({ error: 'Product not found' }, 404);

  return c.json(await buildProductResponse(c.env.DB, p));
});

// POST /api/products — admin only
const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.string().min(1).max(100),
  description: z.string().default(''),
  images: z.array(z.string()).default([]),
  tag_ids: z.array(z.string()).optional().default([]),
  notes: z.array(z.string()).optional().default([]),
  variants: z.array(z.object({
    variant_name: z.string().min(1).max(255),
    price_jpy: z.number().int().min(0),
    product_url: z.string().optional().nullable(),
    images: z.array(z.string()).optional().default([]),
  })).min(1),
});

productRouter.post('/', authMiddleware, adminMiddleware, zValidator('json', createProductSchema), async (c) => {
  const body = c.req.valid('json');
  const settings = await getSettings(c.env.DB);
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO products (id, name, category, description, images, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
  ).bind(id, body.name, body.category, body.description, JSON.stringify(body.images), JSON.stringify(body.notes)).run();

  for (let i = 0; i < body.variants.length; i++) {
    const v = body.variants[i];
    const priceIdrEstimate = calcIdrEstimate(v.price_jpy, settings.jpy_to_idr_rate, settings.global_fee_pct);
    await c.env.DB.prepare(
      `INSERT INTO product_variants (id, product_id, variant_name, price_jpy, price_idr_estimate, product_url, sort_order, images) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    ).bind(crypto.randomUUID(), id, v.variant_name, v.price_jpy, priceIdrEstimate, v.product_url ?? null, i, JSON.stringify(v.images)).run();
  }

  if (body.tag_ids && body.tag_ids.length > 0) {
    for (const tagId of body.tag_ids) {
      await c.env.DB.prepare(`INSERT OR IGNORE INTO product_tags (product_id, tag_id) VALUES (?1, ?2)`)
        .bind(id, tagId).run();
    }
  }

  const created = await c.env.DB.prepare(`SELECT * FROM products WHERE id = ?1`).bind(id).first<Record<string, unknown>>();
  return c.json(await buildProductResponse(c.env.DB, created!), 201);
});

// PUT /api/products/:id — admin only, parent fields only
const updateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  images: z.array(z.string()).optional(),
  tag_ids: z.array(z.string()).optional(),
  notes: z.array(z.string()).optional(),
});

productRouter.put('/:id', authMiddleware, adminMiddleware, zValidator('json', updateProductSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const existing = await c.env.DB.prepare(`SELECT * FROM products WHERE id = ?1 AND is_deleted = 0`).bind(id).first();
  if (!existing) return c.json({ error: 'Product not found' }, 404);

  const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const values: unknown[] = [];
  let idx = 1;

  if (body.name !== undefined) { setClauses.push(`name = ?${idx++}`); values.push(body.name); }
  if (body.category !== undefined) { setClauses.push(`category = ?${idx++}`); values.push(body.category); }
  if (body.description !== undefined) { setClauses.push(`description = ?${idx++}`); values.push(body.description); }
  if (body.images !== undefined) { setClauses.push(`images = ?${idx++}`); values.push(JSON.stringify(body.images)); }
  if (body.notes !== undefined) { setClauses.push(`notes = ?${idx++}`); values.push(JSON.stringify(body.notes)); }
  values.push(id);

  await c.env.DB.prepare(`UPDATE products SET ${setClauses.join(', ')} WHERE id = ?${idx}`).bind(...values).run();

  if (body.tag_ids !== undefined) {
    await c.env.DB.prepare(`DELETE FROM product_tags WHERE product_id = ?1`).bind(id).run();
    for (const tagId of body.tag_ids) {
      await c.env.DB.prepare(`INSERT OR IGNORE INTO product_tags (product_id, tag_id) VALUES (?1, ?2)`)
        .bind(id, tagId).run();
    }
  }

  const settings = await getSettings(c.env.DB);
  const updated = await c.env.DB.prepare(`SELECT * FROM products WHERE id = ?1`).bind(id).first<Record<string, unknown>>();
  return c.json(await buildProductResponse(c.env.DB, updated!));
});

// DELETE /api/products/:id — soft delete
productRouter.delete('/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(`SELECT id FROM products WHERE id = ?1`).bind(id).first();
  if (!existing) return c.json({ error: 'Product not found' }, 404);
  await c.env.DB.prepare(`UPDATE products SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?1`).bind(id).run();
  return c.json({ ok: true });
});

// POST /api/products/:id/variants — add variant
const createVariantSchema = z.object({
  variant_name: z.string().min(1).max(255),
  price_jpy: z.number().int().min(0),
  product_url: z.string().optional().nullable(),
  images: z.array(z.string()).optional().default([]),
});

productRouter.post('/:id/variants', authMiddleware, adminMiddleware, zValidator('json', createVariantSchema), async (c) => {
  const productId = c.req.param('id');
  const body = c.req.valid('json');

  const product = await c.env.DB.prepare(`SELECT id FROM products WHERE id = ?1 AND is_deleted = 0`).bind(productId).first();
  if (!product) return c.json({ error: 'Product not found' }, 404);

  const settings = await getSettings(c.env.DB);
  const priceIdrEstimate = calcIdrEstimate(body.price_jpy, settings.jpy_to_idr_rate, settings.global_fee_pct);

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM product_variants WHERE product_id = ?1 AND is_deleted = 0`).bind(productId).first<{ cnt: number }>();
  const sort_order = countRow?.cnt ?? 0;

  const vid = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO product_variants (id, product_id, variant_name, price_jpy, price_idr_estimate, product_url, sort_order, images) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  ).bind(vid, productId, body.variant_name, body.price_jpy, priceIdrEstimate, body.product_url ?? null, sort_order, JSON.stringify(body.images)).run();

  const created = await c.env.DB.prepare(`SELECT * FROM product_variants WHERE id = ?1`).bind(vid).first();
  return c.json(created, 201);
});

// PUT /api/products/:id/variants/:vid
const updateVariantSchema = z.object({
  variant_name: z.string().min(1).max(255).optional(),
  price_jpy: z.number().int().min(0).optional(),
  product_url: z.string().optional().nullable(),
  images: z.array(z.string()).optional(),
});

productRouter.put('/:id/variants/:vid', authMiddleware, adminMiddleware, zValidator('json', updateVariantSchema), async (c) => {
  const vid = c.req.param('vid');
  const body = c.req.valid('json');

  const existing = await c.env.DB.prepare(`SELECT * FROM product_variants WHERE id = ?1 AND is_deleted = 0`).bind(vid).first();
  if (!existing) return c.json({ error: 'Variant not found' }, 404);

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (body.variant_name !== undefined) { setClauses.push(`variant_name = ?${idx++}`); values.push(body.variant_name); }
  if (body.price_jpy !== undefined) {
    setClauses.push(`price_jpy = ?${idx++}`);
    values.push(body.price_jpy);
    const settings = await getSettings(c.env.DB);
    const priceIdrEstimate = calcIdrEstimate(body.price_jpy, settings.jpy_to_idr_rate, settings.global_fee_pct);
    setClauses.push(`price_idr_estimate = ?${idx++}`);
    values.push(priceIdrEstimate);
  }
  if (body.product_url !== undefined) { setClauses.push(`product_url = ?${idx++}`); values.push(body.product_url); }
  if (body.images !== undefined) { setClauses.push(`images = ?${idx++}`); values.push(JSON.stringify(body.images)); }

  if (setClauses.length === 0) return c.json({ error: 'Nothing to update' }, 400);
  values.push(vid);

  await c.env.DB.prepare(`UPDATE product_variants SET ${setClauses.join(', ')} WHERE id = ?${idx}`).bind(...values).run();
  const updated = await c.env.DB.prepare(`SELECT * FROM product_variants WHERE id = ?1`).bind(vid).first();
  return c.json(updated);
});

// DELETE /api/products/:id/variants/:vid — soft delete
productRouter.delete('/:id/variants/:vid', authMiddleware, adminMiddleware, async (c) => {
  const productId = c.req.param('id');
  const vid = c.req.param('vid');

  const existing = await c.env.DB.prepare(`SELECT id FROM product_variants WHERE id = ?1 AND product_id = ?2 AND is_deleted = 0`).bind(vid, productId).first();
  if (!existing) return c.json({ error: 'Variant not found' }, 404);

  // Ensure at least 1 active variant remains
  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM product_variants WHERE product_id = ?1 AND is_deleted = 0`).bind(productId).first<{ cnt: number }>();
  if ((countRow?.cnt ?? 0) <= 1) return c.json({ error: 'Product must have at least one variant' }, 400);

  await c.env.DB.prepare(`UPDATE product_variants SET is_deleted = 1 WHERE id = ?1`).bind(vid).run();
  return c.json({ ok: true });
});

// POST /api/products/upload-photo — admin only, R2 upload
productRouter.post('/upload-photo', authMiddleware, adminMiddleware, async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No file provided' }, 400);
  }

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json({ error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' }, 400);
  }

  if (file.size > MAX_SIZE) {
    return c.json({ error: 'File too large. Maximum size is 5 MB.' }, 400);
  }

  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const ext = extMap[file.type];
  const key = `products/${crypto.randomUUID()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  await c.env.BUCKET.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
  });

  // Determine URL: for local dev serve via /api/photos proxy; for prod use R2 public domain
  const baseUrl = c.env.APP_BASE_URL ?? '';
  const isLocal = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
  const url = isLocal ? `/api/photos/${key}` : `${baseUrl}/api/photos/${key}`;

  return c.json({ url }, 201);
});

// ============================================================
// ORDER ROUTES (buyer)
// ============================================================

const orderRouter = new Hono<{ Bindings: Env; Variables: { user: User } }>();

// POST /api/orders — catalog order
const catalogOrderSchema = z.object({
  product_id: z.string().min(1),
  variant_id: z.string().min(1),
  qty: z.number().int().min(1),
});

orderRouter.post('/', authMiddleware, zValidator('json', catalogOrderSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const settings = await getSettings(c.env.DB);

  if (settings.gate_status !== 'Open') {
    return c.json({ error: 'Gate is closed. Orders are not accepted at this time.' }, 403);
  }

  const product = await c.env.DB.prepare(`SELECT * FROM products WHERE id = ?1 AND is_deleted = 0`)
    .bind(body.product_id).first<Record<string, unknown>>();
  if (!product) return c.json({ error: 'Product not found or unavailable' }, 404);

  const variant = await c.env.DB.prepare(
    `SELECT * FROM product_variants WHERE id = ?1 AND product_id = ?2 AND is_deleted = 0`
  ).bind(body.variant_id, body.product_id).first<Record<string, unknown>>();
  if (!variant) return c.json({ error: 'Variant not found or does not belong to this product' }, 404);

  const rate = settings.jpy_to_idr_rate;
  const feePct = settings.global_fee_pct;
  const priceJpy = variant.price_jpy as number;
  const priceIdrEstimate = calcIdrEstimate(priceJpy, rate, feePct);
  const orderId = await generateOrderId(c.env.DB);

  await c.env.DB.prepare(
    `INSERT INTO orders (
       id, user_id, product_id, variant_id, type, name,
       qty, status, price_jpy, jpy_rate_snapshot, fee_pct_snapshot,
       price_idr_estimate
     ) VALUES (?1, ?2, ?3, ?4, 'catalog', ?5, ?6, 'Draft', ?7, ?8, ?9, ?10)`
  ).bind(
    orderId, user.id, body.product_id, body.variant_id,
    product.name as string, body.qty,
    priceJpy, rate, feePct, priceIdrEstimate,
  ).run();

  const created = await c.env.DB.prepare(`SELECT * FROM orders WHERE id = ?1`).bind(orderId).first();
  return c.json(created, 201);
});

// POST /api/orders/custom — custom order
const customOrderSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  reference_url: z.string().url().optional().or(z.literal('')),
  qty: z.number().int().min(1),
  notes: z.string().optional(),
});

orderRouter.post(
  '/custom',
  authMiddleware,
  zValidator('json', customOrderSchema),
  async (c) => {
    const user = c.get('user');
    const body = c.req.valid('json');
    const settings = await getSettings(c.env.DB);

    if (settings.gate_status !== 'Open') {
      return c.json({ error: 'Gate is closed. Orders are not accepted at this time.' }, 403);
    }

    const orderId = await generateOrderId(c.env.DB);
    const rate = settings.jpy_to_idr_rate;
    const feePct = settings.global_fee_pct;

    await c.env.DB.prepare(
      `INSERT INTO orders (
         id, user_id, product_id, type, name, description, reference_url,
         qty, status, price_jpy, jpy_rate_snapshot, fee_pct_snapshot,
         price_idr_estimate, notes
       ) VALUES (?1, ?2, NULL, 'custom', ?3, ?4, ?5, ?6, 'Draft', NULL, ?7, ?8, NULL, ?9)`,
    )
      .bind(
        orderId,
        user.id,
        body.name,
        body.description ?? null,
        body.reference_url || null,
        body.qty,
        rate,
        feePct,
        body.notes ?? null,
      )
      .run();

    const created = await c.env.DB.prepare(`SELECT * FROM orders WHERE id = ?1`)
      .bind(orderId)
      .first();

    return c.json(created, 201);
  },
);

// GET /api/orders/mine — buyer's own orders
orderRouter.get('/mine', authMiddleware, async (c) => {
  const user = c.get('user');

  const result = await c.env.DB.prepare(
    `SELECT * FROM orders WHERE user_id = ?1 ORDER BY created_at DESC`,
  )
    .bind(user.id)
    .all<Order>();

  const LOCKED_STATUSES: OrderStatus[] = ['Pending', 'Bought'];
  const orders = result.results.map((order) => ({
    ...order,
    is_locked: LOCKED_STATUSES.includes(order.status),
  }));

  return c.json(orders);
});

// PATCH /api/orders/me/whatsapp — save buyer WhatsApp number
const whatsappSchema = z.object({
  whatsapp_number: z.union([
    z.literal(''),
    z.string().min(5).max(20).regex(/^[0-9+\-\s()]+$/, 'Invalid phone number format'),
  ]),
});

orderRouter.patch('/me/whatsapp', authMiddleware, zValidator('json', whatsappSchema), async (c) => {
  const user = c.get('user');
  const { whatsapp_number } = c.req.valid('json');
  await c.env.DB.prepare(
    `UPDATE users SET whatsapp_number = ?1 WHERE id = ?2`
  ).bind(whatsapp_number || null, user.id).run();
  return c.json({ ok: true });
});

// ============================================================
// ADMIN ROUTES
// ============================================================

const adminRouter = new Hono<{ Bindings: Env; Variables: { user: User } }>();

// All admin routes require auth + admin role
adminRouter.use('*', authMiddleware, adminMiddleware);

// POST /api/admin/tags — admin only
const tagSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(50),
});

adminRouter.post('/tags', zValidator('json', tagSchema), async (c) => {
  const body = c.req.valid('json');
  const id = body.id || crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO tags (id, name) VALUES (?1, ?2)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name
     ON CONFLICT(name) DO UPDATE SET id = id`
  ).bind(id, body.name).run();

  const created = await c.env.DB.prepare(`SELECT * FROM tags WHERE id = ?1 OR name = ?2`).bind(id, body.name).first();
  return c.json(created);
});

// DELETE /api/admin/tags/:id — admin only
adminRouter.delete('/tags/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare(`DELETE FROM tags WHERE id = ?1`).bind(id).run();
  return c.json({ ok: true });
});

// GET /api/admin/orders — all orders with buyer info
adminRouter.get('/orders', async (c) => {
  const status = c.req.query('status');
  const type = c.req.query('type');

  let query = `
    SELECT o.*, u.name AS buyer_name, u.email AS buyer_email
    FROM orders o
    JOIN users u ON u.id = o.user_id
    WHERE 1=1`;
  const bindings: string[] = [];
  let paramIdx = 1;

  if (status) {
    query += ` AND o.status = ?${paramIdx++}`;
    bindings.push(status);
  }
  if (type) {
    query += ` AND o.type = ?${paramIdx++}`;
    bindings.push(type);
  }
  query += ` ORDER BY o.created_at DESC`;

  const result = bindings.length
    ? await c.env.DB.prepare(query).bind(...bindings).all()
    : await c.env.DB.prepare(query).all();

  return c.json(result.results);
});

// PATCH /api/admin/orders/:id/status — advance order status
const patchStatusSchema = z.object({
  status: z.enum(['Pending', 'Bought']).optional(),
  price_jpy: z.number().int().min(0).optional(),
  bought_price_jpy: z.number().int().min(0).optional(),
  price_idr_final: z.number().int().min(0).optional(),
  custom_fee_idr: z.number().int().min(0).optional(),
  manual_idr_override: z.number().int().min(0).optional(),
});

adminRouter.patch('/orders/:id/status', zValidator('json', patchStatusSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const order = await c.env.DB.prepare(`SELECT * FROM orders WHERE id = ?1`)
    .bind(id)
    .first<Order>();

  if (!order) {
    return c.json({ error: 'Order not found' }, 404);
  }

  // Handle price_jpy update for custom orders
  if (body.price_jpy !== undefined) {
    if (order.type !== 'custom') {
      return c.json({ error: 'price_jpy can only be set on custom orders' }, 400);
    }
    const newEstimate = calcIdrEstimate(body.price_jpy, order.jpy_rate_snapshot, order.fee_pct_snapshot);
    await c.env.DB.prepare(
      `UPDATE orders SET price_jpy = ?1, price_idr_estimate = ?2 WHERE id = ?3`,
    )
      .bind(body.price_jpy, newEstimate, id)
      .run();
  }

  // Record actual bought price in JPY when admin marks as Bought
  if (body.bought_price_jpy !== undefined) {
    await c.env.DB.prepare(
      `UPDATE orders SET bought_price_jpy = ?1 WHERE id = ?2`
    ).bind(body.bought_price_jpy, id).run();
  }

  if (body.price_idr_final !== undefined) {
    await c.env.DB.prepare(
      `UPDATE orders SET price_idr_final = ?1 WHERE id = ?2`
    ).bind(body.price_idr_final, id).run();
  }
  if (body.custom_fee_idr !== undefined) {
    await c.env.DB.prepare(
      `UPDATE orders SET custom_fee_idr = ?1 WHERE id = ?2`
    ).bind(body.custom_fee_idr, id).run();
  }
  if (body.manual_idr_override !== undefined) {
    await c.env.DB.prepare(
      `UPDATE orders SET manual_idr_override = ?1 WHERE id = ?2`
    ).bind(body.manual_idr_override, id).run();
  }

  if (!body.status) {
    // Only field updates, no status change
    const updated = await c.env.DB.prepare(`SELECT * FROM orders WHERE id = ?1`).bind(id).first();
    return c.json(updated);
  }

  const newStatus = body.status;

  if (!isForwardTransition(order.status, newStatus)) {
    return c.json(
      { error: `Cannot transition from ${order.status} to ${newStatus}` },
      400,
    );
  }

  // Custom order going to Pending must have price_jpy set
  if (newStatus === 'Pending' && order.type === 'custom') {
    const currentPriceJpy = body.price_jpy ?? order.price_jpy;
    if (currentPriceJpy === null || currentPriceJpy === undefined) {
      return c.json(
        { error: 'Custom order must have price_jpy set before moving to Pending' },
        400,
      );
    }
  }

  if (newStatus === 'Bought') {
    await c.env.DB.prepare(
      `UPDATE orders SET status = ?1, settled_at = CURRENT_TIMESTAMP WHERE id = ?2`
    ).bind(newStatus, id).run();
  } else {
    await c.env.DB.prepare(`UPDATE orders SET status = ?1 WHERE id = ?2`)
      .bind(newStatus, id)
      .run();
  }

  const updated = await c.env.DB.prepare(`SELECT * FROM orders WHERE id = ?1`).bind(id).first();
  return c.json(updated);
});

// PATCH /api/admin/orders/:id/cancel
const cancelSchema = z.object({
  cancellation_reason: z.string().min(1).max(500),
});

adminRouter.patch('/orders/:id/cancel', zValidator('json', cancelSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const order = await c.env.DB.prepare(`SELECT * FROM orders WHERE id = ?1`)
    .bind(id)
    .first<Order>();

  if (!order) return c.json({ error: 'Order not found' }, 404);

  if (order.status === 'Bought' || order.status === 'Cancelled') {
    return c.json(
      { error: `Cannot cancel an order with status: ${order.status}` },
      400,
    );
  }

  await c.env.DB.prepare(
    `UPDATE orders
     SET status = 'Cancelled',
         cancellation_reason = ?1,
         cancelled_at = CURRENT_TIMESTAMP
     WHERE id = ?2`,
  )
    .bind(body.cancellation_reason, id)
    .run();

  const updated = await c.env.DB.prepare(`SELECT * FROM orders WHERE id = ?1`).bind(id).first();
  return c.json(updated);
});

// PATCH /api/admin/orders/:id/payment
const paymentSchema = z.object({
  down_payment_idr: z.number().int().min(0).optional(),
  paid_amount_idr: z.number().int().min(0).optional(),
});

adminRouter.patch('/orders/:id/payment', zValidator('json', paymentSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const order = await c.env.DB.prepare(`SELECT id FROM orders WHERE id = ?1`)
    .bind(id).first();
  if (!order) return c.json({ error: 'Order not found' }, 404);

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (body.down_payment_idr !== undefined) {
    updates.push(`down_payment_idr = ?${idx++}`);
    values.push(body.down_payment_idr);
  }
  if (body.paid_amount_idr !== undefined) {
    updates.push(`paid_amount_idr = ?${idx++}`);
    values.push(body.paid_amount_idr);
  }

  if (updates.length === 0) return c.json({ error: 'Nothing to update' }, 400);
  values.push(id);

  await c.env.DB.prepare(
    `UPDATE orders SET ${updates.join(', ')} WHERE id = ?${idx}`
  ).bind(...values).run();

  const updated = await c.env.DB.prepare(`SELECT * FROM orders WHERE id = ?1`).bind(id).first();
  return c.json(updated);
});

// GET /api/admin/settings
adminRouter.get('/settings', async (c) => {
  const settings = await getSettings(c.env.DB);
  return c.json(settings);
});

// GET /api/admin/tokens (admin only)
adminRouter.get('/tokens', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT id, label, created_at, last_used_at, revoked_at FROM api_tokens ORDER BY created_at DESC`
  ).all();
  return c.json(result.results || []);
});

// POST /api/admin/tokens (admin only, create token)
const createTokenSchema = z.object({
  label: z.string().min(1).max(100).default('AI Assistant'),
});
adminRouter.post('/tokens', zValidator('json', createTokenSchema), async (c) => {
  const body = c.req.valid('json');
  const user = c.get('user');
  const id = crypto.randomUUID();

  // Generate random token and hash it
  const rawToken = 'jastip_' + generateToken();
  const hash = await sha256(rawToken);

  await c.env.DB.prepare(
    `INSERT INTO api_tokens (id, user_id, token_hash, label) VALUES (?1, ?2, ?3, ?4)`
  ).bind(id, user.id, hash, body.label).run();

  return c.json({ id, label: body.label, token: rawToken }, 201);
});

// DELETE /api/admin/tokens/:id (admin only, soft-revoke token)
adminRouter.delete('/tokens/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare(
    `UPDATE api_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?1`
  ).bind(id).run();
  return c.json({ ok: true });
});

// PUT /api/admin/settings
const updateSettingsSchema = z.object({
  gate_status: z.enum(['Open', 'Closed']).optional(),
  jpy_to_idr_rate: z.number().positive().optional(),
  global_fee_pct: z.number().min(0).optional(),
  telegram_link: z.string().url().or(z.literal('')).optional(),
  product_categories: z.array(z.string().min(1)).min(1).optional(),
  arrival_notification: z.string().optional(),
  bank_name: z.string().optional(),
  bank_account_number: z.string().optional(),
  bank_account_name: z.string().optional(),
  note_templates: z.array(z.string().min(1)).optional(),
});

adminRouter.put('/settings', zValidator('json', updateSettingsSchema), async (c) => {
  const body = c.req.valid('json');

  const updates: Array<[string, string]> = [];

  if (body.gate_status !== undefined) updates.push(['gate_status', body.gate_status]);
  if (body.jpy_to_idr_rate !== undefined) updates.push(['jpy_to_idr_rate', String(body.jpy_to_idr_rate)]);
  if (body.global_fee_pct !== undefined) updates.push(['global_fee_pct', String(body.global_fee_pct)]);
  if (body.telegram_link !== undefined) updates.push(['telegram_link', body.telegram_link]);
  if (body.product_categories !== undefined) updates.push(['product_categories', JSON.stringify(body.product_categories)]);
  if (body.arrival_notification !== undefined) updates.push(['arrival_notification', body.arrival_notification]);
  if (body.bank_name !== undefined) updates.push(['bank_name', body.bank_name]);
  if (body.bank_account_number !== undefined) updates.push(['bank_account_number', body.bank_account_number]);
  if (body.bank_account_name !== undefined) updates.push(['bank_account_name', body.bank_account_name]);
  if (body.note_templates !== undefined) updates.push(['note_templates', JSON.stringify(body.note_templates)]);

  if (updates.length === 0) {
    return c.json({ error: 'No valid settings provided' }, 400);
  }

  for (const [key, value] of updates) {
    await c.env.DB.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    )
      .bind(key, value)
      .run();
  }

  // Recalculate all variant price_idr_estimates if rate or fee changed
  if (body.jpy_to_idr_rate !== undefined || body.global_fee_pct !== undefined) {
    const settings = await getSettings(c.env.DB);
    const rate = settings.jpy_to_idr_rate;
    const feePct = settings.global_fee_pct;
    const variants = await c.env.DB.prepare(
      `SELECT id, price_jpy FROM product_variants WHERE is_deleted = 0`
    ).all<{ id: string; price_jpy: number }>();
    for (const v of variants.results) {
      const newEstimate = calcIdrEstimate(v.price_jpy, rate, feePct);
      await c.env.DB.prepare(
        `UPDATE product_variants SET price_idr_estimate = ?1 WHERE id = ?2`
      ).bind(newEstimate, v.id).run();
    }
  }

  const settings = await getSettings(c.env.DB);
  return c.json(settings);
});

// GET /api/admin/users
adminRouter.get('/users', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT id, email, name, avatar_url, role, is_active, created_at FROM users ORDER BY created_at DESC`,
  ).all();
  return c.json(result.results);
});

// PATCH /api/admin/users/:id/toggle-access
adminRouter.patch('/users/:id/toggle-access', async (c) => {
  const targetId = c.req.param('id');
  const adminUser = c.get('user');

  if (targetId === adminUser.id) {
    return c.json({ error: 'Cannot disable your own account' }, 400);
  }

  const target = await c.env.DB.prepare(`SELECT id, is_active FROM users WHERE id = ?1`)
    .bind(targetId)
    .first<{ id: string; is_active: number }>();

  if (!target) return c.json({ error: 'User not found' }, 404);

  const newActive = target.is_active === 1 ? 0 : 1;
  await c.env.DB.prepare(`UPDATE users SET is_active = ?1 WHERE id = ?2`)
    .bind(newActive, targetId)
    .run();

  const updated = await c.env.DB.prepare(
    `SELECT id, email, name, avatar_url, role, is_active FROM users WHERE id = ?1`,
  )
    .bind(targetId)
    .first();

  return c.json(updated);
});

// GET /api/admin/profit — profit report
adminRouter.get('/profit', async (c) => {
  const from = c.req.query('from'); // ISO date string
  const to = c.req.query('to');
  const showCancelled = c.req.query('show_cancelled') === 'true';

  let settledQuery = `
    SELECT o.*, u.name AS buyer_name, u.email AS buyer_email
    FROM orders o
    JOIN users u ON u.id = o.user_id
    WHERE o.status = 'Bought'`;
  const bindings: string[] = [];
  let paramIdx = 1;

  if (from) {
    settledQuery += ` AND o.settled_at >= ?${paramIdx++}`;
    bindings.push(from);
  }
  if (to) {
    settledQuery += ` AND o.settled_at <= ?${paramIdx++}`;
    bindings.push(to);
  }
  settledQuery += ` ORDER BY o.settled_at DESC`;

  const settledResult = bindings.length
    ? await c.env.DB.prepare(settledQuery).bind(...bindings).all<Record<string, unknown>>()
    : await c.env.DB.prepare(settledQuery).all<Record<string, unknown>>();

  const settledOrders = settledResult.results;

  const totalRevenueIdr = settledOrders.reduce(
    (sum, o) => sum + ((o.price_idr_final as number) ?? 0),
    0,
  );
  // HPP = cost at snapshot rate (price_jpy * jpy_rate_snapshot)
  const totalHppIdr = settledOrders.reduce((sum, o) => {
    const jpy = (o.price_jpy as number) ?? 0;
    const rate = (o.jpy_rate_snapshot as number) ?? 0;
    const qty = (o.qty as number) ?? 1;
    return sum + jpy * rate * qty;
  }, 0);

  const result: Record<string, unknown> = {
    total_orders: settledOrders.length,
    total_revenue_idr: Math.round(totalRevenueIdr),
    total_hpp_idr: Math.round(totalHppIdr),
    gross_profit_idr: Math.round(totalRevenueIdr - totalHppIdr),
    orders: settledOrders,
  };

  if (showCancelled) {
    let cancelledQuery = `
      SELECT o.*, u.name AS buyer_name, u.email AS buyer_email
      FROM orders o
      JOIN users u ON u.id = o.user_id
      WHERE o.status = 'Cancelled'`;
    const cancelBindings: string[] = [];
    let cIdx = 1;

    if (from) {
      cancelledQuery += ` AND o.cancelled_at >= ?${cIdx++}`;
      cancelBindings.push(from);
    }
    if (to) {
      cancelledQuery += ` AND o.cancelled_at <= ?${cIdx++}`;
      cancelBindings.push(to);
    }
    cancelledQuery += ` ORDER BY o.cancelled_at DESC`;

    const cancelledResult = cancelBindings.length
      ? await c.env.DB.prepare(cancelledQuery).bind(...cancelBindings).all()
      : await c.env.DB.prepare(cancelledQuery).all();

    result.cancelled_orders = cancelledResult.results;
  }

  return c.json(result);
});

// ============================================================
// Mount route groups
// ============================================================

app.route('/auth', authRouter);
app.route('/gate', gateRouter);
app.route('/products', productRouter);
app.route('/tags', tagRouter);
// Serve R2 photos — mounted at top level of /api so the wildcard key works
app.get('/photos/:key{.+}', async (c) => {
  const key = c.req.param('key');
  const object = await c.env.BUCKET.get(key);
  if (!object) return c.json({ error: 'Not found' }, 404);
  const contentType = object.httpMetadata?.contentType ?? 'application/octet-stream';
  const buffer = await object.arrayBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
});
app.route('/orders', orderRouter);
app.route('/admin', adminRouter);

// ============================================================
// Astro API route exports
// ============================================================

// Single handler: delegates to Hono with cloudflare:workers env.
const handler: APIRoute = async (context) => {
  return app.fetch(context.request, cfEnv as any);
};

export const ALL = handler;
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
