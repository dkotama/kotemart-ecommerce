# 004 — Soft-Delete Only

Products and variants use `is_deleted` flag (0/1). Never `DELETE FROM` on these tables.

**Why:** Orders reference products/variants by FK. Hard-deleting would orphan order references or cascade wrongly. Soft-delete preserves referential integrity.

**Rule:** All queries on products/variants must include `WHERE is_deleted = 0` unless admin context. The API layer filters deleted items out of catalog endpoints.
