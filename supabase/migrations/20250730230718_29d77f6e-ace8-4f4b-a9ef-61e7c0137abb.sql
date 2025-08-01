-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles table
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles in their firm" 
ON public.profiles 
FOR SELECT 
USING (
  get_user_role() = 'admin' AND 
  firm_id = get_user_firm_id()
);

-- Create RLS policies for firms table
CREATE POLICY "Users can view their own firm" 
ON public.firms 
FOR SELECT 
USING (id = get_user_firm_id());

CREATE POLICY "Admins can update their firm" 
ON public.firms 
FOR UPDATE 
USING (
  get_user_role() = 'admin' AND 
  id = get_user_firm_id()
);

-- Create RLS policies for templates table
CREATE POLICY "Users can view templates from their firm" 
ON public.templates 
FOR SELECT 
USING (firm_id = get_user_firm_id());

CREATE POLICY "Users can create templates for their firm" 
ON public.templates 
FOR INSERT 
WITH CHECK (
  firm_id = get_user_firm_id() AND 
  created_by = auth.uid()
);

CREATE POLICY "Admins can update all templates in their firm" 
ON public.templates 
FOR UPDATE 
USING (
  get_user_role() = 'admin' AND 
  firm_id = get_user_firm_id()
);

CREATE POLICY "Admins can delete all templates in their firm" 
ON public.templates 
FOR DELETE 
USING (
  get_user_role() = 'admin' AND 
  firm_id = get_user_firm_id()
);

-- Create/update Straus Meyers firm and set btm@strausmeyers.com as admin
INSERT INTO public.firms (name, domain) 
VALUES ('Straus Meyers', 'strausmeyers.com')
ON CONFLICT (domain) DO UPDATE SET 
  name = EXCLUDED.name;

-- Get the firm ID for strausmeyers.com
DO $$
DECLARE
  firm_uuid uuid;
  user_uuid uuid;
BEGIN
  -- Get firm ID
  SELECT id INTO firm_uuid FROM public.firms WHERE domain = 'strausmeyers.com';
  
  -- Check if user exists in auth.users by email
  SELECT id INTO user_uuid FROM auth.users WHERE email = 'btm@strausmeyers.com';
  
  -- If user exists, update their profile to admin
  IF user_uuid IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, email, role, firm_id)
    VALUES (user_uuid, 'btm@strausmeyers.com', 'admin', firm_uuid)
    ON CONFLICT (user_id) DO UPDATE SET
      role = 'admin',
      firm_id = firm_uuid,
      email = 'btm@strausmeyers.com';
  END IF;
END $$;