import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Folder, FileText, ExternalLink, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NetDocsFolder {
  id: string;
  name: string;
  type: 'folder' | 'document';
  path?: string;
}

export function NetDocsIntegration() {
  const [isConnected, setIsConnected] = useState(false);
  const [folders, setFolders] = useState<NetDocsFolder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('netdocs-search', {
        body: { q: '=11(ndfld)' }
      });
      
      if (!error && data && !data.error) {
        setIsConnected(true);
        // Parse the results to show folders
        const results = data.Results || [];
        const folderData: NetDocsFolder[] = results.map((item: any) => ({
          id: item.Id || item.id || crypto.randomUUID(),
          name: item.DisplayName || item.name || 'Unnamed',
          type: item.Container ? 'folder' : 'document',
          path: item.Path || ''
        }));
        setFolders(folderData);
      } else {
        setIsConnected(false);
        setFolders([]);
      }
    } catch (error) {
      console.error('Failed to check NetDocs connection:', error);
      setIsConnected(false);
      setFolders([]);
    }
  };

  const connectNetDocs = async () => {
    try {
      setIsConnecting(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Please log in first to connect NetDocuments');
        return;
      }

      // Use the project ID from the Supabase URL to construct functions URL
      const functionsUrl = 'https://vrxzwhbbblkqraimfclt.functions.supabase.co';
      const authUrl = `${functionsUrl}/netdocs-auth-start?uid=${encodeURIComponent(user.id)}`;
      
      // Open in popup window
      const popup = window.open(
        authUrl, 
        'netdocs-auth', 
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      // Poll for completion
      const pollTimer = setInterval(async () => {
        try {
          if (popup?.closed) {
            clearInterval(pollTimer);
            setIsConnecting(false);
            // Check if connection was successful
            await checkConnectionStatus();
            if (isConnected) {
              toast.success('NetDocuments connected successfully!');
            }
          }
        } catch (error) {
          console.error('Error polling popup status:', error);
        }
      }, 1000);

    } catch (error) {
      console.error('Failed to connect NetDocs:', error);
      toast.error('Failed to connect NetDocuments');
      setIsConnecting(false);
    }
  };

  const searchFolders = async () => {
    if (!isConnected) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('netdocs-search', {
        body: { q: '=11(ndfld)' }
      });

      if (error) {
        toast.error('Failed to search NetDocuments folders');
        return;
      }

      const results = data.Results || [];
      const folderData: NetDocsFolder[] = results.map((item: any) => ({
        id: item.Id || item.id || crypto.randomUUID(),
        name: item.DisplayName || item.name || 'Unnamed',
        type: item.Container ? 'folder' : 'document',
        path: item.Path || ''
      }));
      
      setFolders(folderData);
      toast.success(`Found ${folderData.length} folders`);
      
    } catch (error) {
      console.error('Search failed:', error);
      toast.error('Failed to search folders');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5" />
          NetDocuments Integration
          {isConnected && (
            <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
              Connected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>NetDocuments not connected</span>
            </div>
            <Button 
              onClick={connectNetDocs} 
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? 'Connecting...' : 'Connect NetDocuments'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Connected to NetDocuments
              </span>
              <Button 
                onClick={searchFolders}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                {isLoading ? 'Searching...' : 'Refresh Folders'}
              </Button>
            </div>

            {folders.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Available Folders ({folders.length})</h4>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center gap-2 p-2 rounded-lg border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      {folder.type === 'folder' ? (
                        <Folder className="h-4 w-4 text-blue-500" />
                      ) : (
                        <FileText className="h-4 w-4 text-gray-500" />
                      )}
                      <span className="flex-1 text-sm truncate">{folder.name}</span>
                      {folder.path && (
                        <span className="text-xs text-muted-foreground truncate max-w-32">
                          {folder.path}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}