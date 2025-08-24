import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NetDocsOAuthRequest {
  action: 'authorize' | 'callback' | 'refresh';
  code?: string;
  state?: string;
  externalDatabaseId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create both anon and service-role clients
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json() as NetDocsOAuthRequest;
    const clientId = Deno.env.get('NETDOCS_CLIENT_ID');
    const clientSecret = Deno.env.get('NETDOCS_CLIENT_SECRET');
    const appBaseUrl = Deno.env.get('APP_BASE_URL');

    if (!clientId || !clientSecret || !appBaseUrl) {
      console.error('Missing environment variables:', {
        clientId: !!clientId,
        clientSecret: !!clientSecret,
        appBaseUrl: !!appBaseUrl
      });
      throw new Error('NetDocs OAuth credentials not configured');
    }

    if (body.action === 'authorize') {
      // Generate OAuth authorization URL
      const state = crypto.randomUUID();
      const redirectUri = `${appBaseUrl}/netdocs-callback`;
      
      const authUrl = new URL('https://vault.netvoyage.com/oauth2/authorize');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', 'read write');
      authUrl.searchParams.set('state', state);

      // Store state in oauth_state table for verification
      await supabaseService
        .from('oauth_state')
        .insert({
          state,
          user_id: user.id,
          provider: 'netdocs'
        });

      return new Response(JSON.stringify({ 
        authUrl: authUrl.toString(),
        state 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.action === 'callback') {
      // Verify state
      const { data: stateRecord } = await supabaseService
        .from('oauth_state')
        .select('user_id')
        .eq('state', body.state!)
        .eq('provider', 'netdocs')
        .single();

      if (!stateRecord || stateRecord.user_id !== user.id) {
        throw new Error('Invalid state parameter');
      }

      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://vault.netvoyage.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code: body.code!,
          redirect_uri: `${appBaseUrl}/netdocs-callback`,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange failed:', errorText);
        throw new Error('Failed to exchange authorization code for token');
      }

      const tokenData = await tokenResponse.json();
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

      // Find or create external database entry for this user
      let { data: existingDb } = await supabaseService
        .from('external_databases')
        .select('id')
        .eq('type', 'netdocs')
        .eq('created_by', user.id)
        .single();

      let externalDatabaseId = existingDb?.id;

      if (!externalDatabaseId) {
        // Create new external database entry
        const { data: newDb, error: createError } = await supabaseService
          .from('external_databases')
          .insert({
            type: 'netdocs',
            name: 'NetDocs Integration',
            created_by: user.id,
            firm_id: (await supabaseService.from('profiles').select('firm_id').eq('user_id', user.id).single()).data?.firm_id
          })
          .select('id')
          .single();

        if (createError || !newDb) {
          throw new Error('Failed to create external database entry');
        }
        externalDatabaseId = newDb.id;
      }

      // Store encrypted OAuth tokens using service role
      const { error } = await supabaseService.rpc('store_encrypted_oauth_tokens', {
        db_id: externalDatabaseId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt.toISOString()
      });

      if (error) {
        console.error('Failed to update OAuth tokens:', error);
        throw new Error('Failed to save OAuth tokens');
      }

      // Clean up state record
      await supabaseService
        .from('oauth_state')
        .delete()
        .eq('state', body.state!);

      return new Response(JSON.stringify({ 
        success: true,
        message: 'NetDocs authentication successful' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.action === 'refresh') {
      // Get stored refresh token for user's netdocs integration
      const { data: dbRecord } = await supabaseService
        .rpc('get_decrypted_oauth_tokens', { 
          db_id: body.externalDatabaseId! 
        })
        .single();

      if (!dbRecord?.refresh_token) {
        throw new Error('No refresh token found');
      }

      // Exchange refresh token for new tokens
      const tokenResponse = await fetch('https://vault.netvoyage.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: dbRecord.refresh_token,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to refresh token');
      }

      const tokenData = await tokenResponse.json();
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

      // Store new tokens (overwrites refresh token if rotated)
      const { error } = await supabaseService.rpc('store_encrypted_oauth_tokens', {
        db_id: body.externalDatabaseId!,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || dbRecord.refresh_token, // Use new if rotated, keep old if not
        expires_at: expiresAt.toISOString()
      });

      if (error) {
        console.error('Failed to update refreshed tokens:', error);
        throw new Error('Failed to save refreshed tokens');
      }

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Tokens refreshed successfully' 
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