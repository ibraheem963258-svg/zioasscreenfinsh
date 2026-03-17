-- Create storage bucket for content files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content', 
  'content', 
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
);

-- Allow public read access to content bucket
CREATE POLICY "Public can view content files"
ON storage.objects FOR SELECT
USING (bucket_id = 'content');

-- Allow authenticated users to upload content
CREATE POLICY "Authenticated users can upload content"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'content' AND auth.role() = 'authenticated');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update content"
ON storage.objects FOR UPDATE
USING (bucket_id = 'content' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete content
CREATE POLICY "Authenticated users can delete content"
ON storage.objects FOR DELETE
USING (bucket_id = 'content' AND auth.role() = 'authenticated');