-- Create table to track and organize files per external database
CREATE TABLE IF NOT EXISTS public.database_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  external_database_id uuid NOT NULL,
  storage_path text NOT NULL,
  filename text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  mime_type text,
  tags text[] NOT NULL DEFAULT '{}',
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.database_documents ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view documents for their firm"
ON public.database_documents
FOR SELECT
USING (is_admin() AND firm_id = get_user_firm_id());

CREATE POLICY "Users can insert their own documents"
ON public.database_documents
FOR INSERT
WITH CHECK (firm_id = get_user_firm_id() AND uploaded_by = auth.uid());

CREATE POLICY "Owners or admins can update documents"
ON public.database_documents
FOR UPDATE
USING (uploaded_by = auth.uid() OR (is_admin() AND firm_id = get_user_firm_id()));

CREATE POLICY "Owners or admins can delete documents"
ON public.database_documents
FOR DELETE
USING (uploaded_by = auth.uid() OR (is_admin() AND firm_id = get_user_firm_id()));

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_database_documents_extdb ON public.database_documents (external_database_id);
CREATE INDEX IF NOT EXISTS idx_database_documents_firm ON public.database_documents (firm_id);
CREATE INDEX IF NOT EXISTS idx_database_documents_storage_path ON public.database_documents (storage_path);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_database_documents_updated_at ON public.database_documents;
CREATE TRIGGER update_database_documents_updated_at
BEFORE UPDATE ON public.database_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();