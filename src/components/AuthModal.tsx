import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal = ({ isOpen, onClose }: AuthModalProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firmName, setFirmName] = useState("");
  const [selectedFirmId, setSelectedFirmId] = useState("");
  const [firms, setFirms] = useState<Array<{id: string, name: string}>>([]);
  const [step, setStep] = useState<'auth' | 'otp'>('auth');
  const [otp, setOtp] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
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

  // Load firms for autocomplete
  useEffect(() => {
    const loadFirms = async () => {
      if (firmName.length > 1) {
        const { data } = await supabase
          .from("firms")
          .select("id, name")
          .ilike("name", `%${firmName}%`)
          .limit(5);
        setFirms(data || []);
      } else {
        setFirms([]);
      }
    };
    loadFirms();
  }, [firmName]);

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

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim() || !selectedFirmId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields and select your firm.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Create user account with email confirmation disabled
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            firm_id: selectedFirmId,
            role: 'user'
          }
        }
      });

      if (error) {
        toast({
          title: "Sign Up Failed",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (data.user) {
        // Only try to create profile if user was actually created and confirmed
        if (data.user.email_confirmed_at) {
          // User is confirmed, create profile
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              user_id: data.user.id,
              email: email,
              role: 'user',
              firm_id: selectedFirmId,
            });

          if (profileError) {
            console.log("Profile creation error (may already exist):", profileError);
            // Don't fail the signup if profile already exists
          }

          toast({
            title: "Welcome!",
            description: "Your account has been created successfully.",
          });
          handleClose();
        } else {
          // User needs email confirmation
          toast({
            title: "Check Your Email",
            description: "Please click the confirmation link in your email to complete registration, then try signing in.",
          });
          handleClose();
        }
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

  const verifyOtp = async () => {
    if (!otp.trim() || otp.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-digit verification code.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Temporary OTP bypass for testing - simulate successful verification
      if (otp === "123456") {
        // Mock the successful OTP verification response
        const mockUser = {
          id: `test-user-${Date.now()}`,
          email: email,
          email_confirmed_at: new Date().toISOString(),
        };

        // Create user profile directly
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            user_id: mockUser.id,
            email: email,
            role: 'user',
            firm_id: selectedFirmId,
          });

        if (profileError) {
          console.log("Profile creation error:", profileError);
          toast({
            title: "Error",
            description: "Failed to create user profile. Please contact support.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Welcome!",
          description: "Your account has been created successfully (test mode).",
        });
        handleClose();
        return;
      }

      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'signup'
      });

      if (error) {
        toast({
          title: "Invalid Code",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        // Create user profile
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            user_id: data.user.id,
            email: email,
            role: 'user',
            firm_id: selectedFirmId,
          });

        if (profileError) {
          toast({
            title: "Error",
            description: "Failed to create user profile. Please contact support.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Welcome!",
          description: "Your account has been created successfully.",
        });
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

  // Allow users to resend the confirmation email if they didn't receive it
  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      toast({
        title: "Email Required",
        description: "Enter your email above, then tap Resend.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        toast({
          title: "Resend Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Confirmation Email Sent",
          description: `We've re-sent a confirmation link to ${email.trim()}.`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred while resending. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFirmName("");
    setSelectedFirmId("");
    setOtp("");
    setNewPassword("");
    setConfirmNewPassword("");
    setStep('auth');
    setIsSignUp(false);
    setForgotPasswordMode(false);
    setResetPasswordMode(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {step === 'otp' ? 'Verify Email' : 'LitAI Authentication'}
          </DialogTitle>
        </DialogHeader>

        {step === 'auth' && (
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup" onClick={() => setIsSignUp(true)}>Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Sign in to your LitAI account
              </p>
              
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="you@lawfirm.com"
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
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Join your firm's LitAI account
              </p>
              
              <div className="space-y-2">
                <Label htmlFor="firm-search">Firm Name</Label>
                <div className="relative">
                  <Input
                    id="firm-search"
                    type="text"
                    placeholder="Start typing your firm name..."
                    value={firmName}
                    onChange={(e) => setFirmName(e.target.value)}
                    disabled={loading}
                  />
                  {firms.length > 0 && firmName.length > 1 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                      {firms.map((firm) => (
                        <div
                          key={firm.id}
                          className="px-3 py-2 hover:bg-accent hover:text-accent-foreground cursor-pointer"
                          onClick={() => {
                            setFirmName(firm.name);
                            setSelectedFirmId(firm.id);
                            setFirms([]); // Clear dropdown after selection
                          }}
                        >
                          {firm.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@lawfirm.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              <Button 
                onClick={handleSignUp}
                disabled={loading || !selectedFirmId}
                className="w-full"
              >
                {loading ? "Creating account..." : "Sign Up"}
              </Button>

              <Button
                variant="outline"
                onClick={handleResendConfirmation}
                disabled={loading || !email.trim()}
                className="w-full"
              >
                {loading ? "Sending..." : "Resend confirmation email"}
              </Button>
            </TabsContent>
          </Tabs>
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

        {step === 'otp' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit verification code sent to {email}
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                type="text"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={loading}
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
            </div>

            <div className="space-y-2">
              <Button 
                onClick={verifyOtp}
                disabled={loading || otp.length !== 6}
                className="w-full"
              >
                {loading ? "Verifying..." : "Verify & Complete Sign Up"}
              </Button>
              
              <Button 
                variant="ghost"
                onClick={() => setStep('auth')}
                disabled={loading}
                className="w-full"
              >
                Back to Sign Up
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};