-- Function to wipe all storage objects in a bucket for the current admin's firm
CREATE OR REPLACE FUNCTION public.wipe_firm_uploads(bucket TEXT DEFAULT 'database-uploads')
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Only allow admins to run
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can wipe firm uploads' USING ERRCODE = '42501';
  END IF;

  -- Delete metadata rows first (organizer table)
  DELETE FROM public.database_documents
  WHERE firm_id = get_user_firm_id();

  -- Delete storage objects for all users in the current firm
  DELETE FROM storage.objects o
  USING public.profiles p
  WHERE o.bucket_id = bucket
    AND (storage.foldername(o.name))[1] = p.user_id::text
    AND p.firm_id = get_user_firm_id();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN COALESCE(deleted_count, 0);
END;
$$;