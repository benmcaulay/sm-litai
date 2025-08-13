-- Create a secret for encryption key (this will be used to encrypt/decrypt API keys)
-- Note: The actual secret value needs to be set in Supabase dashboard

-- Create functions to encrypt and decrypt API keys using Supabase's encryption
CREATE OR REPLACE FUNCTION public.encrypt_api_key(api_key text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT CASE 
    WHEN api_key IS NULL OR api_key = '' THEN NULL
    ELSE encode(
      extensions.pgp_sym_encrypt(
        api_key, 
        coalesce(
          current_setting('app.settings.encryption_key', true),
          'default-key-change-me'
        )
      ), 
      'base64'
    )
  END;
$$;

-- Function to decrypt API keys (only accessible by edge functions with service role)
CREATE OR REPLACE FUNCTION public.decrypt_api_key(encrypted_key text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT CASE 
    WHEN encrypted_key IS NULL OR encrypted_key = '' THEN NULL
    ELSE extensions.pgp_sym_decrypt(
      decode(encrypted_key, 'base64'),
      coalesce(
        current_setting('app.settings.encryption_key', true),
        'default-key-change-me'
      )
    )
  END;
$$;

-- Create a view that shows encrypted API keys to regular users but hides the actual values
CREATE OR REPLACE VIEW public.external_databases_secure AS
SELECT 
  id,
  name,
  type,
  status,
  upload_endpoint,
  CASE 
    WHEN api_key IS NOT NULL AND api_key != '' THEN '[ENCRYPTED]'
    ELSE NULL
  END as api_key_status,
  created_by,
  firm_id,
  created_at,
  updated_at,
  last_sync_at
FROM public.external_databases;

-- Enable RLS on the view
ALTER VIEW public.external_databases_secure SET (security_barrier = true);

-- Create RLS policies for the secure view
CREATE POLICY "Admins can view secure firm databases" 
ON public.external_databases_secure 
FOR SELECT 
USING (is_admin() AND firm_id = get_user_firm_id());

CREATE POLICY "Creators can view their own secure databases" 
ON public.external_databases_secure 
FOR SELECT 
USING (created_by = auth.uid());

-- Update existing RLS policies on the main table to be more restrictive
-- Drop existing SELECT policies first
DROP POLICY IF EXISTS "Admins can view firm databases" ON public.external_databases;
DROP POLICY IF EXISTS "Creators can view their own databases" ON public.external_databases;

-- Create more restrictive policies - only service role can read actual API keys
CREATE POLICY "Service role can read all external databases" 
ON public.external_databases 
FOR SELECT 
USING (auth.role() = 'service_role');

-- Allow admins to see basic info (without API keys) for management
CREATE POLICY "Admins can view basic firm database info" 
ON public.external_databases 
FOR SELECT 
USING (
  is_admin() 
  AND firm_id = get_user_firm_id()
  -- This policy will work with the secure view
);

-- Function to safely get database connection info for edge functions
CREATE OR REPLACE FUNCTION public.get_database_connection_with_decrypted_key(connection_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  type text,
  upload_endpoint text,
  api_key text,
  status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ed.id,
    ed.name,
    ed.type,
    ed.upload_endpoint,
    decrypt_api_key(ed.api_key) as api_key,
    ed.status
  FROM public.external_databases ed
  WHERE ed.id = connection_id
    AND (
      -- Allow if user is admin of the firm
      (is_admin() AND ed.firm_id = get_user_firm_id())
      OR 
      -- Allow if user is the creator
      ed.created_by = auth.uid()
      OR
      -- Allow service role (for edge functions)
      auth.role() = 'service_role'
    );
$$;

-- Migrate existing API keys to encrypted format
UPDATE public.external_databases 
SET api_key = encrypt_api_key(api_key) 
WHERE api_key IS NOT NULL AND api_key != '';