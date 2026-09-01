-- Google discovery correctly reassigns evidence to its original publisher.
-- Early publisher rows therefore preserved the right source family but not the
-- reviewed editorial category.  Backfill only a missing/blank category so a
-- manually classified source is never overwritten.
WITH classified AS (
  SELECT id,
         CASE
           WHEN homepage_url ~* '^https?://([^/]+\.)?(gov\.il|idf\.il|mfa\.gov\.il|mod\.gov\.il|knesset\.gov\.il|police\.gov\.il)(/|$)' THEN 'official_israeli'
           WHEN homepage_url ~* '^https?://([^/]+\.)?(timesofisrael\.com|jpost\.com|ynetnews\.com|israelhayom\.com|kan\.org\.il|n12\.co\.il|i24news\.tv)(/|$)' THEN 'israeli_media'
           WHEN homepage_url ~* '^https?://([^/]+\.)?haaretz\.com(/|$)' THEN 'critical_media'
           WHEN homepage_url ~* '^https?://([^/]+\.)?(reuters\.com|apnews\.com|bbc\.com|theguardian\.com|france24\.com|dw\.com|cnn\.com|nytimes\.com|washingtonpost\.com)(/|$)' THEN 'international_media'
           WHEN homepage_url ~* '^https?://([^/]+\.)?(aljazeera\.com|middleeasteye\.net)(/|$)' THEN 'regional_critical'
           WHEN homepage_url ~* '^https?://([^/]+\.)?(arabnews\.com|dailysabah\.com|aa\.com\.tr)(/|$)' THEN 'regional_media'
           WHEN homepage_url ~* '^https?://([^/]+\.)?(tehrantimes\.com|presstv\.ir)(/|$)' THEN 'hostile_state_media'
           WHEN homepage_url ~* '^https?://([^/]+\.)?(news\.un\.org|unrwa\.org|icrc\.org|who\.int)(/|$)' THEN 'international_institution'
           WHEN homepage_url ~* '^https?://([^/]+\.)?(hrw\.org|amnesty\.org)(/|$)' THEN 'critical_institution'
           WHEN homepage_url ~* '^https?://([^/]+\.)?(atlanticcouncil\.org|washingtoninstitute\.org|csis\.org)(/|$)' THEN 'research'
           WHEN homepage_url ~* '^https?://([^/]+\.)?(bellingcat\.com|politifact\.com|factcheck\.org|snopes\.com)(/|$)' THEN 'fact_checking'
         END AS category
  FROM source
  WHERE homepage_url IS NOT NULL
)
UPDATE source AS s
SET config = jsonb_set(coalesce(s.config, '{}'::jsonb), '{category}', to_jsonb(classified.category), true),
    updated_at = now()
FROM classified
WHERE s.id = classified.id
  AND classified.category IS NOT NULL
  AND nullif(btrim(s.config->>'category'), '') IS NULL;
