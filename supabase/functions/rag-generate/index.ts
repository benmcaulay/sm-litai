import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import PizZip from "https://esm.sh/pizzip@3.1.6";
import pdfjsLib from "https://esm.sh/pdfjs-dist@3.11.174/legacy/build/pdf.mjs";
// Configure PDF.js worker to avoid errors in edge runtime
try { (pdfjsLib as any).GlobalWorkerOptions.workerSrc = "https://esm.sh/pdfjs-dist@3.11.174/legacy/build/pdf.worker.mjs"; } catch (_) {}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
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
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } }
    );

    const openAIApiKey =
      Deno.env.get("OPENAI_API_KEY") ||
      Deno.env.get("OPENAI KEY") ||
      Deno.env.get("OPENAI") ||
      "";

    console.log("rag-generate: OPENAI_API_KEY present:", Boolean(openAIApiKey));
    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: "Missing OpenAI API key. Please set OPENAI_API_KEY in Supabase secrets." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { query, templateId } = await req.json();
    if (!query || !templateId) {
      return new Response(JSON.stringify({ error: "Missing query or templateId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userRes.user.id;

    // Fetch template
    const { data: template, error: tplErr } = await supabase
      .from("templates")
      .select("id, name, file_type, file_path, content")
      .eq("id", templateId)
      .maybeSingle();

    if (tplErr || !template) {
      return new Response(JSON.stringify({ error: "Template not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List uploaded files for this user ("database files")
    const { data: objects, error: listErr } = await supabase.storage
      .from("database-uploads")
      .list(userId, { limit: 100, sortBy: { column: "name", order: "desc" } });

    if (listErr) {
      console.error("Storage list error", listErr);
      return new Response(JSON.stringify({ error: "Unable to list uploaded case files" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!objects || objects.length === 0) {
      return new Response(
        JSON.stringify({ error: "No uploaded database files found. Please upload files in Database Connections." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Scoring: prioritize firm header/letterhead files, then 'complain/complaint', then PDFs
    const scoreFile = (name: string) => {
      const n = name.toLowerCase();
      let s = 0;
      if (/(letterhead|header|firm|contact)/i.test(n)) s += 100;
      if (/(complain|complaint)/i.test(n)) s += 50;
      if (/\.pdf$/i.test(n)) s += 20;
      return s;
    };

    const sorted = [...objects].sort((a, b) => {
      const sa = scoreFile(a.name);
      const sb = scoreFile(b.name);
      if (sb !== sa) return sb - sa;
      return b.name.localeCompare(a.name);
    });

    const candidates = sorted.slice(0, 5);

    // --- Extraction helpers ---
    const stripXmlParagraphs = (xml: string) => {
      try {
        // Convert explicit Word line breaks to \n before extracting text
        const withLineBreaks = xml.replace(/<w:br\s*\/?>/gi, "\n");
        const paraBlocks = withLineBreaks.split(/<w:p[^>]*>/i);
        const out: string[] = [];
        for (const block of paraBlocks) {
          const texts = block.match(/<w:t[^>]*>([^<]*)<\/w:t>/gi) || [];
          if (texts.length === 0) continue;
          const combined = texts.map((m) => m.replace(/<[^>]*>/g, "")).join("");
          const cleaned = combined.replace(/[\t\r]+/g, "").trimEnd();
          if (cleaned) out.push(cleaned);
        }
        return out.join("\n\n");
      } catch (_) {
        // Fallback to simple text extraction
        const textMatches = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/gi) || [];
        return textMatches.map((m) => m.replace(/<[^>]*>/g, "")).join(" ").trim();
      }
    };

    const extractDocxText = (buf: ArrayBuffer): string => {
      try {
        const zip = new PizZip(buf);
        let collected = "";
        const main = zip.file("word/document.xml");
        if (main) collected += stripXmlParagraphs(main.asText()) + "\n\n";
        // Include headers and footers (often contain firm name/address/contact)
        const headerFiles = zip.file(/word\/header[0-9]*\.xml/);
        const footerFiles = zip.file(/word\/footer[0-9]*\.xml/);
        for (const f of headerFiles) collected += stripXmlParagraphs(f.asText()) + "\n\n";
        for (const f of footerFiles) collected += stripXmlParagraphs(f.asText()) + "\n\n";
        return collected.replace(/\n{3,}/g, "\n\n").trim();
      } catch (e) {
        console.warn("DOCX parse failed", e);
        return "";
      }
    };

    const extractPdfText = async (buf: ArrayBuffer): Promise<string> => {
      try {
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) });
        const pdf = await loadingTask.promise;
        const pages: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content: any = await page.getTextContent({ disableCombineTextItems: false });
          const items: any[] = content.items || [];
          const lines = new Map<number, { y: number; parts: { x: number; str: string }[] }>();
          for (const it of items) {
            const tr = Array.isArray(it?.transform) ? it.transform : [];
            const x = typeof tr[4] === "number" ? tr[4] : 0;
            const y = typeof tr[5] === "number" ? tr[5] : 0;
            const key = Math.round(y);
            if (!lines.has(key)) lines.set(key, { y: key, parts: [] });
            lines.get(key)!.parts.push({ x, str: typeof it?.str === "string" ? it.str : "" });
          }
          const sortedLines = Array.from(lines.values())
            .sort((a, b) => b.y - a.y)
            .map((ln) => ln.parts.sort((p, q) => p.x - q.x).map((p) => p.str.trim()).join(" ").replace(/\s+$/g, ""));
          pages.push(sortedLines.join("\n"));
        }
        return pages.join("\n\n").replace(/\s+$/g, "");
      } catch (e) {
        console.warn("PDF.js parse failed, falling back to naive extraction", e);
        try {
          const bytes = new Uint8Array(buf);
          let s = "";
          for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
          const matches = s.match(/\((?:\\\)|\\\(|\\n|\\r|\\t|[^()])+\)/g) || [];
          const decoded = matches
            .map((m) =>
              m
                .slice(1, -1)
                .replace(/\\n/g, "\n")
                .replace(/\\r/g, "\r")
                .replace(/\\t/g, "\t")
                .replace(/\\\(/g, "(")
                .replace(/\\\)/g, ")")
                .replace(/\\\\/g, "\\")
            )
            .join("");
          return decoded.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
        } catch {
          return "";
        }
      }
    };

    const extractAnyText = async (name: string, buf: ArrayBuffer): Promise<string> => {
      const lower = name.toLowerCase();
      if (lower.endsWith(".docx")) return extractDocxText(buf);
      if (lower.endsWith(".pdf")) return await extractPdfText(buf);
      return new TextDecoder().decode(buf).toString();
    };

    const contexts: { filename: string; text: string; storagePath: string; chars: number }[] = [];

    // Download and extract text
    await Promise.all(
      candidates.map(async (obj) => {
        const storagePath = `${userId}/${obj.name}`;
        const { data: fileData, error: dlErr } = await supabase.storage
          .from("database-uploads")
          .download(storagePath);
        if (dlErr || !fileData) {
          console.warn("Download failed for", storagePath, dlErr);
          return;
        }
        const buf = await fileData.arrayBuffer();
        let text = await extractAnyText(obj.name, buf);
        if (!text || text.trim().length === 0) {
          text = `No readable text extracted from ${obj.name}.`;
        }
        contexts.push({ filename: obj.name, text, storagePath, chars: text.length });
      })
    );

    if (contexts.length === 0) {
      return new Response(
        JSON.stringify({ error: "No readable content extracted from uploaded files." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Combine context (size-limited)
    const MAX_TOTAL = 16000;
    const perFile = Math.max(1000, Math.floor(MAX_TOTAL / contexts.length));
    const combined = contexts
      .map((c) => `=== Source: ${c.filename} ===\n${c.text.slice(0, perFile)}`)
      .join("\n\n");

    // Default outline (legacy; only used if no database style authority is found)
    const defaultOutline = [
      "Title",
      "Header",
      "Introduction",
      "Background",
      "Facts",
      "Arguments",
      "Relief Requested",
      "Conclusion",
      "Signature",
    ];

    // TEMPLATE content (optional, used for guidance or fallback formatting)
    let templateText = "";
    try {
      if (typeof (template as any).content === "string" && (template as any).content.trim().length > 0) {
        templateText = String((template as any).content).slice(0, 16000);
      } else if ((template as any).file_path) {
        const { data: tplData } = await supabase.storage.from("templates").download((template as any).file_path);
        if (tplData) {
          const buf = await tplData.arrayBuffer();
          templateText = await extractAnyText((template as any).file_path, buf);
        }
      }
    } catch (_e) {
      console.warn("Template text extraction failed");
    }
    const TEMPLATE_BLOCK = `=== TEMPLATE CONTENT ===\n${templateText || "[No template text available]"}`;

    // Prepare DATABASE blocks and choose style authority (largest readable file)
    const DATABASE_BLOCKS = contexts
      .map((c) => `=== DATABASE SOURCE: ${c.filename} ===\n${c.text.slice(0, perFile)}`)
      .join("\n\n");

    const styleAuthority = contexts.slice().sort((a, b) => b.chars - a.chars)[0] || null;
    const STYLE_BLOCK = styleAuthority
      ? `=== DATABASE STYLE AUTHORITY: ${styleAuthority.filename} ===\n${styleAuthority.text.slice(0, Math.min(styleAuthority.text.length, 12000))}`
      : "";

    
    let firmDbHints: { name?: string; domain?: string } | null = null;
    try {
      const { data: firmIdData } = await supabase.rpc("get_user_firm_id");
      const firmId = (firmIdData as string | null) || null;
      if (firmId) {
        const { data: firmRow } = await supabase
          .from("firms")
          .select("name, domain")
          .eq("id", firmId)
          .maybeSingle();
        if (firmRow) {
          firmDbHints = { name: (firmRow as any).name, domain: (firmRow as any).domain };
        }
      }
    } catch (_e) {
      console.warn("Firm DB hint fetch failed");
    }

    // Phase 1: Extract structured facts from database files (authoritative for header)
    const analysisRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              "You are a legal analyst. Extract structured facts strictly from the provided database files (authoritative). Return STRICT JSON only.",
          },
          {
            role: "user",
            content:
              `Analyze the following database files (Sources) and extract key facts as JSON with this shape:\n\n{
  "case_caption": "string",
  "parties": { "plaintiff": ["..."], "defendant": ["..."] },
  "claims": ["..."],
  "key_dates": [{ "label": "", "date": "" }],
  "venue": "",
  "docket_number": "",
  "monetary_amounts": [{ "label": "", "amount": "" }],
  "firm_header": { "name": "", "address": "", "phone": "", "email": "", "website": "", "other": "" },
  "fact_citations": [{ "fact": "", "sources": ["filename.ext"] }],
  "other_facts": ["..."],
  "source_filenames": ["..."]
}\n\nRules:\n- These Sources are the DATABASE FILES and are AUTHORITATIVE.\n- firm_header MUST be derived from these Sources (e.g., letterheads, contact blocks).\n- If a field is unknown, leave it empty or omit it. Do NOT invent values.\n- Return STRICT JSON only. No comments, no trailing commas, no markdown.\n\nSources:\n${combined}`,
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

    let analysisData: any = null;
    try {
      analysisData = JSON.parse(analysisText);
    } catch (_) {
      analysisData = {};
    }

    const firmHeaderFromSources = analysisData?.firm_header ?? null;
    const factCitations = analysisData?.fact_citations ?? null;

    // Phase 2: Generate document with strict template alignment and header populated from database files
    const generationRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAIApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: "You are a legal document assistant. Output plain text only. Do not use markdown headings, code fences, or additional labels." },
          { role: "system", content: "Document roles:\n- TEMPLATE: general guidance ONLY for content when database lacks a section.\n- DATABASE: authoritative facts and primary formatting source.\n- DATABASE STYLE AUTHORITY: the single database document whose formatting MUST be exactly copied (intro, outro, paragraph and line spacing, blank lines, numbering, indentation, section order and wording)." },
          { role: "system", content: STYLE_BLOCK || "No database style authority available. If so, mirror the TEMPLATE formatting as a fallback." },
          { role: "system", content: TEMPLATE_BLOCK },
          { role: "system", content: `DATABASE SOURCES (truncated):\n${DATABASE_BLOCKS}` },
          { role: "system", content: `Firm header from database files: ${JSON.stringify(firmHeaderFromSources)}` },
          { role: "system", content: `Firm DB hints (fallback only): ${JSON.stringify(firmDbHints)}` },
          { role: "system", content: `Structured facts (JSON):\n${analysisText}` },
          { role: "system", content: "Formatting instructions:\n- If a DATABASE STYLE AUTHORITY is provided, EXACTLY copy its intro, outro, line breaks, blank lines, paragraph spacing, numbering/bullets, indentation, and section order/wording.\n- Replace only variable factual content; preserve all format markers and spacing.\n- If a value is unknown, keep the existing placeholder if present; otherwise write [TBD] while preserving spacing.\n- Do not add citations, bracketed notes, hashes (#), or headings not present in the style authority.\n- Output must be plain text with the exact spacing and blank lines as the style authority.\n- If no DATABASE STYLE AUTHORITY exists, follow the TEMPLATE format instead. Never mix styles." },
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
        extraction_diagnostics: contexts.map((c) => ({ filename: c.filename, chars: c.chars })),
        firm_db_hints: firmDbHints,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("rag-generate error", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});