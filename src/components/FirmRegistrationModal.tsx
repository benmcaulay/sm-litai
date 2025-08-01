import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

interface FirmRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirmRegistrationModal = ({ isOpen, onClose }: FirmRegistrationModalProps) => {
  const [step, setStep] = useState<'info' | 'otp'>('info');
  const [firmName, setFirmName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const sendOtp = async () => {
    if (!firmName.trim() || !email.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both firm name and email address.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Extract domain from email
      const domain = email.split('@')[1];
      
      // Check if firm with this domain already exists
      const { data: existingFirm } = await supabase
        .from("firms")
        .select("*")
        .eq("domain", domain)
        .maybeSingle();

      if (existingFirm) {
        toast({
          title: "Firm Already Exists",
          description: "A firm with this email domain is already registered.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Generate 6-digit OTP
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Send OTP via Supabase Auth with custom email template
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          data: {
            otp_code: generatedOtp,
            firm_name: firmName,
            domain: domain,
            role: 'admin'
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Store the generated OTP for verification (in production, this would be server-side)
        sessionStorage.setItem('firmRegistrationOtp', generatedOtp);
        sessionStorage.setItem('firmRegistrationEmail', email);
        sessionStorage.setItem('firmRegistrationFirm', firmName);
        
        setStep('otp');
        toast({
          title: "Verification Code Sent",
          description: `Please check your email for the 6-digit verification code: ${generatedOtp}`,
        });
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
        description: "Please enter the complete 6-digit verification code.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get stored OTP for verification (in production, this would be server-side)
      const storedOtp = sessionStorage.getItem('firmRegistrationOtp');
      const storedEmail = sessionStorage.getItem('firmRegistrationEmail');
      const storedFirmName = sessionStorage.getItem('firmRegistrationFirm');

      if (!storedOtp || storedEmail !== email || storedFirmName !== firmName) {
        toast({
          title: "Session Expired",
          description: "Please restart the registration process.",
          variant: "destructive",
        });
        setStep('info');
        setLoading(false);
        return;
      }

      if (otp !== storedOtp) {
        toast({
          title: "Invalid Code",
          description: "The verification code you entered is incorrect.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Clear stored data
      sessionStorage.removeItem('firmRegistrationOtp');
      sessionStorage.removeItem('firmRegistrationEmail');
      sessionStorage.removeItem('firmRegistrationFirm');

      const domain = email.split('@')[1];
      
      // Create the firm (authentication temporarily bypassed)
      const { data: newFirm, error: firmError } = await supabase
        .from("firms")
        .insert({
          name: firmName,
          domain: domain,
        })
        .select()
        .single();

      if (firmError) {
        console.error("Firm creation error:", firmError);
        toast({
          title: "Error",
          description: `Failed to create firm: ${firmError.message}`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      toast({
        title: "Firm Created Successfully!",
        description: `${firmName} has been registered. You can now sign in with your email.`,
      });

      // Reset form and close modal
      setStep('info');
      setFirmName("");
      setEmail("");
      setOtp("");
      onClose();
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
    setStep('info');
    setFirmName("");
    setEmail("");
    setOtp("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">
              Register Your Firm
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {step === 'info' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Set up your firm's LitAI account with your work email
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="firmName">Firm Name</Label>
              <Input
                id="firmName"
                type="text"
                placeholder="Your Law Firm Name"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Admin Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@lawfirm.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button 
              onClick={sendOtp}
              disabled={loading}
              className="w-full"
            >
              {loading ? "Sending..." : "Send Verification Code"}
            </Button>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the verification code sent to {email}
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                type="text"
                placeholder="Enter 6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={loading}
                maxLength={6}
              />
            </div>

            <div className="space-y-2">
              <Button 
                onClick={verifyOtp}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Verifying..." : "Verify & Create Firm"}
              </Button>
              
              <Button 
                variant="ghost"
                onClick={() => setStep('info')}
                disabled={loading}
                className="w-full"
              >
                Back to Firm Info
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};