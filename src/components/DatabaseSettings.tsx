
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Database, Server, Key, RefreshCw, CheckCircle, AlertCircle, HardDrive, Cloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DatabaseSettings = () => {
  const [connectionStatus, setConnectionStatus] = useState("connected");
  const [autoSync, setAutoSync] = useState(true);
  const [lastSync, setLastSync] = useState("2024-01-16 09:30 AM");
  const { toast } = useToast();

  const databases = [
    {
      id: 1,
      name: "NetDocs Primary",
      type: "NetDocs",
      status: "connected",
      lastSync: "2024-01-16 09:30 AM",
      caseCount: 1247,
      documentsIndexed: 15832
    },
    {
      id: 2,
      name: "Local Case Archive",
      type: "Custom Server",
      status: "connected",
      lastSync: "2024-01-16 08:45 AM",
      caseCount: 892,
      documentsIndexed: 8934
    },
    {
      id: 3,
      name: "SharePoint Backup",
      type: "SharePoint",
      status: "error",
      lastSync: "2024-01-15 03:20 PM",
      caseCount: 456,
      documentsIndexed: 3245
    }
  ];

  const handleTestConnection = (dbId: number) => {
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
            {databases.map((db) => (
              <div
                key={db.id}
                className="flex items-center justify-between p-4 border border-steel-blue-200 rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  {db.type === "Custom Server" ? (
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
                    <div className="text-sm text-steel-blue-600 mt-1">
                      {db.caseCount} cases • {db.documentsIndexed.toLocaleString()} documents
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right text-sm text-steel-blue-600">
                    <div>Last sync: {db.lastSync}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestConnection(db.id)}
                    className="border-steel-blue-300 hover:bg-steel-blue-50"
                  >
                    Test Connection
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
              />
            </div>

            <div>
              <Label className="text-steel-blue-700">Database Type</Label>
              <Select>
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
              />
            </div>

            <Button className="w-full bg-primary hover:bg-primary/90">
              <Database className="mr-2 h-4 w-4" />
              Add Database
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
              <div className="text-2xl font-bold text-steel-blue-800">24.7 GB</div>
              <div className="text-sm text-steel-blue-600">Total Indexed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-steel-blue-800">2,595</div>
              <div className="text-sm text-steel-blue-600">Active Cases</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-steel-blue-800">28,011</div>
              <div className="text-sm text-steel-blue-600">Documents Indexed</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DatabaseSettings;
