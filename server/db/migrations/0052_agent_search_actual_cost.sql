-- Agent Search spend, recorded where the query happened. `ai_run.cost_usd`
-- already carries model spend; a discovery fetch bills per query through the
-- same ledger-free path, and without this column the console can only
-- estimate spend from a monthly count times a configured rate, never sum it.
--
-- The value written is an honest per-query billed estimate: unit cost comes
-- from `GOOGLE_SEARCH_ESTIMATED_COST_PER_QUERY_USD`, multiplied by the number
-- of queries a fetch executed, at fetch time. It is NOT a Google billing
-- feed — no invoice reconciliation exists. Nullable: RSS and official APIs
-- are free, and a fetch whose rate is unconfigured stays null rather than
-- pretending to zero.
--
-- Same precision as `ai_run.cost_usd` (0020): embeddings cost less than one
-- millionth of a dollar, and money is numeric, never a float.
ALTER TABLE "source_fetch"
  ADD COLUMN IF NOT EXISTS "actual_cost_usd" numeric(16, 9);
