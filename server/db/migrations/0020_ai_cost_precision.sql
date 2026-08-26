-- Embeddings can cost less than one millionth of a dollar per call. Keep the
-- exact Gateway amount rather than rounding those calls to zero.
ALTER TABLE ai_run
  ALTER COLUMN cost_usd TYPE numeric(16, 9)
  USING cost_usd::numeric(16, 9);
