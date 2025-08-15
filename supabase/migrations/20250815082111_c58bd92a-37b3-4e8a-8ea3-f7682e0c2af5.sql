-- Add NetDocs-specific fields to external_databases table
ALTER TABLE public.external_databases 
ADD COLUMN IF NOT EXISTS netdocs_repository_id TEXT,
ADD COLUMN IF NOT EXISTS netdocs_workspace_id TEXT,
ADD COLUMN IF NOT EXISTS oauth_access_token TEXT,
ADD COLUMN IF NOT EXISTS oauth_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS oauth_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_document_sync_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sync_frequency_hours INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT false;

-- Create table for NetDocs document sync tracking
CREATE TABLE IF NOT EXISTS public.netdocs_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_database_id UUID NOT NULL,
  firm_id UUID NOT NULL,
  netdocs_document_id TEXT NOT NULL,
  cabinet_id TEXT,
  workspace_id TEXT,
  document_name TEXT NOT NULL,
  document_path TEXT,
  file_extension TEXT,
  size_bytes BIGINT DEFAULT 0,
  last_modified TIMESTAMP WITH TIME ZONE,
  document_version TEXT,
  content_hash TEXT,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error', 'processing')),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  ai_analysis JSONB DEFAULT '{}',
  relevance_score FLOAT DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(external_database_id, netdocs_document_id)
);

-- Enable RLS
ALTER TABLE public.netdocs_documents ENABLE ROW LEVEL SECURITY;

-- Create policies for netdocs_documents
CREATE POLICY "Users can view NetDocs documents in their firm"
ON public.netdocs_documents
FOR SELECT
USING (firm_id = get_user_firm_id());

CREATE POLICY "Users can insert NetDocs documents in their firm"
ON public.netdocs_documents
FOR INSERT
WITH CHECK (firm_id = get_user_firm_id());

CREATE POLICY "Admins can update NetDocs documents in their firm"
ON public.netdocs_documents
FOR UPDATE
USING (is_admin() AND firm_id = get_user_firm_id());

CREATE POLICY "Admins can delete NetDocs documents in their firm"
ON public.netdocs_documents
FOR DELETE
USING (is_admin() AND firm_id = get_user_firm_id());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_netdocs_documents_external_db ON public.netdocs_documents(external_database_id);
CREATE INDEX IF NOT EXISTS idx_netdocs_documents_firm ON public.netdocs_documents(firm_id);
CREATE INDEX IF NOT EXISTS idx_netdocs_documents_sync_status ON public.netdocs_documents(sync_status);
CREATE INDEX IF NOT EXISTS idx_netdocs_documents_relevance ON public.netdocs_documents(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_netdocs_documents_last_modified ON public.netdocs_documents(last_modified DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_netdocs_documents_updated_at
BEFORE UPDATE ON public.netdocs_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for intelligent search queries
CREATE TABLE IF NOT EXISTS public.netdocs_search_queries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_database_id UUID NOT NULL,
  firm_id UUID NOT NULL,
  query_type TEXT NOT NULL CHECK (query_type IN ('case_discovery', 'document_type', 'date_range', 'keyword', 'ai_generated')),
  search_parameters JSONB NOT NULL DEFAULT '{}',
  results_count INTEGER DEFAULT 0,
  execution_time_ms INTEGER DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.netdocs_search_queries ENABLE ROW LEVEL SECURITY;

-- Create policies for search queries
CREATE POLICY "Users can view search queries in their firm"
ON public.netdocs_search_queries
FOR SELECT
USING (firm_id = get_user_firm_id());

CREATE POLICY "Users can insert search queries in their firm"
ON public.netdocs_search_queries
FOR INSERT
WITH CHECK (firm_id = get_user_firm_id() AND created_by = auth.uid());