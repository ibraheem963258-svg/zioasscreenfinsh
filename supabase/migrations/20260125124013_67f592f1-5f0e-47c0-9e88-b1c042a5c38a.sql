-- Add is_playing column to screens table for content playback control
ALTER TABLE public.screens ADD COLUMN IF NOT EXISTS is_playing boolean NOT NULL DEFAULT true;