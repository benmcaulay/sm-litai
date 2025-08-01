-- Drop all RLS policies on firms table
DROP POLICY IF EXISTS "Users can create new firms during registration" ON public.firms;
DROP POLICY IF EXISTS "Users can view their own firm" ON public.firms;
DROP POLICY IF EXISTS "Admins can update their own firm" ON public.firms;

-- Drop all RLS policies on profiles table
DROP POLICY IF EXISTS "Users can create their own profile during registration" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their firm" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile (except role)" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their firm" ON public.profiles;

-- Drop all RLS policies on templates table
DROP POLICY IF EXISTS "Users can view templates in their firm" ON public.templates;
DROP POLICY IF EXISTS "Users can create templates in their firm" ON public.templates;
DROP POLICY IF EXISTS "Users can update templates they created" ON public.templates;
DROP POLICY IF EXISTS "Users can delete templates they created" ON public.templates;
DROP POLICY IF EXISTS "Admins can update any template in their firm" ON public.templates;
DROP POLICY IF EXISTS "Admins can delete any template in their firm" ON public.templates;

-- Disable RLS on all tables
ALTER TABLE public.firms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates DISABLE ROW LEVEL SECURITY;