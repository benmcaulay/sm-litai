import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  user_id: string;
  email: string;
  role: "admin" | "user";
  firm_id: string | null;
}

interface Firm {
  id: string;
  name: string;
  domain: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  firm: Firm | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [firm, setFirm] = useState<Firm | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileData) {
      setProfile(profileData);
      
      if (profileData.firm_id) {
        const { data: firmData } = await supabase
          .from("firms")
          .select("*")
          .eq("id", profileData.firm_id)
          .maybeSingle();
        
        setFirm(firmData);
      }
    }
  };

  const ensureProfile = async (user: User) => {
    try {
      const { data: existing, error: selectError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (selectError) {
        console.warn('Profile select error:', selectError);
      }

      if (!existing) {
        const metadata = user.user_metadata || {};
        const role = (metadata.role === 'admin' || metadata.role === 'user') ? metadata.role : 'user';
        // Always assign to Straus Meyers firm
        const strausMeyersFirmId = '1b783430-ab7f-4305-a394-5da53ae96233';

        const { data: inserted, error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            email: user.email ?? '',
            role,
            firm_id: strausMeyersFirmId,
          })
          .select('*')
          .maybeSingle();

        if (insertError) {
          console.error('Failed to create profile:', insertError);
          return null;
        }

        setProfile(inserted);
        if (inserted?.firm_id) {
          const { data: firmData } = await supabase
            .from('firms')
            .select('*')
            .eq('id', inserted.firm_id)
            .maybeSingle();
          setFirm(firmData);
        } else {
          setFirm(null);
        }
        return inserted;
      } else {
        // If existing profile doesn't have firm_id, update it to Straus Meyers
        if (!existing.firm_id) {
          const strausMeyersFirmId = '1b783430-ab7f-4305-a394-5da53ae96233';
          const { data: updated } = await supabase
            .from('profiles')
            .update({ firm_id: strausMeyersFirmId })
            .eq('user_id', user.id)
            .select('*')
            .maybeSingle();
          
          if (updated) {
            existing.firm_id = strausMeyersFirmId;
          }
        }
        
        setProfile(existing);
        if (existing?.firm_id) {
          const { data: firmData } = await supabase
            .from('firms')
            .select('*')
            .eq('id', existing.firm_id)
            .maybeSingle();
          setFirm(firmData);
        } else {
          setFirm(null);
        }
        return existing;
      }
    } catch (e) {
      console.error('ensureProfile error:', e);
      return null;
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Keep UI in loading state until profile + firm are fully hydrated
          setLoading(true);
          setTimeout(() => {
            ensureProfile(session.user!)
              .finally(() => setLoading(false));
          }, 0);
        } else {
          setProfile(null);
          setFirm(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setLoading(true);
        ensureProfile(session.user)
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setFirm(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      firm,
      loading,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};