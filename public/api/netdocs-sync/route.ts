import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface NetDocsSyncRequest {
  externalDatabaseId: string;
  action: 'discover' | 'sync' | 'analyze';
  searchCriteria?: {
    caseType?: string;
    dateRange?: { start: string; end: string };
    keywords?: string[];
    documentTypes?: string[];
  };
}

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

    const body = await req.json() as NetDocsSyncRequest;

    // Get external database configuration
    const { data: externalDb, error: dbError } = await supabase
      .from('external_databases')
      .select('*')
      .eq('id', body.externalDatabaseId)
      .single();

    if (dbError || !externalDb) {
      return NextResponse.json({ error: 'External database not found' }, { status: 404 });
    }

    if (!externalDb.oauth_access_token) {
      return NextResponse.json({ error: 'NetDocs not authenticated. Please complete OAuth flow first.' }, { status: 400 });
    }

    // Check if token needs refresh
    if (externalDb.oauth_expires_at && new Date(externalDb.oauth_expires_at) <= new Date()) {
      await refreshNetDocsToken(supabase, externalDb);
    }

    if (body.action === 'discover') {
      return await discoverDocuments(supabase, externalDb, body.searchCriteria);
    }

    if (body.action === 'sync') {
      return await syncDocuments(supabase, externalDb);
    }

    if (body.action === 'analyze') {
      return await analyzeDocuments(supabase, externalDb, body.searchCriteria);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error in netdocs-sync function:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

async function refreshNetDocsToken(supabase: any, externalDb: any) {
  const clientId = process.env.NETDOCS_CLIENT_ID;
  const clientSecret = process.env.NETDOCS_CLIENT_SECRET;

  const tokenResponse = await fetch('https://vault.netvoyage.com/neWeb2/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: externalDb.oauth_refresh_token,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to refresh NetDocs token');
  }

  const tokenData = await tokenResponse.json();
  const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

  await supabase
    .from('external_databases')
    .update({
      oauth_access_token: tokenData.access_token,
      oauth_refresh_token: tokenData.refresh_token || externalDb.oauth_refresh_token,
      oauth_expires_at: expiresAt.toISOString(),
    })
    .eq('id', externalDb.id);
}

async function discoverDocuments(supabase: any, externalDb: any, searchCriteria?: any) {
  console.log('Starting intelligent document discovery for NetDocs...');
  
  const openAIApiKey = process.env.OPENAI_API_KEY;
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Generate intelligent search queries using GPT-4
  const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        {
          role: 'system',
          content: `You are a legal document discovery expert. Generate intelligent NetDocs search queries based on the given criteria. 
          Return a JSON object with specific search parameters that would find the most relevant legal documents.
          Include: keywords, document types, date ranges, and folder patterns.`
        },
        {
          role: 'user',
          content: `Generate search queries for: ${JSON.stringify(searchCriteria)}`
        }
      ],
      max_completion_tokens: 1000,
    }),
  });

  const aiData = await aiResponse.json();
  const searchQueries = JSON.parse(aiData.choices[0].message.content);

  // Execute searches using NetDocs API
  const documents: any[] = [];
  
  for (const query of searchQueries.queries || [searchQueries]) {
    const searchUrl = new URL('https://vault.netvoyage.com/neWeb2/search');
    searchUrl.searchParams.set('q', query.keywords?.join(' ') || '');
    searchUrl.searchParams.set('cabinet', externalDb.netdocs_repository_id || '');
    
    if (query.dateRange) {
      searchUrl.searchParams.set('modified_from', query.dateRange.start);
      searchUrl.searchParams.set('modified_to', query.dateRange.end);
    }

    const searchResponse = await fetch(searchUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${externalDb.oauth_access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      documents.push(...(searchData.documents || []));
    }
  }

  // Store search query for analytics
  await supabase
    .from('netdocs_search_queries')
    .insert({
      external_database_id: externalDb.id,
      firm_id: externalDb.firm_id,
      query_type: 'ai_generated',
      search_parameters: searchQueries,
      results_count: documents.length,
      created_by: externalDb.created_by,
    });

  return NextResponse.json({
    documents,
    searchQueries,
    totalFound: documents.length
  });
}

