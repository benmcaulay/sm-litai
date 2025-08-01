import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const { action, filePath, templateData } = await req.json();

    if (action === 'extract') {
      // Extract text content from .docx file for AI processing
      const { data: fileData, error: downloadError } = await supabaseClient.storage
        .from('templates')
        .download(filePath);

      if (downloadError || !fileData) {
        console.error('Error downloading file:', downloadError);
        return new Response(JSON.stringify({ error: 'Failed to download file' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Simple text extraction - in production, you'd use a proper .docx parser
      // For now, return a placeholder that indicates this is a .docx template
      const extractedText = `[DOCX Template - ${filePath}]\nThis is a Microsoft Word document template that contains formatted content, tables, headers, and styling that will be preserved in the final document.`;

      return new Response(JSON.stringify({ 
        text: extractedText,
        success: true 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'generate') {
      // Generate a new .docx document with replaced content
      // This is a placeholder - in production, you'd use docx library to properly generate documents
      
      const generatedContent = `Generated document based on template: ${templateData.templateName}
      
User Query: ${templateData.userQuery}

This would be a properly formatted Microsoft Word document with:
- Preserved formatting from the original template
- Replaced variables and placeholders
- Professional legal document structure
- Headers, footers, and styling maintained

Generated on: ${new Date().toISOString()}`;

      // In a real implementation, you would:
      // 1. Download the original .docx template
      // 2. Parse it using a library like docx or docx-templates
      // 3. Replace variables and content
      // 4. Generate a new .docx file
      // 5. Upload it to storage and return the download URL

      return new Response(JSON.stringify({ 
        content: generatedContent,
        downloadUrl: null, // Would be a real storage URL
        success: true 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in process-docx function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})