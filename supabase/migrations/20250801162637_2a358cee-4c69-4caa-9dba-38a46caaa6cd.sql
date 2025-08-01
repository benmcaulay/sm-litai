-- Allow unauthenticated users to read firm names for autocomplete during sign-up
CREATE POLICY "Allow public to view firm names for autocomplete" 
ON public.firms 
FOR SELECT 
USING (true);