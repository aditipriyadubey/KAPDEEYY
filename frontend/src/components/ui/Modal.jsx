import { useEffect } from "react";
import { X } from "lucide-react";

export default function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`animate-slide-up relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl bg-line/60 text-ink-soft hover:bg-line hover:text-ink transition-colors" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
