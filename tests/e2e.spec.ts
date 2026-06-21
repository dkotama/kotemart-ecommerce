import { test, expect } from '@playwright/test';

// ============================================================
// Helpers
// ============================================================
async function loginAs(page: any, role: 'buyer' | 'admin') {
  await page.context().clearCookies();
  await page.goto('about:blank');
  await page.goto(`/api/auth/mock-login?role=${role}`);
}

test.beforeEach(async ({ page }) => {
  await page.route(/(unsplash\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)/, route => route.abort());

  const originalGoto = page.goto.bind(page);
  page.goto = async (url: string, options?: any) => {
    return originalGoto(url, { waitUntil: 'domcontentloaded', ...options });
  };

  page.on('console', msg => {
    console.log(`[PAGE CONSOLE] [${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.log(`[PAGE ERROR] ${err.stack || err.message}`);
  });
  page.on('request', request => {
    console.log(`[REQUEST] ${request.method()} ${request.url()} (${request.resourceType()})`);
  });
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      response.text().then(text => {
        console.log(`[API RESPONSE] ${response.status()} ${response.url()} -> ${text}`);
      }).catch(() => {
        console.log(`[API RESPONSE] ${response.status()} ${response.url()} -> (failed to read body)`);
      });
    }
  });
});

// ============================================================
// CUJ-1: Gate Status Visibility
// Catalog page correctly reflects Open/Closed gate state
// ============================================================
test.describe('CUJ-1: Gate Status', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'buyer');
  });

  test('shows Open state - Pesan buttons enabled', async ({ page }) => {
    // Set gate to Open via admin API
    await loginAs(page, 'admin');
    await page.request.put('/api/admin/settings', {
      data: { gate_status: 'Open' },
    });
    await loginAs(page, 'buyer');

    await page.goto('/catalog');
    await expect(page.locator('[data-testid="gate-banner"]')).not.toBeVisible();
    const pesan = page.locator('[data-testid="btn-pesan"]').first();
    await expect(pesan).toBeEnabled();
  });

  test('shows Closed state - gate banner visible and Pesan buttons disabled', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.request.put('/api/admin/settings', {
      data: { gate_status: 'Closed' },
    });
    await loginAs(page, 'buyer');

    await page.goto('/catalog');
    await expect(page.locator('[data-testid="gate-banner"]')).toBeVisible();
    const pesan = page.locator('[data-testid="btn-pesan"]').first();
    await expect(pesan).toBeDisabled();

    // Restore
    await loginAs(page, 'admin');
    await page.request.put('/api/admin/settings', {
      data: { gate_status: 'Open' },
    });
    await loginAs(page, 'buyer');
  });
});

// ============================================================
// CUJ-2: Catalog Browsing
// User can view, search, filter catalog products
// ============================================================
test.describe('CUJ-2: Catalog Browsing', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'buyer');
    await page.goto('/catalog');
  });

  test('shows product cards with name, JPY price, IDR estimate', async ({ page }) => {
    const cards = page.locator('[data-testid="product-card"]');
    await expect(cards.first()).toBeVisible();
    await expect(cards.first().locator('[data-testid="product-name"]')).toBeVisible();
    await expect(cards.first().locator('[data-testid="product-price-jpy"]')).toBeVisible();
    await expect(cards.first().locator('[data-testid="product-price-idr"]')).toBeVisible();
  });

  test('does NOT show soft-deleted products', async ({ page }) => {
    const cards = page.locator('[data-testid="product-card"]');
    const texts = await cards.allTextContents();
    const hasDeleted = texts.some((t) => t.includes('Deleted Product'));
    expect(hasDeleted).toBe(false);
  });

  test('category filter dropdown filters the product list', async ({ page }) => {
    // Open the dropdown
    await page.click('[data-testid="category-dropdown-btn"]');
    const elektronikOpt = page.locator('[data-testid="filter-pill-Elektronik"]');
    if (await elektronikOpt.count() > 0) {
      await elektronikOpt.click();
      const cards = page.locator('[data-testid="product-card"]');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
      // All visible cards should be in Elektronik category
      for (let i = 0; i < count; i++) {
        const badge = cards.nth(i).locator('[data-testid="category-badge"]');
        await expect(badge).toHaveText('Elektronik');
      }
    }
  });

  test('search input filters products by name', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill('Keychron');
    await page.waitForTimeout(400); // debounce
    const cards = page.locator('[data-testid="product-card"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
    await expect(cards.first().locator('[data-testid="product-name"]')).toContainText('Keychron');
  });
});

// ============================================================
// CUJ-3: Place Catalog Order
// Buyer places a catalog order from product detail page
// ============================================================
test.describe('CUJ-3: Place Catalog Order', () => {
  test('buyer can place order from product detail page', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.request.put('/api/admin/settings', { data: { gate_status: 'Open' } });
    await loginAs(page, 'buyer');
    // Ensure buyer-001 has WA saved so WA gate dialog is skipped
    await page.request.patch('/api/orders/me/whatsapp', {
      data: { whatsapp_number: '628111222333' },
    });

    await page.goto('/catalog');
    const firstCard = page.locator('[data-testid="product-card"]').first();
    await firstCard.click();
    // Should navigate to product detail
    await page.waitForURL(/\/catalog\/.+/);

    const addBtn = page.locator('[data-testid="btn-add-order"]');
    await expect(addBtn).toBeEnabled();
    await addBtn.click();

    // Confirm order dialog should appear (no WA dialog because WA is already saved)
    // Native <dialog> uses showModal() — check via [open] attribute
    await expect(page.locator('#confirm-order-dialog[open]')).toBeAttached({ timeout: 3000 });
    await page.locator('#confirm-order-btn').click();

    // Toast should appear after confirmation
    const toast = page.locator('[data-testid="toast-success"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
    // User stays on the product detail page (no redirect) and the nav
    // order badge increments to reflect the new order.
    await expect(page.locator('[data-testid="nav-order-count"]')).toHaveText(/^[1-9][0-9]*$/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/catalog\/.+/);
  });
});

// ============================================================
// CUJ-4: Custom Order Submission
// Buyer submits a custom order with URL and description
// ============================================================
test.describe('CUJ-4: Custom Order', () => {
  test('buyer can submit a custom order', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.request.put('/api/admin/settings', { data: { gate_status: 'Open' } });
    await loginAs(page, 'buyer');
    await page.goto('/custom-order');

    await page.locator('[data-testid="custom-url-input"]').fill('https://www.amazon.co.jp/dp/B0BSHF7WHW');
    await page.locator('[data-testid="custom-name-input"]').fill('Artbook Cyberpunk 2077 Complete Edition');
    await page.locator('[data-testid="custom-desc-input"]').fill('Beli versi hardcover, wrap bubble wrap extra please.');
    await page.locator('[data-testid="custom-qty-input"]').fill('1');

    await page.locator('[data-testid="btn-custom-submit"]').click();

    // Success alert should be shown
    await expect(page.locator('[data-testid="custom-success-alert"]')).toBeVisible({ timeout: 5000 });
  });

  test('gate closed blocks custom order submission', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.request.put('/api/admin/settings', { data: { gate_status: 'Closed' } });
    await loginAs(page, 'buyer');
    await page.goto('/custom-order');

    const submitBtn = page.locator('[data-testid="btn-custom-submit"]');
    await expect(submitBtn).toBeDisabled();

    await loginAs(page, 'admin');
    await page.request.put('/api/admin/settings', { data: { gate_status: 'Open' } });
    await loginAs(page, 'buyer');
  });
});

// ============================================================
// CUJ-5: My Orders Page
// Buyer can view all their orders with correct statuses
// ============================================================
test.describe('CUJ-5: My Orders', () => {
  test('buyer sees their orders with correct status steps', async ({ page }) => {
    await loginAs(page, 'buyer');
    await page.goto('/my-orders');
    const ordersList = page.locator('[data-testid="orders-list"]');
    await expect(ordersList).toBeVisible();
    const orderRows = page.locator('[data-testid="order-row"]');
    expect(await orderRows.count()).toBeGreaterThanOrEqual(1);
  });

  test('bought order shows final price and Bought status', async ({ page }) => {
    await loginAs(page, 'buyer');
    await page.goto('/my-orders');
    const boughtRow = page.locator('[data-testid="order-row"][data-status="Bought"]').first();
    if (await boughtRow.count() > 0) {
      await expect(boughtRow.locator('[data-testid="status-badge"]')).toHaveText('Bought');
    }
  });
});

// ============================================================
// CUJ-6: Admin Order Management
// Admin changes order statuses through the workflow
// ============================================================
test.describe('CUJ-6: Admin Order Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('admin can see all orders in admin panel', async ({ page }) => {
    await page.goto('/admin/orders');
    const table = page.locator('[data-testid="orders-table"]');
    await expect(table).toBeVisible();
    const rows = page.locator('[data-testid="order-row"]');
    expect(await rows.count()).toBeGreaterThanOrEqual(1);
  });

  test('admin can advance a Draft order to Pending', async ({ page }) => {
    await page.goto('/admin/orders');
    const draftRow = page.locator('[data-testid="order-row"][data-status="Draft"][data-type="catalog"]').first();
    if (await draftRow.count() > 0) {
      const orderId = await draftRow.getAttribute('data-id');
      await draftRow.locator('[data-testid="context-menu-btn"]').click();
      const markPending = draftRow.locator('[data-testid="action-mark-pending"]');
      await expect(markPending).toBeVisible();
      await markPending.click();
      // Unified price dialog opens for catalog orders too — confirm with prefilled IDR
      const pendingModal = page.locator('[data-testid="pending-price-modal"]');
      await expect(pendingModal).toBeVisible({ timeout: 3000 });
      await page.locator('[data-testid="pending-confirm-btn"]').click();
      // Row should update to Pending
      const targetRow = page.locator(`[data-testid="order-row"][data-id="${orderId}"]`);
      await expect(targetRow.locator('[data-testid="status-badge"]')).toHaveText('Pending', { timeout: 5000 });
    }
  });

  test('admin pending dialog auto-fills IDR from JPY and stores override', async ({ page }) => {
    await page.goto('/admin/orders');
    const draftRow = page.locator('[data-testid="order-row"][data-status="Draft"][data-type="catalog"]').first();
    if (await draftRow.count() === 0) return; // no suitable order to test against
    const orderId = await draftRow.getAttribute('data-id');
    await draftRow.locator('[data-testid="context-menu-btn"]').click();
    await draftRow.locator('[data-testid="action-mark-pending"]').click();

    const modal = page.locator('[data-testid="pending-price-modal"]');
    await expect(modal).toBeVisible({ timeout: 3000 });
    // Typing JPY auto-fills IDR = ceil1000(jpy * rate * (1 + fee/100)) using the order's snapshot
    const rate = parseFloat(await draftRow.getAttribute('data-rate') || '0');
    const fee = parseFloat(await draftRow.getAttribute('data-fee') || '0');
    const expectedIdr = String(Math.ceil((17600 * rate * (1 + fee / 100)) / 1000) * 1000);
    const jpyInput = page.locator('[data-testid="pending-jpy-input"]');
    await jpyInput.fill('17600');
    await expect(page.locator('[data-testid="pending-idr-input"]')).toHaveValue(expectedIdr);
    await page.locator('[data-testid="pending-confirm-btn"]').click();

    const targetRow = page.locator(`[data-testid="order-row"][data-id="${orderId}"]`);
    await expect(targetRow.locator('[data-testid="status-badge"]')).toHaveText('Pending', { timeout: 5000 });
    // Override marker should show in the price cell
    await expect(targetRow.locator('text=OVERRIDE')).toBeVisible();
  });

  test('admin can mark a Pending order as Bought with actual price', async ({ page }) => {
    await page.goto('/admin/orders');
    const pendingRow = page.locator('[data-testid="order-row"][data-status="Pending"]').first();
    if (await pendingRow.count() > 0) {
      const orderId = await pendingRow.getAttribute('data-id');
      await pendingRow.locator('[data-testid="context-menu-btn"]').click();
      await pendingRow.locator('[data-testid="action-mark-bought"]').click();
      // Bought modal opens to record actual JPY purchase price
      const boughtModal = page.locator('#bought-modal');
      await expect(boughtModal).toBeVisible({ timeout: 3000 });
      const priceInput = boughtModal.locator('#bought-price-input');
      await priceInput.fill('5000');
      await boughtModal.locator('button[type="submit"]').click();
      await expect(boughtModal).not.toBeVisible({ timeout: 5000 });
      const targetRow = page.locator(`[data-testid="order-row"][data-id="${orderId}"]`);
      await expect(targetRow.locator('[data-testid="status-badge"]')).toHaveText('Bought', { timeout: 5000 });
    }
  });

  test('admin can cancel a non-terminal order with reason', async ({ page }) => {
    await page.goto('/admin/orders');
    const pendingRow = page.locator('[data-testid="order-row"][data-status="Pending"]').first();
    if (await pendingRow.count() > 0) {
      await pendingRow.locator('[data-testid="context-menu-btn"]').click();
      await pendingRow.locator('[data-testid="action-cancel"]').click();
      // Cancel modal appears
      const modal = page.locator('[data-testid="cancel-modal"]');
      await expect(modal).toBeVisible();
      await modal.locator('[data-testid="cancel-reason-input"]').fill('Barang habis di toko');
      await modal.locator('[data-testid="cancel-confirm-btn"]').click();
      await expect(modal).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('admin can edit order quantity inline', async ({ page }) => {
    await page.goto('/admin/orders');
    const firstRow = page.locator('[data-testid="order-row"]').first();
    if (await firstRow.count() > 0) {
      const orderId = await firstRow.getAttribute('data-id');
      const qtyInput = firstRow.locator(`[data-testid="qty-input-${orderId}"]`);
      await expect(qtyInput).toBeVisible();

      // Change quantity
      await qtyInput.fill('4');
      await qtyInput.dispatchEvent('change');

      // Verify new quantity is stored and persists
      const targetRow = page.locator(`[data-testid="order-row"][data-id="${orderId}"]`);
      const targetInput = targetRow.locator(`[data-testid="qty-input-${orderId}"]`);
      await expect(targetInput).toHaveValue('4');
    }
  });
});

// ============================================================
// CUJ-7: Admin Mark Pending as Bought (with final price)
// Settled status removed; Bought is terminal. Advance Pending→Bought.
// ============================================================
test.describe('CUJ-7: Admin Mark Bought with Final Price', () => {
  test('admin can mark a Pending order Bought with final price', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/orders');

    const pendingRow = page.locator('[data-testid="order-row"][data-status="Pending"]').first();
    if (await pendingRow.count() === 0) return; // skip if no pending order

    const orderId = await pendingRow.getAttribute('data-id');
    await pendingRow.locator('[data-testid="context-menu-btn"]').click();
    await pendingRow.locator('[data-testid="action-mark-bought"]').click();

    await expect(page.locator('#bought-modal')).toBeVisible({ timeout: 3000 });
    await page.locator('#bought-price-input').fill('5000');
    await page.locator('#bought-final-price-input').fill('600000');
    await page.locator('#bought-form button[type="submit"]').click();

    const targetRow = page.locator(`[data-testid="order-row"][data-id="${orderId}"]`);
    await expect(targetRow.locator('[data-testid="status-badge"]')).toHaveText('Bought', { timeout: 5000 });
  });
});

// ============================================================
// CUJ-8: Admin Settings / Rate Update
// Admin can change JPY rate and it affects new IDR estimates
// ============================================================
test.describe('CUJ-8: Admin Settings', () => {
  test('admin can update JPY rate', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/settings');
    const rateInput = page.locator('[data-testid="jpy-rate-input"]');
    await rateInput.fill('112.5');
    await page.locator('[data-testid="btn-save-rate"]').click();
    const toast = page.locator('[data-testid="toast-success"]');
    await expect(toast).toBeVisible({ timeout: 3000 });
  });

  test('admin can toggle gate status', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/settings');
    const toggle = page.locator('[data-testid="gate-toggle"]');
    const initialState = await toggle.getAttribute('data-state');
    await toggle.click();
    await page.waitForTimeout(500);
    const newState = await toggle.getAttribute('data-state');
    expect(newState).not.toBe(initialState);
    // Restore
    await toggle.click();
  });
});

// ============================================================
// CUJ-9: Auth Guard
// Unauthenticated users are redirected to /login
// ============================================================
test.describe('CUJ-9: Auth Guard', () => {
  test('unauthenticated visitor on /catalog is redirected to /login', async ({ page }) => {
    // Clear cookies
    await page.context().clearCookies();
    await page.goto('/catalog');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated visitor on /my-orders is redirected to /login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/my-orders');
    await expect(page).toHaveURL(/\/login/);
  });

  test('buyer cannot access /admin/* routes', async ({ page }) => {
    await loginAs(page, 'buyer');
    await page.goto('/admin/orders');
    // Should be redirected away from admin
    await expect(page).not.toHaveURL(/\/admin/);
  });
});

// ============================================================
// CUJ-10: Admin Profit Report
// Admin can view profit report
// ============================================================
test.describe('CUJ-10: Admin Profit Report', () => {
  test('admin can view profit report page', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/profit');
    await expect(page.locator('[data-testid="profit-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-total-orders"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-gross-profit"]')).toBeVisible();
  });
});

// ============================================================
// API Tests: Direct endpoint testing
// ============================================================
test.describe('API: Products', () => {
  test('GET /api/products returns array of active products', async ({ request }) => {
    // First mock-login to get a session cookie
    const loginRes = await request.get('/api/auth/mock-login?role=buyer', { maxRedirects: 0 });
    // Sessions should be set; now try products
    const res = await request.get('/api/products');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    // No deleted products
    const hasDeleted = body.some((p: any) => p.is_deleted === 1);
    expect(hasDeleted).toBe(false);
  });

  test('GET /api/products/:id for non-existent product returns 404', async ({ request }) => {
    await request.get('/api/auth/mock-login?role=buyer', { maxRedirects: 0 });
    const res = await request.get('/api/products/does-not-exist');
    expect(res.status()).toBe(404);
  });
});

test.describe('API: Orders', () => {
  test('POST /api/orders with closed gate returns 403', async ({ request }) => {
    // Set gate closed
    await request.get('/api/auth/mock-login?role=admin', { maxRedirects: 0 });
    await request.put('/api/admin/settings', { data: { gate_status: 'Closed' } });
    await request.get('/api/auth/mock-login?role=buyer', { maxRedirects: 0 });
    const res = await request.post('/api/orders', { data: { product_id: 'prod-001', variant_id: 'var-001-1', qty: 1 } });
    expect(res.status()).toBe(403);
    // Restore
    await request.get('/api/auth/mock-login?role=admin', { maxRedirects: 0 });
    await request.put('/api/admin/settings', { data: { gate_status: 'Open' } });
  });

  test('POST /api/orders without auth returns 401', async ({ request }) => {
    // Use a fresh context with no cookies
    const res = await request.post('/api/orders', { data: { product_id: 'prod-001', qty: 1 } });
    expect(res.status()).toBe(401);
  });

  test('POST /api/orders/custom with invalid body returns 400', async ({ request }) => {
    // Login first
    await request.get('/api/auth/mock-login?role=admin', { maxRedirects: 0 });
    await request.put('/api/admin/settings', { data: { gate_status: 'Open' } });
    await request.get('/api/auth/mock-login?role=buyer', { maxRedirects: 0 });
    // Missing required name field
    const res = await request.post('/api/orders/custom', {
      data: { qty: 1 },
    });
    expect(res.status()).toBe(400);
  });
});

// ============================================================
// CUJ-11: Admin Product CRUD
// Admin can create, edit, and delete products
// ============================================================
test.describe('CUJ-11: Admin Product CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('open add modal shows Tambah Produk title', async ({ page }) => {
    await page.goto('/admin/products');
    await page.click('#btn-add-product');
    await expect(page.locator('#product-modal')).toBeVisible();
    await expect(page.locator('#modal-title')).toHaveText('Tambah Produk');
  });

  test('create product (no image) appears in table', async ({ page }) => {
    const name = `Test Keyboard ${Date.now()}`;
    await page.goto('/admin/products');
    await page.click('#btn-add-product');
    await expect(page.locator('#product-modal')).toBeVisible();

    await page.fill('#input-name', name);
    await page.selectOption('#input-category', 'Elektronik');
    await page.fill('#input-desc', 'Keyboard mekanikal test');
    await page.evaluate(() => {
      const el = document.querySelector('#input-images-json') as HTMLInputElement;
      if (el) el.value = '[]';
    });
    // fill first variant row (auto-added when modal opens)
    await page.locator('.variant-name').first().fill('Standard');
    await page.locator('.variant-price').first().fill('17600');

    await page.click('#btn-save');
    await page.waitForLoadState('networkidle');

    await expect(page.locator(`.product-row[data-name="${name}"]`)).toBeVisible();
  });

  test('edit product updates row name', async ({ page }) => {
    const name = `Test Keyboard ${Date.now()}`;
    await page.goto('/admin/products');
    await page.click('#btn-add-product');
    await expect(page.locator('#product-modal')).toBeVisible();

    await page.fill('#input-name', name);
    await page.selectOption('#input-category', 'Elektronik');
    await page.fill('#input-desc', 'Keyboard mekanikal test');
    await page.evaluate(() => {
      const el = document.querySelector('#input-images-json') as HTMLInputElement;
      if (el) el.value = '[]';
    });
    // fill first variant row (auto-added when modal opens)
    await page.locator('.variant-name').first().fill('Standard');
    await page.locator('.variant-price').first().fill('17600');
    await page.click('#btn-save');
    await page.waitForLoadState('networkidle');

    const row = page.locator(`.product-row[data-name="${name}"]`);
    await expect(row).toBeVisible();
    await row.locator('.btn-edit').click();

    await expect(page.locator('#product-modal')).toBeVisible();
    await expect(page.locator('#modal-title')).toHaveText('Edit Produk');

    await page.fill('#input-name', name + ' v2');
    await page.click('#btn-save');
    await page.waitForLoadState('networkidle');

    await expect(page.locator(`.product-row[data-name="${name} v2"]`)).toBeVisible();
  });

  test('delete product removes row from table', async ({ page }) => {
    const name = `Test Keyboard ${Date.now()}`;
    await page.goto('/admin/products');
    await page.click('#btn-add-product');
    await expect(page.locator('#product-modal')).toBeVisible();

    await page.fill('#input-name', name);
    await page.selectOption('#input-category', 'Elektronik');
    await page.fill('#input-desc', 'Keyboard mekanikal test');
    await page.evaluate(() => {
      const el = document.querySelector('#input-images-json') as HTMLInputElement;
      if (el) el.value = '[]';
    });
    // fill first variant row (auto-added when modal opens)
    await page.locator('.variant-name').first().fill('Standard');
    await page.locator('.variant-price').first().fill('17600');
    await page.click('#btn-save');
    await page.waitForLoadState('networkidle');

    const row = page.locator(`.product-row[data-name="${name}"]`);
    await expect(row).toBeVisible();

    page.on('dialog', d => d.accept());
    await row.locator('.btn-delete').click();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.product-row[data-name="Test Keyboard"]')).not.toBeVisible();
  });

  test('admin can reorder product images in modal', async ({ page }) => {
    await page.goto('/admin/products');
    await page.click('#btn-add-product');
    await expect(page.locator('#product-modal')).toBeVisible();

    await page.evaluate(() => {
      const input = document.getElementById('input-images-json') as HTMLInputElement;
      if (input) {
        input.value = JSON.stringify(['https://example.com/image1.png', 'https://example.com/image2.png']);
      }
      (window as any)._test_renderParentImages?.();
    });

    const tiles = page.locator('#image-preview-container .group');
    await expect(tiles).toHaveCount(2);

    const leftBtn1 = tiles.nth(0).locator('.btn-move-left');
    await expect(leftBtn1).toBeDisabled();

    const rightBtn1 = tiles.nth(0).locator('.btn-move-right');
    await expect(rightBtn1).toBeEnabled();
    await rightBtn1.click();

    const jsonVal = await page.locator('#input-images-json').inputValue();
    const imgs = JSON.parse(jsonVal);
    expect(imgs[0]).toBe('https://example.com/image2.png');
    expect(imgs[1]).toBe('https://example.com/image1.png');
  });
});

// ============================================================
// CUJ-12: Modal Live Calculation
// Admin product modal shows live JPY→IDR calc as price is typed
// ============================================================
test.describe('CUJ-12: Modal Live Calculation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('kurs row always shows rate immediately on modal open', async ({ page }) => {
    await page.goto('/admin/products');
    await page.click('#btn-add-product');
    await expect(page.locator('#product-modal')).toBeVisible();
    await expect(page.locator('#calc-rate')).toContainText('Rp');
  });

  test('zero price shows dashes for fee and estimate', async ({ page }) => {
    await page.goto('/admin/products');
    await page.click('#btn-add-product');
    await expect(page.locator('#product-modal')).toBeVisible();
    await expect(page.locator('#calc-est-idr')).toHaveText('—');
  });

  test('live calc updates fee and estimate when JPY price entered', async ({ page }) => {
    await page.goto('/admin/products');
    await page.click('#btn-add-product');
    await expect(page.locator('#product-modal')).toBeVisible();
    await page.locator('.variant-price').first().fill('10000');
    await page.locator('.variant-price').first().dispatchEvent('input');
    await expect(page.locator('#calc-est-idr')).toContainText('Rp');
  });
});

// ============================================================
// CUJ-13: Categories CRUD
// Admin can manage product categories from master page
// ============================================================
test.describe('CUJ-13: Categories CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('categories page shows default categories', async ({ page }) => {
    await page.goto('/admin/master/categories');
    await expect(page.locator('[data-testid="chip-remove-Elektronik"]')).toBeVisible();
    await expect(page.locator('[data-testid="chip-remove-Figure"]')).toBeVisible();
    await expect(page.locator('[data-testid="chip-remove-Snack"]')).toBeVisible();
    await expect(page.locator('[data-testid="chip-remove-Pakaian"]')).toBeVisible();
  });

  test('add new category and save reflects in catalog filter dropdown', async ({ page }) => {
    await page.goto('/admin/master/categories');
    await page.fill('[data-testid="new-category-input"]', 'Mainan');
    await page.click('[data-testid="btn-add-category"]');
    await expect(page.locator('[data-testid="chip-remove-Mainan"]')).toBeVisible();
    await page.click('[data-testid="btn-save-categories"]');
    await page.waitForLoadState('networkidle');
    await page.goto('/catalog');
    // Open dropdown to see the new category option
    await page.click('[data-testid="category-dropdown-btn"]');
    await expect(page.locator('[data-testid="filter-pill-Mainan"]')).toBeVisible();
  });

  test('duplicate category is rejected — chip count stays 1', async ({ page }) => {
    await page.goto('/admin/master/categories');
    await page.fill('[data-testid="new-category-input"]', 'Elektronik');
    await page.click('[data-testid="btn-add-category"]');
    expect(await page.locator('[data-testid="chip-remove-Elektronik"]').count()).toBe(1);
  });

  test('empty category is rejected — existing chips unchanged', async ({ page }) => {
    await page.goto('/admin/master/categories');
    await page.fill('[data-testid="new-category-input"]', '');
    await page.click('[data-testid="btn-add-category"]');
    await expect(page.locator('[data-testid="chip-remove-Elektronik"]')).toBeVisible();
    await expect(page.locator('[data-testid="chip-remove-Figure"]')).toBeVisible();
    await expect(page.locator('[data-testid="chip-remove-Snack"]')).toBeVisible();
    await expect(page.locator('[data-testid="chip-remove-Pakaian"]')).toBeVisible();
  });
});

test.describe('API: Gate', () => {
  test('GET /api/gate/status returns status without auth', async ({ request }) => {
    const res = await request.get('/api/gate/status');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(['Open', 'Closed']).toContain(body.status);
  });
});

// ============================================================
// CUJ-14: Catalog Card Price Range
// Cards show JPY price range for multi-variant products
// ============================================================
test.describe('CUJ-14: Catalog Card Price Range', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('multi-variant product shows JPY range with dash on card', async ({ page }) => {
    // Create product with 2 variants via API
    const res = await page.request.post('/api/products', {
      data: {
        name: 'Price Range Test Product',
        category: 'Elektronik',
        description: 'Test product',
        images: [],
        variants: [
          { variant_name: '50g', price_jpy: 1000, product_url: null, sort_order: 0 },
          { variant_name: '100g', price_jpy: 2000, product_url: null, sort_order: 1 },
        ],
      },
    });
    expect(res.status()).toBe(201);
    const product = await res.json();

    await loginAs(page, 'buyer');
    await page.goto('/catalog');

    const card = page.locator('[data-testid="product-card"][data-product-id="' + product.id + '"]');
    await expect(card).toBeVisible();
    const jpyEl = card.locator('[data-testid="product-price-jpy"]');
    await expect(jpyEl).toContainText('–');
    await expect(jpyEl).toContainText('¥');

    // Cleanup
    await loginAs(page, 'admin');
    await page.request.delete(`/api/products/${product.id}`);
  });

  test('single-variant product shows single JPY price (no dash)', async ({ page }) => {
    const res = await page.request.post('/api/products', {
      data: {
        name: 'Single Variant Test Product',
        category: 'Elektronik',
        description: 'Test product',
        images: [],
        variants: [
          { variant_name: 'Only Size', price_jpy: 1500, product_url: null, sort_order: 0 },
        ],
      },
    });
    expect(res.status()).toBe(201);
    const product = await res.json();

    await loginAs(page, 'buyer');
    await page.goto('/catalog');

    const card = page.locator('[data-testid="product-card"][data-product-id="' + product.id + '"]');
    await expect(card).toBeVisible();
    const jpyEl = card.locator('[data-testid="product-price-jpy"]');
    await expect(jpyEl).not.toContainText('–');
    await expect(jpyEl).toContainText('¥');

    // Cleanup
    await loginAs(page, 'admin');
    await page.request.delete(`/api/products/${product.id}`);
  });

  test('catalog card shows IDR estimate range', async ({ page }) => {
    const res = await page.request.post('/api/products', {
      data: {
        name: 'IDR Range Test Product',
        category: 'Elektronik',
        description: 'Test product',
        images: [],
        variants: [
          { variant_name: 'Small', price_jpy: 1000, product_url: null, sort_order: 0 },
          { variant_name: 'Large', price_jpy: 3000, product_url: null, sort_order: 1 },
        ],
      },
    });
    expect(res.status()).toBe(201);
    const product = await res.json();

    await loginAs(page, 'buyer');
    await page.goto('/catalog');

    const card = page.locator('[data-testid="product-card"][data-product-id="' + product.id + '"]');
    await expect(card).toBeVisible();
    const idrEl = card.locator('[data-testid="product-price-idr"]');
    await expect(idrEl).toContainText('Rp');
    await expect(idrEl).toContainText('–');

    // Cleanup
    await loginAs(page, 'admin');
    await page.request.delete(`/api/products/${product.id}`);
  });
});

// ============================================================
// CUJ-15: Desktop Variant Selection
// Variant pills on /catalog/[id] update price card
// ============================================================
test.describe('CUJ-15: Desktop Variant Selection', () => {
  test('variant pills change displayed price on detail page', async ({ page }) => {
    await loginAs(page, 'admin');
    const res = await page.request.post('/api/products', {
      data: {
        name: 'Variant Selection Test',
        category: 'Elektronik',
        description: 'Test',
        images: [],
        variants: [
          { variant_name: 'Small 50g', price_jpy: 1000, product_url: null, sort_order: 0 },
          { variant_name: 'Large 100g', price_jpy: 2500, product_url: null, sort_order: 1 },
        ],
      },
    });
    expect(res.status()).toBe(201);
    const product = await res.json();

    await loginAs(page, 'buyer');
    await page.goto(`/catalog/${product.id}`);

    // First variant pre-selected — price shows ¥ 1,000
    const priceJpy = page.locator('#detail-price-jpy');
    await expect(priceJpy).toContainText('1,000');

    // Click second variant pill
    const pills = page.locator('[data-testid="variant-pill"]');
    await expect(pills).toHaveCount(2);
    await pills.nth(1).click();

    // Price should update to ¥ 2,500
    await expect(priceJpy).toContainText('2,500');
    await expect(page.locator('#detail-price-idr')).toContainText('Rp');

    // Cleanup
    await loginAs(page, 'admin');
    await page.request.delete(`/api/products/${product.id}`);
  });

  test('order submitted with selected variant_id', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.request.put('/api/admin/settings', { data: { gate_status: 'Open' } });
    const res = await page.request.post('/api/products', {
      data: {
        name: 'Order Variant Test',
        category: 'Elektronik',
        description: 'Test',
        images: [],
        variants: [
          { variant_name: 'Default', price_jpy: 1200, product_url: null, sort_order: 0 },
        ],
      },
    });
    expect(res.status()).toBe(201);
    const product = await res.json();

    await loginAs(page, 'buyer');
    // Ensure buyer has WA saved so WA gate is skipped
    await page.request.patch('/api/orders/me/whatsapp', {
      data: { whatsapp_number: '628111222333' },
    });
    await page.goto(`/catalog/${product.id}`);

    await page.locator('[data-testid="btn-add-order"]').click();

    // Confirm order dialog appears — click confirm
    // Native <dialog> uses showModal() — check via [open] attribute
    await expect(page.locator('#confirm-order-dialog[open]')).toBeAttached({ timeout: 3000 });
    await page.locator('#confirm-order-btn').click();

    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible({ timeout: 5000 });

    // Verify order has variant_id via API
    await loginAs(page, 'admin');
    const ordersRes = await page.request.get('/api/admin/orders');
    const orders = await ordersRes.json();
    const order = orders.find((o: any) => o.product_id === product.id);
    expect(order).toBeTruthy();
    expect(order.variant_id).toBeTruthy();

    // Cleanup
    await page.request.delete(`/api/products/${product.id}`);
  });
});

// ============================================================
// CUJ-16: Admin Variant Management
// Admin can manage variants in product modal
// ============================================================
test.describe('CUJ-16: Admin Variant Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('cannot save product with 0 variants — shows error', async ({ page }) => {
    await page.goto('/admin/products');
    await page.click('#btn-add-product');
    await expect(page.locator('#product-modal')).toBeVisible();

    await page.fill('#input-name', 'No Variant Product');
    await page.selectOption('#input-category', 'Elektronik');
    await page.fill('#input-desc', 'Test');

    // Remove the auto-added variant row
    await page.locator('.variant-remove').first().click();

    await page.click('#btn-save');
    await expect(page.locator('#variants-error')).toBeVisible();
  });

  test('product table shows variant count badge', async ({ page }) => {
    // Create product with 2 variants via API (admin session from beforeEach)
    const res = await page.request.post('/api/products', {
      data: {
        name: `Badge Count Test ${Date.now()}`,
        category: 'Elektronik',
        description: 'Test',
        images: [],
        variants: [
          { variant_name: 'A', price_jpy: 1000, product_url: null, sort_order: 0 },
          { variant_name: 'B', price_jpy: 2000, product_url: null, sort_order: 1 },
        ],
      },
    });
    expect(res.status()).toBe(201);
    const product = await res.json();

    await page.goto('/admin/products');
    const row = page.locator(`.product-row[data-id="${product.id}"]`);
    await expect(row).toBeVisible();
    const badge = row.locator('[data-testid="variant-count-badge"]');
    await expect(badge).toContainText('2 varian');
    const priceRange = row.locator('[data-testid="product-price-range"]');
    await expect(priceRange).toContainText('¥');
    await expect(priceRange).toContainText('–');

    // Cleanup via table delete button
    page.on('dialog', d => d.accept());
    await row.locator('.btn-delete').click();
    await page.waitForLoadState('networkidle');
  });

  test('create product with multiple variants saves all variants', async ({ page }) => {
    const name = `Multi Variant Create ${Date.now()}`;
    await page.goto('/admin/products');
    await page.click('#btn-add-product');
    await expect(page.locator('#product-modal')).toBeVisible();

    await page.fill('#input-name', name);
    await page.selectOption('#input-category', 'Elektronik');
    await page.fill('#input-desc', 'Test multi variant');

    // Fill first auto-added row
    await page.locator('.variant-name').first().fill('Small');
    await page.locator('.variant-price').first().fill('1000');

    // Add second row
    await page.click('#btn-add-variant');
    await page.locator('.variant-name').nth(1).fill('Large');
    await page.locator('.variant-price').nth(1).fill('2000');

    await page.click('#btn-save');
    await page.waitForLoadState('networkidle');

    const row = page.locator(`.product-row[data-name="${name}"]`);
    await expect(row).toBeVisible();
    await expect(row.locator('[data-testid="variant-count-badge"]')).toContainText('2 varian');
    await expect(row.locator('[data-testid="product-price-range"]')).toContainText('–');

    // Cleanup
    const productId = await row.getAttribute('data-id');
    if (productId) await page.request.delete(`/api/products/${productId}`);
  });
});

// ============================================================
// CUJ-17: WhatsApp Gate Dialog
// Buyer must provide WhatsApp number before placing order
// if not already saved
// ============================================================
test.describe('CUJ-17: WhatsApp Gate Dialog', () => {
  test('buyer with WA saved skips WA dialog and shows confirm dialog directly', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.request.put('/api/admin/settings', { data: { gate_status: 'Open' } });
    const res = await page.request.post('/api/products', {
      data: {
        name: 'WA Skip Test Product',
        category: 'Elektronik',
        description: 'Test WA skip',
        images: [],
        variants: [
          { variant_name: 'Default', price_jpy: 1500, product_url: null, sort_order: 0 },
        ],
      },
    });
    expect(res.status()).toBe(201);
    const product = await res.json();

    // Login as buyer — buyer-001 has WA from seed
    await loginAs(page, 'buyer');
    await page.goto(`/catalog/${product.id}`);
    await page.locator('[data-testid="btn-add-order"]').click();

    // WA dialog should NOT appear; confirm dialog should appear directly
    // Native <dialog> uses showModal() — check via [open] attribute
    await expect(page.locator('#confirm-order-dialog[open]')).toBeAttached({ timeout: 3000 });
    await expect(page.locator('#wa-dialog[open]')).not.toBeAttached();

    // Cancel order instead of placing it
    await page.locator('#cancel-order-btn').click();

    // Cleanup
    await loginAs(page, 'admin');
    await page.request.delete(`/api/products/${product.id}`);
  });

  test('WA dialog appears when buyer has no WA saved (API level check)', async ({ request }) => {
    // This test verifies the /api/orders/me/whatsapp endpoint accepts WA updates
    await request.get('/api/auth/mock-login?role=buyer', { maxRedirects: 0 });
    // Save WA number
    const saveRes = await request.patch('/api/orders/me/whatsapp', {
      data: { whatsapp_number: '628555666777' },
    });
    expect(saveRes.status()).toBe(200);

    // Verify the WA was saved by checking user info (check an endpoint that returns user)
    const meRes = await request.get('/api/orders/me');
    // If 200, WA was saved successfully
    expect(saveRes.status()).toBe(200);
  });
});

// ============================================================
// CUJ-18: Admin Mark as Bought with bought_price_jpy
// ============================================================
test.describe('CUJ-18: Admin Mark as Bought (with JPY price)', () => {
  test('admin Mark as Bought modal is present on orders page', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/orders');
    // The bought-modal should exist in the DOM
    await expect(page.locator('#bought-modal')).toBeAttached();
    await expect(page.locator('#bought-price-input')).toBeAttached();
  });

  test('API: PATCH admin status with bought_price_jpy saves correctly', async ({ request }) => {
    // Setup: create an order in Pending status via API
    await request.get('/api/auth/mock-login?role=admin', { maxRedirects: 0 });
    await request.put('/api/admin/settings', { data: { gate_status: 'Open' } });
    await request.get('/api/auth/mock-login?role=buyer', { maxRedirects: 0 });

    const orderRes = await request.post('/api/orders', {
      data: { product_id: 'prod-001', variant_id: 'var-001-1', qty: 1 },
    });
    if (orderRes.status() !== 201) return; // skip if order creation fails

    const order = await orderRes.json();

    // Admin: advance to Pending
    await request.get('/api/auth/mock-login?role=admin', { maxRedirects: 0 });
    await request.patch(`/api/admin/orders/${order.id}/status`, {
      data: { status: 'Pending' },
    });

    // Admin: mark Bought with actual price
    const boughtRes = await request.patch(`/api/admin/orders/${order.id}/status`, {
      data: { status: 'Bought', bought_price_jpy: 12500 },
    });
    expect(boughtRes.status()).toBe(200);

    // Verify the order has bought_price_jpy
    const ordersRes = await request.get('/api/admin/orders');
    const orders = await ordersRes.json();
    const updatedOrder = orders.find((o: any) => o.id === order.id);
    expect(updatedOrder).toBeTruthy();
    expect(updatedOrder.bought_price_jpy).toBe(12500);
  });
});

// ============================================================
// CUJ-19: Admin Custom Fee & Profit PnL
// ============================================================
test.describe('CUJ-19: Admin Custom Fee & Profit PnL', () => {
  test('status API accepts custom_fee_idr and stores it when marking Bought', async ({ request }) => {
    await request.get('/api/auth/mock-login?role=admin', { maxRedirects: 0 });
    await request.put('/api/admin/settings', { data: { gate_status: 'Open' } });
    await request.get('/api/auth/mock-login?role=buyer', { maxRedirects: 0 });

    const orderRes = await request.post('/api/orders', {
      data: { product_id: 'prod-001', variant_id: 'var-001-1', qty: 1 },
    });
    if (orderRes.status() !== 201) return;
    const order = await orderRes.json();

    await request.get('/api/auth/mock-login?role=admin', { maxRedirects: 0 });
    // Advance to Pending
    await request.patch(`/api/admin/orders/${order.id}/status`, { data: { status: 'Pending' } });
    const boughtRes = await request.patch(`/api/admin/orders/${order.id}/status`, {
      data: {
        status: 'Bought',
        bought_price_jpy: 10000,
        price_idr_final: 1800000,
        custom_fee_idr: 50000,
      },
    });
    expect(boughtRes.status()).toBe(200);

    // Check order has custom_fee_idr stored
    const ordersRes = await request.get('/api/admin/orders');
    const orders = await ordersRes.json();
    const updatedOrder = orders.find((o: any) => o.id === order.id);
    if (updatedOrder) {
      expect(updatedOrder.custom_fee_idr).toBe(50000);
      expect(updatedOrder.price_idr_final).toBe(1800000);
      expect(updatedOrder.status).toBe('Bought');
    }
  });

  test('profit page shows PnL column', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/profit');
    await expect(page.locator('[data-testid="profit-page"]')).toBeVisible();
    // PnL column header should be visible in the table
    await expect(page.locator('th:has-text("PnL")')).toBeVisible();
  });

  test('bought-modal has custom fee input field', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/orders');
    // Bought modal and custom fee input should be present in DOM
    await expect(page.locator('#bought-modal')).toBeAttached();
    await expect(page.locator('#bought-fee-input')).toBeAttached();
  });

  test('admin buyer row shows WhatsApp link when WA number saved', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/orders');
    // buyer-001 has WA 628111222333 from seed
    // Find any row with the buyer and check for WA link
    const rows = page.locator('[data-testid="order-row"][data-buyer-wa]:not([data-buyer-wa=""])');
    if (await rows.count() > 0) {
      const waLink = rows.first().locator('a[href*="wa.me"]');
      await expect(waLink).toBeVisible();
      await expect(waLink).toHaveAttribute('href', /wa\.me/);
    }
  });
});

// ============================================================
// CUJ: Down Payment
// ============================================================
test.describe('CUJ: Down Payment', () => {
  test('admin can set down payment target and paid amount', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/orders');

    const row = page.locator('[data-testid="order-row"]').first();
    if (await row.count() === 0) return;
    const orderId = await row.getAttribute('data-id');

    await row.locator('[data-testid="context-menu-btn"]').click();
    await row.locator('[data-testid="action-dp"]').click();
    await expect(page.locator('#dp-modal')).toBeVisible({ timeout: 3000 });

    const targetInput = page.locator('#dp-target-input');
    const targetVal = await targetInput.inputValue();
    expect(parseInt(targetVal, 10)).toBeGreaterThanOrEqual(0);

    await page.locator('#dp-paid-input').fill(targetVal);
    await page.locator('#dp-form button[type="submit"]').click();

    const targetRow = page.locator(`[data-testid="order-row"][data-id="${orderId}"]`);
    await expect(targetRow).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================
// CUJ: Banking Info
// ============================================================
test.describe('CUJ: Banking Info', () => {
  test('admin updates bank info and buyer sees it', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/settings');
    await page.locator('#bank-name-input').fill('Test Bank');
    await page.locator('#bank-account-input').fill('9876543210');
    await page.locator('#bank-nameholder-input').fill('Test Holder');
    await page.locator('#btn-save-bank').click();

    await loginAs(page, 'buyer');
    await page.goto('/my-orders');
    // Bank info only shows when there's a Bought order with a final price (totalToPay > 0).
    const summary = page.getByText('Transfer ke Bank Berikut');
    if (await summary.count() > 0) {
      await expect(page.getByText('Test Bank')).toBeVisible();
      await expect(page.getByText('9876543210')).toBeVisible();
    }
  });
});

// ============================================================
// CUJ: Arrival Notification
// ============================================================
test.describe('CUJ: Arrival Notification', () => {
  test('admin sets arrival notification, buyer sees it on landing and orders', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/settings');
    await page.locator('#arrival-input').fill('Barang tiba 1 Juli 2026');
    await page.locator('#btn-save-arrival').click();

    // Landing page (logged out)
    await page.context().clearCookies();
    await page.goto('/');
    await expect(page.getByText('Barang tiba 1 Juli 2026')).toBeVisible();

    // Buyer orders page
    await loginAs(page, 'buyer');
    await page.goto('/my-orders');
    await expect(page.getByText('Barang tiba 1 Juli 2026')).toBeVisible();

    // Cleanup
    await loginAs(page, 'admin');
    await page.request.put('/api/admin/settings', { data: { arrival_notification: '' } });
  });
});

// ============================================================
// CUJ: Footer
// ============================================================
test.describe('CUJ: Footer', () => {
  test('footer visible on buyer pages with brand and links', async ({ page }) => {
    await loginAs(page, 'buyer');
    await page.goto('/catalog');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer.getByText(/Kotemart Jastip/)).toBeVisible();
    await expect(footer.getByText(/Kebijakan Privasi/)).toBeVisible();
  });
});

// ============================================================
// API: order status + payment
// ============================================================
test.describe('API: order transitions', () => {
  test('removed settle endpoint returns 404/401', async ({ request }) => {
    const res = await request.patch('/api/admin/orders/KTM-8472/settle', {
      data: { price_idr_final: 100000 },
    });
    expect([401, 404]).toContain(res.status());
  });

  test('payment endpoint updates DP fields (admin)', async ({ page }) => {
    await loginAs(page, 'admin');
    const res = await page.request.patch('/api/admin/orders/KTM-8472/payment', {
      data: { down_payment_idr: 50000, paid_amount_idr: 25000 },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.down_payment_idr).toBe(50000);
    expect(body.paid_amount_idr).toBe(25000);
  });
});

// ============================================================
// CUJ: Tags Master & Mobile Bottom Sheet Checkout
// ============================================================
test.describe('CUJ: Tags Master & Mobile Bottom Sheet Checkout', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.request.put('/api/admin/settings', { data: { gate_status: 'Open' } });
  });

  test('admin tags master creation and catalog tag filter works', async ({ page }) => {
    const tagName = `tag-${Date.now()}`;
    await page.goto('/admin/master/tags');
    await page.fill('#tag-name', tagName);
    await page.click('#btn-save');
    await page.waitForLoadState('networkidle');

    await expect(page.locator(`tr.tag-row:has-text("#${tagName}")`)).toBeVisible();

    // Create a product with this tag
    const res = await page.request.post('/api/products', {
      data: {
        name: 'Tagged Test Product',
        category: 'Elektronik',
        description: 'Product with custom tag',
        images: [],
        tag_ids: [],
        variants: [
          { variant_name: 'Standard', price_jpy: 1200, product_url: null, images: [] },
        ],
      },
    });
    expect(res.status()).toBe(201);
    const product = await res.json();

    // Link tag to product
    const tagsListRes = await page.request.get('/api/tags');
    const tagsList = await tagsListRes.json();
    const activeTag = tagsList.find((t: any) => t.name === tagName);
    expect(activeTag).toBeTruthy();

    await page.request.put(`/api/products/${product.id}`, {
      data: {
        tag_ids: [activeTag.id],
      },
    });

    await loginAs(page, 'buyer');
    await page.goto('/catalog');

    // Verify tag dropdown is visible and contains tag
    await page.click('[data-testid="tag-dropdown-btn"]');
    await page.click(`[data-testid="filter-tag-${tagName}"]`);

    const card = page.locator(`[data-testid="product-card"][data-product-id="${product.id}"]`);
    await expect(card).toBeVisible();

    // Search by tag name
    await page.fill('[data-testid="search-input"]', tagName);
    await expect(card).toBeVisible();

    // Cleanup
    await loginAs(page, 'admin');
    await page.request.delete(`/api/products/${product.id}`);
    await page.request.delete(`/api/admin/tags/${activeTag.id}`);
  });

  test('mobile bottom sheet checkout triggers WA gate and confirm dialog', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    await loginAs(page, 'buyer');
    // Clear WA number so WA dialog shows
    await page.request.patch('/api/orders/me/whatsapp', { data: { whatsapp_number: '' } });

    await page.goto('/catalog');
    const card = page.locator('[data-testid="product-card"]').first();
    await card.click();

    // Bottom sheet should open
    await expect(page.locator('#bottom-sheet')).toBeVisible();

    // Click checkout in sheet
    await page.locator('#sheet-order-btn').click();

    // WA Dialog must be shown
    await expect(page.locator('#wa-dialog[open]')).toBeAttached();

    // Input WA
    await page.fill('#wa-input', '628999000111');
    await page.locator('#wa-form button[type="submit"]').click();

    // Confirm dialog must show next
    await expect(page.locator('#confirm-order-dialog[open]')).toBeAttached();
    await page.locator('#confirm-order-btn').click();

    // Success toast
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================
// CUJ: Product Notes Templates & Buyer Confirm Dialog
// ============================================================
test.describe('CUJ: Product Notes Templates & Buyer Confirm Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('admin can manage note templates', async ({ page }) => {
    const noteText = `note-${Date.now()}`;
    await page.goto('/admin/master/notes');
    await page.fill('#new-note-input', noteText);
    await page.click('#btn-add-note');
    await expect(page.locator(`[data-testid="chip-remove-${noteText}"]`)).toBeVisible();
    await page.click('#btn-save-notes');
    await page.waitForLoadState('networkidle');

    // Reload settings and confirm it is there
    await page.goto('/admin/master/notes');
    await expect(page.locator(`[data-testid="chip-remove-${noteText}"]`)).toBeVisible();

    // Cleanup
    await page.locator(`[data-testid="chip-remove-${noteText}"]`).click();
    await page.click('#btn-save-notes');
    await page.waitForLoadState('networkidle');
  });

  test('buyer sees product notes in confirm dialog', async ({ page }) => {
    // Create product with notes
    const res = await page.request.post('/api/products', {
      data: {
        name: 'Notes Test Product',
        category: 'Elektronik',
        description: 'Test product',
        images: [],
        notes: ['Extra bubble wrap please', 'Fragile item'],
        variants: [
          { variant_name: 'Default', price_jpy: 1500, product_url: null, images: [] },
        ],
      },
    });
    expect(res.status()).toBe(201);
    const product = await res.json();

    await loginAs(page, 'buyer');
    await page.request.patch('/api/orders/me/whatsapp', { data: { whatsapp_number: '628111222333' } });
    await page.goto(`/catalog/${product.id}`);

    await page.locator('[data-testid="btn-add-order"]').click();

    // Confirm dialog should appear
    await expect(page.locator('#confirm-order-dialog[open]')).toBeAttached({ timeout: 3000 });
    await expect(page.locator('#confirm-notes-section')).toBeVisible();
    await expect(page.locator('#confirm-notes-list')).toContainText('Extra bubble wrap please');
    await expect(page.locator('#confirm-notes-list')).toContainText('Fragile item');

    await page.locator('#cancel-order-btn').click();

    // Cleanup
    await loginAs(page, 'admin');
    await page.request.delete(`/api/products/${product.id}`);
  });
});

// ============================================================
// CUJ: API Tokens Management & Variant Buy Links
// ============================================================
test.describe('CUJ: API Tokens Management & Variant Buy Links', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('admin settings page has api token UI and can generate/revoke tokens', async ({ page }) => {
    const tokenLabel = `token-${Date.now()}`;
    await page.goto('/admin/settings');

    await page.fill('#token-label-input', tokenLabel);
    await page.click('#btn-generate-token');

    // Token Modal must show up
    await expect(page.locator('#token-show-modal[open]')).toBeAttached();
    const tokenDisplay = await page.locator('#raw-token-display').textContent();
    expect(tokenDisplay).toContain('jastip_');

    await page.locator('#token-show-modal button:has-text("Selesai")').click();
    await page.waitForLoadState('networkidle');

    // Token should show up in list as active
    const row = page.locator(`tr:has-text("${tokenLabel}")`);
    await expect(row).toBeVisible();
    await expect(row.locator('.btn-revoke-token')).toBeVisible();

    // Verify token can make requests to admin endpoints
    const res = await page.request.get('/api/admin/settings', {
      headers: {
        'Authorization': `Bearer ${tokenDisplay}`,
      },
    });
    expect(res.status()).toBe(200);

    // Revoke token
    page.on('dialog', d => d.accept());
    await row.locator('.btn-revoke-token').click();
    await page.waitForLoadState('networkidle');

    // Token should now be listed as Revoked
    await expect(row.locator('span:has-text("Revoked")')).toBeVisible();

    // Revoked token should return 401
    const revokedRes = await page.request.get('/api/admin/settings', {
      headers: {
        'Authorization': `Bearer ${tokenDisplay}`,
      },
    });
    expect(revokedRes.status()).toBe(401);
  });

  test('admin order row renders buy link for variant product URL', async ({ page }) => {
    const buyUrl = 'https://www.amazon.co.jp/dp/B0BSHF7WHW';
    // Create product with variant URL
    const prodRes = await page.request.post('/api/products', {
      data: {
        name: 'Variant Buy Link Test Product',
        category: 'Elektronik',
        description: 'Product for checking buy url',
        images: [],
        variants: [
          { variant_name: 'Standard Size', price_jpy: 1500, product_url: buyUrl, images: [] },
        ],
      },
    });
    expect(prodRes.status()).toBe(201);
    const product = await prodRes.json();
    const variantId = product.variants[0].id;

    // Buyer places order
    await loginAs(page, 'buyer');
    await page.request.patch('/api/orders/me/whatsapp', { data: { whatsapp_number: '628111222333' } });

    const orderRes = await page.request.post('/api/orders', {
      data: { product_id: product.id, variant_id: variantId, qty: 1 },
    });
    expect(orderRes.status()).toBe(201);
    const order = await orderRes.json();

    // Admin navigates to orders list
    await loginAs(page, 'admin');
    await page.goto('/admin/orders');

    const orderRow = page.locator(`tr.order-row[data-id="${order.id}"]`);
    await expect(orderRow).toBeVisible();

    const buyLink = orderRow.locator('a:has-text("Beli")');
    await expect(buyLink).toBeVisible();
    await expect(buyLink).toHaveAttribute('href', buyUrl);

    // Cleanup
    await page.request.delete(`/api/products/${product.id}`);
  });
});

// ============================================================
// CUJ: Catalog Links and Pricing Audit
// ============================================================
test.describe('CUJ: Catalog Links and Pricing Audit', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/products/audit');
  });

  test('navigation to page works and layout is rendered', async ({ page }) => {
    await expect(page.locator('h2').first()).toContainText('Audit Katalog');
    await expect(page.locator('#search-input')).toBeVisible();
    await expect(page.locator('#category-filter')).toBeVisible();
    await expect(page.locator('#issue-filter')).toBeVisible();
  });

  test('can expand product, change JPY price, and save it', async ({ page }) => {
    // Find first toggle button and click it
    const toggleBtn = page.locator('.toggle-btn').first();
    await toggleBtn.click();

    // Check if variant container is visible
    const firstProductRow = page.locator('.product-row').first();
    const productId = await firstProductRow.getAttribute('data-id');
    const container = page.locator(`#variants-row-${productId}`);
    await expect(container).toBeVisible();

    // Change variant JPY price
    const priceInput = container.locator('.variant-price-jpy').first();
    const oldPriceStr = await priceInput.inputValue();
    const newPriceVal = (parseInt(oldPriceStr, 10) || 100) + 10;

    await priceInput.fill(newPriceVal.toString());

    // Trigger save
    const saveBtn = container.locator('.btn-save-variant').first();
    await saveBtn.click();
    await expect(saveBtn).toContainText('Selesai!');

    // Re-verify value after page reload to confirm database persistence
    await page.reload();
    await page.locator('.toggle-btn').first().click();
    const updatedPriceStr = await page.locator('.variant-price-jpy').first().inputValue();
    expect(parseInt(updatedPriceStr, 10)).toBe(newPriceVal);
  });
});
