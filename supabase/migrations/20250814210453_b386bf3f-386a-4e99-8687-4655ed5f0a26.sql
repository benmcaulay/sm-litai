-- Function to create encrypted database connection
CREATE OR REPLACE FUNCTION public.create_encrypted_database(
  db_name text,
  db_type text,
  db_api_key text DEFAULT NULL,
  db_upload_endpoint text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.external_databases (
    name,
    type,
    api_key,
    upload_endpoint,
    firm_id,
    created_by
  ) VALUES (
    db_name,
    db_type,
    encrypt_api_key(db_api_key),
    db_upload_endpoint,
    get_user_firm_id(),
    auth.uid()
  )
  RETURNING id;
$$;