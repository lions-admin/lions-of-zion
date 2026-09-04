-- The operations console audits tool calls that touch no single record — a
-- pipeline run, a publication pause, a health probe, a catalog sync — and
-- `audit_log.entity_type` is NOT NULL. `system` is that entity.
ALTER TYPE "entity_type" ADD VALUE IF NOT EXISTS 'system';
