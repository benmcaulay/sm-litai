import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import PizZip from 'https://esm.sh/pizzip@3.1.6'

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
      
      try {
        // Parse .docx file using PizZip
        const zip = new PizZip(arrayBuffer);
        
        // Extract document.xml which contains the main content
        const documentXml = zip.file("word/document.xml");
        if (!documentXml) {
          throw new Error("Invalid .docx file - missing document.xml");
        }
        
        const xmlContent = documentXml.asText();
        
        // Extract text content from XML (simple regex-based extraction)
        const textMatches = xmlContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
        const extractedText = textMatches
          .map(match => match.replace(/<[^>]*>/g, ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        console.log('Successfully extracted text from .docx:', extractedText.substring(0, 200) + '...');
        
        if (!extractedText) {
          throw new Error("No text content found in document");
        }
        
        return new Response(JSON.stringify({ 
          text: extractedText,
          success: true 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } catch (parseError) {
        console.error('Error parsing .docx file:', parseError);
        
        // Fallback to basic file info
        const fallbackText = `[DOCX Template - ${filePath}]\nThis is a Microsoft Word document template. Content extraction failed: ${parseError.message}`;
        
        return new Response(JSON.stringify({ 
          text: fallbackText,
          success: true,
          warning: 'Content extraction failed, using fallback'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }


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