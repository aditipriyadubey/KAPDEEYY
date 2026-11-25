export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 px-4" role="status" aria-live="polite">
      <div
        className={`fade-up rounded-full px-5 py-2.5 text-sm text-white shadow-lg ${
          toast.type === "error" ? "bg-rose-deep" : "bg-ink"
        }`}
      >
        {toast.message}
      </div>
    </div>
  );
}
