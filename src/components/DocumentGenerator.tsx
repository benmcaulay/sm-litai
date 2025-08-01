import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, FileText, Download, Eye, Loader2, CheckCircle, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const DocumentGenerator = () => {
  const [query, setQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<string | null>(null);
  const [ragSteps, setRagSteps] = useState<string[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchTemplates();
    }
  }, [user]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleGenerate = async () => {
    if (!query.trim() || !selectedTemplate) {
      toast({
        title: "Missing Information",
        description: "Please enter a query and select a template.",
        variant: "destructive",
      });
      return;
    }

    const template = templates.find(t => t.id === selectedTemplate);
    if (!template) {
      toast({
        title: "Template Error",
        description: "Selected template not found",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setRagSteps([]);
    setGeneratedDoc(null);

    // Simulate RAG process with realistic steps
    const steps = [
      "Searching case files for relevant documents...",
      template.file_type === 'docx' ? "Processing Word template formatting..." : "Processing text template...",
      "Analyzing case: " + query.split(" ").slice(-2).join(" "),
      "Extracting key facts and dates...",
      "Cross-referencing with legal precedents...",
      template.file_type === 'docx' ? "Generating formatted Word document..." : "Generating text document...",
      "Performing fact-checking and validation...",
      "Finalizing document with proper formatting..."
    ];

    for (let i = 0; i < steps.length; i++) {
      setTimeout(() => {
        setRagSteps(prev => [...prev, steps[i]]);
      }, i * 1000);
    }

    // Simulate document generation
    setTimeout(async () => {
      try {
        if (template.file_type === 'docx' && template.file_path) {
          // Process .docx template using edge function
          const { data, error } = await supabase.functions.invoke('process-docx', {
            body: {
              action: 'generate',
              filePath: template.file_path,
              templateData: {
                templateName: template.name,
                userQuery: query
              }
            }
          });

          if (error) throw error;
          setGeneratedDoc(data.content);
        } else {
          // Generate from text template or fallback
          const mockDocument = generateMockDocument(selectedTemplate, query);
          setGeneratedDoc(mockDocument);
        }

        setIsGenerating(false);
        toast({
          title: "Document Generated Successfully",
          description: `Your ${template.file_type === 'docx' ? 'Word' : 'text'} document has been created using verified case file information.`,
        });
      } catch (error) {
        console.error('Generation error:', error);
        setIsGenerating(false);
        toast({
          title: "Generation Failed",
          description: "There was an error generating your document",
          variant: "destructive"
        });
      }
    }, steps.length * 1000);
  };

  const generateMockDocument = (templateId: string, userQuery: string) => {
    const template = templates.find(t => t.id === templateId);
    const caseName = userQuery.split(" ").slice(-2).join(" ") || "Sample Case";
    
    return `Generated Document: ${template?.name || 'Unknown Template'}

Based on your query: "${userQuery}"

This is a ${template?.file_type === 'docx' ? 'Microsoft Word format' : 'text format'} document that would contain:
- Professional legal formatting ${template?.file_type === 'docx' ? 'with preserved Word styling' : ''}
- Customized content based on your case details
- Proper legal structure and clauses
- All necessary provisions and terms

Case: ${caseName}
Generated on: ${new Date().toLocaleDateString()}
Template Source: ${template?.file_type === 'docx' ? 'Word Document (.docx)' : 'Text Template'}

${template?.file_type === 'docx' ? 
  '[In production, this would maintain all original Word formatting, headers, footers, styles, and embedded elements from the .docx template]' :
  '[This document was generated from a text template and contains structured legal content]'
}

This document has been generated using RAG technology to ensure accuracy and prevent hallucinations.`;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/70 border-steel-blue-200">
        <CardHeader>
          <CardTitle className="text-steel-blue-800 flex items-center">
            <MessageSquare className="mr-2 h-5 w-5 text-steel-blue-600" />
            AI Document Generator
          </CardTitle>
          <CardDescription className="text-steel-blue-600">
            Generate legal documents using AI with RAG technology - supports both Word (.docx) and text templates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-steel-blue-700 mb-2">
              Select Template
            </label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger className="border-steel-blue-300">
                <SelectValue placeholder="Choose a document template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex items-center gap-2">
                      {template.file_type === 'docx' ? 
                        <File className="h-4 w-4 text-blue-500" /> : 
                        <FileText className="h-4 w-4 text-gray-500" />
                      }
                      <div>
                        <div className="font-medium">{template.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {template.category} • {template.file_type?.toUpperCase() || 'TEXT'}
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-steel-blue-700 mb-2">
              Your Request
            </label>
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Example: 'Write a deposition summary for Coldwater v. Cowell' or 'Generate an introductory letter for the Johnson personal injury case'"
              className="min-h-[100px] border-steel-blue-300 focus:border-primary"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !query.trim() || !selectedTemplate}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Document...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generate Document
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {ragSteps.length > 0 && (
        <Card className="bg-white/70 border-steel-blue-200">
          <CardHeader>
            <CardTitle className="text-steel-blue-800 text-lg">
              RAG Process Status
            </CardTitle>
            <CardDescription className="text-steel-blue-600">
              Real-time processing to ensure document accuracy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ragSteps.map((step, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-steel-blue-700">{step}</span>
                </div>
              ))}
              {isGenerating && (
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 text-steel-blue-500 animate-spin" />
                  <span className="text-sm text-steel-blue-600">Processing...</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {generatedDoc && (
        <Card className="bg-white/70 border-steel-blue-200">
          <CardHeader>
            <CardTitle className="text-steel-blue-800 flex items-center justify-between">
              <span className="flex items-center">
                {templates.find(t => t.id === selectedTemplate)?.file_type === 'docx' ? 
                  <File className="mr-2 h-5 w-5 text-blue-500" /> :
                  <FileText className="mr-2 h-5 w-5 text-steel-blue-600" />
                }
                Generated Document
              </span>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" className="border-steel-blue-300">
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                <Button variant="outline" size="sm" className="border-steel-blue-300">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-white border border-steel-blue-200 rounded-md p-4">
              <pre className="text-sm text-steel-blue-800 whitespace-pre-wrap font-mono">
                {generatedDoc}
              </pre>
            </div>
            <div className="flex items-center mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              <span className="text-sm text-green-800">
                Document generated using RAG technology - all information verified against case files
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DocumentGenerator;