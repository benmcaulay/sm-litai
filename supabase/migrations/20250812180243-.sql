-- Create table to log each generated document
CREATE TABLE IF NOT EXISTS public.generated_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  created_by uuid NOT NULL,
  template_id uuid NULL,
  output_type text NULL,
  metadata jsonb NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

-- Policies (mirror existing style)
CREATE POLICY IF NOT EXISTS "Users can insert generated documents"
ON public.generated_documents
FOR INSERT
WITH CHECK ((firm_id = get_user_firm_id()) AND (created_by = auth.uid()));

CREATE POLICY IF NOT EXISTS "Users can view generated documents in their firm"
ON public.generated_documents
FOR SELECT
USING (firm_id = get_user_firm_id());

CREATE POLICY IF NOT EXISTS "Users can update their own generated documents"
ON public.generated_documents
FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY IF NOT EXISTS "Admins can update all generated documents in their firm"
ON public.generated_documents
FOR UPDATE
USING (is_admin() AND (firm_id = get_user_firm_id()));

-- Trigger to maintain updated_at
DROP TRIGGER IF EXISTS update_generated_documents_updated_at ON public.generated_documents;
CREATE TRIGGER update_generated_documents_updated_at
BEFORE UPDATE ON public.generated_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_generated_documents_firm_id_created_at
  ON public.generated_documents (firm_id, created_at DESC);


-- Create table to register indexed case files
CREATE TABLE IF NOT EXISTS public.case_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  created_by uuid NOT NULL,
  source text NOT NULL DEFAULT 'database',
  name text NOT NULL,
  status text NOT NULL DEFAULT 'indexed',
  metadata jsonb NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.case_files ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY IF NOT EXISTS "Users can insert case files in their firm"
ON public.case_files
FOR INSERT
WITH CHECK ((firm_id = get_user_firm_id()) AND (created_by = auth.uid()));

CREATE POLICY IF NOT EXISTS "Users can view case files in their firm"
ON public.case_files
FOR SELECT
USING (firm_id = get_user_firm_id());

CREATE POLICY IF NOT EXISTS "Users can update their own case files"
ON public.case_files
FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY IF NOT EXISTS "Admins can update all case files in their firm"
ON public.case_files
FOR UPDATE
USING (is_admin() AND (firm_id = get_user_firm_id()));

-- Trigger to maintain updated_at
DROP TRIGGER IF EXISTS update_case_files_updated_at ON public.case_files;
CREATE TRIGGER update_case_files_updated_at
BEFORE UPDATE ON public.case_files
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_case_files_firm_id_created_at
  ON public.case_files (firm_id, created_at DESC);
