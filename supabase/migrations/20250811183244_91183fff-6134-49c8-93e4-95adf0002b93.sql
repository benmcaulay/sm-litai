-- Remove overly permissive public SELECT policy on firms
DROP POLICY IF EXISTS "Allow public to view firm names for autocomplete" ON public.firms;

-- Create a SECURITY DEFINER function to safely check if a firm exists by domain
CREATE OR REPLACE FUNCTION public.firm_exists(p_domain text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.firms f
    WHERE f.domain = p_domain
  );
$$;

-- Create a SECURITY DEFINER function to search firm names for autocomplete, returning only minimal fields
CREATE OR REPLACE FUNCTION public.search_firms(p_query text, p_limit int DEFAULT 5)
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id, f.name
  FROM public.firms f
  WHERE CASE 
          WHEN coalesce(p_query, '') = '' THEN true
          ELSE f.name ILIKE '%' || p_query || '%'
        END
  ORDER BY f.name
  LIMIT LEAST(GREATEST(coalesce(p_limit, 5), 1), 25);
$$;