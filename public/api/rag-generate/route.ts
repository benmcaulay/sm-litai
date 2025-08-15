import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const OLLAMA_BASE = process.env.OLLAMA_BASE || 'http://127.0.0.1:11434';
const MODEL = process.env.MODEL_NAME || 'gpt-oss:20b';

export async function POST(req: Request) {
  // keep Supabase for auth/metadata only
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } } }
  );

  const body = await req.json(); // {query, templateId, caseId, ...}
  // TODO: copy your existing logic (template fetch, file listing, extraction) here.
  // Replace Deno.env.get → process.env, and Supabase Storage reads with local file reads if going fully local.

  // --- Replace OpenAI calls with Ollama ---
  const analysis = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ model: MODEL, stream: false, messages: [
      { role:'system', content:'<your analysis system prompt>' },
      { role:'user',   content:'<your analysis user prompt with combined sources>' }
    ]})
  }).then(r=>r.json());

  const analysisText = analysis?.message?.content || '{}';

  const generation = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ model: MODEL, stream: false, messages: [
      { role:'system', content:'You are a legal document assistant...' },
      // add your STYLE_BLOCK / TEMPLATE_BLOCK / DATABASE_BLOCKS as system messages
      { role:'system', content:`Structured facts: ${analysisText}` },
      { role:'user',   content: body.query || 'Generate the document…' }
    ]})
  }).then(r=>r.json());

  const answer = generation?.message?.content || '';
  return NextResponse.json({ answer, analysis: analysisText });
}
