---
title: "Kotemart Jastip Catalog — Product Specification"
prepared_for: "Kotemart"
prepared_by: "Darma Kotama"
date: "2026-06-16"
version: "1.0"
---

## 1. Project Overview

Kotemart Jastip Catalog adalah sebuah website yang memungkinkan pembeli terpercaya untuk melihat produk-produk pilihan yang tersedia dalam satu batch jastip dari Jepang, lengkap dengan estimasi harga dalam Rupiah. Pembeli dapat mendaftarkan minat pembelian mereka langsung di website, dan admin akan mengonfirmasi pesanan serta harga final setelah barang berhasil dibeli.

Sistem ini dirancang untuk mengakomodasi alur jastip personal — bukan toko online konvensional. Tidak ada pembayaran online di dalam sistem; semua transaksi dikonfirmasi dan diselesaikan secara langsung antara pembeli dan admin melalui Telegram.

---

## 2. Deliverables

### 2.1 Website Katalog (untuk Pembeli)

- Login aman menggunakan akun Google — tidak perlu daftar manual
- Halaman katalog produk dengan foto, nama produk, dan estimasi harga Rupiah
- Halaman detail produk dengan deskripsi lengkap, foto gallery, dan keterangan estimasi harga
- Filter produk berdasarkan kategori
- Fitur "Daftar Pesanan" — pembeli bisa mendaftarkan produk yang ingin dipesan selama jastip sedang buka
- Fitur "Custom Order" — pembeli bisa request produk di luar katalog (contoh: dari Amazon JP, Yahoo Auction, Rakuten) cukup dengan menempelkan link produk dan keterangan
- Halaman riwayat pesanan pribadi: pembeli bisa memantau status pesanan dan melihat harga final yang dikonfirmasi admin

### 2.2 Panel Admin

- Toggle buka/tutup jastip — saat ditutup, pembeli melihat notifikasi dan link kontak admin
- Manajemen katalog: tambah, edit, hapus produk beserta foto
- Upload foto produk ke penyimpanan cloud
- Pengaturan global: kurs JPY (manual), persentase fee, dan link Telegram
- Manajemen semua pesanan (katalog dan custom): update status, input harga final saat pesanan selesai
- Dashboard profit per batch jastip: total pesanan, total pendapatan, HPP, dan keuntungan bersih

---

## 3. Out of Scope

The following items are explicitly excluded from this engagement and would require a separate project or change order.

- Payment gateway / online payment processing
- Shopping cart / checkout flow
- Automated shipment tracking
- Multi-admin roles or RBAC permissions
- Product review / rating system
- Real-time currency rate from external API

---

## 4. Assumptions & Client Responsibilities

### Our assumptions

Admin adalah satu orang yang mengelola seluruh operasional jastip. Pembeli adalah individu yang sudah dikenal dan diberikan akses melalui login Google. Harga yang ditampilkan di katalog adalah estimasi — harga final dikonfirmasi setelah admin membeli barang. Kurs JPY diperbarui secara manual oleh admin sesuai kebutuhan.

### Client responsibilities

| Item | Required by |
|---|---|
| Google OAuth2 Client ID & Secret (via Google Cloud Console) | Week 1 |
| Cloudflare account dengan Workers & Pages aktif | Week 1 |
| Daftar produk awal (nama, harga JPY, deskripsi, foto) untuk batch pertama | Week 2 |
| Kurs JPY awal dan persentase fee yang ingin digunakan | Week 2 |
| Username / link Telegram yang akan dicantumkan sebagai kontak CS | Week 2 |

---

## 5. Timeline & Milestones

| Phase | Weeks | Focus |
|---|---|---|
| Foundation | 1–2 | Auth, database setup, jastip gate |
| Catalog & Order | 3–5 | Catalog CRUD, foto upload, order list, custom order |
| Admin & Profit | 6–7 | Order management, pricing flow, profit dashboard |
| QA & Launch | 8 | Testing, bug fixing, go-live |

Exact dates to be confirmed after project kickoff.
