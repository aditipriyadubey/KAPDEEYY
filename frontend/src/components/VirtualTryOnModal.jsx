import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Loader2,
  Sparkles,
  VideoOff,
} from "lucide-react";
import GarmentImage from "./ui/GarmentImage";

/**
 * Virtual Try-On Coming Soon.
 *
 * This is deliberately a preview only: the camera feed is shown as-is and no
 * body detection, garment overlay or fitting happens. The copy must never
 * suggest otherwise.
 */
export default function VirtualTryOnModal({ open, outfit, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  // idle | requesting | live | denied | unavailable | unsupported
  const [status, setStatus] = useState("idle");

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setStatus("idle");
      return undefined;
    }

    let cancelled = false;
    setStatus("requesting");

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setStatus("live");
      } catch (err) {
        if (cancelled) return;
        const name = err?.name || "";
        const denied = ["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(name);
        setStatus(denied ? "denied" : "unavailable");
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, stopStream]);

  useEffect(() => {
    if (status === "live" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      const played = videoRef.current.play();
      if (played && typeof played.catch === "function") played.catch(() => {});
    }
  }, [status]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const items = outfit?.items || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Virtual Try-On"
    >
      <div className="relative flex max-h-[94vh] w-full animate-slide-up flex-col overflow-y-auto rounded-t-xl border border-line bg-surface shadow-lift sm:max-w-2xl sm:rounded-xl">
        {/* ─── Header ─── */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="-ml-1 flex items-center gap-1.5 rounded p-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="text-center">
            <p className="eyebrow">Preview</p>
            <p className="font-display text-sm tracking-tight text-ink">Virtual Try-On</p>
          </div>

          <span className="rounded-full border border-accent/30 bg-accent-tint px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
            Coming soon
          </span>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          {/* ─── Camera frame ─── */}
          <div className="relative overflow-hidden rounded-xl border border-line bg-ink">
            <div className="relative aspect-[3/4] w-full sm:aspect-[4/3]">
              <video
                ref={videoRef}
                className={`h-full w-full object-cover transition-opacity duration-500 ${
                  status === "live" ? "opacity-100 [transform:scaleX(-1)]" : "opacity-0"
                }`}
                playsInline
                muted
                autoPlay
                aria-label="Live camera preview"
              />

              {status !== "live" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink px-6 text-center text-white/80">
                  {status === "requesting" ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin text-white/70" />
                      <p className="text-sm">Requesting camera access…</p>
                      <p className="max-w-xs text-[11px] leading-relaxed text-white/50">
                        Your browser will ask for permission. The preview stays on
                        this device and is never uploaded.
                      </p>
                    </>
                  ) : status === "denied" ? (
                    <>
                      <CameraOff className="h-6 w-6 text-white/70" />
                      <p className="text-sm font-medium text-white">Camera access is off</p>
                      <p className="max-w-xs text-[11px] leading-relaxed text-white/55">
                        No problem — nothing is broken. Allow camera access from the
                        address bar and reopen this screen, or keep browsing your looks.
                      </p>
                    </>
                  ) : status === "unsupported" ? (
                    <>
                      <VideoOff className="h-6 w-6 text-white/70" />
                      <p className="text-sm font-medium text-white">No camera support</p>
                      <p className="max-w-xs text-[11px] leading-relaxed text-white/55">
                        This browser cannot open a camera preview. You can still use
                        every other part of your wardrobe.
                      </p>
                    </>
                  ) : status === "unavailable" ? (
                    <>
                      <VideoOff className="h-6 w-6 text-white/70" />
                      <p className="text-sm font-medium text-white">Camera unavailable</p>
                      <p className="max-w-xs text-[11px] leading-relaxed text-white/55">
                        No camera was found, or another app is using it. Close the other
                        app and reopen this screen.
                      </p>
                    </>
                  ) : null}
                </div>
              )}

              {status === "live" && (
                <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-ink/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Live camera
                </span>
              )}
            </div>
          </div>

          {/* ─── Coming soon panel ─── */}
          <div className="rounded-xl border border-line bg-canvas p-5 text-center">
            <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-accent">
              <Sparkles className="h-4 w-4" strokeWidth={1.7} />
            </span>
            <h2 className="font-display text-xl font-normal tracking-tight text-ink">
              Virtual Try-On Coming Soon
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-soft">
              We're working on bringing your outfits to life. Stay tuned!
            </p>
            <p className="mx-auto mt-3 max-w-sm text-[11px] leading-relaxed text-ink-faint">
              {status === "live"
                ? "This is your live camera preview. Your clothes are not being fitted yet."
                : "The camera preview is only for the prototype; no outfit is applied."}
            </p>
          </div>

          {/* ─── Outfit context ─── */}
          {outfit && (
            <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                  The look you selected
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-ink">
                  {outfit.outfit_name}
                </p>
                {items.length > 0 && (
                  <p className="mt-0.5 truncate text-[11px] text-ink-soft">
                    {items.map((item) => item.item_name).join(" · ")}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 gap-1.5">
                {items.slice(0, 4).map((item) => (
                  <GarmentImage
                    key={item.id}
                    item={item}
                    className="h-12 w-12 rounded-lg border border-line"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[11px] text-ink-faint">
              <Camera className="h-3.5 w-3.5" />
              Camera footage is never recorded or uploaded.
            </p>
            <button type="button" onClick={onClose} className="btn-secondary py-2 text-xs">
              Back to outfits
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
