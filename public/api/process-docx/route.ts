import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import PizZip from 'pizzip';

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

    const { action, filePath, templateData } = await req.json();

    if (action === 'extract') {
      // Extract text content from .docx file for AI processing
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('templates')
        .download(filePath);

      if (downloadError || !fileData) {
        console.error('Error downloading file:', downloadError);
        return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
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
        
        return NextResponse.json({ 
          text: extractedText,
          success: true 
        });
        
      } catch (parseError) {
        console.error('Error parsing .docx file:', parseError);
        
        // Fallback to basic file info
        const fallbackText = `[DOCX Template - ${filePath}]\nThis is a Microsoft Word document template. Content extraction failed: ${(parseError as Error).message}`;
        
        return NextResponse.json({ 
          text: fallbackText,
          success: true,
          warning: 'Content extraction failed, using fallback'
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

      return NextResponse.json({ 
        content: generatedContent,
        downloadUrl: null, // Would be a real storage URL
        success: true 
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error in process-docx function:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}