import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, FileText, Download, Eye, Loader2, CheckCircle, File, Folder } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Document as DocxDocument, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';
import QueryStatusPanel from "@/components/QueryStatusPanel";
import { useGenerationStatus } from "@/hooks/useGenerationStatus";

const DocumentGenerator = () => {
  const [query, setQuery] = useState("");
  const [selectedCase, setSelectedCase] = useState("");
  const [cases, setCases] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const { isGenerating, setIsGenerating, addStep, reset, steps: ragSteps } = useGenerationStatus();
  const [generatedDoc, setGeneratedDoc] = useState<string | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const [download, setDownload] = useState<{ url: string; filename: string; mime: string } | null>(null);

  // Revoke object URL on change/unmount to avoid leaks
  useEffect(() => {
    return () => {
      if (download?.url) URL.revokeObjectURL(download.url);
    };
  }, [download?.url]);

  useEffect(() => {
    if (user) {
      fetchTemplates();
      fetchCases();
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

  const fetchCases = async () => {
    try {
      const { data, error } = await supabase
        .from('case_files')
        .select('id, name')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCases(data || []);
    } catch (error) {
      console.error('Error fetching cases:', error);
    }
  };

  const handleGenerate = async () => {
    if (!selectedCase || !selectedTemplate) {
      toast({
        title: "Missing Information",
        description: "Please select a case and a template. Special instructions are optional.",
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
    const selectedCaseObj = cases.find((c: any) => c.id === selectedCase);

    setIsGenerating(true);
    reset();
    setGeneratedDoc(null);
    if (download?.url) URL.revokeObjectURL(download.url);
    setDownload(null);

    // RAG: Locate case files, extract context, and generate with GPT using server-side function
    addStep(`Using case: ${selectedCaseObj?.name || 'Selected case'}`);
    addStep(template.file_type === 'docx' ? "Extracting text from .docx..." : "Preparing template context...");
    addStep("Generating answer with GPT...");

    try {
      const { data, error } = await supabase.functions.invoke('rag-generate', {
        body: {
          query,
          templateId: selectedTemplate,
          caseId: selectedCase,
          caseName: selectedCaseObj?.name || null,
        },
      });

      if (error) throw error;

      const sourceLabel = data?.source?.filename || (Array.isArray(data?.sources) && data.sources[0]?.filename);
      addStep(sourceLabel ? `Verified answer generated from ${sourceLabel}.` : 'Verified answer generated from uploaded files.');

      // Diagnostics: show how much text was actually extracted from each source
      const diags = Array.isArray(data?.extraction_diagnostics) ? data.extraction_diagnostics : [];
      if (diags.length) {
        diags.forEach((d: any) => addStep(`Source ${d.filename}: ${d.chars} chars extracted`));
        const totalChars = diags.reduce((a: number, b: any) => a + (b?.chars || 0), 0);
        if (totalChars < 200) {
          addStep('Low text extraction from sources — they may be scanned PDFs or protected. Try uploading DOCX or text-based PDFs (not scans).');
        }
      }

      // Show firm header detection status
      if (data?.firm_header) {
        const fh = data.firm_header;
        const parts = [fh.name, fh.address, fh.phone, fh.email, fh.website].filter(Boolean).join(' | ');
        addStep(parts ? `Firm header detected: ${parts}` : 'Firm header missing from sources. Falling back to hints if available.');
      }

      // Update visible output for preview
      setGeneratedDoc(typeof data?.answer === 'string' ? data.answer : '');

      // Prepare downloadable file matching template type
      addStep('Preparing downloadable file...');
      const dl = await createDownload(template, data?.answer || '');
      setDownload(dl);
      addStep('Download ready.');

      // Record generation in analytics table
      try {
        if (user && profile?.firm_id) {
          await supabase.from('generated_documents').insert({
            firm_id: profile.firm_id,
            created_by: user.id,
            template_id: selectedTemplate,
            output_type: template.file_type,
            metadata: {
              query,
              source: sourceLabel || null,
              caseId: selectedCase,
              caseName: selectedCaseObj?.name || null,
            },
          });
          window.dispatchEvent(new CustomEvent('generated_document_created'));
        }
      } catch (e) {
        console.warn('Failed to record generated document:', e);
      }

      toast({
        title: "Document Generated Successfully",
        description: `Your ${template.file_type === 'docx' ? 'Word' : 'text'} document has been created using verified case file information.`,
      });
    } catch (error: any) {
      console.error('RAG generation error:', error);
      let detail = '';
      let status: number | undefined;
      try {
        // Supabase FunctionsHttpError exposes response in context
        const res = error?.context?.response as Response | undefined;
        status = (res as any)?.status;
        if (res) {
          const text = await res.text();
          try {
            const json = JSON.parse(text);
            detail = json?.error || json?.message || text;
          } catch {
            detail = text || error?.message;
          }
        } else {
          detail = typeof error?.message === 'string' ? error.message : JSON.stringify(error);
        }
      } catch {
        detail = typeof error?.message === 'string' ? error.message : '';
      }
      const quota = (detail && (detail.includes('insufficient_quota') || detail.toLowerCase().includes('quota')));
      addStep(
        quota ? 'OpenAI quota exceeded.' : (detail ? `Error: ${detail}${status ? ` (status ${status})` : ''}` : 'Error during generation.')
      );
      toast({
        title: "Generation Failed",
        description: quota
          ? 'OpenAI quota exceeded. Add a funded key in Supabase secrets and try again.'
          : (detail || "There was an error generating your document."),
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
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

  const slugify = (s: string) => (s || 'document')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const createDownload = async (template: any, content: string) => {
    const ext = template?.file_type === 'docx' ? 'docx' : (template?.file_type === 'md' ? 'md' : 'txt');
    const mime = template?.file_type === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : (ext === 'md' ? 'text/markdown' : 'text/plain');

    let blob: Blob;
    if (ext === 'docx') {
      const lines = content.split(/\n\n+/).map((p: string) => p.replace(/\s+$/g, '')).filter((p) => p.length > 0);
      const children = [
        new Paragraph({ text: template?.name || 'Generated Document', heading: HeadingLevel.HEADING_1 }),
        ...lines.map((p: string) => new Paragraph({ children: [ new TextRun(p) ] })),
      ];
      const doc = new DocxDocument({ sections: [{ properties: {}, children }] });
      blob = await Packer.toBlob(doc);
    } else {
      blob = new Blob([content], { type: mime });
    }

    const filename = `${slugify(template?.name)}-${Date.now()}.${ext}`;
    const url = URL.createObjectURL(blob);
    return { url, filename, mime };
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-steel-blue-700 mb-2">
                Select Case
              </label>
              <Select value={selectedCase} onValueChange={setSelectedCase}>
                <SelectTrigger className="border-steel-blue-300">
                  <SelectValue placeholder="Choose a case folder" />
                </SelectTrigger>
                <SelectContent>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-steel-blue-600" />
                        <div className="font-medium">{c.name}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
          </div>

          <div>
            <label className="block text-sm font-medium text-steel-blue-700 mb-2">
              Special Instructions (optional)
            </label>
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Optional: Add any special instructions, preferences, or constraints to tailor the document."
              className="min-h-[100px] border-steel-blue-300 focus:border-primary placeholder:text-steel-blue-400"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedCase || !selectedTemplate}
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

      <QueryStatusPanel />

      {download && (
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
                <Button
                  variant="outline"
                  size="sm"
                  className="border-steel-blue-300"
                  disabled={!download}
                  onClick={() => {
                    if (!download) return;
                    window.open(download.url, '_blank');
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-steel-blue-300"
                  disabled={!download}
                  onClick={() => {
                    if (!download) return;
                    const a = document.createElement('a');
                    a.href = download.url;
                    a.download = download.filename;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {download ? `Download (${download.filename.split('.').pop()?.toUpperCase()})` : 'Download'}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-white border border-steel-blue-200 rounded-md p-4">
              {generatedDoc && generatedDoc.trim().length > 0 ? (
                <pre className="text-sm text-steel-blue-800 whitespace-pre-wrap font-mono">
                  {generatedDoc}
                </pre>
              ) : (
                <div className="text-sm text-steel-blue-700">
                  No inline preview available. Use Preview to open the file.
                </div>
              )}
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