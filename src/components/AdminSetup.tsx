
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Scale, Database, Key, FileText, CheckCircle, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface AdminSetupProps {
  onSetupComplete: () => void;
}

const AdminSetup = ({ onSetupComplete }: AdminSetupProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [firmName, setFirmName] = useState("");
  const [databaseType, setDatabaseType] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    if (!user || !profile || profile.role !== 'admin') {
      toast({
        title: "Error",
        description: "You must be logged in as an admin to complete setup.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Extract domain from user's email
      const domain = user.email?.split('@')[1]?.toLowerCase();
      if (!domain) {
        throw new Error("Invalid email domain");
      }

      // Create or update firm
      const { data: firm, error: firmError } = await supabase
        .from('firms')
        .upsert({
          name: firmName,
          domain: domain,
          database_config: {
            type: databaseType,
            apiKey: apiKey,
            serverUrl: serverUrl
          }
        }, {
          onConflict: 'domain'
        })
        .select()
        .single();

      if (firmError) throw firmError;

      // Update user's profile to link to firm
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ firm_id: firm.id })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      toast({
        title: "Setup Complete!",
        description: "LitAI is now configured for your firm.",
      });
      onSetupComplete();
    } catch (error: any) {
      toast({
        title: "Setup Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card className="bg-white/80 border-steel-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center text-steel-blue-800">
                <Scale className="mr-2 h-6 w-6 text-steel-blue-600" />
                Firm Information
              </CardTitle>
              <CardDescription className="text-steel-blue-600">
                Let's start by setting up your firm's basic information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="firmName" className="text-steel-blue-700">Firm Name</Label>
                <Input
                  id="firmName"
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  placeholder="Enter your law firm's name"
                  className="border-steel-blue-300 focus:border-primary"
                />
              </div>
              <div>
                <Label htmlFor="adminEmail" className="text-steel-blue-700">Admin Email</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="border-steel-blue-300 focus:border-primary bg-steel-blue-50"
                />
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card className="bg-white/80 border-steel-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center text-steel-blue-800">
                <Database className="mr-2 h-6 w-6 text-steel-blue-600" />
                Database Connection
              </CardTitle>
              <CardDescription className="text-steel-blue-600">
                Choose how LitAI will access your case files
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="databaseType" className="text-steel-blue-700">Database Type</Label>
                <Select value={databaseType} onValueChange={setDatabaseType}>
                  <SelectTrigger className="border-steel-blue-300">
                    <SelectValue placeholder="Select your document storage system" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="netdocs">NetDocs</SelectItem>
                    <SelectItem value="centerbase">Centerbase</SelectItem>
                    <SelectItem value="custom-server">Custom Server</SelectItem>
                    <SelectItem value="sharepoint">SharePoint</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {databaseType === "custom-server" && (
                <div>
                  <Label htmlFor="serverUrl" className="text-steel-blue-700">Server URL</Label>
                  <Input
                    id="serverUrl"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="https://your-server.com/api"
                    className="border-steel-blue-300 focus:border-primary"
                  />
                </div>
              )}

              {(databaseType === "netdocs" || databaseType === "centerbase" || databaseType === "sharepoint" || databaseType === "box") && (
                <div>
                  <Label htmlFor="apiKey" className="text-steel-blue-700">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API key"
                    className="border-steel-blue-300 focus:border-primary"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card className="bg-white/80 border-steel-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center text-steel-blue-800">
                <Key className="mr-2 h-6 w-6 text-steel-blue-600" />
                Security Configuration
              </CardTitle>
              <CardDescription className="text-steel-blue-600">
                Configure security settings and access permissions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-steel-blue-700">Encryption Level</Label>
                <Select defaultValue="aes-256">
                  <SelectTrigger className="border-steel-blue-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aes-256">AES-256 (Recommended)</SelectItem>
                    <SelectItem value="aes-128">AES-128</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-steel-blue-700">Data Retention Period</Label>
                <Select defaultValue="7-years">
                  <SelectTrigger className="border-steel-blue-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5-years">5 Years</SelectItem>
                    <SelectItem value="7-years">7 Years (Legal Standard)</SelectItem>
                    <SelectItem value="10-years">10 Years</SelectItem>
                    <SelectItem value="indefinite">Indefinite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="backupLocation" className="text-steel-blue-700">Backup Location</Label>
                <Input
                  id="backupLocation"
                  placeholder="Cloud storage or server path"
                  className="border-steel-blue-300 focus:border-primary"
                />
              </div>
            </CardContent>
          </Card>
        );

      case 4:
        return (
          <Card className="bg-white/80 border-steel-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center text-steel-blue-800">
                <CheckCircle className="mr-2 h-6 w-6 text-green-600" />
                Setup Complete
              </CardTitle>
              <CardDescription className="text-steel-blue-600">
                Review your configuration before finalizing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-steel-blue-700">Firm Name:</span>
                  <span className="text-steel-blue-800 font-medium">{firmName || "Not set"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-steel-blue-700">Database Type:</span>
                  <span className="text-steel-blue-800 font-medium">{databaseType || "Not selected"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-steel-blue-700">Security:</span>
                  <span className="text-green-600 font-medium">AES-256 Encryption</span>
                </div>
              </div>
              <div className="bg-steel-blue-50 p-4 rounded-lg">
                <p className="text-sm text-steel-blue-700">
                  ✓ Your firm's data will be encrypted and secured<br/>
                  ✓ RAG technology will prevent AI hallucinations<br/>
                  ✓ All documents will be generated from verified case files
                </p>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-steel-blue-800 mb-2">
          Welcome to LitAI
        </h1>
        <p className="text-steel-blue-600 text-lg">
          Let's set up your firm's AI-powered document automation
        </p>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-steel-blue-600">Setup Progress</span>
          <span className="text-sm text-steel-blue-600">{currentStep} of {totalSteps}</span>
        </div>
        <Progress value={progress} className="h-2 bg-steel-blue-100" />
      </div>

      {renderStep()}

      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1}
          className="border-steel-blue-300 hover:bg-steel-blue-50"
        >
          Previous
        </Button>
        <Button
          onClick={handleNext}
          className="bg-primary hover:bg-primary/90"
        >
          {currentStep === totalSteps ? "Complete Setup" : "Next"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default AdminSetup;
