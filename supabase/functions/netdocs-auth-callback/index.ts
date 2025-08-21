import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state") || "";
    
    console.log('NetDocs callback received - code:', !!code, 'state:', state);
    
    if (!code || !state) {
      return new Response("Missing code/state", { status: 400 });
    }

    const [userId] = state.split(":"); // uid we sent in start
    const B = Deno.env.get("ND_BASE_URL")!;
    const ID = Deno.env.get("ND_CLIENT_ID")!;
    const SECRET = Deno.env.get("ND_CLIENT_SECRET")!;
    const REDIR = Deno.env.get("ND_REDIRECT_URI")!;
    const basic = btoa(`${ID}:${SECRET}`);

    console.log('Exchanging code for tokens for user:', userId);

    // Exchange code for tokens
    const tok = await fetch(`${B}/oauth2/token`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/x-www-form-urlencoded", 
        Authorization: `Basic ${basic}` 
      },
      body: new URLSearchParams({ 
        grant_type: "authorization_code", 
        code, 
        redirect_uri: REDIR 
      }),
    });
    
    if (!tok.ok) {
      const errorText = await tok.text();
      console.error('Token exchange failed:', errorText);
      return new Response(errorText, { 
        status: tok.status, 
        headers: { "Content-Type": "text/plain" } 
      });
    }
    
    const j = await tok.json(); // { access_token, refresh_token, expires_in, token_type }
    console.log('Token exchange successful');

    // Store tokens (service role)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, 
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const expires_at = new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString();

    const { error } = await supabase
      .from("netdocs_tokens")
      .upsert({ 
        user_id: userId, 
        access_token: j.access_token, 
        refresh_token: j.refresh_token, 
        expires_at 
      });

    if (error) {
      console.error('Failed to store tokens:', error);
      return new Response(error.message, { status: 500 });
    }

    console.log('Tokens stored successfully for user:', userId);

    // Simple success page
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>NetDocuments Connected</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 2rem; text-align: center; }
          .success { color: #059669; font-size: 1.2rem; margin-bottom: 1rem; }
        </style>
      </head>
      <body>
        <div class="success">✓ NetDocuments connected successfully!</div>
        <p>You can close this tab and return to the application.</p>
        <script>
          // Auto-close after 3 seconds
          setTimeout(() => window.close(), 3000);
        </script>
      </body>
      </html>
    `, { 
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('Error in netdocs-auth-callback:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});