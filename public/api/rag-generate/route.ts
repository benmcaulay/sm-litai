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

    const body = await req.json();
    const { query, templateId, caseId, caseName } = body;

    // Use OpenAI instead of Ollama for better legal document generation
    const openAIApiKey = process.env.OPENAI_API_KEY;
    if (!openAIApiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    console.log('Starting RAG generation process...');

    // Fetch template
    let templateText = '';
    if (templateId) {
      const { data: template } = await supabase
        .from('templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (template?.file_path) {
        // Extract text from template document
        try {
          const extractResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/process-docx`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': req.headers.get('authorization') ?? '',
            },
            body: JSON.stringify({
              action: 'extract',
              filePath: template.file_path
            }),
          });

          if (extractResponse.ok) {
            const extractData = await extractResponse.json();
            templateText = extractData.text || template.content || '';
          } else {
            templateText = template.content || '';
          }
        } catch (error) {
          console.error('Template extraction failed:', error);
          templateText = template.content || '';
        }
      } else {
        templateText = template?.content || '';
      }
    }

    // Get user's firm for file access
    const { data: profile } = await supabase
      .from('profiles')
      .select('firm_id')
      .eq('user_id', user.id)
      .single();

    // List uploaded documents
    const { data: files } = await supabase.storage
      .from('database-uploads')
      .list(`${user.id}/`, { limit: 100 });

    const sources: string[] = [];
    
    // Extract text from relevant documents
    for (const file of files || []) {
      if (file.name.endsWith('.docx') || file.name.endsWith('.pdf')) {
        try {
          const { data: fileData } = await supabase.storage
            .from('database-uploads')
            .download(`${user.id}/${file.name}`);

          if (fileData) {
            const arrayBuffer = await fileData.arrayBuffer();
            // Simplified text extraction - in production, use proper PDF/DOCX parsers
            const text = `[Document: ${file.name}]\nContent extraction from ${file.name}`;
            sources.push(text);
          }
        } catch (error) {
          console.error(`Failed to extract text from ${file.name}:`, error);
        }
      }
    }

    const combinedSources = sources.join('\n\n');

    // Phase 1: Analyze sources and extract structured facts
    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          {
            role: 'system',
            content: `You are a legal document analysis expert. Extract and structure key facts from the provided legal documents.

ANALYSIS REQUIREMENTS:
- Identify all parties, entities, and individuals
- Extract key dates, deadlines, and timeframes  
- Identify claims, causes of action, and legal issues
- Note jurisdictional information and governing law
- Extract financial information, damages, and monetary amounts
- Identify key documents, exhibits, and evidence referenced
- Note procedural history and case status
- Extract contact information and representatives

Return structured JSON with these categories of facts.`
          },
          {
            role: 'user',
            content: `Case: ${caseName || 'Document Generation Request'}
Query: ${query}
Template Context: ${templateText.substring(0, 2000)}
Source Documents: ${combinedSources.substring(0, 8000)}`
          }
        ],
        max_completion_tokens: 2000,
      }),
    });

    const analysisData = await analysisResponse.json();
    const analysisText = analysisData.choices[0].message.content;

    // Phase 2: Generate final document
    const generationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          {
            role: 'system',
            content: `You are a professional legal document assistant. Generate comprehensive, well-structured legal documents using the template and extracted facts.

DOCUMENT GENERATION GUIDELINES:
- Follow the template structure and formatting exactly
- Use formal legal language and proper citations
- Include all relevant facts from the analysis
- Maintain professional tone throughout
- Ensure accuracy and completeness
- Include proper headers, sections, and formatting
- Use the extracted facts to populate template variables and content

Generate a complete, professional legal document based on the template and facts provided.`
          },
          {
            role: 'user',
            content: `User Request: ${query}

TEMPLATE:
${templateText}

STRUCTURED FACTS:
${analysisText}

Generate the complete legal document now.`
          }
        ],
        max_completion_tokens: 4000,
      }),
    });

    const generationData = await generationResponse.json();
    const answer = generationData.choices[0].message.content;

    console.log('RAG generation completed successfully');

    return NextResponse.json({ 
      answer, 
      analysis: analysisText,
      sources: sources.length,
      template: templateText ? 'Template loaded' : 'No template'
    });

  } catch (error) {
    console.error('Error in rag-generate:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
