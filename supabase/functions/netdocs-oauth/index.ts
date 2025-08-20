import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NetDocsOAuthRequest {
  action: 'authorize' | 'callback';
  code?: string;
  state?: string;
  externalDatabaseId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json() as NetDocsOAuthRequest;
    const clientId = Deno.env.get('NETDOCS_CLIENT_ID');
    const clientSecret = Deno.env.get('NETDOCS_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('NetDocs OAuth credentials not configured');
    }

    if (body.action === 'authorize') {
      // Generate OAuth authorization URL
      const state = crypto.randomUUID();
      const redirectUri = `${req.headers.get('origin')}/netdocs-callback`;
      
      const authUrl = new URL('https://vault.netvoyage.com/neWeb2/oauth/authorize');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', 'read write');
      authUrl.searchParams.set('state', state);

      // Store state for verification
      await supabase
        .from('external_databases')
        .update({ 
          oauth_access_token: state // Temporarily store state for verification
        })
        .eq('id', body.externalDatabaseId);

      return new Response(JSON.stringify({ 
        authUrl: authUrl.toString(),
        state 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.action === 'callback') {
      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://vault.netvoyage.com/neWeb2/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code: body.code!,
          redirect_uri: `${req.headers.get('origin')}/netdocs-callback`,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange authorization code for token');
      }

      const tokenData = await tokenResponse.json();
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

      // Update external database with encrypted OAuth tokens
      const { error } = await supabase.rpc('store_encrypted_oauth_tokens', {
        db_id: body.externalDatabaseId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt.toISOString()
      });

      if (error) {
        console.error('Failed to update OAuth tokens:', error);
        throw new Error('Failed to save OAuth tokens');
      }

      return new Response(JSON.stringify({ 
        success: true,
        message: 'NetDocs authentication successful' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Error in netdocs-oauth function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});