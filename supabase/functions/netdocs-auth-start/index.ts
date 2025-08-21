import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const uid = url.searchParams.get("uid") || "nouser";
    const B = Deno.env.get("ND_BASE_URL")!;
    const ID = Deno.env.get("ND_CLIENT_ID")!;
    const REDIR = Deno.env.get("ND_REDIRECT_URI")!;

    console.log('Starting NetDocs auth for user:', uid);

    const state = `${uid}:${crypto.randomUUID()}`; // bind login to user
    const authUrl = `${B}/oauth2/authorize?response_type=code` +
      `&client_id=${encodeURIComponent(ID)}` +
      `&redirect_uri=${encodeURIComponent(REDIR)}` +
      `&scope=${encodeURIComponent("full")}` +
      `&state=${encodeURIComponent(state)}`;

    console.log('Redirecting to NetDocs auth URL');

    return new Response(null, { 
      status: 302, 
      headers: { 
        ...corsHeaders,
        Location: authUrl 
      } 
    });
  } catch (error) {
    console.error('Error in netdocs-auth-start:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});