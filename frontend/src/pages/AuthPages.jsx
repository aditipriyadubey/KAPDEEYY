import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { friendlyAuthError, useAuth } from "../context/AuthContext";

const POINTS = [
  {
    title: "A wardrobe you can see",
    body: "Upload your pieces once and keep every detail in one place.",
  },
  {
    title: "Outfits for the occasion",
    body: "Real combinations built from the clothes you already own.",
  },
  {
    title: "A record of what you wear",
    body: "See your favourites and the pieces that never leave the closet.",
  },
];

function BrandMark({ inverted = false }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5">
      <span
        className={`flex h-7 w-7 items-center justify-center rounded text-[12px] font-semibold ${
          inverted ? "bg-white text-ink" : "bg-ink text-white"
        }`}
      >
        K
      </span>
      <span
        className={`font-display text-base font-normal uppercase tracking-[0.22em] ${
          inverted ? "text-white" : "text-ink"
        }`}
      >
        Kapdeeyy
      </span>
    </Link>
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

  const enterDemo = async () => {
    await signIn("demo@closetremix.local", "password");
    navigate("/");
  };

  const switchMode = (next) => {
    setMode(next);
    setError(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink lg:flex-row">
      {/* ─── Editorial brand panel (desktop) ─── */}
      <aside className="hidden bg-ink p-10 lg:flex lg:w-[46%] lg:flex-col lg:justify-between xl:p-14">
        <BrandMark inverted />

        <div className="max-w-md py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
            Personal styling
          </p>
          <h2 className="mt-4 font-display text-4xl font-normal leading-[1.15] tracking-tight text-white xl:text-5xl">
            Your wardrobe,
            <br />
            styled.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/65">
            Kapdeeyy turns the clothes you own into outfits you will actually
            wear — for class, work, dinner or wherever the day goes.
          </p>

          <ol className="mt-10 space-y-6 border-t border-white/15 pt-8">
            {POINTS.map((point, index) => (
              <li key={point.title} className="flex gap-4">
                <span className="mt-0.5 font-display text-sm text-white/40">
                  0{index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{point.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/55">
                    {point.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="text-[11px] text-white/40">
          © 2026 Kapdeeyy. All rights reserved.
        </p>
      </aside>

      {/* ─── Form panel ─── */}
      <main className="flex flex-1 flex-col">
        <div className="flex items-center justify-between px-5 py-5 sm:px-8 lg:hidden">
          <BrandMark />
          {mode !== "splash" && (
            <button
              type="button"
              onClick={() => switchMode("splash")}
              className="text-xs font-medium text-ink-soft hover:text-ink"
            >
              Back
            </button>
          )}
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
          <div className="w-full max-w-sm">
            {demoMode && (
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  onClick={enterDemo}
                  className="text-[11px] font-medium text-accent hover:underline"
                >
                  Enter demo wardrobe
                </button>
              </div>
            )}

            {/* 1. Splash mode */}
            {mode === "splash" && (
              <div className="space-y-6">
                <div>
                  <p className="eyebrow">Account</p>
                  <h1 className="mt-2 font-display text-3xl font-normal tracking-tight text-ink">
                    Welcome to Kapdeeyy
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                    Sign in to your wardrobe, or create an account to start
                    building one.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className="btn-primary w-full"
                  >
                    Create account
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="btn-secondary w-full"
                  >
                    Sign in
                  </button>
                </div>

                <ul className="space-y-3 border-t border-line pt-6">
                  {POINTS.map((point) => (
                    <li key={point.title} className="text-xs leading-relaxed text-ink-soft">
                      <span className="font-semibold text-ink">{point.title}.</span>{" "}
                      {point.body}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 2. Login mode */}
            {mode === "login" && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => switchMode("splash")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-soft transition-colors hover:text-ink"
                    aria-label="Back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <p className="eyebrow">Sign in</p>
                    <h1 className="font-display text-2xl font-normal tracking-tight text-ink">
                      Welcome back
                    </h1>
                  </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label htmlFor="login-email" className="mb-1.5 block text-xs font-medium text-ink-soft">
                      Email
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="field"
                    />
                  </div>

                  <div>
                    <label htmlFor="login-password" className="mb-1.5 block text-xs font-medium text-ink-soft">
                      Password
                    </label>
                    <input
                      id="login-password"
                      type="password"
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="field"
                    />
                  </div>

                  {error && (
                    <p className="rounded-lg border border-danger/20 bg-danger-tint p-3 text-xs font-medium text-danger">
                      {error}
                    </p>
                  )}

                  <button type="submit" disabled={busy} className="btn-primary w-full">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                  </button>
                </form>

                <div className="flex items-center justify-between border-t border-line pt-4 text-xs">
                  <span className="text-ink-soft">New to Kapdeeyy?</span>
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className="font-medium text-accent hover:underline"
                  >
                    Create an account
                  </button>
                </div>
              </div>
            )}

            {/* 3. Register mode */}
            {mode === "register" && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => switchMode("splash")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-soft transition-colors hover:text-ink"
                    aria-label="Back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <p className="eyebrow">Create account</p>
                    <h1 className="font-display text-2xl font-normal tracking-tight text-ink">
                      Start your wardrobe
                    </h1>
                  </div>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label htmlFor="register-name" className="mb-1.5 block text-xs font-medium text-ink-soft">
                      Full name
                    </label>
                    <input
                      id="register-name"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="field"
                    />
                  </div>

                  <div>
                    <label htmlFor="register-email" className="mb-1.5 block text-xs font-medium text-ink-soft">
                      Email
                    </label>
                    <input
                      id="register-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="field"
                    />
                  </div>

                  <div>
                    <label htmlFor="register-password" className="mb-1.5 block text-xs font-medium text-ink-soft">
                      Password
                    </label>
                    <input
                      id="register-password"
                      type="password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="field"
                    />
                  </div>

                  {error && (
                    <p className="rounded-lg border border-danger/20 bg-danger-tint p-3 text-xs font-medium text-danger">
                      {error}
                    </p>
                  )}

                  <button type="submit" disabled={busy} className="btn-primary w-full">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                  </button>
                </form>

                <div className="flex items-center justify-between border-t border-line pt-4 text-xs">
                  <span className="text-ink-soft">Already registered?</span>
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="font-medium text-accent hover:underline"
                  >
                    Sign in
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
