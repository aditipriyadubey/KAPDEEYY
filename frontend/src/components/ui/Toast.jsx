export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div
      className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 px-4 lg:bottom-6"
      role="status"
      aria-live="polite"
    >
      <div
        className={`max-w-sm animate-slide-up rounded-lg px-4 py-3 text-sm text-white shadow-lift ${
          toast.type === "error" ? "bg-danger" : "bg-ink"
        }`}
      >
        {toast.message}
      </div>
    </div>
  );
}
