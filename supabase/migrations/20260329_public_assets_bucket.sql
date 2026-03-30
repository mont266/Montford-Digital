-- Create public-assets bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-assets', 'public-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'public-assets' );

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'public-assets' AND auth.role() = 'authenticated' );

-- Allow authenticated users to update
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'public-assets' AND auth.role() = 'authenticated' );

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'public-assets' AND auth.role() = 'authenticated' );
