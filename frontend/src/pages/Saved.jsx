import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, Camera, Trash2 } from "lucide-react";
import useAsync from "../hooks/useAsync";
import { getSavedOutfits, markWorn, removeSavedOutfit } from "../services/api";
import { formatShort } from "../utils/format";
import OutfitCollage from "../components/ui/OutfitCollage";
import Modal from "../components/ui/Modal";
import { CardSkeleton, EmptyState, ErrorState } from "../components/ui/Feedback";
import Toast from "../components/ui/Toast";
import VirtualTryOnModal from "../components/VirtualTryOnModal";

export default function Saved() {
  const { data, loading, error, reload } = useAsync(getSavedOutfits);
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [tryOnOutfit, setTryOnOutfit] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  const flash = (message, type = "ok") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2400);
  };

  const act = async (outfit, fn, message) => {
    setBusyId(outfit.id);
    try {
      await fn(outfit.id);
      flash(message);
      await reload();
      setDetail(null);
    } catch {
      flash("That didn't go through", "error");
    } finally {
      setBusyId(null);
    }
  };

  const list = data || [];

  return (
    <div className="space-y-6">
      <div className="border-b border-line pb-5">
        <p className="eyebrow">Collection</p>
        <h1 className="mt-1 font-display text-2xl font-normal tracking-tight text-ink sm:text-3xl">
          Saved Outfits
        </h1>
        <p className="mt-1 text-xs text-ink-soft sm:text-sm">
          Looks you kept to wear again.
        </p>
      </div>

      {loading && <CardSkeleton tall count={3} />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && list.length === 0 && (
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet"
          message="Save an outfit in the studio and it will appear here."
          action={
            <button onClick={() => navigate("/studio")} className="btn-primary">
              Open studio
            </button>
          }
        />
      )}

      {!loading && list.length > 0 && (
        <div className="grid grid-cols-1 gap-4 pb-6 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {list.map((o) => (
            <div
              key={o.id}
              className="card flex flex-col justify-between p-4 transition-colors hover:border-ink/25"
            >
              <div>
                <div className="rounded-lg border border-line bg-canvas p-2">
                  <OutfitCollage items={o.items} showLabels={false} className="w-full" />
                </div>

                <div className="mt-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-ink">
                      {o.outfit_name}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-ink-faint">
                      {o.occasion ? `${o.occasion} · ` : ""}saved{" "}
                      {formatShort(o.saved_at)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-medium ${
                      o.worn
                        ? "bg-success-tint text-success"
                        : "bg-canvas text-ink-soft"
                    }`}
                  >
                    {o.worn ? "Worn" : "Saved"}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  onClick={() => setDetail(o)}
                  className="btn-secondary flex-1 py-1.5 text-[11px]"
                >
                  Details
                </button>
                <button
                  type="button"
                  disabled={busyId === o.id}
                  onClick={() => act(o, markWorn, "Added to wear history")}
                  className="btn-primary flex-1 py-1.5 text-[11px]"
                >
                  Worn
                </button>
                <button
                  type="button"
                  onClick={() => setTryOnOutfit(o)}
                  className="flex items-center justify-center rounded-lg border border-line px-3 text-ink-faint transition-colors hover:border-ink/30 hover:text-ink"
                  aria-label="Virtual Try-On"
                  title="Virtual Try-On (coming soon)"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={busyId === o.id}
                  onClick={() => act(o, removeSavedOutfit, "Removed")}
                  className="flex items-center justify-center rounded-lg border border-line px-3 text-ink-faint transition-colors hover:border-danger/30 hover:text-danger"
                  aria-label="Remove saved outfit"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.outfit_name || ""}>
        {detail && (
          <div className="space-y-4">
            <div className="rounded-lg border border-line bg-canvas p-2">
              <OutfitCollage items={detail.items} />
            </div>
            {detail.styling_explanation && (
              <p className="text-sm leading-relaxed text-ink-soft">
                {detail.styling_explanation}
              </p>
            )}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                Pieces in this outfit
              </p>
              <ul className="text-xs">
                {detail.items.map((it) => (
                  <li
                    key={it.id}
                    className="flex justify-between border-b border-line py-1.5 last:border-0"
                  >
                    <span className="font-medium text-ink">{it.item_name}</span>
                    <span className="text-ink-faint">{it.category}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>

      <VirtualTryOnModal
        open={!!tryOnOutfit}
        outfit={tryOnOutfit}
        onClose={() => setTryOnOutfit(null)}
      />

      <Toast toast={toast} />
    </div>
  );
}
