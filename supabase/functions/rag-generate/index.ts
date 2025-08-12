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

    // Gather recent uploaded case files for this user (prefer PDFs and 'complain' files)
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

    // Helper extractors
    const extractDocxText = (buf: ArrayBuffer): string => {
      try {
        const zip = new PizZip(buf);
        const documentXml = zip.file("word/document.xml");
        if (!documentXml) return "";
        const xmlContent = documentXml.asText();
        const textMatches = xmlContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
        return textMatches.map((m) => m.replace(/<[^>]*>/g, "")).join(" ").replace(/\s+/g, " ").trim();
      } catch (e) {
        console.warn("DOCX parse failed", e);
        return "";
      }
    };

    const extractPdfText = (buf: ArrayBuffer): string => {
      // Very lightweight, best-effort text extraction from PDF content streams
      try {
        const bytes = new Uint8Array(buf);
        let s = "";
        for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
        const matches = s.match(/\((?:\\\)|\\\(|\\n|\\r|\\t|[^()])+\)/g) || [];
        const decoded = matches
          .map((m) => m.slice(1, -1)
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "\r")
            .replace(/\\t/g, "\t")
            .replace(/\\\(/g, "(")
            .replace(/\\\)/g, ")")
            .replace(/\\\\/g, "\\")
          )
          .join(" ");
        return decoded.replace(/\s+/g, " ").trim();
      } catch (e) {
        console.warn("PDF parse failed", e);
        return "";
      }
    };

    const extractAnyText = (name: string, buf: ArrayBuffer): string => {
      const lower = name.toLowerCase();
      if (lower.endsWith(".docx")) return extractDocxText(buf);
      if (lower.endsWith(".pdf")) return extractPdfText(buf);
      if (lower.endsWith(".txt") || lower.endsWith(".md")) return new TextDecoder().decode(buf).toString();
      return new TextDecoder().decode(buf).toString();
    };

    // Choose up to 5 priority files: prefer names containing 'complain' or 'complaint' and PDFs
    const sorted = [...objects].sort((a, b) => (b.name.localeCompare(a.name)));
    const preferred = sorted.filter((o) => /(complain|complaint)/i.test(o.name) || /\.pdf$/i.test(o.name));
    const fallback = sorted.filter((o) => !preferred.includes(o));
    const candidates = [...preferred, ...fallback].slice(0, 5);

    const contexts: { filename: string; text: string; storagePath: string }[] = [];

    for (const obj of candidates) {
      const storagePath = `${userId}/${obj.name}`;
      const { data: fileData, error: dlErr } = await supabase.storage
        .from("database-uploads")
        .download(storagePath);
      if (dlErr || !fileData) {
        console.warn("Download failed for", storagePath, dlErr);
        continue;
      }
      const buf = await fileData.arrayBuffer();
      let text = extractAnyText(obj.name, buf);
      if (!text || text.trim().length === 0) {
        text = `No readable text extracted from ${obj.name}.`;
      }
      contexts.push({ filename: obj.name, text, storagePath });
    }

    if (contexts.length === 0) {
      return new Response(
        JSON.stringify({ error: "No readable content extracted from uploaded files." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build combined, size-limited context
    const MAX_TOTAL = 16000;
    const perFile = Math.floor(MAX_TOTAL / contexts.length);
    const combined = contexts
      .map((c) => `=== Source: ${c.filename} ===\n${c.text.slice(0, perFile)}`)
      .join("\n\n");

    // Output outline for generation
    const defaultOutline = [
      "Title",
      "Header",
      "Introduction",
      "Background",
      "Facts",
      "Arguments",
      "Relief Requested",
      "Conclusion",
      "Signature"
    ];

    // Optional firm DB hints from user's firm (name/domain). Header details will STILL be extracted from Sources.
    let firmDbHints: { name?: string; domain?: string } | null = null;
    try {
      const { data: firmIdData } = await supabase.rpc('get_user_firm_id');
      const firmId = (firmIdData as string | null) || null;
      if (firmId) {
        const { data: firmRow } = await supabase
          .from('firms')
          .select('name, domain')
          .eq('id', firmId)
          .maybeSingle();
        if (firmRow) {
          firmDbHints = { name: (firmRow as any).name, domain: (firmRow as any).domain };
        }
      }
    } catch (_e) {
      console.warn('Firm DB hint fetch failed');
    }

    // Phase 1: Initial evaluation — extract structured facts from all sources
    const analysisRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: "You are a legal analyst. Extract structured facts from the provided case documents. Return STRICT JSON only.",
          },
          {
            role: "user",
            content: `Analyze the following Sources and extract the key case facts as JSON with this shape:\n\n{
  \"case_caption\": \"string\",\n  \"parties\": { \"plaintiff\": [\"...\"], \"defendant\": [\"...\"] },\n  \"claims\": [\"...\"],\n  \"key_dates\": [{ \"label\": \"\", \"date\": \"\" }],\n  \"venue\": \"\",\n  \"docket_number\": \"\",\n  \"monetary_amounts\": [{ \"label\": \"\", \"amount\": \"\" }],\n  \"firm_header\": { \"name\": \"\", \"address\": \"\", \"phone\": \"\", \"email\": \"\", \"website\": \"\", \"other\": \"\" },\n  \"fact_citations\": [{ \"fact\": \"\", \"sources\": [\"filename.ext\"] }],\n  \"other_facts\": [\"...\"],\n  \"source_filenames\": [\"...\"]\n}\n\nRules:\n- Use ONLY facts present in Sources; if unknown, omit the field or use an empty string.\n- firm_header MUST be derived from the Sources (e.g., firm letterheads, contact blocks).\n- Return STRICT JSON only. No comments, no trailing commas, no markdown.\n\nSources:\n${combined}`
          },
        ],
      }),
    });

    if (!analysisRes.ok) {
      const errText = await analysisRes.text();
      console.error("OpenAI analysis error", errText);
      return new Response(
        JSON.stringify({ error: "OpenAI analysis failed", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const analysisJson = await analysisRes.json();
    const analysisText: string = analysisJson?.choices?.[0]?.message?.content || "{}";

    // Parse analysis JSON to extract firm header and citations for later use
    let analysisData: any = null;
    try { analysisData = JSON.parse(analysisText); } catch {}
    const firmHeaderFromSources = analysisData?.firm_header ?? null;
    const factCitations = analysisData?.fact_citations ?? null;

    // Phase 2: RAG-verified generation using template + analysis + sources (+ firm header and DB hints)
    const generationRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
          messages: [
            { role: "system", content: "You are a legal document assistant. Output plain text without code fences." },
            { role: "system", content: `Template: ${template.name} (${template.file_type || "text"})` },
            {
              role: "system",
              content: `Output contract:\n1) Start with a Title line.\n2) Immediately include a Header block populated with firm details (Name, Address, Phone, Email, Website). If a field is unknown, put [TBD].\n3) Follow these sections in order: ${defaultOutline.join(" > ")}.\n4) Use heading markers: # for the Title, ## for top-level sections, ### for subsections.\n5) After any sentence that relies on a Source, append an inline citation like [source: filename.ext]. Multiple filenames separated by commas.\n6) Use ONLY facts that are verifiably present in Sources. If a claim cannot be verified, mark it [TBD] and keep it minimal.\n7) Maintain a professional legal tone.`
            },
            { role: "system", content: `Firm header extracted from Sources (if any): ${JSON.stringify(firmHeaderFromSources)}` },
            { role: "system", content: `Firm DB hints (optional fallback): ${JSON.stringify(firmDbHints)}` },
            { role: "system", content: `Structured facts extracted (JSON):\n${analysisText}` },
            { role: "system", content: `Sources (truncated):\n${combined}` },
            { role: "user", content: query },
          ],
      }),
    });

    if (!generationRes.ok) {
      const errText = await generationRes.text();
      console.error("OpenAI generation error", errText);
      return new Response(
        JSON.stringify({ error: "OpenAI request failed", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const generationJson = await generationRes.json();
    const answer = generationJson?.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({
        answer,
        analysis: analysisText,
        firm_header: firmHeaderFromSources,
        fact_citations: factCitations,
        outline_used: defaultOutline,
        sources: contexts.map((c) => ({ bucket: "database-uploads", path: c.storagePath, filename: c.filename })),
        template: { id: template.id, name: template.name, file_type: template.file_type || "text" },
        file_selection_count: contexts.length,
        firm_db_hints: firmDbHints,
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