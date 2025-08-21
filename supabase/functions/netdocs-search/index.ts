import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getUserIdFromAuth(req: Request, supabaseUrl: string, anonKey: string) {
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
  });
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const ndBaseUrl = Deno.env.get("ND_BASE_URL")!;
    const ndCabinet = Deno.env.get("ND_REPO") || Deno.env.get("ND_CABINET")!;

    const uid = await getUserIdFromAuth(req, supabaseUrl, anonKey);
    if (!uid) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    console.log('NetDocs search request for user:', uid);

    const supabaseSrv = createClient(supabaseUrl, serviceRoleKey);
    const { data: row, error: selErr } = await supabaseSrv
      .from("netdocs_tokens")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();
      
    if (selErr || !row) {
      console.log('No tokens found for user:', uid, selErr);
      return new Response(JSON.stringify({ error: "No NetDocs connection found. Please connect first." }), { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    let { access_token, refresh_token, expires_at } = row;
    if (!access_token) {
      return new Response(JSON.stringify({ error: "No access token" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Check if token needs refresh (60 seconds buffer)
    if (expires_at && Date.now() > new Date(expires_at).getTime() - 60_000) {
      console.log('Refreshing expired token for user:', uid);
      
      const basic = btoa(`${Deno.env.get("ND_CLIENT_ID")}:${Deno.env.get("ND_CLIENT_SECRET")}`);
      const refreshResponse = await fetch(`${ndBaseUrl}/oauth2/token`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/x-www-form-urlencoded", 
          Authorization: `Basic ${basic}` 
        },
        body: new URLSearchParams({ 
          grant_type: "refresh_token", 
          refresh_token 
        }),
      });
      
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        access_token = refreshData.access_token;
        refresh_token = refreshData.refresh_token || refresh_token;
        expires_at = new Date(Date.now() + (refreshData.expires_in ?? 3600) * 1000).toISOString();
        
        await supabaseSrv
          .from("netdocs_tokens")
          .upsert({ user_id: uid, access_token, refresh_token, expires_at });
          
        console.log('Token refreshed successfully');
      } else {
        console.error('Token refresh failed');
      }
    }

    // Parse request body for search query
    const body = await req.json().catch(() => ({}));
    const { q = "=11(ndfld)" } = body; // Default to folders search
    
    console.log('Searching NetDocs with query:', q);
    
    const searchUrl = `${ndBaseUrl}/v2/search/${ndCabinet}?q=${encodeURIComponent(q)}&select=Containers,Documents,DisplayNames,Extensions,Ids`;
    const searchResponse = await fetch(searchUrl, { 
      headers: { Authorization: `Bearer ${access_token}` } 
    });
    
    const searchData = await searchResponse.json().catch(() => ({}));
    
    console.log('NetDocs search completed, status:', searchResponse.status);
    
    return new Response(JSON.stringify(searchData), { 
      status: searchResponse.status, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error('Error in netdocs-search:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});