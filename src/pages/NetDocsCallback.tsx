import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { setCanonical } from "@/lib/seo";

const NetDocsCallback = () => {
  const { toast } = useToast();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState<string>("Completing NetDocs authentication...");
  const [countdown, setCountdown] = useState(5);

  const redirectToApp = () => {
    window.location.href = '/';
  };

  useEffect(() => {
    document.title = "NetDocs OAuth Callback | LitAI";
    setCanonical(window.location.href);

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");

    if (error) {
      console.error("OAuth error from NetDocs:", error);
      setStatus("error");
      setMessage(`OAuth error: ${error}. You can return to LitAI using the button below.`);
      return;
    }

    if (!code || !state) {
      console.error("Missing callback parameters:", { code: !!code, state: !!state });
      setStatus("error");
      setMessage("Invalid callback parameters. You can return to LitAI using the button below.");
      return;
    }

    const completeAuth = async () => {
      try {
        console.log("Processing NetDocs callback with code:", code.substring(0, 10) + "...");
        
        const { data, error } = await supabase.functions.invoke("netdocs-oauth", {
          body: { action: "callback", code, state },
        });
        
        if (error) {
          console.error("Supabase function error:", error);
          throw error;
        }

        console.log("NetDocs authentication successful:", data);
        setStatus("success");
        setMessage("NetDocs authentication successful! Your database is now connected to LitAI.");
        toast({ title: "NetDocs Connected", description: "Database connection established successfully." });
        
        // If opened as a popup/new tab, notify opener and close this tab
        if (window.opener) {
          try {
            window.opener.postMessage({ type: 'NETDOCS_AUTH_COMPLETE', status: 'success' }, window.location.origin);
          } catch {}
          setMessage("Authentication complete. You can close this tab.");
          setTimeout(() => window.close(), 300);
        } else {
          // Fallback: Start countdown for automatic redirect
          let timeLeft = 5;
          const countdownInterval = setInterval(() => {
            timeLeft -= 1;
            setCountdown(timeLeft);
            if (timeLeft <= 0) {
              clearInterval(countdownInterval);
              redirectToApp();
            }
          }, 1000);
        }
        
      } catch (err: any) {
        console.error("NetDocs callback error:", err);
        setStatus("error");
        setMessage(`Authentication failed: ${err.message || "Unknown error"}. You can return to LitAI using the button below.`);
        toast({ title: "Authentication Failed", description: "Could not complete NetDocs authentication.", variant: "destructive" });
        if (window.opener) {
          try {
            window.opener.postMessage({ type: 'NETDOCS_AUTH_COMPLETE', status: 'error', message: err?.message || 'Unknown error' }, window.location.origin);
          } catch {}
          setTimeout(() => window.close(), 300);
        }
      }
    };

    completeAuth();
  }, [toast]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-steel-blue-800">NetDocs Authentication</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-steel-blue-700">
            <p>{message}</p>
            
            {status === "success" && (
              <p className="text-sm text-steel-blue-600">
                Redirecting automatically in {countdown} seconds...
              </p>
            )}
            
            {status === "processing" && (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-steel-blue-600"></div>
                <span className="text-sm">Processing...</span>
              </div>
            )}
            
            {status !== "processing" && (
              <Button 
                variant={status === "success" ? "default" : "secondary"} 
                onClick={redirectToApp}
                className="w-full"
              >
                {status === "success" ? "Return to LitAI Now" : "Return to LitAI"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default NetDocsCallback;
