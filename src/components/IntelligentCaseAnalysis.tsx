import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, Search, FileText, Clock, Target, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DiscoveryResult {
  documentId: string;
  documentName: string;
  relevanceScore: number;
  documentType: string;
  reasoning: string;
  keyPoints: string[];
}

interface CoverageAnalysis {
  completenessScore: number;
  risks: string[];
  recommendations: string[];
  missingDocumentTypes: string[];
}

const IntelligentCaseAnalysis = () => {
  const [caseDescription, setCaseDescription] = useState('');
  const [keyParties, setKeyParties] = useState('');
  const [legalIssues, setLegalIssues] = useState('');
  const [timeframe, setTimeframe] = useState({ start: '', end: '' });
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [results, setResults] = useState<{
    strategy: any;
    results: {
      totalDocumentsFound: number;
      searchPhases: any[];
      relevantDocuments: DiscoveryResult[];
      coverageAnalysis: CoverageAnalysis;
    };
    summary: {
      totalDocuments: number;
      highRelevanceDocuments: number;
      searchPhasesExecuted: number;
      completenessScore: number;
      risksIdentified: number;
    };
  } | null>(null);

  const { toast } = useToast();

  const handleIntelligentDiscovery = async () => {
    if (!caseDescription.trim()) {
      toast({
        title: "Error",
        description: "Please provide a case description",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setResults(null);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await fetch('/api/intelligent-document-discovery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          caseDescription,
          keyParties: keyParties.split(',').map(p => p.trim()).filter(Boolean),
          legalIssues: legalIssues.split(',').map(i => i.trim()).filter(Boolean),
          timeframe: timeframe.start && timeframe.end ? timeframe : undefined,
          priority
        })
      });

      if (!response.ok) throw new Error('Analysis failed');
      const responseData = await response.json();

      clearInterval(progressInterval);
      setAnalysisProgress(100);

      setResults(responseData || {});
      
      toast({
        title: "Analysis Complete",
        description: `Found ${responseData?.summary?.totalDocuments || 0} documents with ${responseData?.summary?.completenessScore || 0}% case coverage`,
      });

    } catch (error) {
      console.error('Intelligent discovery error:', error);
      toast({
        title: "Error",
        description: "Failed to execute intelligent discovery",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
      setTimeout(() => setAnalysisProgress(0), 2000);
    }
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800';
    if (score >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getCompletenessColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/70 border-steel-blue-200">
        <CardHeader>
          <CardTitle className="text-steel-blue-800 flex items-center">
            <Brain className="mr-2 h-5 w-5 text-steel-blue-600" />
            Intelligent Case Analysis & Document Discovery
          </CardTitle>
          <CardDescription className="text-steel-blue-600">
            AI-powered document discovery that understands legal context and case requirements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="caseDescription" className="text-steel-blue-700">Case Description *</Label>
                <Textarea
                  id="caseDescription"
                  placeholder="Describe the case, legal matter, or dispute. Include key facts, claims, and context..."
                  className="border-steel-blue-300 focus:border-primary min-h-[100px]"
                  value={caseDescription}
                  onChange={(e) => setCaseDescription(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="keyParties" className="text-steel-blue-700">Key Parties</Label>
                <Input
                  id="keyParties"
                  placeholder="John Smith, ABC Corp, Jane Doe (comma-separated)"
                  className="border-steel-blue-300 focus:border-primary"
                  value={keyParties}
                  onChange={(e) => setKeyParties(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="legalIssues" className="text-steel-blue-700">Legal Issues</Label>
                <Input
                  id="legalIssues"
                  placeholder="Contract breach, negligence, employment (comma-separated)"
                  className="border-steel-blue-300 focus:border-primary"
                  value={legalIssues}
                  onChange={(e) => setLegalIssues(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="startDate" className="text-steel-blue-700">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    className="border-steel-blue-300 focus:border-primary"
                    value={timeframe.start}
                    onChange={(e) => setTimeframe(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate" className="text-steel-blue-700">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    className="border-steel-blue-300 focus:border-primary"
                    value={timeframe.end}
                    onChange={(e) => setTimeframe(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label className="text-steel-blue-700">Priority Level</Label>
                <div className="flex space-x-2 mt-1">
                  {(['high', 'medium', 'low'] as const).map((level) => (
                    <Button
                      key={level}
                      variant={priority === level ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPriority(level)}
                      className={priority === level ? "bg-primary" : "border-steel-blue-300"}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              <Button 
                onClick={handleIntelligentDiscovery}
                disabled={isAnalyzing || !caseDescription.trim()}
                className="w-full bg-gradient-to-r from-primary to-primary-glow text-white"
              >
                <Search className="mr-2 h-4 w-4" />
                {isAnalyzing ? 'Analyzing...' : 'Start Intelligent Discovery'}
              </Button>
            </div>
          </div>

          {isAnalyzing && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-800">AI Analysis in Progress...</span>
                    <span className="text-sm text-blue-600">{analysisProgress}%</span>
                  </div>
                  <Progress value={analysisProgress} className="h-2" />
                  <p className="text-xs text-blue-600">
                    Analyzing case context, generating search strategies, and scoring document relevance
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {results && (
        <div className="space-y-6">
          {/* Summary Dashboard */}
          <Card className="bg-white/70 border-steel-blue-200">
            <CardHeader>
              <CardTitle className="text-steel-blue-800 flex items-center">
                <TrendingUp className="mr-2 h-5 w-5 text-steel-blue-600" />
                Discovery Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-steel-blue-800">{results.summary.totalDocuments}</div>
                  <div className="text-sm text-steel-blue-600">Total Found</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{results.summary.highRelevanceDocuments}</div>
                  <div className="text-sm text-steel-blue-600">High Relevance</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{results.summary.searchPhasesExecuted}</div>
                  <div className="text-sm text-steel-blue-600">Search Phases</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getCompletenessColor(results.summary.completenessScore)}`}>
                    {results.summary.completenessScore}%
                  </div>
                  <div className="text-sm text-steel-blue-600">Case Coverage</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search Strategy */}
          <Card className="bg-white/70 border-steel-blue-200">
            <CardHeader>
              <CardTitle className="text-steel-blue-800 flex items-center">
                <Target className="mr-2 h-5 w-5 text-steel-blue-600" />
                AI Search Strategy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.results.searchPhases.map((phase, index) => (
                  <Card key={index} className="border border-steel-blue-200">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          Phase {phase.phase}
                        </Badge>
                        <Badge className="bg-green-100 text-green-800">
                          {phase.documentsFound} found
                        </Badge>
                      </div>
                      <h4 className="font-medium text-steel-blue-800 mb-1">{phase.name}</h4>
                      <p className="text-sm text-steel-blue-600 mb-2">{phase.query}</p>
                      <div className="flex items-center text-xs text-steel-blue-500">
                        <Clock className="mr-1 h-3 w-3" />
                        {phase.executionTime}ms
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Relevant Documents */}
          <Card className="bg-white/70 border-steel-blue-200">
            <CardHeader>
              <CardTitle className="text-steel-blue-800 flex items-center">
                <FileText className="mr-2 h-5 w-5 text-steel-blue-600" />
                Most Relevant Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {results.results.relevantDocuments.slice(0, 10).map((doc, index) => (
                  <Card key={index} className="border border-steel-blue-200">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="font-medium text-steel-blue-800">{doc.documentName}</h4>
                            <Badge className={getRelevanceColor(doc.relevanceScore)}>
                              {Math.round(doc.relevanceScore * 100)}% relevant
                            </Badge>
                            <Badge variant="outline" className="bg-steel-blue-50 text-steel-blue-700">
                              {doc.documentType}
                            </Badge>
                          </div>
                          <p className="text-sm text-steel-blue-600 mb-2">{doc.reasoning}</p>
                          {doc.keyPoints.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {doc.keyPoints.map((point, i) => (
                                <Badge key={i} variant="secondary" className="text-xs bg-steel-blue-100 text-steel-blue-600">
                                  {point}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Coverage Analysis */}
          {results.results.coverageAnalysis && (
            <Card className="bg-white/70 border-steel-blue-200">
              <CardHeader>
                <CardTitle className="text-steel-blue-800">Coverage Analysis & Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {results.results.coverageAnalysis.risks?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-red-700 mb-2">Potential Risks</h4>
                    <ul className="space-y-1">
                      {results.results.coverageAnalysis.risks.map((risk, index) => (
                        <li key={index} className="text-sm text-red-600 flex items-start">
                          <span className="mr-2">⚠️</span>
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {results.results.coverageAnalysis.recommendations?.length > 0 && (
                  <div>
                    <h4 className="font-medium text-blue-700 mb-2">Recommendations</h4>
                    <ul className="space-y-1">
                      {results.results.coverageAnalysis.recommendations.map((rec, index) => (
                        <li key={index} className="text-sm text-blue-600 flex items-start">
                          <span className="mr-2">💡</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default IntelligentCaseAnalysis;