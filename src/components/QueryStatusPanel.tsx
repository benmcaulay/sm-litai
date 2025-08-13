import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2 } from "lucide-react";
import { useGenerationStatus } from "@/hooks/useGenerationStatus";

const QueryStatusPanel = () => {
  const { steps, isGenerating } = useGenerationStatus();

  if (!isGenerating && steps.length === 0) return null;

  return (
    <Card className="bg-white/70 border-steel-blue-200 mt-6">
      <CardHeader>
        <CardTitle className="text-steel-blue-800 text-lg">
          Query Status
        </CardTitle>
        <CardDescription className="text-steel-blue-600">
          Real-time processing to ensure document accuracy
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {steps.map((step, index) => (
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
  );
};

export default QueryStatusPanel;
