# Order Flow & Site Info Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify order flow (remove Settled), add down payment tracking, configurable banking info, arrival notification banner, and site footer.

**Architecture:** Five tightly-coupled changes sharing schema, types, pricing lib, and API router. Tasks are sequenced: schema/types first → pricing/lib changes → API changes → admin UI → buyer UI → tests — so each task can be committed independently without breaking the previous state.

**Tech Stack:** Astro 6 SSR, Cloudflare D1 (SQLite), Hono API, Tailwind 4 + DaisyUI, Playwright E2E.

---

### Task 1: Schema, types, and seed data

**Files:**
- Modify: `db/schema.sql` (orders CHECK constraint + 2 new columns)
- Modify: `db/seed.sql` (Settled → Bought)
- Modify: `src/lib/types.ts` (OrderStatus, Settings)

- [ ] **Step 1: Update `db/schema.sql` — remove `Settled` from orders status CHECK, add DP columns**

In `orders` table, change the `status` CHECK to:
```
status TEXT NOT NULL DEFAULT 'Draft'
  CHECK(status IN ('Draft','Pending','Bought','Cancelled')),
```

Add two new columns after `cancelled_at`:
```
down_payment_idr  INTEGER,
paid_amount_idr   INTEGER NOT NULL DEFAULT 0,
```

- [ ] **Step 2: Update `db/seed.sql` — change Settled seed order to Bought**

Change the KTM-8412 order status from `Settled` to `Bought` and add `bought_price_jpy`. The line is:
```
('KTM-8412', 'buyer-001', 'prod-004', 'var-004-2', 'catalog',
 'DHC Deep Cleansing Oil',
 1, 'Bought', 1800, 110.0, 5.0, CAST(1800*110.0*1.05 AS INTEGER), 215000,
 datetime('now', '-20 days')),
```
Also update the `settled_at` update at end of seed:
```
UPDATE orders SET settled_at = datetime('now', '-15 days'), bought_price_jpy = 1800 WHERE id = 'KTM-8412';
```

- [ ] **Step 3: Update `src/lib/types.ts` — OrderStatus, Settings, Settings defaults**

Change `OrderStatus`:
```ts
export type OrderStatus = 'Draft' | 'Pending' | 'Bought' | 'Cancelled';
```

Add DP fields to the `Order` interface (after `custom_fee_idr`):
```ts
  down_payment_idr: number | null;
  paid_amount_idr: number;
```

Extend `Settings` interface:
```ts
export interface Settings {
  gate_status: 'Open' | 'Closed';
  jpy_to_idr_rate: number;
  global_fee_pct: number;
  telegram_link: string;
  product_categories: string[];
  arrival_notification: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add db/schema.sql db/seed.sql src/lib/types.ts
git commit -m "feat: simplify order flow (rm Settled), add DP columns, new settings fields"
```

---

### Task 2: Pricing lib — `ceilTo1000`, `getSettings` with new fields

**Files:**
- Modify: `src/lib/pricing.ts`

- [ ] **Step 1: Extract and export `ceilTo1000` helper**

Add before `calcIdrEstimate`:
```ts
export function ceilTo1000(value: number): number {
  return Math.ceil(value / 1000) * 1000;
}
```

Refactor `calcIdrEstimate` to use it:
```ts
export function calcIdrEstimate(
  priceJpy: number,
  jpyRate: number,
  feePct: number,
): number {
  const rawIdr = priceJpy * jpyRate * (1 + feePct / 100);
  return ceilTo1000(rawIdr);
}
```

- [ ] **Step 2: Update `getSettings()` — bank + arrival fields**

Update the `getSettings` function to fetch the 4 new keys. Change the WHERE clause:
```ts
const rows = await db
  .prepare(`SELECT key, value FROM settings WHERE key IN ('gate_status','jpy_to_idr_rate','global_fee_pct','telegram_link','product_categories','arrival_notification','bank_name','bank_account_number','bank_account_name')`)
  .all<{ key: string; value: string }>();
```

Add to the return object:
```ts
return {
  // ... existing fields ...
  arrival_notification: map['arrival_notification'] ?? '',
  bank_name: map['bank_name'] ?? '',
  bank_account_number: map['bank_account_number'] ?? '',
  bank_account_name: map['bank_account_name'] ?? '',
};
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/pricing.ts
git commit -m "feat: add ceilTo1000 helper, getSettings returns bank + arrival fields"
```

---

### Task 3: API — remove /settle, merge into /status, add /payment, profit, settings schema

**Files:**
- Modify: `src/pages/api/[...path].ts`

- [ ] **Step 1: Update `STATUS_ORDER` and `isForwardTransition`**

```ts
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
```
Key change: `Cancelled` is only allowed from Draft or Pending (not from Bought).

- [ ] **Step 2: Update `patchStatusSchema` — merge settle fields**

Replace the existing schema with:
```ts
const patchStatusSchema = z.object({
  status: z.enum(['Pending', 'Bought']).optional(),
  price_jpy: z.number().int().min(0).optional(),
  bought_price_jpy: z.number().int().min(0).optional(),
  price_idr_final: z.number().int().min(0).optional(),
  custom_fee_idr: z.number().int().min(0).optional(),
  manual_idr_override: z.number().int().min(0).optional(),
});
```

- [ ] **Step 3: Update the status handler — handle price_idr_final, custom_fee_idr, manual_idr_override at Bought**

