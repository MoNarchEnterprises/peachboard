import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient'; // Use shared client

// Simplified AuthContextType - Profile removed
interface AuthContextType {
  session: Session | null;
  user: User | null;
  //figure out how to properly add profile
  loading: boolean;
}

// Create the context with a default value - Profile removed
const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => { // Removed React.FC
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  // Profile state removed
  const [loading, setLoading] = useState(true);

  // fetchProfile function removed

  useEffect(() => {
    setLoading(true);
    // Check initial session ONLY
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      console.log("Initial session check complete (profile logic removed). User:", session?.user ?? null);
    }).catch(error => {
       console.error("Error getting initial session:", error);
       setLoading(false);
    });

    // Listen for auth state changes ONLY (no profile fetch)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log("Auth state changed (profile logic removed):", _event, session);
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    // Cleanup listener on unmount
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const value = {
    session,
    user,
    // profile removed from value
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};