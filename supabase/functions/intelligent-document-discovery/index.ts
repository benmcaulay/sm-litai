import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiscoveryRequest {
  caseDescription: string;
  documentTypes?: string[];
  timeframe?: { start: string; end: string };
  keyParties?: string[];
  legalIssues?: string[];
  priority?: 'high' | 'medium' | 'low';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json() as DiscoveryRequest;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('Starting intelligent document discovery for case:', body.caseDescription);

    // Get user's firm and external databases
    const { data: profile } = await supabase
      .from('profiles')
      .select('firm_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.firm_id) {
      throw new Error('User firm not found');
    }

    const { data: externalDbs } = await supabase
      .from('external_databases')
      .select('*')
      .eq('firm_id', profile.firm_id)
      .eq('type', 'NetDocs')
      .eq('status', 'connected');

    if (!externalDbs?.length) {
      throw new Error('No connected NetDocs databases found');
    }

    // Phase 1: AI Strategy Planning
    const strategyResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are an expert legal document discovery strategist. Create a comprehensive search strategy for finding relevant documents in NetDocs.
            
            Analyze the case and generate:
            1. Primary search keywords and Boolean queries
            2. Document type priorities (contracts, correspondence, pleadings, etc.)
            3. Date range optimization
            4. Party-specific searches
            5. Secondary/related searches to catch overlooked documents
            6. Risk assessment for missing critical documents
            
            Return a detailed JSON strategy with multiple search phases.`
          },
          {
            role: 'user',
            content: `Case Description: ${body.caseDescription}
            Document Types: ${JSON.stringify(body.documentTypes || [])}
            Timeframe: ${JSON.stringify(body.timeframe || {})}
            Key Parties: ${JSON.stringify(body.keyParties || [])}
            Legal Issues: ${JSON.stringify(body.legalIssues || [])}
            Priority: ${body.priority || 'medium'}`
          }
        ],
        max_completion_tokens: 2000,
      }),
    });

    const strategyData = await strategyResponse.json();
    const strategy = JSON.parse(strategyData.choices[0].message.content);

    console.log('AI Discovery Strategy Generated:', strategy);

    // Phase 2: Execute Multi-Phase Discovery
    const discoveryResults = {
      totalDocumentsFound: 0,
      searchPhases: [],
      relevantDocuments: [],
      coverageAnalysis: {},
      recommendations: []
    };

    for (const externalDb of externalDbs) {
      if (!externalDb.oauth_access_token) {
        continue;
      }

      // Execute each search phase
      for (let i = 0; i < strategy.searchPhases?.length; i++) {
        const phase = strategy.searchPhases[i];
        console.log(`Executing search phase ${i + 1}:`, phase.name);

        const phaseResults = await executeSearchPhase(
          externalDb,
          phase,
          openAIApiKey
        );

        discoveryResults.searchPhases.push({
          phase: i + 1,
          name: phase.name,
          query: phase.query,
          documentsFound: phaseResults.documents.length,
          executionTime: phaseResults.executionTime
        });

        // Analyze and score documents with AI
        const scoredDocuments = await analyzeDocumentRelevance(
          phaseResults.documents,
          body,
          openAIApiKey
        );

        discoveryResults.relevantDocuments.push(...scoredDocuments);
        discoveryResults.totalDocumentsFound += phaseResults.documents.length;

        // Store search query analytics
        await supabase
          .from('netdocs_search_queries')
          .insert({
            external_database_id: externalDb.id,
            firm_id: profile.firm_id,
            query_type: 'ai_generated',
            search_parameters: {
              phase: phase.name,
              query: phase.query,
              caseDescription: body.caseDescription
            },
            results_count: phaseResults.documents.length,
            execution_time_ms: phaseResults.executionTime,
            created_by: user.id,
          });
      }
    }

    // Phase 3: Coverage Analysis and Gap Detection
    const coverageResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `Analyze the document discovery results for completeness and gaps. 
            Assess if critical document types might be missing and recommend additional searches.
            Rate the discovery completeness (0-100%) and identify potential risks.`
          },
          {
            role: 'user',
            content: `Case: ${body.caseDescription}
            Search Results: ${JSON.stringify(discoveryResults.searchPhases)}
            Found Documents: ${discoveryResults.totalDocumentsFound}
            Document Types Found: ${JSON.stringify(discoveryResults.relevantDocuments.map(d => d.type))}`
          }
        ],
        max_completion_tokens: 1000,
      }),
    });

    const coverageData = await coverageResponse.json();
    discoveryResults.coverageAnalysis = JSON.parse(coverageData.choices[0].message.content);

    // Sort documents by relevance score
    discoveryResults.relevantDocuments.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return new Response(JSON.stringify({
      success: true,
      strategy,
      results: discoveryResults,
      summary: {
        totalDocuments: discoveryResults.totalDocumentsFound,
        highRelevanceDocuments: discoveryResults.relevantDocuments.filter(d => d.relevanceScore > 0.8).length,
        searchPhasesExecuted: discoveryResults.searchPhases.length,
        completenessScore: discoveryResults.coverageAnalysis.completenessScore || 0,
        risksIdentified: discoveryResults.coverageAnalysis.risks?.length || 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in intelligent-document-discovery function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function executeSearchPhase(externalDb: any, phase: any, openAIApiKey: string) {
  const startTime = Date.now();
  
  try {
    const searchUrl = new URL('https://vault.netvoyage.com/neWeb2/search');
    searchUrl.searchParams.set('q', phase.query);
    searchUrl.searchParams.set('cabinet', externalDb.netdocs_repository_id || '');
    searchUrl.searchParams.set('limit', '50');
    
    if (phase.dateRange) {
      searchUrl.searchParams.set('modified_from', phase.dateRange.start);
      searchUrl.searchParams.set('modified_to', phase.dateRange.end);
    }

    if (phase.documentTypes?.length) {
      searchUrl.searchParams.set('file_types', phase.documentTypes.join(','));
    }

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${externalDb.oauth_access_token}`,
        'Content-Type': 'application/json',
      },
    });

    const executionTime = Date.now() - startTime;

    if (!response.ok) {
      console.error('NetDocs API error:', await response.text());
      return { documents: [], executionTime };
    }

    const data = await response.json();
    return {
      documents: data.documents || [],
      executionTime
    };

  } catch (error) {
    console.error('Search phase execution error:', error);
    return { documents: [], executionTime: Date.now() - startTime };
  }
}

