import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import PizZip from "https://esm.sh/pizzip@3.1.6";

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
        global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      }
    );

    const openAIApiKey =
      Deno.env.get("OPENAI_API_KEY") ||
      Deno.env.get("OPENAI KEY") ||
      Deno.env.get("OPENAI") ||
      "";

    // Log presence (not the value) to help diagnose missing secret issues
    console.log("rag-generate: OPENAI_API_KEY present:", Boolean(openAIApiKey));

    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: "Missing OpenAI API key. Please set OPENAI_API_KEY in Supabase secrets." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { query, templateId } = await req.json();
    if (!query || !templateId) {
      return new Response(
        JSON.stringify({ error: "Missing query or templateId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = userRes.user.id;

    const { data: template, error: tplErr } = await supabase
      .from("templates")
      .select("id, name, file_type, file_path, content")
      .eq("id", templateId)
      .maybeSingle();

    if (tplErr || !template) {
      return new Response(
        JSON.stringify({ error: "Template not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find latest uploaded case file for this user
    const { data: objects, error: listErr } = await supabase.storage
      .from("database-uploads")
      .list(userId, { limit: 100, sortBy: { column: "name", order: "desc" } });

    if (listErr) {
      console.error("Storage list error", listErr);
      return new Response(
        JSON.stringify({ error: "Unable to list uploaded case files" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!objects || objects.length === 0) {
      return new Response(
        JSON.stringify({ error: "No uploaded case files found. Please upload a file in Database Connections." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pick the most recent by name (Date.now prefix ensures correct order)
    const latest = objects[0];
    const storagePath = `${userId}/${latest.name}`;

    const { data: fileData, error: dlErr } = await supabase.storage
      .from("database-uploads")
      .download(storagePath);

    if (dlErr || !fileData) {
      console.error("Storage download error", dlErr);
      return new Response(
        JSON.stringify({ error: "Failed to download latest case file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const buf = await fileData.arrayBuffer();

    // Extract text from the file
    let contextText = "";
    const lower = latest.name.toLowerCase();
    try {
      if (lower.endsWith(".docx")) {
        const zip = new PizZip(buf);
        const documentXml = zip.file("word/document.xml");
        if (documentXml) {
          const xmlContent = documentXml.asText();
          const textMatches = xmlContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
          contextText = textMatches.map((m) => m.replace(/<[^>]*>/g, "")).join(" ").replace(/\s+/g, " ").trim();
        }
      } else if (lower.endsWith(".txt") || lower.endsWith(".md")) {
        contextText = new TextDecoder().decode(buf).toString();
      } else {
        // Best-effort text decode
        contextText = new TextDecoder().decode(buf).toString();
      }
    } catch (e) {
      console.warn("Context extraction failed, falling back to raw text:", e);
      contextText = new TextDecoder().decode(buf).toString();
    }

    if (!contextText || contextText.trim().length === 0) {
      contextText = `No readable text extracted from ${latest.name}.`;
    }

    const maxContext = 12000; // keep prompt within limits
    const trimmedContext = contextText.slice(0, maxContext);

    // Call OpenAI to generate an answer using the context and template
    const completionRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are a legal document assistant. Only use facts from the provided case context. If the context is insufficient, reply: 'Insufficient context to answer.' Produce clear, structured, professional output.",
          },
          { role: "system", content: `Template: ${template.name} (${template.file_type || "text"})` },
          { role: "system", content: `Case context (truncated):\n${trimmedContext}` },
          { role: "user", content: query },
        ],
      }),
    });

    if (!completionRes.ok) {
      const errText = await completionRes.text();
      console.error("OpenAI error", errText);
      return new Response(
        JSON.stringify({ error: "OpenAI request failed", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const completionJson = await completionRes.json();
    const answer = completionJson?.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({
        answer,
        source: { bucket: "database-uploads", path: storagePath, filename: latest.name },
        template: { id: template.id, name: template.name },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("rag-generate error", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});