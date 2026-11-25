export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 px-4 lg:bottom-6" role="status" aria-live="polite">
      <div
        className={`animate-slide-up rounded-2xl px-5 py-3 text-sm font-medium text-white shadow-lg backdrop-blur-md ${
          toast.type === "error" ? "bg-coral-deep" : "bg-ink/90"
        }`}
      >
        {toast.message}
      </div>
    </div>
  );
}
