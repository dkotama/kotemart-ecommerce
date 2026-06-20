import { defineMiddleware } from 'astro:middleware';
import type { User } from './lib/types';
import { env } from 'cloudflare:workers';

// Routes that require authentication (exact or prefix match)
const PROTECTED_ROUTES = ['/my-orders', '/custom-order', '/admin', '/catalog'];

// Routes that require admin role
const ADMIN_ROUTES = ['/admin'];

// Routes that redirect to /catalog if already logged in
const AUTH_ONLY_ROUTES = ['/login', '/'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, cookies, redirect, locals } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Initialize user as null
  locals.user = null;

  // Read session cookie
  const sessionId = cookies.get('session')?.value;

  if (sessionId) {
    try {
      const db = (env as any).DB;
      if (db) {
        const result = await db.prepare(`
          SELECT s.id as session_id, s.expires_at,
                 u.id, u.email, u.name, u.avatar_url, u.role, u.is_active, u.whatsapp_number, u.created_at
          FROM sessions s
          JOIN users u ON s.user_id = u.id
          WHERE s.id = ?
          AND s.expires_at > datetime('now')
        `).bind(sessionId).first<{
          session_id: string;
          expires_at: string;
          id: string;
          email: string;
          name: string;
          avatar_url: string | null;
          role: 'buyer' | 'admin';
          is_active: number;
          whatsapp_number: string | null;
          created_at: string;
        }>();

        if (result && result.is_active === 1) {
          locals.user = {
            id: result.id,
            email: result.email,
            name: result.name,
            avatar_url: result.avatar_url,
            role: result.role,
            is_active: result.is_active,
            whatsapp_number: result.whatsapp_number,
            created_at: result.created_at,
          } satisfies User;
        }
      }
    } catch (err) {
      // Session validation failed — treat as unauthenticated
      console.error('Session validation error:', err);
    }
  }

  // If logged in and hitting auth-only route → redirect to catalog
  if (locals.user && AUTH_ONLY_ROUTES.some(r => pathname === r || pathname.startsWith(r + '?'))) {
    return redirect('/catalog');
  }

  // Check if route needs protection
  const isProtected = PROTECTED_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/') || pathname.startsWith(r + '?'));

  if (isProtected && !locals.user) {
    const redirectTo = encodeURIComponent(pathname + url.search);
    return redirect(`/login?redirect=${redirectTo}`);
  }

  // Check admin routes
  const isAdminRoute = ADMIN_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'));

  if (isAdminRoute && locals.user && locals.user.role !== 'admin') {
    return redirect('/catalog');
  }

  return next();
});
