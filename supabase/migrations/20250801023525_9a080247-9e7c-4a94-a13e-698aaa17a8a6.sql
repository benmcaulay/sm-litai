-- Create user_role enum
CREATE TYPE public.user_role AS ENUM ('admin', 'user');

-- Create firms table
CREATE TABLE public.firms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT NOT NULL UNIQUE,
    database_config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email TEXT NOT NULL,
    role user_role DEFAULT 'user',
    firm_id UUID REFERENCES public.firms(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create templates table
CREATE TABLE public.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Create security definer functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_firm_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT firm_id FROM public.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Firms RLS policies - Allow admins to create firms during signup
CREATE POLICY "Allow authenticated users to create firms" ON public.firms
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Admins can view all firms in their organization" ON public.firms
    FOR SELECT TO authenticated
    USING (public.is_admin() OR id = public.get_user_firm_id());

CREATE POLICY "Admins can update their firm" ON public.firms
    FOR UPDATE TO authenticated
    USING (public.is_admin() AND id = public.get_user_firm_id());

-- Profiles RLS policies - Allow users to create their own profile during signup
CREATE POLICY "Allow authenticated users to create their own profile" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles in their firm" ON public.profiles
    FOR SELECT TO authenticated
    USING (public.is_admin() AND firm_id = public.get_user_firm_id());

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

-- Templates RLS policies
CREATE POLICY "Users can view templates in their firm" ON public.templates
    FOR SELECT TO authenticated
    USING (firm_id = public.get_user_firm_id());

CREATE POLICY "Users can create templates in their firm" ON public.templates
    FOR INSERT TO authenticated
    WITH CHECK (firm_id = public.get_user_firm_id() AND created_by = auth.uid());

CREATE POLICY "Users can update their own templates" ON public.templates
    FOR UPDATE TO authenticated
    USING (created_by = auth.uid());

CREATE POLICY "Admins can update all templates in their firm" ON public.templates
    FOR UPDATE TO authenticated
    USING (public.is_admin() AND firm_id = public.get_user_firm_id());

-- Create trigger for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_firms_updated_at
    BEFORE UPDATE ON public.firms
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON public.templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();