# Kotemart Jastip Catalog — Variant Naming Specification
**Version:** v01
**Date:** 2026-06-17

---

## 1. Core Rules for Variant Names

To prevent UI clutter and keep the product detail pages clean, variant names must follow these strict styling rules:

1.  **Strict Length Limit:** Maximum **30 characters**.
2.  **No Brand Names / Parent Names:** Brand names (e.g., *DHC*, *Biore*, *Senka*, *Muji*) and the product's main name must be stripped.
3.  **No Amazon Marketing Clutter:** Remove tags like `【Amazon.co.jp Exclusive】`, `【Bulk Purchase】`, `Parallel Import`, `Bonus Included`, `Quasi-drug`, `【第X類医薬品】`.
4.  **Uniform Suffix Structure:**
    *   **Volume/Size:** `[Volume/Weight]` (e.g., `50g`, `120ml`, `XS`, `M`).
    *   **Count/Packs:** `[Count] Tablets/Capsules/Bags` (e.g., `60 Tablets`, `120 Capsules`).
    *   **Bundles:** `[Base Variant] - [Qty] Set` (e.g., `60 Tablets - 2 Set`, `120g - 3 Set`).
    *   **Specific Varian Type:** `[Type Name]` (e.g., `Premium`, `Excellent`).

---

## 2. Refined Mapping Table

Below is the translation and cleanup applied to the scraped variants matching these rules:

| Variant ID | Scraped Long Name | Cleaned Variant Name |
|---|---|---|
| **var-007-1** | PILLBOX onaka Stomach [Food with Functional Claims] (onaka 30-Day Supply)... | `30-Day (120 Tabs)` |
| **var-007-2** | Pillbox onaka (belly) [Foods with Functional Claims] 15-day supply... | `15-Day (60 Tabs)` |
| **var-008-1** | DHC コラーゲン 60日分 360粒 | `60-Day (360 Tabs)` |
| **var-008-2** | DHC コラーゲン 60日分 360粒 2セット | `360 Tabs - 2 Set` |
| **var-008-3** | [セット商品] DHC コラーゲン 60日分 360粒 3袋セット | `360 Tabs - 3 Set` |
| **var-008-4** | DHC コラーゲン 60日分 360粒 4袋セット | `360 Tabs - 4 Set` |
| **var-008-5** | チョコラBB 美 チョコラ コラーゲン120粒... (x5) | `120 Caps - 5 Set` |
| **var-009-1** | DHC Lasting Vitamin C 60 Day 240 Tablets (Set of 2) | `240 Tabs - 2 Set` |
| **var-009-2** | DHC Lasting Vitamin C 60 Day 240 Tablets (Set of 3) | `240 Tabs - 3 Set` |
| **var-010-1** | 【第3類医薬品】チョコラBBプラス 60錠 | `60 Tablets` |
| **var-010-2** | 【第3類医薬品】チョコラBBプラス 60錠 ×2 | `60 Tabs - 2 Set` |
| **var-010-3** | 【第3類医薬品】チョコラBBプラス 60錠 ×4 | `60 Tabs - 4 Set` |
| **var-011-1** | FANCL Calorie Limit (Approx. 30 Servings), 90 Tablets... | `30-Day (90 Tabs)` |
| **var-011-2** | FANCL (New) Calorie Limit (40 Servings), 120 Tablets | `40-Day (120 Tabs)` |
| **var-011-3** | FANCL (New) Calorie Limit (80 Servings), 240 Tablets | `80-Day (240 Tabs)` |
| **var-012-1** | 【第2類医薬品】ペアアクネクリームW 24g | `24g Tube` |
| **var-015-1** | 【第2類医薬品】ユンkel Fanti 50ml | `50ml Bottle` |
| **var-015-2** | 【第2類医薬品】ユンkel Fanti 50ml x 2 | `50ml - 2 Set` |
| **var-016-1** | DHC Zinc 60 Day Supply | `60-Day (60 Caps)` |
| **var-016-2** | DHC Zinc, 60 Day Supply, 60 Capsules | `60 Caps` |
| **var-016-3** | DHC Zinc 30 Day Supply | `30-Day (30 Caps)` |
| **var-017-1** | Hada Labo Gokujun Medicinal Astringent Lotion 170mL... | `Regular (170ml)` |
| **var-018-1** | DHC Medicated Deep Cleansing Oil 200ml | `Regular (200ml)` |
| **var-019-1** | SENKA Premium Perfect Whip, Clear 120g | `Clear (120g)` |
| **var-019-2** | 【Amazon.co.jp Exclusive】SENKA Premium Perfect Whip Clear 120g x 2... | `Clear 120g - 2 Set` |
| **var-020-1** | Biore UV Aqua Rich Watery Essence SPF50+ (50g) | `50g Tube` |
| **var-020-2** | Bioré Biore UV Aqua Rich Watery Essence 100g Sunscreen... | `100g Tube` |
| **var-020-3** | Bioré Bioré UV Aqua Rich Watery Essence Fresh Pouch 120g... | `120g Pouch` |
| **var-021-1** | Fino Premium Touch Penetrating Serum Hair Mask 230g | `230g Tub` |
| **var-022-1** | 大島椿 椿油 (60ml) ヘア・スカルプ・スキン用 / Oshima Tsubaki | `60ml Bottle` |
| **var-023-1** | メラノCC 薬用しみ集中対策 美容液 20mL | `Regular (20ml)` |
| **var-023-2** | メラノCC 薬用しみ集中対策 プレミアム美容液 20ml | `Premium (20ml)` |
| **var-023-3** | メラano CC Medicated Stain Concentrated 20ml x 3 | `20ml - 3 Set` |
| **var-024-1** | Kosei Medicated Snow Skin Lotion Excellent 200ml | `Excellent (200ml)` |
