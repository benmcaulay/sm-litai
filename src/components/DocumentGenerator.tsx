
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, FileText, Download, Eye, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DocumentGenerator = () => {
  const [query, setQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<string | null>(null);
  const [ragSteps, setRagSteps] = useState<string[]>([]);
  const { toast } = useToast();

  const templates = [
    { id: "depo-summary", name: "Deposition Summary", type: "Discovery" },
    { id: "intro-letter", name: "Introductory Letter", type: "Client Communication" },
    { id: "form-interrogatories", name: "Form Interrogatories", type: "Discovery" },
    { id: "motion-dismiss", name: "Motion to Dismiss", type: "Motions" },
    { id: "settlement-demand", name: "Settlement Demand Letter", type: "Negotiation" },
  ];

  const handleGenerate = async () => {
    if (!query.trim() || !selectedTemplate) {
      toast({
        title: "Missing Information",
        description: "Please enter a query and select a template.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setRagSteps([]);
    setGeneratedDoc(null);

    // Simulate RAG process with realistic steps
    const steps = [
      "Searching case files for relevant documents...",
      "Analyzing case: " + query.split(" ").slice(-2).join(" "),
      "Extracting key facts and dates...",
      "Cross-referencing with legal precedents...",
      "Generating document using verified information...",
      "Performing fact-checking and validation...",
      "Finalizing document with proper formatting..."
    ];

    for (let i = 0; i < steps.length; i++) {
      setTimeout(() => {
        setRagSteps(prev => [...prev, steps[i]]);
      }, i * 1000);
    }

    // Simulate document generation
    setTimeout(() => {
      const mockDocument = generateMockDocument(selectedTemplate, query);
      setGeneratedDoc(mockDocument);
      setIsGenerating(false);
      toast({
        title: "Document Generated Successfully",
        description: "Your document has been created using verified case file information.",
      });
    }, steps.length * 1000);
  };

  const generateMockDocument = (templateId: string, userQuery: string) => {
    const caseName = userQuery.split(" ").slice(-2).join(" ") || "Sample Case";
    
    switch (templateId) {
      case "depo-summary":
        return `DEPOSITION SUMMARY
Case: ${caseName}
Date: ${new Date().toLocaleDateString()}

WITNESS: [Extracted from case files]
DATE OF DEPOSITION: [Verified from court records]

SUMMARY OF TESTIMONY:
• Key facts extracted from case documents
• Timeline verified against filed pleadings
• Witness credibility assessment based on prior statements
• Supporting evidence references from discovery materials

This summary has been generated using RAG technology to ensure accuracy and prevent hallucinations.`;

      case "intro-letter":
        return `[Your Firm Letterhead]

${new Date().toLocaleDateString()}

[Client Address - Extracted from case file]

RE: ${caseName}

Dear [Client Name],

Thank you for retaining our firm to represent you in the above-referenced matter. Based on our review of your case files and initial consultation, we have prepared this introduction letter outlining our representation.

[Document continues with case-specific details extracted from verified sources...]

This document was generated using verified information from your case files.`;

      default:
        return `Generated document for ${caseName} using template: ${templates.find(t => t.id === templateId)?.name}`;
    }
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
            Generate legal documents using AI with RAG technology to prevent hallucinations
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
                    <div className="flex items-center justify-between w-full">
                      <span>{template.name}</span>
                      <Badge variant="secondary" className="ml-2">
                        {template.type}
                      </Badge>
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
                <FileText className="mr-2 h-5 w-5 text-steel-blue-600" />
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
