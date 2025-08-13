
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, FileText, Database, MessageSquare, Shield, Zap, Scale, BookOpen, LogIn } from "lucide-react";
import Header from "@/components/Header";
import AdminSetup from "@/components/AdminSetup";
import TemplateManager from "@/components/TemplateManager";
import DocumentGenerator from "@/components/DocumentGenerator";
import DatabaseSettings from "@/components/DatabaseSettings";
import { AuthModal } from "@/components/AuthModal";
import { FirmRegistrationModal } from "@/components/FirmRegistrationModal";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const AppContent = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showFirmRegistrationModal, setShowFirmRegistrationModal] = useState(false);
  const { user, profile, firm, loading } = useAuth();

  // Firm-scoped dashboard stats
  const [templateCount, setTemplateCount] = useState<number>(0);
  const [documentCount, setDocumentCount] = useState<number>(0);
  const [caseFileCount, setCaseFileCount] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [templatesAddedThisWeek, setTemplatesAddedThisWeek] = useState<number>(0);
  const [documentsAddedThisWeek, setDocumentsAddedThisWeek] = useState<number>(0);

  const formatNumber = (n: number) => new Intl.NumberFormat().format(n || 0);

  const fetchCounts = async () => {
    if (!profile?.firm_id) return;
    setLoadingStats(true);
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [templatesRes, docsRes, casesRes, templatesWeekRes, docsWeekRes] = await Promise.all([
        supabase.from('templates').select('id', { count: 'exact', head: true }).eq('firm_id', profile.firm_id),
        supabase.from('generated_documents').select('id', { count: 'exact', head: true }).eq('firm_id', profile.firm_id),
        supabase.from('case_files').select('id', { count: 'exact', head: true }).eq('firm_id', profile.firm_id).eq('status', 'indexed'),
        supabase.from('templates').select('id', { count: 'exact', head: true }).eq('firm_id', profile.firm_id).gte('created_at', oneWeekAgo),
        supabase.from('generated_documents').select('id', { count: 'exact', head: true }).eq('firm_id', profile.firm_id).gte('created_at', oneWeekAgo),
      ]);
      if (templatesRes.error) console.warn('Template count error:', templatesRes.error);
      if (docsRes.error) console.warn('Generated documents count error:', docsRes.error);
      if (casesRes.error) console.warn('Case files count error:', casesRes.error);
      if (templatesWeekRes.error) console.warn('Templates last 7 days count error:', templatesWeekRes.error);
      if (docsWeekRes.error) console.warn('Generated documents last 7 days count error:', docsWeekRes.error);
      setTemplateCount(templatesRes.count || 0);
      setDocumentCount(docsRes.count || 0);
      setCaseFileCount(casesRes.count || 0);
      setTemplatesAddedThisWeek(templatesWeekRes.count || 0);
      setDocumentsAddedThisWeek(docsWeekRes.count || 0);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, [profile?.firm_id]);

  useEffect(() => {
    const handler = () => fetchCounts();
    window.addEventListener('generated_document_created', handler as EventListener);
    return () => window.removeEventListener('generated_document_created', handler as EventListener);
  }, [profile?.firm_id]);

  const isSetupComplete = profile?.role === 'admin' ? !!firm : !!firm;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-steel-blue-50 to-steel-blue-100 flex items-center justify-center">
        <div className="text-steel-blue-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-steel-blue-50 to-steel-blue-100">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <img 
              src="/lovable-uploads/767961b3-485a-4d43-9dfb-56163866e12b.png" 
              alt="LitAI Logo" 
              className="h-20 w-20 mx-auto mb-6"
            />
            <h1 className="text-4xl font-bold text-steel-blue-800 mb-4">
              Welcome to LitAI
            </h1>
            <p className="text-steel-blue-600 text-lg mb-8">
              AI-powered legal document automation for law firms
            </p>
            <div className="space-y-4">
              <Button 
                onClick={() => setShowAuthModal(true)}
                className="bg-primary hover:bg-primary/90"
                size="lg"
              >
                <LogIn className="mr-2 h-5 w-5" />
                Log In / Sign Up
              </Button>
              <div className="text-center">
                <button 
                  onClick={() => setShowFirmRegistrationModal(true)}
                  className="text-sm text-muted-foreground hover:text-primary underline cursor-pointer"
                >
                  New Here? Register Your Firm
                </button>
              </div>
            </div>
          </div>
        </div>
        <AuthModal 
          isOpen={showAuthModal} 
          onClose={() => setShowAuthModal(false)} 
        />
        <FirmRegistrationModal 
          isOpen={showFirmRegistrationModal} 
          onClose={() => setShowFirmRegistrationModal(false)} 
        />
      </div>
    );
  }

  if (profile?.role === 'admin' && !isSetupComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-steel-blue-50 to-steel-blue-100">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <AdminSetup onSetupComplete={() => window.location.reload()} />
        </div>
      </div>
    );
  }

  if (profile?.role === 'user' && !firm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-steel-blue-50 to-steel-blue-100">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl font-bold text-steel-blue-800 mb-4">
              Firm Not Set Up
            </h1>
            <p className="text-steel-blue-600 text-lg">
              Your firm has not been configured yet. Please contact your administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-steel-blue-50 to-steel-blue-100">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-steel-blue-800 mb-2">
            Welcome to LitAI
          </h1>
          <p className="text-steel-blue-600 text-lg">
            Your AI-powered legal document automation platform
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full mb-8 bg-white/50 ${profile?.role === 'admin' ? 'grid-cols-5' : 'grid-cols-3'}`}>
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Overview
            </TabsTrigger>
            <TabsTrigger value="generate" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Generate
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Templates
            </TabsTrigger>
            {profile?.role === 'admin' && (
              <>
                <TabsTrigger value="database" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Database
                </TabsTrigger>
                <TabsTrigger value="settings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Settings
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="bg-white/70 border-steel-blue-200 hover:bg-white/90 transition-all duration-300">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-steel-blue-700 flex items-center">
                    <FileText className="mr-2 h-4 w-4 text-steel-blue-500" />
                    Active Templates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-steel-blue-800">{formatNumber(templateCount)}</div>
                  <p className="text-xs text-steel-blue-600">+{formatNumber(templatesAddedThisWeek)} this week</p>
                </CardContent>
              </Card>

              <Card className="bg-white/70 border-steel-blue-200 hover:bg-white/90 transition-all duration-300">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-steel-blue-700 flex items-center">
                    <Zap className="mr-2 h-4 w-4 text-steel-blue-500" />
                    Documents Generated
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-steel-blue-800">{formatNumber(documentCount)}</div>
                  <p className="text-xs text-steel-blue-600">+{formatNumber(documentsAddedThisWeek)} this week</p>
                </CardContent>
              </Card>

              <Card className="bg-white/70 border-steel-blue-200 hover:bg-white/90 transition-all duration-300">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-steel-blue-700 flex items-center">
                    <Database className="mr-2 h-4 w-4 text-steel-blue-500" />
                    Case Files Indexed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-steel-blue-800">{formatNumber(caseFileCount)}</div>
                  <p className="text-xs text-steel-blue-600">All databases synced</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white/70 border-steel-blue-200">
                <CardHeader>
                  <CardTitle className="text-steel-blue-800 flex items-center">
                    <Scale className="mr-2 h-5 w-5 text-steel-blue-600" />
                    Quick Actions
                  </CardTitle>
                  <CardDescription className="text-steel-blue-600">
                    Common tasks and shortcuts
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start border-steel-blue-300 hover:bg-steel-blue-50"
                    onClick={() => setActiveTab("generate")}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Generate Document
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start border-steel-blue-300 hover:bg-steel-blue-50"
                    onClick={() => setActiveTab("templates")}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Manage Templates
                  </Button>
                  {profile?.role === 'admin' && (
                    <Button 
                      variant="outline" 
                      className="w-full justify-start border-steel-blue-300 hover:bg-steel-blue-50"
                      onClick={() => setActiveTab("database")}
                    >
                      <Database className="mr-2 h-4 w-4" />
                      Database Settings
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white/70 border-steel-blue-200">
                <CardHeader>
                  <CardTitle className="text-steel-blue-800 flex items-center">
                    <Shield className="mr-2 h-5 w-5 text-steel-blue-600" />
                    Security & Compliance
                  </CardTitle>
                  <CardDescription className="text-steel-blue-600">
                    Your data protection status
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-steel-blue-700">Encryption</span>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Active</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-steel-blue-700">HIPAA Compliance</span>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Verified</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-steel-blue-700">Data Backup</span>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Current</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="generate" forceMount>
            <DocumentGenerator />
          </TabsContent>

          <TabsContent value="templates">
            <TemplateManager />
          </TabsContent>

          {profile?.role === 'admin' && (
            <>
              <TabsContent value="database">
                <DatabaseSettings />
              </TabsContent>

              <TabsContent value="settings">
                <Card className="bg-white/70 border-steel-blue-200">
                  <CardHeader>
                    <CardTitle className="text-steel-blue-800 flex items-center">
                      <Settings className="mr-2 h-5 w-5 text-steel-blue-600" />
                      Firm Settings
                    </CardTitle>
                    <CardDescription className="text-steel-blue-600">
                      Manage your firm's LitAI configuration
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-steel-blue-600">Settings panel coming soon...</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
};

const Index = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default Index;
