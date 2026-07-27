-- Setup Supabase Storage for Website Builder Media Uploads (logos, gallery, section images)
-- Creates the media bucket and RLS policies for secure, tenant-scoped storage.

-- 1. Create the public media bucket if it does not exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow public read-only access to all files in the media bucket
CREATE POLICY "Allow public read access to media"
ON storage.objects FOR SELECT
USING (bucket_id = 'media');

-- 3. Allow authenticated users to upload files only to their own folder path
-- The path structure must start with the user's UUID (e.g. user_id/logos/...)
CREATE POLICY "Allow tenant-scoped inserts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media'
  AND (regexp_split_to_array(name, '/'))[1] = auth.uid()::text
);

-- 4. Allow authenticated users to update files only in their own folder path
CREATE POLICY "Allow tenant-scoped updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'media'
  AND (regexp_split_to_array(name, '/'))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'media'
  AND (regexp_split_to_array(name, '/'))[1] = auth.uid()::text
);

-- 5. Allow authenticated users to delete files only in their own folder path
CREATE POLICY "Allow tenant-scoped deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'media'
  AND (regexp_split_to_array(name, '/'))[1] = auth.uid()::text
);
