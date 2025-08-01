-- Drop the foreign key constraints that are causing authentication issues
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS templates_created_by_fkey;

-- We'll keep the firm relationships as they don't interfere with auth
-- ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_firm_id_fkey;
-- ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS templates_firm_id_fkey;