async function syncDocuments(supabase: any, externalDb: any) {
  console.log('Starting document sync...');
  
  // Get existing documents to avoid duplicates
  const { data: existingDocs } = await supabase
    .from('netdocs_documents')
    .select('netdocs_document_id')
    .eq('external_database_id', externalDb.id);

  const existingIds = new Set(existingDocs?.map(doc => doc.netdocs_document_id) || []);

  // Fetch recent documents from NetDocs
  const documentsUrl = new URL('https://vault.netvoyage.com/neWeb2/documents');
  documentsUrl.searchParams.set('cabinet', externalDb.netdocs_repository_id || '');
  documentsUrl.searchParams.set('limit', '100');
  documentsUrl.searchParams.set('sort', 'modified:desc');

  const response = await fetch(documentsUrl.toString(), {
    headers: {
      'Authorization': `Bearer ${externalDb.oauth_access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch documents from NetDocs');
  }

  const data = await response.json();
  const newDocuments = data.documents?.filter(doc => !existingIds.has(doc.id)) || [];

  // Insert new documents
  const documentsToInsert = newDocuments.map(doc => ({
    external_database_id: externalDb.id,
    firm_id: externalDb.firm_id,
    netdocs_document_id: doc.id,
    cabinet_id: doc.cabinetId,
    workspace_id: doc.workspaceId,
    document_name: doc.name,
    document_path: doc.path,
    file_extension: doc.extension,
    size_bytes: doc.size,
    last_modified: doc.lastModified,
    document_version: doc.version,
    sync_status: 'synced',
    last_sync_at: new Date().toISOString(),
    metadata: {
      syncedAt: new Date().toISOString(),
      source: 'netdocs_api'
    }
  }));

  if (documentsToInsert.length > 0) {
    const { error } = await supabase
      .from('netdocs_documents')
      .insert(documentsToInsert);

    if (error) {
      console.error('Failed to insert documents:', error);
    }
  }

  // Update last sync time
  await supabase
    .from('external_databases')
    .update({ last_document_sync_at: new Date().toISOString() })
    .eq('id', externalDb.id);

  return NextResponse.json({
    syncedDocuments: documentsToInsert.length,
    totalDocuments: existingIds.size + documentsToInsert.length
  });
}

async function analyzeDocuments(supabase: any, externalDb: any, searchCriteria?: any) {
  console.log('Starting AI document analysis...');
  
  const openAIApiKey = process.env.OPENAI_API_KEY;
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Get documents that need analysis
  const { data: documents } = await supabase
    .from('netdocs_documents')
    .select('*')
    .eq('external_database_id', externalDb.id)
    .is('ai_analysis', null)
    .limit(10);

  const analysisResults = [];

  for (const doc of documents || []) {
    try {
      // Download document content from NetDocs
      const contentResponse = await fetch(
        `https://vault.netvoyage.com/neWeb2/documents/${doc.netdocs_document_id}/content`,
        {
          headers: {
            'Authorization': `Bearer ${externalDb.oauth_access_token}`,
          },
        }
      );

      if (!contentResponse.ok) {
        continue;
      }

      const content = await contentResponse.text();
      
      // Analyze with GPT-4
      const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-2025-04-14',
          messages: [
            {
              role: 'system',
              content: `Analyze this legal document and extract key information including:
              - Document type and category
              - Key parties involved
              - Important dates
              - Main legal issues or topics
              - Relevance score (0-1) based on search criteria
              Return JSON format with these fields.`
            },
            {
              role: 'user',
              content: `Document: ${doc.document_name}\nContent: ${content.substring(0, 4000)}\nSearch Criteria: ${JSON.stringify(searchCriteria)}`
            }
          ],
          max_completion_tokens: 1000,
        }),
      });

      const analysisData = await analysisResponse.json();
      const analysis = JSON.parse(analysisData.choices[0].message.content);

      // Update document with analysis
      await supabase
        .from('netdocs_documents')
        .update({
          ai_analysis: analysis,
          relevance_score: analysis.relevance_score || 0.5
        })
        .eq('id', doc.id);

      analysisResults.push({
        documentId: doc.id,
        documentName: doc.document_name,
        analysis
      });

    } catch (error) {
      console.error(`Failed to analyze document ${doc.id}:`, error);
    }
  }

  return NextResponse.json({
    analyzedDocuments: analysisResults.length,
    results: analysisResults
  });
}