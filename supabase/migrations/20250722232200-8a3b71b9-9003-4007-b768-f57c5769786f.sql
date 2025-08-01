-- Add INSERT policy for firms table to allow new firm creation during signup
CREATE POLICY "Allow firm creation during signup" 
ON public.firms 
FOR INSERT 
WITH CHECK (true);