-- Migration: Remove age_group column from participants table
-- Created: 2026-01-18 03:51:00

-- Remove age_group column from participants table
ALTER TABLE public.participants DROP COLUMN IF EXISTS age_group;