After the existing `bought_price_jpy` block, add:
```ts
// Set final price fields when marking as Bought
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
```

When `status` is set to `'Bought'`, also set `settled_at`:
```ts
if (newStatus === 'Bought') {
  await c.env.DB.prepare(
    `UPDATE orders SET status = ?1, settled_at = CURRENT_TIMESTAMP WHERE id = ?2`
  ).bind(newStatus, id).run();
} else {
  await c.env.DB.prepare(`UPDATE orders SET status = ?1 WHERE id = ?2`)
    .bind(newStatus, id)
    .run();
}
```

- [ ] **Step 4: Remove the `/settle` endpoint**

Delete the entire `settleSchema` and `adminRouter.patch('/orders/:id/settle', ...)` block (roughly lines 769-802).

- [ ] **Step 5: Add PATCH `/api/admin/orders/:id/payment`**

After the cancel endpoint, add:
```ts
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
```

- [ ] **Step 6: Update profit report query — use 'Bought' instead of 'Settled'**

In the profit report handler (around line 938), change:
```ts
let settledQuery = `
  SELECT o.*, u.name AS buyer_name, u.email AS buyer_email
  FROM orders o
  JOIN users u ON u.id = o.user_id
  WHERE o.status = 'Bought'`;
```
Also in `calculateKPIs` in the profit page JS (admin/profit.astro).

- [ ] **Step 7: Update settings schema — add bank + arrival fields**

Extend `updateSettingsSchema`:
```ts
const updateSettingsSchema = z.object({
  // existing fields...
  arrival_notification: z.string().optional(),
  bank_name: z.string().optional(),
  bank_account_number: z.string().optional(),
  bank_account_name: z.string().optional(),
});
```

Add them to the updates list:
```ts
if (body.arrival_notification !== undefined) updates.push(['arrival_notification', body.arrival_notification]);
if (body.bank_name !== undefined) updates.push(['bank_name', body.bank_name]);
if (body.bank_account_number !== undefined) updates.push(['bank_account_number', body.bank_account_number]);
if (body.bank_account_name !== undefined) updates.push(['bank_account_name', body.bank_account_name]);
```

- [ ] **Step 8: Commit**

```bash
git add src/pages/api/\[...path\].ts
git commit -m "feat: merge settle into status, add payment endpoint, bank+arrival settings"
```

---

### Task 4: Admin orders UI — remove Settle, embed final-price in Bought modal, add DP modal

**Files:**
- Modify: `src/pages/admin/orders.astro`

- [ ] **Step 1: Remove the Settle modal** (lines 206-252 in current file) — delete the entire `<dialog id="settle-modal">...</dialog>` block.

- [ ] **Step 2: Add final-price fields to the Bought modal**

The existing bought modal (lines 306-330) gains three optional fields after the bought-price input. Add inside the form, before the modal-action div:

```html
<div class="flex flex-col gap-1">
  <label class="text-[0.8125rem] font-semibold text-[#1A1D23]">Harga Final IDR (Opsional)</label>
  <input
    type="number"
    id="bought-final-price-input"
    min="0"
    class="w-full h-[40px] px-3 border border-[#E8E9ED] rounded-[6px] text-[0.875rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89]"
    placeholder="Harga final dalam IDR..."
  />
</div>
<div class="flex flex-col gap-1">
  <label class="text-[0.8125rem] font-semibold text-[#1A1D23]">Fee Jastip IDR (Opsional)</label>
  <input
    type="number"
    id="bought-fee-input"
    min="0"
    class="w-full h-[40px] px-3 border border-[#E8E9ED] rounded-[6px] text-[0.875rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89]"
    placeholder="Override fee jastip..."
  />
</div>
<div class="flex flex-col gap-1">
  <label class="text-[0.8125rem] font-semibold text-[#1A1D23]">Manual IDR Override (Opsional)</label>
  <input
    type="number"
    id="bought-override-input"
    min="0"
    class="w-full h-[40px] px-3 border border-[#E8E9ED] rounded-[6px] text-[0.875rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89]"
    placeholder="Override rumus kalkulasi..."
  />
</div>
```

- [ ] **Step 3: Add DP modal**

Before the closing `</AdminLayout>`, add:
```html
<!-- Down Payment Modal -->
<dialog id="dp-modal" class="modal">
  <div class="modal-box bg-[#FFFFFF] border border-[#E8E9ED] shadow-lg rounded-[10px]">
    <h3 class="font-bold text-lg text-[#1A1D23] mb-1">Down Payment</h3>
    <p class="text-[0.8125rem] text-[#5B606D] mb-4">Atur target DP dan jumlah yang sudah dibayar pembeli.</p>
    <form id="dp-form" class="flex flex-col gap-4">
      <input type="hidden" id="dp-order-id" />
      <div class="flex flex-col gap-1">
        <label class="text-[0.8125rem] font-semibold text-[#1A1D23]">Target DP (IDR)</label>
        <input
          type="number"
          id="dp-target-input"
          min="0"
          class="w-full h-[40px] px-3 border border-[#E8E9ED] rounded-[6px] text-[0.875rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89]"
          placeholder="50% dari estimasi harga..."
        />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[0.8125rem] font-semibold text-[#1A1D23]">Jumlah Dibayar (IDR)</label>
        <input
          type="number"
          id="dp-paid-input"
          min="0"
          class="w-full h-[40px] px-3 border border-[#E8E9ED] rounded-[6px] text-[0.875rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89]"
          placeholder="Total yang sudah ditransfer pembeli..."
        />
      </div>
      <div class="modal-action">
        <button type="button" class="btn btn-ghost text-[#5B606D] rounded-[6px]" onclick="document.getElementById('dp-modal').close()">Batal</button>
        <button type="submit" class="btn bg-[#0F726E] hover:bg-[#0A5D59] text-white rounded-[6px]">Simpan Pembayaran</button>
      </div>
    </form>
  </div>
</dialog>
```

