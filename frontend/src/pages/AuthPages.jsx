import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { friendlyAuthError, useAuth } from "../context/AuthContext";

function BlueSparkle({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="#58C9F3" className={className}>
      <path d="M12 1L14.5 8.5L22 11L14.5 13.5L12 21L9.5 13.5L2 11L9.5 8.5L12 1Z" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}

export function Login() {
  return <AuthDesktopLanding initialMode="splash" />;
}

export function Register() {
  return <AuthDesktopLanding initialMode="register" />;
}

export function AuthDesktopLanding({ initialMode = "splash" }) {
  const { signIn, signUp, demoMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // "splash" | "login" | "register"
  const [mode, setMode] = useState(initialMode);

  // Form inputs
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signUp(name.trim(), email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-kapdeeyy-pattern min-h-screen flex flex-col justify-between select-none">
      {/* ─── Top Header (Responsive: zero collision on mobile) ─── */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-3 pb-1 sm:py-6 flex items-center justify-between gap-3 z-20">
        {/* Desktop-only duplicate logo (hidden on mobile to prevent clutter and collision) */}
        <div className="hidden sm:flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 shadow-md text-[#54C7EC]">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="bubble-title text-2xl sm:text-3xl font-extrabold uppercase">
            KAPDEEYY
          </span>
        </div>

        {demoMode && (
          <button
            type="button"
            onClick={async () => {
              await signIn("demo@closetremix.local", "password");
              navigate("/");
            }}
            className="ml-auto rounded-full bg-white/95 backdrop-blur-md px-4 py-2 sm:px-5 sm:py-2.5 text-[11px] sm:text-xs font-bold text-[#F46A6A] shadow-md hover:bg-white active:scale-95 transition-all whitespace-nowrap border border-white/60"
          >
            Enter Demo Wardrobe →
          </button>
        )}
      </header>

      {/* ─── Hero Section ─── */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 my-auto flex-1 flex flex-col lg:flex-row items-center justify-between gap-8 sm:gap-12 z-10">
        
        {/* Left Side: Brand Showcase */}
        <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left">
          
          <div className="relative inline-flex items-center">
            <BlueSparkle className="absolute -left-10 -top-4 w-10 h-10 drop-shadow-sm animate-pulse hidden sm:block" />
            <h1 className="bubble-title text-5xl sm:text-7xl lg:text-8xl font-black tracking-wide uppercase select-none">
              KAPDEEYY
            </h1>
            <BlueSparkle className="absolute -right-10 -bottom-2 w-10 h-10 drop-shadow-sm animate-pulse [animation-delay:1s] hidden sm:block" />
          </div>

          <p className="mt-6 text-white text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.2)] max-w-xl leading-snug">
            Your 'Aaj Kya Pehnu?'<br />
            Question Solved!
          </p>

          <p className="mt-4 text-white/90 text-base sm:text-lg font-semibold max-w-md drop-shadow-xs">
            Build your digital wardrobe, discover fresh outfit combinations every morning, and never worry about what to wear again.
          </p>

          {/* Feature Highlights Pills */}
          <div className="mt-8 flex flex-wrap justify-center lg:justify-start gap-3">
            <div className="flex items-center gap-2 rounded-full bg-white/80 backdrop-blur-md px-4 py-2 text-xs font-bold text-ink shadow-sm">
              <CheckCircle2 className="h-4 w-4 text-[#54C7EC]" />
              <span>Smart Outfit Generator</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/80 backdrop-blur-md px-4 py-2 text-xs font-bold text-ink shadow-sm">
              <CheckCircle2 className="h-4 w-4 text-[#F46A6A]" />
              <span>Digital Wardrobe Tracker</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/80 backdrop-blur-md px-4 py-2 text-xs font-bold text-ink shadow-sm">
              <CheckCircle2 className="h-4 w-4 text-[#54C7EC]" />
              <span>Occasion & Weather Styling</span>
            </div>
          </div>
        </div>

        {/* Right Side: Website Card (matching Reference Image 1 UI) */}
        <div className="w-full max-w-md shrink-0">
          
          {/* 1. Splash Action Mode */}
          {mode === "splash" && (
            <div className="rounded-[36px] bg-white/85 backdrop-blur-xl p-8 sm:p-10 shadow-2xl border border-white/60 space-y-5">
              <div className="text-center space-y-2">
                <span className="inline-block rounded-full bg-[#D7F0DC] text-[#215E39] px-3 py-1 text-xs font-extrabold uppercase tracking-wider">
                  Get Started
                </span>
                <h2 className="font-display text-2xl font-black text-ink">
                  Join Your Closet Remix
                </h2>
                <p className="text-sm font-semibold text-black/50">
                  Choose an option below to continue
                </p>
              </div>

              {/* Sky-Blue "Sign Up" Pill Button */}
              <button
                type="button"
                onClick={() => { setMode("register"); setError(null); }}
                className="btn-signup-pill w-full py-4 text-center font-display text-lg font-bold tracking-wide block"
              >
                Sign Up
              </button>

              {/* Light Frosted "Log In" Pill Button */}
              <button
                type="button"
                onClick={() => { setMode("login"); setError(null); }}
                className="btn-login-pill w-full py-4 text-center font-display text-lg font-bold tracking-wide block border border-gray-100"
              >
                Log In
              </button>

              {demoMode && (
                <div className="text-center pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={async () => {
                      await signIn("demo@closetremix.local", "password");
                      navigate("/");
                    }}
                    className="text-xs font-bold text-[#F46A6A] hover:underline"
                  >
                    Quickly Explore with Demo Account →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2. Login Form Mode */}
          {mode === "login" && (
            <div className="rounded-[36px] bg-white/95 backdrop-blur-xl p-8 sm:p-10 shadow-2xl border border-white space-y-5">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setMode("splash"); setError(null); }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-black/60 hover:bg-gray-200"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <span className="font-display font-black text-xl text-[#54C7EC]">KAPDEEYY</span>
              </div>

              <div>
                <h2 className="font-display text-2xl font-bold text-ink">Welcome back ✨</h2>
                <p className="text-xs font-semibold text-black/45 mt-1">Sign in to access your wardrobe.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-black/60 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm focus:border-[#54C7EC] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black/60 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm focus:border-[#54C7EC] focus:bg-white focus:outline-none"
                  />
                </div>

                {error && (
                  <p className="rounded-xl bg-coral-tint p-3 text-xs font-bold text-coral-deep">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="btn-signup-pill w-full py-4 text-center font-display text-base font-bold shadow-md mt-2"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Log In"}
                </button>
              </form>

              <div className="text-center text-xs font-semibold text-black/50">
                New to Kapdeeyy?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("register"); setError(null); }}
                  className="font-bold text-[#54C7EC] underline underline-offset-2"
                >
                  Create an account
                </button>
              </div>
            </div>
          )}

          {/* 3. Register Form Mode */}
          {mode === "register" && (
            <div className="rounded-[36px] bg-white/95 backdrop-blur-xl p-8 sm:p-10 shadow-2xl border border-white space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setMode("splash"); setError(null); }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-black/60 hover:bg-gray-200"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <span className="font-display font-black text-xl text-[#54C7EC]">KAPDEEYY</span>
              </div>

              <div>
                <h2 className="font-display text-2xl font-bold text-ink">Create Account 👗</h2>
                <p className="text-xs font-semibold text-black/45 mt-1">Start building your smart wardrobe.</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-black/60 mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mary"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm focus:border-[#54C7EC] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black/60 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm focus:border-[#54C7EC] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black/60 mb-1">Password (min. 6 characters)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm focus:border-[#54C7EC] focus:bg-white focus:outline-none"
                  />
                </div>

                {error && (
                  <p className="rounded-xl bg-coral-tint p-3 text-xs font-bold text-coral-deep">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="btn-signup-pill w-full py-4 text-center font-display text-base font-bold shadow-md mt-2"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Sign Up"}
                </button>
              </form>

              <div className="text-center text-xs font-semibold text-black/50">
                Already registered?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(null); }}
                  className="font-bold text-[#54C7EC] underline underline-offset-2"
                >
                  Log In
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ─── Desktop Landing Footer ─── */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-4 text-center text-xs font-bold text-white/80 drop-shadow-xs z-10">
        © 2026 KAPDEEYY · Closet Remix. All rights reserved.
      </footer>
    </div>
  );
}
