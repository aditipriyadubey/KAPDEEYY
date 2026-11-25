
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authConfigured, supabase } from "../services/supabase";
import { setTokenProvider } from "../services/http";
import { getProfile } from "../services/api";

const AuthContext = createContext(null);

const DEMO_USER = {
  id: "demo",
  email: "demo@closetremix.local",
  full_name: "Aditi Sharma",
  demo: true,
};

function toUser(session) {
  const u = session?.user;
  if (!u) return null;

  return {
    id: u.id,
    email: u.email,
    full_name: u.user_metadata?.full_name || u.email?.split("@")[0] || "there",
    demo: false,
  };
}

export function friendlyAuthError(err) {
  const msg = (err?.message || "").toLowerCase();
  if (msg.includes("invalid login")) return "That email and password don't match.";
  if (msg.includes("already registered")) return "An account with this email already exists. Try signing in.";
  if (msg.includes("email not confirmed")) return "Please confirm your email first — check your inbox.";
  if (msg.includes("password") && msg.includes("characters")) return "Password must be at least 6 characters.";
  if (msg.includes("rate limit")) return "Too many attempts. Please wait a minute and try again.";
  if (msg.includes("fetch") || msg.includes("network")) return "Can't reach the server. Check your connection.";
  return err?.message || "Something went wrong. Please try again.";
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(authConfigured);
  const [demoLoggedIn, setDemoLoggedIn] = useState(() => {
    return localStorage.getItem("closet_remix_demo_auth") === "true";
  });

  useEffect(() => {
    if (!authConfigured) return undefined;

    let active = true;

    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      if (error) {
        setLoading(false);
        return;
      }

      setSession(data.session);
      setLoading(false);
    };

    loadSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      if (!next) setProfile(null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setTokenProvider(async () => {
      if (!authConfigured) return null;
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    });
  }, []);

  useEffect(() => {
    let active = true;

    if (!authConfigured || !session?.user) {
      setProfile(null);
      return undefined;
    }

    const loadProfile = async () => {
      try {
        const data = await getProfile();
        if (active) setProfile(data);
      } catch (error) {
        console.error("Could not load backend profile:", error);
        if (active) setProfile(null);
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const signIn = useCallback(async (email, password) => {
    if (!authConfigured) {
      setDemoLoggedIn(true);
      localStorage.setItem("closet_remix_demo_auth", "true");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (fullName, email, password) => {
    if (!authConfigured) {
      setDemoLoggedIn(true);
      localStorage.setItem("closet_remix_demo_auth", "true");
      return { needsConfirmation: false };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    if (authConfigured) {
      await supabase.auth.signOut();
    } else {
      setDemoLoggedIn(false);
      localStorage.removeItem("closet_remix_demo_auth");
    }
  }, []);

  const user = useMemo(() => {
    if (!authConfigured) {
      return demoLoggedIn ? DEMO_USER : null;
    }

    const baseUser = toUser(session);
    if (!baseUser) return null;

    return profile ? { ...baseUser, ...profile, demo: false } : baseUser;
  }, [session, profile, demoLoggedIn]);

  const value = useMemo(
    () => ({
      demoMode: !authConfigured,
      loading,
      user,
      signIn,
      signUp,
      signOut,
    }),
    [user, loading, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
