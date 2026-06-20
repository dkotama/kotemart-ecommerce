# 002 — Raw SQL, No ORM

Use D1's `db.prepare().bind().run()` directly. No Kysely, Drizzle, or Prisma.

**Why:** D1 is SQLite. The schema is 6 tables. An ORM would add complexity with no benefit — prepared statements with positional params (`?1`, `?2`) are already safe from injection.

**Rule:** Never `db.prepare('... WHERE x = ' + userInput)`. Always use bind params.
