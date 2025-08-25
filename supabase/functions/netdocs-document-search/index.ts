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

async function getAccessToken(supabaseSrv: any, uid: string, ndBaseUrl: string) {
  // First try the external_databases table (new OAuth flow)
  const { data: extDb } = await supabaseSrv
    .from("external_databases")
    .select("*")
    .eq("user_id", uid)
    .eq("type", "netdocs")
    .maybeSingle();

  if (extDb) {
    const { data: tokens } = await supabaseSrv.rpc('get_decrypted_oauth_tokens', { db_id: extDb.id });
    if (tokens && tokens.length > 0) {
      let { access_token, refresh_token, expires_at } = tokens[0];
      
      // Check if token needs refresh
      if (expires_at && Date.now() > new Date(expires_at).getTime() - 60000) {
        const basic = btoa(`${Deno.env.get("NETDOCS_CLIENT_ID")}:${Deno.env.get("NETDOCS_CLIENT_SECRET")}`);
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
          
          await supabaseSrv.rpc('store_encrypted_oauth_tokens', {
            db_id: extDb.id,
            access_token,
            refresh_token,
            expires_at
          });
        }
      }
      
      return access_token;
    }
  }

  // Fallback to old netdocs_tokens table
  const { data: row } = await supabaseSrv
    .from("netdocs_tokens")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();
    
  if (row) {
    return row.access_token;
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const ndBaseUrl = Deno.env.get("NETDOCS_API_BASE") || Deno.env.get("ND_BASE_URL")!;
    const ndCabinet = Deno.env.get("ND_REPO");

    const uid = await getUserIdFromAuth(req, supabaseUrl, anonKey);
    if (!uid) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    console.log('NetDocs document search request for user:', uid);

    const supabaseSrv = createClient(supabaseUrl, serviceRoleKey);
    const accessToken = await getAccessToken(supabaseSrv, uid, ndBaseUrl);
    
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No NetDocs connection found. Please connect first." }), { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Parse search parameters from request body
    const body = await req.json().catch(() => ({}));
    const { 
      query = "", 
      cabinetId = ndCabinet,
      includeDocuments = true,
      includeFolders = false,
      limit = 50 
    } = body;

    let searchQuery = query;
    if (!searchQuery) {
      // Default search for documents
      searchQuery = includeDocuments && !includeFolders ? "=11(nddoc)" : 
                   includeFolders && !includeDocuments ? "=11(ndfld)" : 
                   ""; // Both
    }
    
    console.log('Searching NetDocs with query:', searchQuery, 'in cabinet:', cabinetId);
    
    // Use v2 search API as suggested by user
    const searchUrl = `${ndBaseUrl}/v2/search/${cabinetId}`;
    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: searchQuery,
        limit: Math.min(limit, 100),
        select: "Containers,Documents,DisplayNames,Extensions,Ids,Sizes,ModifiedDates,Versions,Paths"
      })
    });
    
    if (!searchResponse.ok) {
      console.error('Search failed:', searchResponse.status, await searchResponse.text());
      return new Response(JSON.stringify({ error: "Search failed" }), { 
        status: searchResponse.status, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    
    const searchData = await searchResponse.json();
    
    // Normalize results to match user's requested format
    const results = (searchData.Results || []).map((item: any) => ({
      id: item.Id || item.id,
      name: item.DisplayName || item.name,
      type: item.Container ? 'folder' : 'document',
      ext: item.Extension || '',
      size: item.Size || 0,
      version: item.Version || '',
      modified: item.ModifiedDate || item.modified || '',
      path: item.Path || ''
    }));
    
    console.log('Search completed, found:', results.length, 'items');
    
    return new Response(JSON.stringify({ 
      results,
      total: searchData.TotalResults || results.length 
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error('Error in netdocs-document-search:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});