- [ ] **Step 4: Add DP badge column to orders table**

In the table header, add after "Harga JPY" column (before "Est./Final IDR"):
```html
<th class="py-3 px-4 text-center">DP</th>
```

In the row data, add after the JPY column (before the Est./Final IDR column):
```html
<td class="py-4 px-4 text-center" data-dp-cell>
  <!-- populated by JS -->
</td>
```

Store DP data on the row element. Add to the existing `data-*` attributes on the `<tr>`:
```
data-dp-target="{order.down_payment_idr ?? ''}"
data-dp-paid="{order.paid_amount_idr ?? 0}"
```

- [ ] **Step 5: Add DP action to the action menu**

In the `<ul>` inside the dropdown, add a separator and DP button before the cancel option:
```html
<li class="divider my-1 mx-4 border-t border-[#E8E9ED]"></li>
<li>
  <button class="action-btn" data-action="dp" data-testid="action-dp">
    Down Payment
  </button>
</li>
```

- [ ] **Step 6: Update the action menu — remove Settle, update Bought behavior, mark terminal**

In the template, the action menu per order row:
- `Bought` orders: show NO actions (terminal state — not even Cancel). Remove the entire `{order.status === 'Bought' && ...}` block for Settle. Remove the cancel option for Bought.
- `Cancelled` orders: show nothing.
- `Draft` and `Pending`: keep existing actions + DP action.

- [ ] **Step 7: Update the client-side JS — connect Bought modal with final price fields, handle DP modal**

Update the `action === 'mark-bought'` handler to also pre-fill the est IDR info.

Replace the bought-form submit handler to send the extra fields:
```ts
document.getElementById('bought-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const orderId = (document.getElementById('bought-order-id') as HTMLInputElement).value;
  const boughtJpy = parseInt((document.getElementById('bought-price-input') as HTMLInputElement).value, 10);
  const finalPrice = (document.getElementById('bought-final-price-input') as HTMLInputElement).value;
  const customFee = (document.getElementById('bought-fee-input') as HTMLInputElement).value;
  const overridePrice = (document.getElementById('bought-override-input') as HTMLInputElement).value;

  const boughtModal = document.getElementById('bought-modal') as HTMLDialogElement;
  boughtModal.close();

  const extraBody: Record<string, unknown> = { bought_price_jpy: boughtJpy };
  if (finalPrice) extraBody.price_idr_final = parseInt(finalPrice, 10);
  if (customFee) extraBody.custom_fee_idr = parseInt(customFee, 10);
  if (overridePrice) extraBody.manual_idr_override = parseInt(overridePrice, 10);

  await updateStatus(orderId, 'Bought', extraBody);
});
```

Remove the settle form submit handler and custom-price form handler (unchanged). Remove the settle-related code from the action-btn handler.

Add the DP action handler in the action-btn click:
```ts
} else if (action === 'dp') {
  const dpModal = document.getElementById('dp-modal') as HTMLDialogElement;
  (document.getElementById('dp-order-id') as HTMLInputElement).value = orderId;

  // Prediksi default DP 50% dari harga IDR
  const dpTargetInput = document.getElementById('dp-target-input') as HTMLInputElement;
  const dpPaidInput = document.getElementById('dp-paid-input') as HTMLInputElement;
  const paidAmountStr = row.getAttribute('data-dp-paid') || '0';
  const estIdrNum = estIdr ? parseInt(estIdr) : 0;
  const defaultDp = estIdrNum ? Math.ceil(estIdrNum * 0.5 / 1000) * 1000 : 0;
  const currentDpTarget = row.getAttribute('data-dp-target');
  dpTargetInput.value = currentDpTarget || String(defaultDp);
  dpPaidInput.value = paidAmountStr;
  dpModal.showModal();
}
```

Add DP form submit handler:
```ts
document.getElementById('dp-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const orderId = (document.getElementById('dp-order-id') as HTMLInputElement).value;
  const target = (document.getElementById('dp-target-input') as HTMLInputElement).value;
  const paid = (document.getElementById('dp-paid-input') as HTMLInputElement).value;

  const dpModal = document.getElementById('dp-modal') as HTMLDialogElement;
  dpModal.close();

  try {
    const apiClient = (window as any).apiClient || fetch;
    const res = await apiClient(`/api/admin/orders/${orderId}/payment`, {
      method: 'PATCH',
      body: JSON.stringify({
        down_payment_idr: target ? parseInt(target, 10) : undefined,
        paid_amount_idr: paid ? parseInt(paid, 10) : undefined,
      }),
    });

    if (res.ok) {
      window.showToast?.(`Pembayaran untuk ${orderId} berhasil disimpan!`, 'success');
      window.location.reload();
    } else {
      const err = await res.json().catch(() => ({}));
      window.showToast?.(err.error || 'Gagal menyimpan pembayaran.', 'error');
    }
  } catch {
    window.showToast?.('Terjadi kesalahan jaringan.', 'error');
  }
});
```

