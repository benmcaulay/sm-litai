import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
      }
    );

    const { connectionId, storagePath, bucket = "database-uploads", filename, mimeType } = await req.json();

    if (!connectionId || !storagePath) {
      return new Response(JSON.stringify({ error: "Missing connectionId or storagePath" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load the connection with decrypted API key, scoped by RLS to the requesting user/firm
    const { data: connection, error: connErr } = await supabase
      .rpc("get_database_connection_with_decrypted_key", { connection_id: connectionId })
      .maybeSingle();

    if (connErr || !connection) {
      console.error("Connection lookup failed", connErr);
      return new Response(JSON.stringify({ error: "Connection not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!connection.upload_endpoint) {
      return new Response(JSON.stringify({ error: "Connection does not have an upload endpoint" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download the file from Storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from(bucket)
      .download(storagePath);

    if (dlErr || !fileData) {
      console.error("Storage download failed", dlErr);
      return new Response(JSON.stringify({ error: "Failed to download uploaded file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await fileData.arrayBuffer();

    // Build multipart form data
    const form = new FormData();
    const blob = new Blob([arrayBuffer], { type: mimeType || "application/octet-stream" });
    form.append("file", blob, filename || "upload.bin");

    // Forward to the external upload endpoint
    const forwardHeaders: Record<string, string> = {};
    if (connection.api_key) {
      forwardHeaders["Authorization"] = `Bearer ${connection.api_key}`;
    }

    let forwardResponse: Response;
    try {
      forwardResponse = await fetch(connection.upload_endpoint, {
        method: "POST",
        headers: forwardHeaders, // Don't set Content-Type to let browser set proper boundary
        body: form,
      });
    } catch (e) {
      console.error("Forward fetch failed", e);
      return new Response(JSON.stringify({ error: "Failed to reach upload endpoint" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = await forwardResponse.text();

    return new Response(
      JSON.stringify({
        ok: forwardResponse.ok,
        status: forwardResponse.status,
        response: text,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("db-upload-relay error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
