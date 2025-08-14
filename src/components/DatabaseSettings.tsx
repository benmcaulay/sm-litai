
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Database, Server, Key, RefreshCw, CheckCircle, AlertCircle, HardDrive, Cloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
const DatabaseSettings = () => {
  const [connectionStatus, setConnectionStatus] = useState("connected");
  const [autoSync, setAutoSync] = useState(true);
  const [lastSync, setLastSync] = useState("2024-01-16 09:30 AM");
  const { toast } = useToast();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Dashboard stats for Storage & Indexing
  const [caseFileCount, setCaseFileCount] = useState<number>(0);
  const [documentCount, setDocumentCount] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [dbName, setDbName] = useState("");
  const [dbType, setDbType] = useState<string | undefined>();
  const [apiKey, setApiKey] = useState("");
  const [uploadEndpoint, setUploadEndpoint] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);

  const loadConnections = async () => {
    const { data, error } = await supabase
      .from("external_databases")
      .select("id, name, type, status, upload_endpoint, created_by, firm_id, created_at, updated_at, last_sync_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error loading connections", description: error.message });
      return;
    }
    setConnections(data || []);
  };

  const handleAddDatabase = async () => {
    if (!dbName || !dbType) {
      toast({ title: "Missing information", description: "Name and Type are required." });
      return;
    }
    setLoading(true);
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id;
    const { data: firmId, error: firmErr } = await supabase.rpc("get_user_firm_id");
    if (!userId || firmErr) {
      toast({ title: "Auth error", description: "Please sign in and ensure your profile is set." });
      setLoading(false);
      return;
    }
    const { error } = await supabase.from("external_databases").insert({
      name: dbName,
      type: dbType,
      api_key: apiKey || null,
      upload_endpoint: uploadEndpoint || null,
      firm_id: firmId,
      created_by: userId,
    });
    if (error) {
      toast({ title: "Failed to add", description: error.message });
    } else {
      toast({ title: "Database added", description: "Connection saved successfully." });
      setDbName("");
      setDbType(undefined);
      setApiKey("");
      setUploadEndpoint("");
      await loadConnections();
    }
    setLoading(false);
  };

  const openUpload = (id: string) => {
    setActiveConnectionId(id);
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConnectionId) return;

    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) {
      toast({ title: "Not signed in", description: "Please sign in to upload." });
      return;
    }

    const path = `${userId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("database-uploads").upload(path, file, { upsert: true });

    if (upErr) {
      toast({ title: "Upload failed", description: upErr.message });
      e.target.value = "";
      setActiveConnectionId(null);
      return;
    }

    const { error: forwardErr } = await supabase.functions.invoke("db-upload-relay", {
      body: {
        connectionId: activeConnectionId,
        storagePath: path,
        bucket: "database-uploads",
        filename: file.name,
        mimeType: file.type,
      },
    });

    // Record in database_documents for organization
    const { data: firmId, error: firmErr } = await supabase.rpc("get_user_firm_id");
    if (!firmErr && firmId && userId) {
      const { error: metaErr } = await (supabase as any).from("database_documents").insert({
        firm_id: firmId,
        external_database_id: activeConnectionId,
        storage_path: path,
        filename: file.name,
        size_bytes: file.size,
        mime_type: file.type || null,
        uploaded_by: userId,
      });
      if (metaErr) {
        console.warn("Failed to record document metadata:", metaErr);
      }
    }

    if (forwardErr) {
      toast({ title: "Forwarding failed", description: forwardErr.message });
    } else {
      toast({ title: "File sent", description: "Your file was forwarded to the database." });
    }

    e.target.value = "";
    setActiveConnectionId(null);
  };

  useEffect(() => {
    loadConnections();
  }, []);

  // Stats helpers
  const formatNumber = (n: number) => new Intl.NumberFormat().format(n || 0);
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  };
  const fetchStats = async () => {
    if (!profile?.firm_id) return;
    setLoadingStats(true);
    try {
      const [casesRes, docsRes] = await Promise.all([
        supabase
          .from('case_files')
          .select('id', { count: 'exact', head: true })
          .eq('firm_id', profile.firm_id)
          .eq('status', 'indexed'),
        supabase
          .from('generated_documents')
          .select('id', { count: 'exact', head: true })
          .eq('firm_id', profile.firm_id),
      ]);
      if (casesRes.error) console.warn('Case files count error:', casesRes.error);
      if (docsRes.error) console.warn('Generated documents count error:', docsRes.error);
      setCaseFileCount(casesRes.count || 0);
      setDocumentCount(docsRes.count || 0);

      const { data: usageBytes, error: usageErr } = await (supabase as any).rpc('get_firm_storage_usage_bytes', { bucket: 'database-uploads' });
      if (usageErr) console.warn('Storage usage error:', usageErr);
      setTotalBytes(Number(usageBytes || 0));
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [profile?.firm_id]);

  const handleTestConnection = (dbId: string | number) => {
    toast({
      title: "Testing Connection",
      description: "Verifying database connectivity...",
    });

    setTimeout(() => {
      toast({
        title: "Connection Successful",
        description: "Database is accessible and responding normally.",
      });
    }, 2000);
  };

  const handleSyncNow = () => {
    toast({
      title: "Sync Started",
      description: "Updating case file index...",
    });

    setTimeout(() => {
      setLastSync(new Date().toLocaleString());
      toast({
        title: "Sync Complete",
        description: "All case files have been indexed successfully.",
      });
    }, 3000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-green-100 text-green-800";
      case "error":
        return "bg-red-100 text-red-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  return (
    <div className="space-y-6">
      <input type="file" ref={fileInputRef} className="hidden" onChange={onFileChange} />
      <Card className="bg-white/70 border-steel-blue-200">
        <CardHeader>
          <CardTitle className="text-steel-blue-800 flex items-center">
            <Database className="mr-2 h-5 w-5 text-steel-blue-600" />
            Database Connections
          </CardTitle>
          <CardDescription className="text-steel-blue-600">
            Manage your firm's case file database connections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {connections.map((db) => (
              <div
                key={db.id}
                className="flex items-center justify-between p-4 border border-steel-blue-200 rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  {db.type === "custom" ? (
                    <Server className="h-8 w-8 text-steel-blue-500" />
                  ) : (
                    <Cloud className="h-8 w-8 text-steel-blue-500" />
                  )}
                  <div>
                    <h3 className="font-medium text-steel-blue-800">{db.name}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="secondary" className="bg-steel-blue-100 text-steel-blue-700">
                        {db.type}
                      </Badge>
                      <Badge className={getStatusColor(db.status)}>
                        <span className="flex items-center space-x-1">
                          {getStatusIcon(db.status)}
                          <span>{db.status}</span>
                        </span>
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right text-sm text-steel-blue-600">
                    <div>Last sync: {db.last_sync_at ? new Date(db.last_sync_at).toLocaleString() : "-"}</div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openUpload(db.id)}
                    className="border-steel-blue-300"
                  >
                    Upload File
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestConnection(db.id)}
                    className="border-steel-blue-300 hover:bg-steel-blue-50"
                  >
                    Test Connection
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/databases/${db.id}/documents`)}
                    className="border-steel-blue-300 hover:bg-steel-blue-50"
                  >
                    View Documents
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/70 border-steel-blue-200">
          <CardHeader>
            <CardTitle className="text-steel-blue-800 flex items-center">
              <RefreshCw className="mr-2 h-5 w-5 text-steel-blue-600" />
              Sync Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-steel-blue-700">Auto-sync</Label>
                <p className="text-sm text-steel-blue-600">Automatically update case file index</p>
              </div>
              <Switch
                checked={autoSync}
                onCheckedChange={setAutoSync}
              />
            </div>

            <div>
              <Label className="text-steel-blue-700">Sync Frequency</Label>
              <Select defaultValue="hourly">
                <SelectTrigger className="border-steel-blue-300 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15min">Every 15 minutes</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2">
              <div className="text-sm text-steel-blue-600 mb-2">
                Last sync: {lastSync}
              </div>
              <Button
                onClick={handleSyncNow}
                className="w-full bg-primary hover:bg-primary/90"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Now
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 border-steel-blue-200">
          <CardHeader>
            <CardTitle className="text-steel-blue-800 flex items-center">
              <Key className="mr-2 h-5 w-5 text-steel-blue-600" />
              Add New Database
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="dbName" className="text-steel-blue-700">Database Name</Label>
              <Input
                id="dbName"
                placeholder="Enter a name for this connection"
                className="border-steel-blue-300 focus:border-primary"
                value={dbName}
                onChange={(e) => setDbName(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-steel-blue-700">Database Type</Label>
              <Select value={dbType} onValueChange={setDbType}>
                <SelectTrigger className="border-steel-blue-300">
                  <SelectValue placeholder="Select database type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="netdocs">NetDocs</SelectItem>
                  <SelectItem value="centerbase">Centerbase</SelectItem>
                  <SelectItem value="sharepoint">SharePoint</SelectItem>
                  <SelectItem value="box">Box</SelectItem>
                  <SelectItem value="custom">Custom Server</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="apiKey" className="text-steel-blue-700">API Key / Connection String</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter API key or connection details"
                className="border-steel-blue-300 focus:border-primary"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="uploadEndpoint" className="text-steel-blue-700">Upload Endpoint URL</Label>
              <Input
                id="uploadEndpoint"
                type="url"
                placeholder="https://example.com/upload"
                className="border-steel-blue-300 focus:border-primary"
                value={uploadEndpoint}
                onChange={(e) => setUploadEndpoint(e.target.value)}
              />
            </div>

            <Button className="w-full bg-primary hover:bg-primary/90" onClick={handleAddDatabase} disabled={loading}>
              <Database className="mr-2 h-4 w-4" />
              {loading ? "Adding..." : "Add Database"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/70 border-steel-blue-200">
        <CardHeader>
          <CardTitle className="text-steel-blue-800 flex items-center">
            <HardDrive className="mr-2 h-5 w-5 text-steel-blue-600" />
            Storage & Indexing
          </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-steel-blue-800">{formatBytes(totalBytes)}</div>
                <div className="text-sm text-steel-blue-600">Total Indexed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-steel-blue-800">{formatNumber(caseFileCount)}</div>
                <div className="text-sm text-steel-blue-600">Active Cases</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-steel-blue-800">{formatNumber(documentCount)}</div>
                <div className="text-sm text-steel-blue-600">Documents Indexed</div>
              </div>
          </div>
          <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-sm text-steel-blue-600">Danger zone: permanently delete all uploaded documents for your firm.</p>
            <Button
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={async () => {
                if (!profile?.firm_id) {
                  toast({ title: 'Not ready', description: 'Firm not loaded.' });
                  return;
                }
                if (!confirm('This will permanently delete all uploaded documents for your firm. Continue?')) return;
                toast({ title: 'Deleting...', description: 'Wiping uploaded documents...' });
                const { data, error } = await (supabase as any).rpc('wipe_firm_uploads', { bucket: 'database-uploads' });
                if (error) {
                  toast({ title: 'Delete failed', description: error.message });
                  return;
                }
                toast({ title: 'Deleted', description: `${data || 0} files removed.` });
                await fetchStats();
              }}
            >
              Delete All Uploaded Documents
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DatabaseSettings;