Add a function to render DP badge cells and call it on page load / filter:
```ts
function renderDpCells() {
  document.querySelectorAll('[data-dp-cell]').forEach(cell => {
    const row = cell.closest('.order-row') as HTMLElement;
    const dpTargetStr = row.getAttribute('data-dp-target');
    const dpPaidStr = row.getAttribute('data-dp-paid') || '0';
    const dpPaid = parseInt(dpPaidStr, 10);

    if (!dpTargetStr) {
      if (dpPaid > 0) {
        cell.innerHTML = `<span class="text-[0.7rem] text-[#2E8B57] font-semibold">Terbayar Rp ${dpPaid.toLocaleString('id-ID')}</span>`;
      } else {
        cell.innerHTML = `<span class="text-[0.7rem] text-[#A5A9B2]">—</span>`;
      }
      return;
    }

    const dpTarget = parseInt(dpTargetStr, 10);
    const isMet = dpPaid >= dpTarget;
    cell.innerHTML = `
      <div class="flex flex-col items-center gap-0.5 text-[0.7rem]">
        <span class="font-semibold text-[#1A1D23]">Rp ${dpTarget.toLocaleString('id-ID')}</span>
        <span class="px-1 py-0.5 rounded text-[0.55rem] font-bold uppercase tracking-wider ${
          isMet ? 'bg-[#D9EDE2] text-[#1E6B3F]' : 'bg-[#FDF3E7] text-[#8B5E0A]'
        }">${isMet ? 'Terbayar' : 'Belum'}</span>
        <span class="text-[#5B606D]">Sisa: Rp ${Math.max(dpTarget - dpPaid, 0).toLocaleString('id-ID')}</span>
      </div>
    `;
  });
}
// Call it on load
renderDpCells();
```

- [ ] **Step 8: Commit**

```bash
git add src/pages/admin/orders.astro
git commit -m "feat: remove settle modal, add DP modal, merge final-price into bought modal"
```

---

### Task 5: Admin profit page — Bought instead of Settled

**Files:**
- Modify: `src/pages/admin/profit.astro`

- [ ] **Step 1: Update the SQL query**

Change `WHERE o.status IN ('Settled', 'Cancelled')` to `WHERE o.status IN ('Bought', 'Cancelled')`.
Change `ORDER BY o.settled_at DESC` (keep as-is — `settled_at` is repurposed).

- [ ] **Step 2: Update client-side JS**

In `calculateKPIs` function, change:
```ts
const settled = filtered.filter(o => o.status === 'Settled');
```
to:
```ts
const settled = filtered.filter(o => o.status === 'Bought');
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/profit.astro
git commit -m "fix: profit page uses Bought instead of Settled"
```

---

### Task 6: Admin settings — bank + arrival notification cards

**Files:**
- Modify: `src/pages/admin/settings.astro`

- [ ] **Step 1: Add Arrival Notification card**

