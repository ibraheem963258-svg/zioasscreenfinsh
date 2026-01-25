-- Add public read policy for screen_group_assignments
CREATE POLICY "Public can read screen_group_assignments" 
ON public.screen_group_assignments 
FOR SELECT 
USING (true);