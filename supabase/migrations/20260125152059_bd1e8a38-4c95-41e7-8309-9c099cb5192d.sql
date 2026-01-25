-- Allow public to update screen status and heartbeat (for display pages)
CREATE POLICY "Public can update screen status" 
ON public.screens 
FOR UPDATE 
USING (true)
WITH CHECK (true);