After the Telegram card (before Categories card), add a new card:
```html
<div class="bg-[#FFFFFF] border border-[#E8E9ED] rounded-[10px] p-[24px] shadow-sm flex flex-col gap-4">
  <h3 class="font-bold text-[1.125rem] text-[#1A1D23] leading-tight">Barang Tiba Notification</h3>
  <p class="text-[0.8125rem] text-[#5B606D] -mt-2">Pesan 1 baris yang muncul di halaman beranda & pesanan pembeli. Kosongkan untuk menyembunyikan.</p>

  <div class="flex flex-col gap-1 border-t border-[#E8E9ED] pt-4">
    <div class="flex flex-col gap-3">
      <input
        type="text"
        id="arrival-input"
        value={settings.arrival_notification}
        placeholder="Contoh: Barang tiba 20 Juni 2026, segera lunasi!"
        class="w-full h-[40px] px-3 border border-[#E8E9ED] rounded-[6px] text-[0.875rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89]"
      />
      <button
        id="btn-save-arrival"
        class="btn-primary-custom h-[40px] w-full"
      >
        Simpan Notification
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add Bank Account card**

After the Categories card, add:
```html
<div class="bg-[#FFFFFF] border border-[#E8E9ED] rounded-[10px] p-[24px] shadow-sm flex flex-col gap-4">
  <h3 class="font-bold text-[1.125rem] text-[#1A1D23] leading-tight">Informasi Rekening Bank</h3>
  <p class="text-[0.8125rem] text-[#5B606D] -mt-2">Data rekening yang ditampilkan ke pembeli untuk pembayaran.</p>

  <div class="border-t border-[#E8E9ED] pt-4 flex flex-col gap-4">
    <div class="flex flex-col gap-1">
      <label class="text-[0.8125rem] font-semibold text-[#1A1D23]">Nama Bank</label>
      <input type="text" id="bank-name-input" value={settings.bank_name} placeholder="BCA"
        class="w-full h-[40px] px-3 border border-[#E8E9ED] rounded-[6px] text-[0.875rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89]" />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-[0.8125rem] font-semibold text-[#1A1D23]">Nomor Rekening</label>
      <input type="text" id="bank-account-input" value={settings.bank_account_number} placeholder="1234567890"
        class="w-full h-[40px] px-3 border border-[#E8E9ED] rounded-[6px] text-[0.875rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89]" />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-[0.8125rem] font-semibold text-[#1A1D23]">Atas Nama</label>
      <input type="text" id="bank-nameholder-input" value={settings.bank_account_name} placeholder="Darma Kotama"
        class="w-full h-[40px] px-3 border border-[#E8E9ED] rounded-[6px] text-[0.875rem] focus:outline-none focus:ring-2 focus:ring-[#1A8F89]" />
    </div>
    <button id="btn-save-bank" class="btn-primary-custom h-[40px] w-full">Simpan Rekening</button>
  </div>
</div>
```

- [ ] **Step 3: Wire JavaScript for arrival and bank saves**

Add to the existing `<script>`:
```ts
// Arrival Notification
document.getElementById('btn-save-arrival')?.addEventListener('click', async () => {
  const val = (document.getElementById('arrival-input') as HTMLInputElement).value.trim();
  await saveSettings({ arrival_notification: val }, 'Notification berhasil disimpan!');
});

// Bank Info
document.getElementById('btn-save-bank')?.addEventListener('click', async () => {
  const bankName = (document.getElementById('bank-name-input') as HTMLInputElement).value.trim();
  const bankAccount = (document.getElementById('bank-account-input') as HTMLInputElement).value.trim();
  const bankNameholder = (document.getElementById('bank-nameholder-input') as HTMLInputElement).value.trim();
  await saveSettings({
    bank_name: bankName,
    bank_account_number: bankAccount,
    bank_account_name: bankNameholder,
  }, 'Data rekening berhasil disimpan!');
});
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/settings.astro
git commit -m "feat: admin settings for arrival notification and bank account info"
```

---

### Task 7: Buyer my-orders — 3-step stepper, Bought-based total, DP display, bank from settings, arrival banner

**Files:**
- Modify: `src/pages/my-orders.astro`

- [ ] **Step 1: Update server-side — fetch settings for bank + arrival, fetch DP fields, filter by Bought**

Add to frontmatter — import and fetch:
```ts
import { getSettings } from '../lib/pricing';

const settings = await getSettings(db);
const arrivalNotification = settings.arrival_notification;
const { bank_name, bank_account_number, bank_account_name } = settings;
```

Update the SQL query to include DP columns:
```ts
const result = await db.prepare(
  `SELECT id, user_id, product_id, type, name, description, reference_url, qty,
          status, price_jpy, jpy_rate_snapshot, fee_pct_snapshot,
          price_idr_estimate, price_idr_final, manual_idr_override,
          notes, cancellation_reason, cancelled_at, settled_at, created_at,
          down_payment_idr, paid_amount_idr,
          (SELECT images FROM products WHERE products.id = orders.product_id LIMIT 1) as product_images
   FROM orders
   WHERE user_id = ?
   ORDER BY created_at DESC`
).bind(user.id).all();
```

Update STATUS_STEPS and STATUS_INDEX:
```ts
const STATUS_STEPS = ['Draft', 'Pending', 'Bought'] as const;
const STATUS_INDEX: Record<string, number> = { Draft: 0, Pending: 1, Bought: 2 };
```

Update `totalToPay` filter:
```ts
const boughtOrders = orders.filter(o => o.status === 'Bought' && (o.price_idr_final != null));
const totalToPay = boughtOrders.reduce((sum, o) => sum + ((o.price_idr_final ?? 0) * o.qty), 0);
```

- [ ] **Step 2: Update status steps rendering**

In the stepper, change `STATUS_STEPS` from 4 to 3:
```ts
const STATUS_STEPS = ['Draft', 'Pending', 'Bought'] as const;
```

The same 3 steps render but the percentages change. The progress line should reflect 3 steps (0/1/2).

- [ ] **Step 3: Update the payment summary card to use dynamic bank info**

Replace hardcoded BCA block with:
```tsx
{bank_name && bank_account_number && (
  <div class="bg-[#F9F9F7] border border-[#E8E9ED] rounded-[6px] p-[16px] w-full md:w-[320px] shrink-0">
    <h3 class="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[#5B606D] mb-4">Transfer ke Bank Berikut</h3>
    <div class="flex justify-between items-center mb-3">
      <span class="text-[0.8125rem] text-[#5B606D]">{bank_name}</span>
      <span class="font-mono text-[1rem] font-bold text-[#1A1D23]">{bank_account_number}</span>
    </div>
    {bank_account_name && (
      <div class="flex justify-between items-center">
        <span class="text-[0.8125rem] text-[#5B606D]">Atas Nama</span>
        <span class="text-[0.8125rem] font-semibold text-[#1A1D23]">{bank_account_name}</span>
      </div>
    )}
    <div class="mt-4 pt-4 border-t border-[#E8E9ED]">
      <button id="copy-rekening-btn" ...>
        Salin No. Rekening
      </button>
    </div>
  </div>
)}
```

Update the copy button handler to use dynamic number:
```ts
await navigator.clipboard.writeText('{bank_account_number}');
```
Wait — this is in a `<script>` tag which is client-side. We need to pass the value from server to client. Use `define:vars={{ bank_account_number }}` on the script tag.

- [ ] **Step 4: Add arrival notification banner**

After the page header div, add:
```tsx
{arrivalNotification && (
  <div class="mb-[24px] bg-[#FDF3E7] border border-[#D4890B] rounded-[8px] px-4 py-3 flex items-center gap-3 text-[0.875rem]">
    <svg class="w-5 h-5 shrink-0 text-[#D4890B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span class="text-[#8B5E0A] font-medium">{arrivalNotification}</span>
  </div>
)}
```

- [ ] **Step 5: Add DP display per-order card**

Inside each order card, after the price section, add a DP info line when `down_payment_idr` is set:
```tsx
{order.down_payment_idr != null && (
  <div class="border-t border-[#E8E9ED] mt-3 pt-3 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <span class="text-[0.75rem] text-[#5B606D]">DP: Rp {order.down_payment_idr.toLocaleString('id-ID')}</span>
      <span class={`px-[4px] py-[1px] rounded text-[0.55rem] font-bold uppercase tracking-[0.08em] ${(order.paid_amount_idr ?? 0) >= order.down_payment_idr ? 'bg-[#D9EDE2] text-[#1E6B3F]' : 'bg-[#FDF3E7] text-[#8B5E0A]'}`}>
        {(order.paid_amount_idr ?? 0) >= order.down_payment_idr ? 'Terbayar' : 'Belum'}
      </span>
    </div>
    <span class="text-[0.75rem] text-[#5B606D]">
      {(order.paid_amount_idr ?? 0) > 0 ? `Terbayar: Rp ${(order.paid_amount_idr ?? 0).toLocaleString('id-ID')}` : ''}
      {(order.paid_amount_idr ?? 0) > 0 && (order.down_payment_idr ?? 0) > 0 ? ` — ` : ''}
      {(order.down_payment_idr ?? 0) > 0 ? `Sisa: Rp ${Math.max(order.down_payment_idr - (order.paid_amount_idr ?? 0), 0).toLocaleString('id-ID')}` : ''}
    </span>
  </div>
)}
```

- [ ] **Step 6: Update copy script with define:vars**

Add `<script define:vars={{ bank_account_number }}>` (or merge into the existing `<script>` block). Wait — the existing script doesn't use `define:vars`. We need to change the `<script>` tag:
```astro
<script define:vars={{ bank_account_number }}>
```

The copy handler:
```ts
document.getElementById('copy-rekening-btn')?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(bank_account_number);
    window.showToast?.('No. Rekening berhasil disalin!', 'success');
  } catch {
    window.showToast?.('Gagal menyalin nomor rekening.', 'error');
  }
});
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/my-orders.astro
git commit -m "feat: 3-step stepper, bank from settings, arrival banner, DP display"
```

---

### Task 8: Home page (index.astro) — arrival notification banner

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Add arrival notification banner above or below the brand section**

This is a standalone landing page (no Layout). Add env/D1 fetch for settings. In the frontmatter:
```ts
import { getSettings } from '../lib/pricing';

let arrivalNotification = '';
try {
  const db = (env as any).DB;
  if (db) {
    const settings = await getSettings(db);
    arrivalNotification = settings.arrival_notification;
  }
} catch (err) {
  console.error('Settings fetch error:', err);
}
```

In the HTML body, before the first `<div class="mb-8 text-center">`, add:
```html
{arrivalNotification && (
  <div class="w-full max-w-[700px] mx-auto mb-6 bg-[#FDF3E7] border border-[#D4890B] rounded-[8px] px-4 py-3 flex items-center gap-3 text-[0.875rem]">
    <svg class="w-5 h-5 shrink-0 text-[#D4890B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span class="text-[#8B5E0A] font-medium">{arrivalNotification}</span>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: add arrival notification banner to landing page"
```

---

### Task 9: Footer in Layout.astro

**Files:**
- Modify: `src/layouts/Layout.astro`

- [ ] **Step 1: Add footer before the closing `</body>` tag**

After the `<slot />` line and before the scroll-to-top button, add:
```tsx
<!-- Site Footer -->
<footer class="bg-[#FFFFFF] border-t border-[#E8E9ED] mt-12">
  <div class="max-w-[1200px] mx-auto px-4 md:px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
    <p class="text-[0.8125rem] text-[#A5A9B2]">
      &copy; {new Date().getFullYear()} Kotemart Jastip
    </p>
    <div class="flex items-center gap-4">
      <a href="/privacy" class="text-[0.75rem] text-[#5B606D] hover:text-[#1A8F89] no-underline transition-colors">Kebijakan Privasi</a>
      <span class="text-[#D8DBDF] text-[0.75rem]">|</span>
      <a href="/terms" class="text-[0.75rem] text-[#5B606D] hover:text-[#1A8F89] no-underline transition-colors">Syarat & Ketentuan</a>
    </div>
  </div>
</footer>
```

But wait — we need settings to access the telegram link. Currently `Layout.astro` doesn't fetch settings. The footer needs the telegram link. Options:
1. Fetch settings in Layout.astro frontmatter — adds DB call to every page
2. Add telegram link to footer only if available — pass as prop from child pages

Option 1 is simplest. Add to Layout frontmatter:
```ts
import { env } from 'cloudflare:workers';
import { getSettings } from '../lib/pricing';

let telegramLink = '';
try {
  const db = (env as any).DB;
  if (db) {
    const settings = await getSettings(db);
    telegramLink = settings.telegram_link;
  }
} catch {}
```

Then in the footer, add a Telegram link if present:
```tsx
<footer class="...">
  <div class="max-w-[1200px] mx-auto px-4 md:px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
    <p class="text-[0.8125rem] text-[#A5A9B2]">
      &copy; {new Date().getFullYear()} Kotemart Jastip
    </p>
    <div class="flex items-center gap-4">
      {telegramLink && (
        <>
          <a href={telegramLink} target="_blank" rel="noopener noreferrer" class="text-[0.75rem] text-[#5B606D] hover:text-[#1A8F89] no-underline transition-colors">Telegram</a>
          <span class="text-[#D8DBDF] text-[0.75rem]">|</span>
        </>
      )}
      <a href="/privacy" ...>Kebijakan Privasi</a>
      <span class="text-[#D8DBDF]">|</span>
      <a href="/terms" ...>Syarat & Ketentuan</a>
    </div>
  </div>
</footer>
```

- [ ] **Step 2: Commit**

```bash
git add src/layouts/Layout.astro
git commit -m "feat: add site-wide footer with telegram, privacy, terms links"
```

---

### Task 10: E2E tests — update existing, add DP, bank, arrival, footer tests

**Files:**
- Modify: `tests/e2e.spec.ts`

- [ ] **Step 1: Update CUJ-11/12 — remove Settle tests, update status flow**

Find the existing tests at around line 239-330. Update:

The `admin can settle a Bought order` test becomes `admin can mark Bought with final price` — change the Bought modal to include final price input instead of using a separate settle modal.

Replace the entire settle test with:
```ts
test('admin can mark a Bought order with final price', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/admin/orders');

  // Find a Pending order and advance it to Bought with final price
  const pendingRow = page.locator('[data-testid="order-row"][data-status="Pending"]').first();
  if (await pendingRow.count() === 0) return; // skip if none

  const orderId = await pendingRow.getAttribute('data-id');
  await pendingRow.locator('[data-testid="context-menu-btn"]').click();
  await pendingRow.locator('[data-testid="action-mark-bought"]').click();
  await expect(page.locator('[data-testid="bought-modal"]')).toBeVisible({ timeout: 3000 });

  const priceInput = page.locator('#bought-price-input');
  await priceInput.fill('5000');
  const finalInput = page.locator('#bought-final-price-input');
  await finalInput.fill('600000');
  await page.locator('#bought-form button[type="submit"]').click();

  // Should reload and show Bought
  const targetRow = page.locator(`[data-testid="order-row"][data-id="${orderId}"]`);
  await expect(targetRow.locator('[data-testid="status-badge"]')).toHaveText('Bought', { timeout: 5000 });
});
```

Update the test that checks for settled order — it should look for `data-status="Bought"` instead:
```ts
test('bought order shows final price and Bought status', async ({ page }) => {
  await page.goto('/my-orders');
  const boughtRow = page.locator('[data-testid="order-row"][data-status="Bought"]').first();
  if (await boughtRow.count() > 0) {
    await expect(boughtRow.locator('[data-testid="status-badge"]')).toHaveText('Bought');
  }
});
```

- [ ] **Step 2: Add CUJ admin can set DP on an order**

```ts
test.describe('CUJ-XX: Down Payment', () => {
  test('admin can set down payment and paid amount', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/orders');

    const draftRow = page.locator('[data-testid="order-row"][data-status="Draft"]').first();
    if (await draftRow.count() === 0) return;
    const orderId = await draftRow.getAttribute('data-id');

    await draftRow.locator('[data-testid="context-menu-btn"]').click();
    await draftRow.locator('[data-testid="action-dp"]').click();
    await expect(page.locator('#dp-modal')).toBeVisible({ timeout: 3000 });

    // Default target should be pre-filled
    const targetInput = page.locator('#dp-target-input');
    const targetVal = await targetInput.inputValue();
    expect(parseInt(targetVal, 10)).toBeGreaterThan(0);

    await page.locator('#dp-paid-input').fill(targetVal);
    await page.locator('#dp-form button[type="submit"]').click();

    const targetRow = page.locator(`[data-testid="order-row"][data-id="${orderId}"]`);
    await expect(targetRow.locator('[data-testid="status-badge"]')).toBeVisible({ timeout: 5000 });
    // Reloaded — row should have DP badge with "Terbayar"
  });

  test('buyer sees DP on their order card', async ({ page }) => {
    // Set DP on an order first via admin API
    await loginAs(page, 'admin');
    // Pick any order belonging to buyer-001 and set DP
    const pendingOrder = page.locator('[data-testid="order-row"][data-status="Pending"]').first();
    if (await pendingOrder.count() === 0) return;

    await loginAs(page, 'buyer');
    await page.goto('/my-orders');
    const rows = page.locator('[data-testid="order-row"]');
    // At least one row should exist
    await expect(rows.first()).toBeVisible();
    // DP info is rendered as text inside the card
  });
});
```

- [ ] **Step 3: Add CUJ banking info**

```ts
test.describe('CUJ-XX: Banking Info', () => {
  test('admin can update bank info and buyer sees it', async ({ page }) => {
    // Admin sets bank info
    await loginAs(page, 'admin');
    await page.goto('/admin/settings');
    await page.locator('#bank-name-input').fill('Test Bank');
    await page.locator('#bank-account-input').fill('9876543210');
    await page.locator('#bank-nameholder-input').fill('Test Holder');
    await page.locator('#btn-save-bank').click();

    // Buyer sees it
    await loginAs(page, 'buyer');
    await page.goto('/my-orders');
    await expect(page.getByText('Test Bank')).toBeVisible();
    await expect(page.getByText('9876543210')).toBeVisible();
  });
});
```

- [ ] **Step 4: Add CUJ arrival notification**

```ts
test.describe('CUJ-XX: Arrival Notification', () => {
  test('admin sets arrival notification, buyer sees it on home and orders', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/settings');
    await page.locator('#arrival-input').fill('Barang tiba 1 Juli 2026');
    await page.locator('#btn-save-arrival').click();

    // Buyer sees it on landing page
    await page.context().clearCookies();
    await page.goto('/');
    await expect(page.getByText('Barang tiba 1 Juli 2026')).toBeVisible();

    // Buyer sees it on my-orders
    await loginAs(page, 'buyer');
    await page.goto('/my-orders');
    await expect(page.getByText('Barang tiba 1 Juli 2026')).toBeVisible();

    // Cleanup
    await loginAs(page, 'admin');
    await page.goto('/admin/settings');
    await page.locator('#arrival-input').fill('');
    await page.locator('#btn-save-arrival').click();
  });
});
```

- [ ] **Step 5: Add CUJ footer**

```ts
test.describe('CUJ-XX: Footer', () => {
  test('footer is visible on buyer pages with year and links', async ({ page }) => {
    await loginAs(page, 'buyer');
    await page.goto('/catalog');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer.getByText(/Kotemart Jastip/)).toBeVisible();
    await expect(footer.getByText(/Kebijakan Privasi/)).toBeVisible();
    await expect(footer.getByText(/Syarat/)).toBeVisible();
  });
});
```

- [ ] **Step 6: Add API test for removed /settle and new /payment**

At the end of the file, add:
```ts
test.describe('API: Order status transitions', () => {
  test('removed settle endpoint returns 404', async ({ page }) => {
    await loginAs(page, 'admin');
    const res = await page.request.patch('/api/admin/orders/KTM-8472/settle', {
      data: { price_idr_final: 100000 },
    });
    expect(res.status()).toBe(404);
  });

  test('/payment updates DP and paid amount', async ({ page }) => {
    await loginAs(page, 'admin');
    const res = await page.request.patch('/api/admin/orders/KTM-8472/payment', {
      data: { down_payment_idr: 50000, paid_amount_idr: 25000 },
    });
    expect(res.ok()).toBeTruthy();
  });
});
```

- [ ] **Step 7: Commit**

```bash
git add tests/e2e.spec.ts
git commit -m "test: update order flow, add DP/bank/arrival/footer E2E tests"
```

---

### Task 11: DB migration file for production deploy

**Files:**
- Create: `db/migration_v05.sql`

- [ ] **Step 1: Create migration SQL**

```sql
-- ============================================================
-- Kotemart Jastip — Migration v05
-- Adds: down_payment_idr, paid_amount_idr on orders
-- Removes: Settled from orders status CHECK
-- ============================================================

