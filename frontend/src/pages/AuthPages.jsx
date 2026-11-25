import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2, MailCheck } from "lucide-react";
import { friendlyAuthError, useAuth } from "../context/AuthContext";

function Shell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <p className="mb-8 text-center font-serif text-3xl">
          Closet <em className="text-rose-deep">Remix</em>
        </p>
        <div className="card p-7 sm:p-8">
          <h1 className="text-3xl">{title}</h1>
          <p className="mb-6 mt-2 text-sm text-ink-soft">{subtitle}</p>
          {children}
        </div>
        <p className="mt-6 text-center text-sm text-ink-soft">{footer}</p>
      </div>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-ink-soft">{label}</span>
      <input className="field" {...props} />
    </label>
  );
}

function useAuthRedirect() {
  const { user, demoMode } = useAuth();
  const location = useLocation();
  return user && !demoMode ? <Navigate to={location.state?.from || "/"} replace /> : null;
}

export function Login() {
  const { signIn, demoMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirect = useAuthRedirect();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (demoMode) return <Navigate to="/" replace />;
  if (redirect) return redirect;

  const submit = async (e) => {
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

  return (
    <Shell
      title="Welcome back"
      subtitle="Sign in to your wardrobe."
      footer={<>New here? <Link to="/register" className="font-medium text-rose-deep underline">Create an account</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="rounded-lg bg-rose-tint px-3 py-2 text-sm text-rose-deep">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
        </button>
      </form>
    </Shell>
  );
}

export function Register() {
  const { signUp, demoMode } = useAuth();
  const navigate = useNavigate();
  const redirect = useAuthRedirect();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  if (demoMode) return <Navigate to="/" replace />;
  if (redirect) return redirect;

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setBusy(true);
    setError(null);
    try {
      const { needsConfirmation } = await signUp(name.trim(), email.trim(), password);
      if (needsConfirmation) setConfirmSent(true);
      else navigate("/", { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  if (confirmSent) {
    return (
      <Shell title="Check your email" subtitle="" footer={<Link to="/login" className="font-medium text-rose-deep underline">Back to sign in</Link>}>
        <div className="flex flex-col items-center text-center">
          <MailCheck className="mb-3 h-8 w-8 text-sage-deep" aria-hidden />
          <p className="text-sm text-ink-soft">We sent a confirmation link to <strong className="text-ink">{email}</strong>. Open it, then sign in.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      title="Create your closet"
      subtitle="Start building your digital wardrobe."
      footer={<>Already have an account? <Link to="/login" className="font-medium text-rose-deep underline">Sign in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Your name" type="text" autoComplete="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password (min. 6 characters)" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p role="alert" className="rounded-lg bg-rose-tint px-3 py-2 text-sm text-rose-deep">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create account
        </button>
      </form>
    </Shell>
  );
}
