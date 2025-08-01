-- Allow authenticated users to create profiles during signup
-- This fixes the RLS policy violation during profile creation
CREATE POLICY "Allow authenticated users to create profiles during signup" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);