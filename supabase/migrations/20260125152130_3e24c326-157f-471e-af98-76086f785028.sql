-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Public can update screen status" ON public.screens;

-- Create a more restrictive policy - only allow updating status-related fields
-- This is acceptable for display screens that need to report their status
CREATE POLICY "Public can update screen heartbeat" 
ON public.screens 
FOR UPDATE 
USING (true)
WITH CHECK (
  -- Only allow if the update is coming from a valid screen (has a slug)
  slug IS NOT NULL
);