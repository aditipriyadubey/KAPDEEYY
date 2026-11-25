import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Shirt, Sparkles, Wand2 } from "lucide-react";
import { generateOutfits, remixOutfits, surpriseOutfits } from "../services/api";
import { OCCASIONS } from "../utils/constants";
import useOutfitActions from "../hooks/useOutfitActions";
import PageHeader from "../components/ui/PageHeader";
import OutfitCard from "../components/OutfitCard";
import { CardSkeleton, EmptyState, ErrorState } from "../components/ui/Feedback";
import Toast from "../components/ui/Toast";

export default function OutfitStudio() {
  const [occasion, setOccasion] = useState("College");
  const [mode, setMode] = useState("generate");
  const [outfits, setOutfits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const actions = useOutfitActions();

  const load = useCallback(async (nextMode, occ) => {
    setLoading(true);
    setError(null);
    try {
      const res =
        nextMode === "remix" ? await remixOutfits(occ)
        : nextMode === "surprise" ? await surpriseOutfits()
        : await generateOutfits(occ);
      setOutfits(res.outfits);
      setMode(nextMode);
    } catch (err) {
      setError(err?.message || "Couldn't build outfits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load("generate", "College"); }, [load]);

  const pickOccasion = (occ) => { setOccasion(occ); load("generate", occ); };


  const heading =
    mode === "surprise" ? "A little of everything."
    : mode === "remix" ? "Fresh combinations."
    : "A little remix for today's mood.";

  return (
    <>
      <PageHeader
        eyebrow="Outfit Studio"
        title={heading}
        subtitle={
          mode === "surprise"
            ? "A mix of occasions and styles from across your closet."
            : "Choose an occasion, or let us surprise you."
        }
      />

      <div className="mb-8 flex flex-wrap items-center gap-2.5">
        {OCCASIONS.map((o) => (
          <button
            key={o}
            type="button"
            className={`chip ${mode !== "surprise" && occasion === o ? "chip-active" : ""}`}
            aria-pressed={mode !== "surprise" && occasion === o}
            onClick={() => pickOccasion(o)}
            disabled={loading}
          >
            {o}
          </button>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden />
        <button type="button" className="btn-secondary btn-sm" disabled={loading} onClick={() => load("surprise")}>
          <Wand2 className="h-3.5 w-3.5" /> Surprise me
        </button>
        <button type="button" className="btn-primary btn-sm" disabled={loading} onClick={() => load("remix", occasion)}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Remix my wardrobe
        </button>
      </div>

      {loading && <CardSkeleton tall />}

      {error && !loading && <ErrorState message={error} onRetry={() => load(mode, occasion)} />}

      {!loading && !error && outfits.length === 0 && (
        <EmptyState
          icon={Shirt}
          title="No complete outfits yet"
          message={`We couldn't build a complete ${occasion.toLowerCase()} outfit without leaving out an essential piece. Add more clothes to your wardrobe and try again.`}
        />
      )}

      {!loading && !error && outfits.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {outfits.map((o, i) => (
            <OutfitCard
              key={o.id}
              outfit={o}
              index={i}
              state={actions.stateFor(o)}
              busy={actions.busyId === o.id}
              onSave={actions.onSave}
              onNotForMe={actions.onNotForMe}
              onWorn={actions.onWorn}
            />
          ))}
        </div>
      )}

      <p className="mt-8 flex items-start gap-2 border-l-2 border-rose pl-4 text-sm text-ink-soft">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-rose-deep" aria-hidden />
        Preview mode: outfits come from demo data. The real, explainable scoring engine arrives in Phase 4.
      </p>

      <Toast toast={actions.toast} />
    </>
  );
}