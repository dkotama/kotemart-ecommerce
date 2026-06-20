---
name: jastip-admin
description: Manage the Kotemart Jastip orders and catalog using admin API authorization tokens
---

# Jastip Admin API Skill

Allows driving the Kotemart Jastip admin endpoints directly.

## Setup

Set `$JASTIP_TOKEN` and `$JASTIP_BASE_URL` (defaults to `https://jastip.dkotama.com`) environment variables.
Every HTTP request must contain this header:
`Authorization: Bearer $JASTIP_TOKEN`

## Available Endpoints

### 1. Orders
- `GET /api/admin/orders` -> List all orders
- `PATCH /api/admin/orders/:id/status` -> Advance status (Body: `{ "status": "Pending" | "Bought", "bought_price_jpy": number, "price_idr_final": number, "custom_fee_idr": number }`)
- `PATCH /api/admin/orders/:id/cancel` -> Cancel order (Body: `{ "cancellation_reason": string }`)
- `PATCH /api/admin/orders/:id/payment` -> Set DP/Paid amount (Body: `{ "down_payment_idr": number, "paid_amount_idr": number }`)

### 2. Products & Variants
- `GET /api/products` -> List public catalog
- `POST /api/products` -> Create product
- `PUT /api/products/:id` -> Update product details
- `DELETE /api/products/:id` -> Soft-delete product
- `POST /api/products/:id/variants` -> Add variant
- `PUT /api/products/:id/variants/:vid` -> Edit variant

### 3. Settings & Gate
- `POST /api/gate/toggle` -> Open/close batch gate
- `GET /api/admin/settings` -> Read settings
- `PUT /api/admin/settings` -> Update settings (exchange rates, fees, categories)

## Example Flows

### Confirm an order Bought
```bash
curl -X PATCH "$JASTIP_BASE_URL/api/admin/orders/KTM-1234/status" \
  -H "Authorization: Bearer $JASTIP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "Bought", "bought_price_jpy": 2500}'
```

### List all orders
```bash
curl -s "$JASTIP_BASE_URL/api/admin/orders" \
  -H "Authorization: Bearer $JASTIP_TOKEN"
```
