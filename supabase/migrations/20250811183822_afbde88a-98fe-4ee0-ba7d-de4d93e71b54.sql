-- Restrict external_databases visibility to creators or firm admins

-- Remove broad SELECT policy
DROP POLICY IF EXISTS "Users can view databases in their firm" ON public.external_databases;

-- Allow admins to view all databases in their firm
CREATE POLICY "Admins can view firm databases"
ON public.external_databases
FOR SELECT
USING (is_admin() AND (firm_id = get_user_firm_id()));

-- Allow creators to view their own databases
CREATE POLICY "Creators can view their own databases"
ON public.external_databases
FOR SELECT
USING (created_by = auth.uid());