-- Add DP columns
ALTER TABLE orders ADD COLUMN down_payment_idr INTEGER;
ALTER TABLE orders ADD COLUMN paid_amount_idr INTEGER NOT NULL DEFAULT 0;

-- Update CHECK constraint (SQLite can't ALTER CHECK, so we need to recreate)
-- SQLite requires recreating the table to modify constraints
-- Strategy: create new table, copy data, drop old, rename
CREATE TABLE orders_new (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id),
  product_id          TEXT REFERENCES products(id),
  variant_id          TEXT REFERENCES product_variants(id),
  type                TEXT NOT NULL
                        CHECK(type IN ('catalog', 'custom')),
  name                TEXT NOT NULL,
  description         TEXT,
  reference_url       TEXT,
  qty                 INTEGER NOT NULL CHECK(qty >= 1),
  status              TEXT NOT NULL DEFAULT 'Draft'
                        CHECK(status IN ('Draft','Pending','Bought','Cancelled')),
  price_jpy           INTEGER,
  jpy_rate_snapshot   REAL NOT NULL,
  fee_pct_snapshot    REAL NOT NULL,
  price_idr_estimate  INTEGER,
  price_idr_final     INTEGER,
  manual_idr_override INTEGER,
  bought_price_jpy    INTEGER,
  custom_fee_idr      INTEGER,
  down_payment_idr    INTEGER,
  paid_amount_idr     INTEGER NOT NULL DEFAULT 0,
  notes               TEXT,
  cancellation_reason TEXT,
  cancelled_at        DATETIME,
  settled_at          DATETIME,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO orders_new SELECT
  id, user_id, product_id, variant_id, type, name, description,
  reference_url, qty, status, price_jpy, jpy_rate_snapshot, fee_pct_snapshot,
  price_idr_estimate, price_idr_final, manual_idr_override,
  bought_price_jpy, custom_fee_idr,
  NULL, 0, -- default down_payment_idr, paid_amount_idr
  notes, cancellation_reason, cancelled_at, settled_at, created_at
FROM orders;

DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_variant ON orders(variant_id);
```

- [ ] **Step 2: Commit**

```bash
git add db/migration_v05.sql
git commit -m "docs: add migration v05 for DP columns and status CHECK"
```
