import { AlertTriangle, Loader2 } from "lucide-react";

export function Spinner({ label = "Loading" }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-soft" role="status">
      <Loader2 className="h-5 w-5 animate-spin text-coral" aria-hidden /> {label}…
    </div>
  );
}

export function CardSkeleton({ count = 3, tall = false }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`skeleton rounded-3xl ${tall ? "h-96" : "h-64"}`} />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      {Icon && (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-coral-tint text-coral">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
      )}
      <h3 className="font-display text-xl font-bold">{title}</h3>
      {message && <p className="mt-2 max-w-md text-sm text-ink-soft">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = "Something went wrong.", onRetry }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center" role="alert">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-coral-tint text-coral-deep">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="font-display text-xl font-bold">We couldn't load that</h3>
      <p className="mt-2 max-w-md text-sm text-ink-soft">{message}</p>
      {onRetry && (
        <button type="button" className="btn-secondary mt-6" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
