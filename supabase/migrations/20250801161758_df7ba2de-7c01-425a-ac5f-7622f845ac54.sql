-- Temporarily allow unauthenticated firm creation for the registration flow
DROP POLICY IF EXISTS "Allow authenticated users to create firms" ON public.firms;

CREATE POLICY "Allow unauthenticated firm creation during registration" 
ON public.firms 
FOR INSERT 
WITH CHECK (true);