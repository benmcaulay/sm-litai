-- Create function to sum per-firm storage usage (in bytes) in a given bucket
-- SECURITY DEFINER so authenticated users can call it without direct access to storage schema
CREATE OR REPLACE FUNCTION public.get_firm_storage_usage_bytes(bucket TEXT DEFAULT 'database-uploads')
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT COALESCE(SUM(COALESCE((o.metadata->>'size')::bigint, 0)), 0) AS total_bytes
  FROM storage.objects o
  WHERE o.bucket_id = bucket
    AND (storage.foldername(o.name))[1] IN (
      SELECT p.user_id::text
      FROM public.profiles p
      WHERE p.firm_id = get_user_firm_id()
    );
$$;