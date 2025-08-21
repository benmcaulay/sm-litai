import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const B = Deno.env.get("ND_BASE_URL")!;
    const REPO = Deno.env.get("ND_REPO")!;
    const ID = Deno.env.get("ND_CLIENT_ID")!;
    const SECRET = Deno.env.get("ND_CLIENT_SECRET")!;

    const basic = btoa(`${ID}|${REPO}:${SECRET}`);
    const r = await fetch(`${B}/v1/OAuth`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
      body: new URLSearchParams({ grant_type: "client_credentials", scope: "full" }),
    });

    const j = await r.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: r.ok, token_type: j.token_type, expires_in: j.expires_in }), {
      status: r.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
