import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { http, setTokenProvider } from "../services/http";

const AuthContext = createContext(null);
const TOKEN_KEY = "kapdeeyy_jwt";

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

/** Decode a base64url JWT payload without verifying it (the server verifies). */
function decodePayload(token) {
  const part = token.split(".")[1];
  const normalised = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
  return JSON.parse(atob(padded));
}

function sessionFromToken(token) {
  const payload = decodePayload(token);
  if (!payload?.sub) throw new Error("Invalid token");
  return {
    access_token: token,
    user: { id: payload.sub, email: payload.email || null },
  };
}

export function friendlyAuthError(err) {
  const msg = (err?.message || "").toLowerCase();
  if (msg.includes("incorrect email or password") || msg.includes("invalid login"))
    return "That email and password don't match.";
  if (msg.includes("already exists") || msg.includes("already registered"))
    return "An account with this email already exists. Try signing in.";
  if (msg.includes("password") && msg.includes("characters"))
    return "Password must be at least 6 characters.";
  if (msg.includes("rate limit")) return "Too many attempts. Please wait a minute and try again.";
  if (msg.includes("network") || msg.includes("econnrefused")) return "Can't reach the server. Is the backend running?";
  return err?.response?.data?.detail || err?.message || "Something went wrong. Please try again.";
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setTokenProvider(async () => getToken());
  }, []);

  useEffect(() => {
    let active = true;
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setSession(sessionFromToken(token));
    } catch {
      clearToken();
      setLoading(false);
      return;
    }
    // Verify the token with the backend and load the profile name.
    (async () => {
      try {
        const res = await http.get("/auth/me");
        if (!active) return;
        setProfile(res.data);
        setSession((current) =>
          current ? { ...current, user: { ...current.user, full_name: res.data.full_name } } : current
        );
      } catch {
        if (!active) return;
        clearToken();
        setSession(null);
        setProfile(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    setBusy(true);
    setError(null);
    try {
      const res = await http.post("/auth/login", { email, password });
      storeToken(res.data.access_token);
      setSession(sessionFromToken(res.data.access_token));
      try {
        const me = await http.get("/auth/me");
        setProfile(me.data);
      } catch {}
    } catch (err) {
      setError(friendlyAuthError(err));
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const signUp = useCallback(async (fullName, email, password) => {
    setBusy(true);
    setError(null);
    try {
      await http.post("/auth/register", { full_name: fullName, email, password });
      // Registration does not return a token; log in to obtain one.
      const res = await http.post("/auth/login", { email, password });
      storeToken(res.data.access_token);
      setSession(sessionFromToken(res.data.access_token));
      setProfile({ id: null, email, full_name: fullName });
    } catch (err) {
      setError(friendlyAuthError(err));
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    clearToken();
    setSession(null);
    setProfile(null);
    setError(null);
  }, []);

  const user = useMemo(() => {
    if (!session?.user) return null;
    const name =
      session.user.full_name ||
      profile?.full_name ||
      session.user.email?.split("@")[0] ||
      "there";
    return {
      id: session.user.id,
      email: session.user.email,
      full_name: name,
      demo: false,
    };
  }, [session, profile]);

  const value = useMemo(
    () => ({ demoMode: false, loading, busy, error, user, signIn, signUp, signOut }),
    [loading, busy, error, user, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
