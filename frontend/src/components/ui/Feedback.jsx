import { AlertTriangle, Loader2 } from "lucide-react";

export function Spinner({ label = "Loading" }) {
  return (
    <div
      className="flex items-center justify-center gap-2 py-16 text-sm text-ink-soft"
      role="status"
    >
      <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden />
      {label}…
    </div>
  );
}

export function CardSkeleton({ count = 3, tall = false }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`skeleton rounded-xl ${tall ? "h-96" : "h-64"}`}
        />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      {Icon && (
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-canvas text-ink-soft">
          <Icon className="h-5 w-5" strokeWidth={1.7} aria-hidden />
        </span>
      )}
      <h3 className="font-display text-lg font-normal tracking-tight text-ink">
        {title}
      </h3>
      {message && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-soft">
          {message}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = "Something went wrong.", onRetry }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center" role="alert">
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-danger/20 bg-danger-tint text-danger">
        <AlertTriangle className="h-5 w-5" strokeWidth={1.7} aria-hidden />
      </span>
      <h3 className="font-display text-lg font-normal tracking-tight text-ink">
        We couldn't load that
      </h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-soft">
        {message}
      </p>
      {onRetry && (
        <button type="button" className="btn-secondary mt-5 py-2 text-xs" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