async function analyzeDocumentRelevance(documents: any[], caseInfo: DiscoveryRequest, openAIApiKey: string) {
  const analyzedDocuments = [];

  for (const doc of documents.slice(0, 20)) { // Limit to first 20 for performance
    try {
      const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-mini-2025-08-07',
          messages: [
            {
              role: 'system',
              content: `Score document relevance (0-1) for the given case. Consider document type, title, metadata, and potential importance. Return JSON with: relevanceScore, reasoning, documentType, keyPoints.`
            },
            {
              role: 'user',
              content: `Case: ${caseInfo.caseDescription}
              Document: ${doc.name}
              Path: ${doc.path || ''}
              Extension: ${doc.extension || ''}
              Size: ${doc.size || 0} bytes
              Modified: ${doc.lastModified || ''}`
            }
          ],
          max_completion_tokens: 500,
        }),
      });

      const analysisData = await analysisResponse.json();
      const analysis = JSON.parse(analysisData.choices[0].message.content);

      analyzedDocuments.push({
        ...doc,
        relevanceScore: analysis.relevanceScore || 0.5,
        type: analysis.documentType || 'unknown',
        reasoning: analysis.reasoning || '',
        keyPoints: analysis.keyPoints || []
      });

    } catch (error) {
      console.error(`Failed to analyze document ${doc.id}:`, error);
      analyzedDocuments.push({
        ...doc,
        relevanceScore: 0.3,
        type: 'unknown',
        reasoning: 'Analysis failed',
        keyPoints: []
      });
    }
  }

  return analyzedDocuments;
}