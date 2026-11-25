import { useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Check, Eye, Trash2 } from "lucide-react";
import useAsync from "../hooks/useAsync";
import { getSavedOutfits, markWorn, removeSavedOutfit } from "../services/api";
import { formatShort } from "../utils/format";
import PageHeader from "../components/ui/PageHeader";
import OutfitCollage from "../components/ui/OutfitCollage";
import Modal from "../components/ui/Modal";
import { CardSkeleton, EmptyState, ErrorState } from "../components/ui/Feedback";
import Toast from "../components/ui/Toast";

export default function Saved() {
  const { data, loading, error, reload } = useAsync(getSavedOutfits);
  const [detail, setDetail] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  const flash = (message, type = "ok") => { setToast({ message, type }); setTimeout(() => setToast(null), 2400); };

  const act = async (outfit, fn, message) => {
    setBusyId(outfit.id);
    try { await fn(outfit.id); flash(message); await reload(); setDetail(null); }
    catch { flash("That didn’t go through", "error"); }
    finally { setBusyId(null); }
  };

  const list = data || [];
  return (
    <>
      <PageHeader eyebrow="Saved outfits" title="Looks you love" subtitle="Outfits you saved on purpose. Saving never counts as wearing." />

      {loading && <CardSkeleton tall />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && list.length === 0 && (
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet"
          message="Save an outfit in Outfit Studio and it will live here."
          action={<Link to="/studio" className="btn-primary">Open Outfit Studio</Link>}
        />
      )}

      {!loading && list.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {list.map((o, i) => (
            <article key={o.id} className="card fade-up p-4" style={{ animationDelay: `${i * 60}ms` }}>
              <OutfitCollage items={o.items} showLabels={false} />
              <div className="mt-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-xl">{o.outfit_name}</h3>
                  <p className="mt-0.5 text-sm text-ink-soft">{o.occasion} · saved {formatShort(o.saved_at)}</p>
                </div>
                <span className={`tag shrink-0 ${o.worn ? "bg-sage-tint text-sage-deep" : "bg-lilac text-ink-soft"}`}>
                  {o.worn ? "Worn" : "Not worn"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn-secondary btn-sm" onClick={() => setDetail(o)}><Eye className="h-3.5 w-3.5" /> Details</button>
                <button type="button" className="btn-primary btn-sm" disabled={busyId === o.id} onClick={() => act(o, markWorn, "Added to your history")}>
                  <Check className="h-3.5 w-3.5" /> Worn
                </button>
                <button type="button" className="btn-ghost btn-sm" disabled={busyId === o.id} onClick={() => act(o, removeSavedOutfit, "Removed from saved")}>
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.outfit_name || ""} wide>
        {detail && (
          <div className="grid gap-6 sm:grid-cols-2">
            <OutfitCollage items={detail.items} />
            <div>
              <p className="eyebrow">{detail.occasion}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{detail.styling_explanation}</p>
              <h4 className="mt-5 text-base">Pieces</h4>
              <ul className="mt-2 space-y-1 text-sm">
                {detail.items.map((it) => (
                  <li key={it.id} className="flex justify-between gap-3 border-b border-line py-1.5 last:border-0">
                    <span>{it.item_name}</span><span className="text-ink-faint">{it.category}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-ink-faint">
                Saved {formatShort(detail.saved_at)}
                {detail.last_worn_at ? ` · last worn ${formatShort(detail.last_worn_at)}` : " · not worn yet"}
              </p>
            </div>
          </div>
        )}
      </Modal>
      <Toast toast={toast} />
    </>
  );
}
