import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Reset Password Page
// - Handles Supabase recovery links and lets the user set a new password
// - Works with both `?code=` links and `#type=recovery` hash links

const parseHashParams = (hash: string) => {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return Object.fromEntries(params.entries());
};

const setMeta = (title: string, description: string, canonicalPath: string) => {
  document.title = title;
  const existingDesc = document.querySelector('meta[name="description"]');
  if (existingDesc) existingDesc.setAttribute("content", description);
  else {
    const m = document.createElement("meta");
    m.name = "description";
    m.content = description;
    document.head.appendChild(m);
  }
  const link = document.querySelector("link[rel=canonical]") as HTMLLinkElement | null;
  if (link) link.href = `${window.location.origin}${canonicalPath}`;
  else {
    const l = document.createElement("link");
    l.rel = "canonical";
    l.href = `${window.location.origin}${canonicalPath}`;
    document.head.appendChild(l);
  }
};

const ResetPassword = () => {
  const { toast } = useToast();
  const [ready, setReady] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const isValid = useMemo(() => newPassword.length >= 6 && newPassword === confirm, [newPassword, confirm]);

  useEffect(() => {
    setMeta(
      "Reset Password | LitAI Legal Automation",
      "Reset your LitAI account password securely.",
      "/reset"
    );

    const init = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) console.warn("exchangeCodeForSession error", error.message);
        } else if (window.location.hash.includes("type=recovery")) {
          // Attempt to set session from hash tokens if present
          const params = parseHashParams(window.location.hash);
          const access_token = params["access_token"];
          const refresh_token = params["refresh_token"];
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) console.warn("setSession error", error.message);
          }
        }
      } finally {
        setReady(true);
      }
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleUpdate = async () => {
    if (!isValid) {
      toast({ title: "Invalid password", description: "Passwords must match and be at least 6 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast({ title: "Update failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Password updated", description: "You can now sign in with your new password." });
      // Optional: sign out recovery session for safety
      await supabase.auth.signOut();
      window.location.replace("/");
    } catch (e: any) {
      toast({ title: "Error", description: e.message ?? "Unexpected error" , variant: "destructive"});
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-steel-blue-50 to-steel-blue-100 flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-white/90 border-steel-blue-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Reset your password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!ready ? (
            <p className="text-sm text-muted-foreground">Preparing secure reset…</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="new">New password</Label>
                <Input id="new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handleUpdate} disabled={!isValid || loading}>
                {loading ? "Updating…" : "Update Password"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => (window.location.href = "/")}>Back to home</Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default ResetPassword;
