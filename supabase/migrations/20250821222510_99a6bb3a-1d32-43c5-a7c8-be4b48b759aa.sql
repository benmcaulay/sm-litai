-- Create netdocs_tokens table for OAuth tokens
CREATE TABLE IF NOT EXISTS public.netdocs_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.netdocs_tokens ENABLE ROW LEVEL SECURITY;

-- Users can read only their own row (for diagnostics if ever exposed via RPC; our functions use service role)
CREATE POLICY "read own tokens"
  ON public.netdocs_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- No inserts/updates from client role; only service role (Edge Functions) should write
REVOKE ALL ON public.netdocs_tokens FROM anon, authenticated;