ALTER TABLE "source_fetch"
  ADD COLUMN IF NOT EXISTS "raw_byte_size" integer;

ALTER TABLE "source_fetch"
  ADD CONSTRAINT "source_fetch_raw_byte_size_is_valid"
  CHECK ("raw_byte_size" IS NULL OR "raw_byte_size" > 0);
