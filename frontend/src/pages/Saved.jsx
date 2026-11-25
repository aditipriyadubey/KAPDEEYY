import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, Check, Eye, Trash2 } from "lucide-react";
import useAsync from "../hooks/useAsync";
import { getSavedOutfits, markWorn, removeSavedOutfit } from "../services/api";
import { formatShort } from "../utils/format";
import OutfitCollage from "../components/ui/OutfitCollage";
import Modal from "../components/ui/Modal";
import { CardSkeleton, EmptyState, ErrorState } from "../components/ui/Feedback";
import Toast from "../components/ui/Toast";

export default function Saved() {
  const { data, loading, error, reload } = useAsync(getSavedOutfits);
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
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
      <div className="pb-2 border-b border-gray-100">
        <h1 className="font-display text-3xl font-extrabold text-ink">Saved Outfits 💕</h1>
        <p className="text-sm font-semibold text-black/45 mt-0.5">Outfits and looks you saved to remember.</p>
      </div>

      {loading && <CardSkeleton tall count={3} />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && list.length === 0 && (
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet"
          message="Save an outfit in Outfit Studio and it will appear here."
          action={<button onClick={() => navigate("/studio")} className="btn-coral-save px-6 py-2.5 text-sm">Open Studio</button>}
        />
      )}

      {!loading && list.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
          {list.map((o) => (
            <div key={o.id} className="rounded-[32px] bg-white border border-gray-100 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <OutfitCollage items={o.items} showLabels={false} className="w-full" />
                <div className="mt-4 flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-lg font-bold text-ink">{o.outfit_name}</h3>
                    <p className="text-xs font-semibold text-black/45 mt-0.5">{o.occasion} · saved {formatShort(o.saved_at)}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${o.worn ? "bg-[#D7F0DC] text-[#215E39]" : "bg-gray-100 text-black/50"}`}>
                    {o.worn ? "Worn" : "Saved"}
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-gray-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setDetail(o)}
                  className="flex-1 py-2 rounded-full border border-gray-200 text-xs font-bold text-black/70 hover:bg-gray-50 transition-colors"
                >
                  Details
                </button>
                <button
                  type="button"
                  disabled={busyId === o.id}
                  onClick={() => act(o, markWorn, "Added to wear history")}
                  className="flex-1 py-2 rounded-full bg-[#F46A6A] text-xs font-bold text-white shadow-xs hover:bg-[#E05252] transition-colors"
                >
                  Worn
                </button>
                <button
                  type="button"
                  disabled={busyId === o.id}
                  onClick={() => act(o, removeSavedOutfit, "Removed")}
                  className="px-3.5 py-2 rounded-full border border-gray-200 text-black/40 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.outfit_name || ""}>
        {detail && (
          <div className="space-y-4">
            <OutfitCollage items={detail.items} />
            <p className="text-sm text-black/60 leading-relaxed">{detail.styling_explanation}</p>
            <div>
              <p className="text-xs font-bold text-black/40 mb-2">Pieces included in this outfit:</p>
              <ul className="text-xs space-y-1.5">
                {detail.items.map((it) => (
                  <li key={it.id} className="flex justify-between border-b border-gray-100 py-1.5">
                    <span className="font-semibold text-ink">{it.item_name}</span>
                    <span className="text-black/40">{it.category}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
