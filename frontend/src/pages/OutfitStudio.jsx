import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Shirt, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { generateOutfits, remixOutfits, surpriseOutfits } from "../services/api";
import { friendlyError } from "../services/http";
import { OCCASIONS } from "../utils/constants";
import useOutfitActions from "../hooks/useOutfitActions";
import StudioOutfitCard from "../components/StudioOutfitCard";
import VirtualTryOnModal from "../components/VirtualTryOnModal";
import { CardSkeleton, EmptyState, ErrorState } from "../components/ui/Feedback";
import Toast from "../components/ui/Toast";

const FILTERS = [
  { id: "Outfits", label: "All outfits" },
  { id: "Trousers", label: "Trousers" },
  { id: "Shoes", label: "Shoes" },
  { id: "Headdress", label: "Accessories" },
];

export default function OutfitStudio() {
  const [occasion, setOccasion] = useState("College");
  const [filterTab, setFilterTab] = useState("Outfits");
  const [outfits, setOutfits] = useState([]);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tryOnOutfit, setTryOnOutfit] = useState(null);
  const seedRef = useRef(0);
  const actions = useOutfitActions();

  const load = useCallback(async (nextMode, occ) => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (nextMode === "remix") {
        // Rotating the seed picks a different set of equally-scored looks.
        seedRef.current += 1;
        res = await remixOutfits(occ, seedRef.current);
      } else if (nextMode === "surprise") {
        // Surprise Me ignores the occasion and jumps somewhere random.
        seedRef.current = Math.floor(Math.random() * 997) + 1;
        res = await surpriseOutfits(seedRef.current);
        setOccasion(null);
      } else {
        seedRef.current = 0;
        res = await generateOutfits(occ, 0);
      }
      setOutfits(res.outfits || []);
      setInfo(res.info || null);
    } catch (err) {
      setError(friendlyError(err, "Couldn't build outfits."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("generate", "College");
  }, [load]);

  const displayedOutfits = outfits.filter((o) => {
    if (filterTab === "Outfits") return true;
    if (filterTab === "Trousers") return o.items.some((i) => i.category === "Bottoms");
    if (filterTab === "Shoes") return o.items.some((i) => i.category === "Shoes");
    if (filterTab === "Headdress")
      return o.items.some((i) => ["Accessories", "Bags"].includes(i.category));
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col justify-between gap-4 border-b border-line pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Styling</p>
          <h1 className="mt-1 font-display text-2xl font-normal tracking-tight text-ink sm:text-3xl">
            Outfit Studio
          </h1>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink-soft sm:text-sm">
            Real combinations from the pieces in your wardrobe, tailored to the
            occasion.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => load("surprise", occasion)}
            disabled={loading}
            className="btn-secondary w-max px-4 py-2 text-[13px]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Surprise me
          </button>

          <button
            type="button"
            onClick={() => load("remix", occasion)}
            disabled={loading}
            className="btn-secondary w-max px-4 py-2 text-[13px]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Remix
          </button>
        </div>
      </div>

      {/* ─── Occasions ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Occasion
        </span>
        {OCCASIONS.map((occ) => (
          <button
            key={occ}
            type="button"
            onClick={() => {
              setOccasion(occ);
              load("generate", occ);
            }}
            aria-pressed={occasion === occ}
            className={`${occasion === occ ? "chip chip-active" : "chip"}`}
          >
            {occ}
          </button>
        ))}
      </div>

      {/* ─── Piece filter ─── */}
      <div className="no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-line pb-2.5">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setFilterTab(filter.id)}
            aria-pressed={filterTab === filter.id}
            className={`shrink-0 border-b-2 px-3 py-1.5 text-xs transition-colors ${
              filterTab === filter.id
                ? "border-accent font-semibold text-ink"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* ─── Results ─── */}
      {loading && <CardSkeleton tall count={2} />}
      {error && !loading && (
        <ErrorState message={error} onRetry={() => load("generate", occasion)} />
      )}

      {!loading && !error && info?.message && displayedOutfits.length > 0 && (
        <p className="text-[11px] text-ink-faint">{info.message}</p>
      )}

      {!loading && !error && displayedOutfits.length === 0 && (
        <EmptyState
          icon={Shirt}
          title={info?.item_count === 0 ? "Add a few pieces first" : "No outfits for this filter"}
          message={
            info?.message ||
            "Choose another occasion or piece filter, or remix to see fresh combinations."
          }
          action={
            info?.item_count === 0 ? (
              <Link to="/add" className="btn-primary">
                Add clothing
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setFilterTab("Outfits");
                  load("remix", occasion);
                }}
                className="btn-primary"
              >
                Remix looks
              </button>
            )
          }
        />
      )}

      {!loading && !error && displayedOutfits.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {displayedOutfits.map((o, i) => (
            <StudioOutfitCard
              key={o.id}
              outfit={o}
              index={i}
              state={actions.stateFor(o)}
              busy={actions.busyId === o.id}
              onSave={actions.onSave}
              onNotForMe={actions.onNotForMe}
              onWorn={actions.onWorn}
              onTryOn={setTryOnOutfit}
            />
          ))}
        </div>
      )}

      <VirtualTryOnModal
        open={!!tryOnOutfit}
        outfit={tryOnOutfit}
        onClose={() => setTryOnOutfit(null)}
      />

      <Toast toast={actions.toast} />
    </div>
  );
}
