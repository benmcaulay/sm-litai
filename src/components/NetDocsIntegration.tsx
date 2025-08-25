import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Folder, FileText, ExternalLink, AlertCircle, Search, Download, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NetDocsItem {
  id: string;
  name: string;
  type: 'folder' | 'document' | 'cabinet';
  path?: string;
  ext?: string;
  size?: number;
  version?: string;
  modified?: string;
}

interface NetDocsCabinet {
  id: string;
  name: string;
  type: 'cabinet';
}

interface PathItem {
  id: string;
  name: string;
}

export function NetDocsIntegration() {
  const [isConnected, setIsConnected] = useState(false);
  const [cabinets, setCabinets] = useState<NetDocsCabinet[]>([]);
  const [currentItems, setCurrentItems] = useState<NetDocsItem[]>([]);
  const [currentPath, setCurrentPath] = useState<PathItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<NetDocsItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('netdocs-cabinets');
      
      if (!error && data && !data.error) {
        setIsConnected(true);
        setCabinets(data.cabinets || []);
        setCurrentItems(data.cabinets || []);
        setCurrentPath([]);
      } else {
        setIsConnected(false);
        setCabinets([]);
        setCurrentItems([]);
      }
    } catch (error) {
      console.error('Failed to check NetDocs connection:', error);
      setIsConnected(false);
      setCabinets([]);
      setCurrentItems([]);
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

      // Call netdocs-oauth with authorize action
      const { data, error } = await supabase.functions.invoke('netdocs-oauth', {
        body: { action: 'authorize' }
      });

      if (error || !data?.authUrl) {
        toast.error('Failed to initialize NetDocs authorization');
        setIsConnecting(false);
        return;
      }

      // Open authorization URL in popup window
      const popup = window.open(
        data.authUrl,
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

  const loadFolderContents = async (folderId: string, folderName: string) => {
    if (!isConnected) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('netdocs-folder-contents', {
        body: { folderId }
      });

      if (error) {
        toast.error('Failed to load folder contents');
        return;
      }

      setCurrentItems(data.items || []);
      setCurrentPath([...currentPath, { id: folderId, name: folderName }]);
      
    } catch (error) {
      console.error('Failed to load folder contents:', error);
      toast.error('Failed to load folder contents');
    } finally {
      setIsLoading(false);
    }
  };

  const searchDocuments = async () => {
    if (!isConnected || !searchQuery.trim()) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('netdocs-document-search', {
        body: { 
          query: searchQuery,
          includeDocuments: true,
          includeFolders: true
        }
      });

      if (error) {
        toast.error('Search failed');
        return;
      }

      setCurrentItems(data.results || []);
      setCurrentPath([{ id: 'search', name: `Search: ${searchQuery}` }]);
      toast.success(`Found ${data.results?.length || 0} items`);
      
    } catch (error) {
      console.error('Search failed:', error);
      toast.error('Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateBack = () => {
    if (currentPath.length === 0) {
      setCurrentItems(cabinets);
      return;
    }
    
    const newPath = currentPath.slice(0, -1);
    setCurrentPath(newPath);
    
    if (newPath.length === 0) {
      setCurrentItems(cabinets);
    } else {
      // Load parent folder contents
      const parentFolder = newPath[newPath.length - 1];
      loadFolderContents(parentFolder.id, parentFolder.name);
    }
  };

  const handleItemClick = (item: NetDocsItem) => {
    if (item.type === 'folder' || item.type === 'cabinet') {
      loadFolderContents(item.id, item.name);
    } else if (item.type === 'document') {
      setSelectedDocument(item);
      toast.success(`Selected: ${item.name}`);
    }
  };

  const downloadDocument = async (documentId: string, fileName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('netdocs-document-download', {
        body: { documentId }
      });

      if (error) {
        toast.error('Failed to download document');
        return;
      }

      // Create download link
      const blob = new Blob([data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Document downloaded');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Download failed');
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
            {/* Search Bar */}
            <div className="flex gap-2">
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchDocuments()}
              />
              <Button 
                onClick={searchDocuments}
                disabled={isLoading || !searchQuery.trim()}
                size="sm"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {/* Breadcrumb Navigation */}
            {currentPath.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={navigateBack}
                  className="p-1 h-auto"
                >
                  ← Back
                </Button>
                <span>/</span>
                {currentPath.map((pathItem, index) => (
                  <span key={index} className="flex items-center gap-1">
                    {index > 0 && <ChevronRight className="h-3 w-3" />}
                    <span className="truncate max-w-32">{pathItem.name}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Selected Document Display */}
            {selectedDocument && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-900 dark:text-blue-100">
                      Selected: {selectedDocument.name}
                    </span>
                  </div>
                  <Button
                    onClick={() => downloadDocument(selectedDocument.id, selectedDocument.name)}
                    size="sm"
                    variant="outline"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
            )}

            {/* File/Folder List */}
            {currentItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">
                  {currentPath.length === 0 ? 'Cabinets' : 'Contents'} ({currentItems.length})
                </h4>
                <div className="max-h-96 overflow-y-auto space-y-1">
                  {currentItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 p-2 rounded-lg border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                      onClick={() => handleItemClick(item)}
                    >
                      {item.type === 'folder' || item.type === 'cabinet' ? (
                        <Folder className="h-4 w-4 text-blue-500" />
                      ) : (
                        <FileText className="h-4 w-4 text-gray-500" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{item.name}</div>
                        {item.ext && (
                          <div className="text-xs text-muted-foreground">
                            {item.ext}
                            {item.size && ` • ${Math.round(item.size / 1024)}KB`}
                            {item.modified && ` • ${new Date(item.modified).toLocaleDateString()}`}
                          </div>
                        )}
                      </div>
                      {item.type === 'document' && selectedDocument?.id === item.id && (
                        <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                          Selected
                        </Badge>
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