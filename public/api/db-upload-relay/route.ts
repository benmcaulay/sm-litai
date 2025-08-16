import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { connectionId, storagePath, bucket = "database-uploads", filename, mimeType } = await req.json();

    if (!connectionId || !storagePath) {
      return NextResponse.json({ error: "Missing connectionId or storagePath" }, { status: 400 });
    }

    // Load the connection with decrypted API key, scoped by RLS to the requesting user/firm
    const { data: connection, error: connErr } = await supabase
      .rpc("get_database_connection_with_decrypted_key", { connection_id: connectionId })
      .maybeSingle();

    if (connErr || !connection) {
      console.error("Connection lookup failed", connErr);
      return NextResponse.json({ error: "Connection not found or access denied" }, { status: 404 });
    }

    if (!connection.upload_endpoint) {
      return NextResponse.json({ error: "Connection does not have an upload endpoint" }, { status: 400 });
    }

    // Download the file from Storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from(bucket)
      .download(storagePath);

    if (dlErr || !fileData) {
      console.error("Storage download failed", dlErr);
      return NextResponse.json({ error: "Failed to download uploaded file" }, { status: 500 });
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
        headers: forwardHeaders,
        body: form,
      });
    } catch (e) {
      console.error("Forward fetch failed", e);
      return NextResponse.json({ error: "Failed to reach upload endpoint" }, { status: 502 });
    }

    const text = await forwardResponse.text();

    return NextResponse.json({
      ok: forwardResponse.ok,
      status: forwardResponse.status,
      response: text,
    });
  } catch (err) {
    console.error("db-upload-relay error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}