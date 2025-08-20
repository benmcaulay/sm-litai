-- Fix security warnings by setting search_path for all functions
CREATE OR REPLACE FUNCTION public.encrypt_oauth_token(token_value text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
    IF token_value IS NULL OR token_value = '' THEN
        RETURN NULL;
    END IF;
    
    -- Encrypt the token with a fixed key
    RETURN extensions.encrypt(
        token_value::bytea, 
        'OAuthTokenSecretKey2024!'::bytea, 
        'aes'
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_oauth_token(encrypted_token bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
    IF encrypted_token IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Decrypt the token with the same fixed key
    RETURN extensions.decrypt(
        encrypted_token, 
        'OAuthTokenSecretKey2024!'::bytea, 
        'aes'
    )::text;
END;
$function$;

CREATE OR REPLACE FUNCTION public.store_encrypted_oauth_tokens(
    db_id uuid,
    access_token text,
    refresh_token text,
    expires_at timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE public.external_databases 
    SET 
        encrypted_oauth_access_token = encrypt_oauth_token(access_token),
        encrypted_oauth_refresh_token = encrypt_oauth_token(refresh_token),
        oauth_expires_at = expires_at,
        oauth_access_token = NULL,  -- Clear plaintext token
        oauth_refresh_token = NULL, -- Clear plaintext token
        status = 'connected',
        updated_at = now()
    WHERE id = db_id
      AND firm_id = get_user_firm_id();
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_decrypted_oauth_tokens(db_id uuid)
RETURNS TABLE(access_token text, refresh_token text, expires_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY 
    SELECT 
        decrypt_oauth_token(encrypted_oauth_access_token) as access_token,
        decrypt_oauth_token(encrypted_oauth_refresh_token) as refresh_token,
        oauth_expires_at as expires_at
    FROM public.external_databases 
    WHERE id = db_id 
      AND firm_id = get_user_firm_id();
END;
$function$;