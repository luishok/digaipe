-- Intentionally a no-op. This migration was generated to bring drizzle's schema snapshot in line
-- with the hand-written 0002/0003, and repeated their statements: CREATE TABLE
-- admission_processings, its foreign keys and indexes, and the two admissions indexes. Those
-- objects already exist once 0002/0003 have run, so the original failed with "table already
-- exists" and stopped every later migration (drizzle-kit exits 1 without printing why).
-- meta/0004_snapshot.json is kept: it matches the real schema.
SELECT 1;
