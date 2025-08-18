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

  useEffect(() => {
    document.title = "NetDocs OAuth Callback | Straus Meyers";
    setCanonical(window.location.href);

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (!code || !state) {
      setStatus("error");
      setMessage("Invalid callback parameters. Please retry from the app.");
      return;
    }

    const completeAuth = async () => {
      try {
        const { error } = await supabase.functions.invoke("netdocs-oauth", {
          body: { action: "callback", code, state },
        });
        if (error) throw error;

        setStatus("success");
        setMessage("NetDocs authentication successful. You can close this window.");
        toast({ title: "NetDocs Connected", description: "Authentication completed successfully." });
      } catch (err: any) {
        console.error("NetDocs callback error:", err);
        setStatus("error");
        setMessage("Failed to complete NetDocs authentication. Please try again.");
        toast({ title: "Authentication Failed", description: "Could not finish NetDocs OAuth.", variant: "destructive" });
      } finally {
        // Notify opener and attempt to close after a brief delay
        setTimeout(() => {
          try {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ type: "NETDOCS_OAUTH_COMPLETE" }, "*");
            }
          } catch {}
          window.close();
        }, 1200);
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
            {status !== "processing" && (
              <Button variant="secondary" onClick={() => window.close()}>
                Close Window
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default NetDocsCallback;
