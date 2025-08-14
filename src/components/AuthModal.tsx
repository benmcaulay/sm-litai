import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal = ({ isOpen, onClose }: AuthModalProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<'auth'>('auth');
  const [loading, setLoading] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetPasswordMode, setResetPasswordMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const { toast } = useToast();

  // Check for password reset session
  useEffect(() => {
    const checkForPasswordReset = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && window.location.hash.includes('type=recovery')) {
        setResetPasswordMode(true);
      }
    };
    checkForPasswordReset();
  }, []);


  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log("DEBUG: Attempting sign in with email:", email.trim());
      console.log("DEBUG: Password length:", password.length);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      console.log("DEBUG: Sign in response data:", data);
      console.log("DEBUG: Sign in error:", error);

      if (error) {
        console.log("DEBUG: Full error object:", JSON.stringify(error, null, 2));
        toast({
          title: "Sign In Failed",
          description: `${error.message} (Debug: Email="${email.trim()}", Error Code: ${error.status || 'unknown'})`,
          variant: "destructive",
        });
      } else {
        console.log("DEBUG: Sign in successful, user:", data.user?.email);
        toast({
          title: "Welcome back!",
          description: "You have been signed in successfully.",
        });
        handleClose();
      }
    } catch (error) {
      console.log("DEBUG: Unexpected error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const handleResetPassword = async () => {
    if (!newPassword.trim() || !confirmNewPassword.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter and confirm your new password.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast({
        title: "Password Mismatch", 
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        toast({
          title: "Password Update Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password Updated",
          description: "Your password has been successfully updated.",
        });
        setResetPasswordMode(false);
        handleClose();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter your email address to reset your password.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset`,
      });

      if (error) {
        toast({
          title: "Reset Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Reset Email Sent",
          description: "Check your email for a password reset link.",
        });
        setForgotPasswordMode(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const handleClose = () => {
    setEmail("");
    setPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setStep('auth');
    setForgotPasswordMode(false);
    setResetPasswordMode(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Straus Meyers LLP - Document Automation
          </DialogTitle>
        </DialogHeader>

        {step === 'auth' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sign in to your Straus Meyers LLP account
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="signin-email">Email</Label>
              <Input
                id="signin-email"
                type="email"
                placeholder="you@strausmeyers.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signin-password">Password</Label>
              <Input
                id="signin-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSignIn();
                  }
                }}
              />
            </div>

            <Button 
              onClick={handleSignIn}
              disabled={loading}
              className="w-full"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            <Button 
              variant="ghost"
              onClick={handleForgotPassword}
              disabled={loading}
              className="w-full text-sm"
            >
              Forgot Password?
            </Button>
          </div>
        )}

        {resetPasswordMode && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please enter your new password
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm New Password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                placeholder="Confirm new password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button 
              onClick={handleResetPassword}
              disabled={loading}
              className="w-full"
            >
              {loading ? "Updating Password..." : "Update Password"}
            </Button>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
};