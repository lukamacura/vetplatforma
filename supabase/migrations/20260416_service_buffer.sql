-- Migration: Add buffer_after_minutes to services
-- Adaptive post-appointment buffer that scales with service complexity.
-- Vets can override per-service; default 0 preserves existing behavior.

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS buffer_after_minutes int NOT NULL DEFAULT 0
  CHECK (buffer_after_minutes >= 0 AND buffer_after_minutes <= 60);
