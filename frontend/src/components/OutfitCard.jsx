import { Bookmark, BookmarkCheck, Check, ThumbsDown } from "lucide-react";
import OutfitCollage from "./ui/OutfitCollage";

/**
 * One outfit recommendation. Three independent actions:
 *  Save Outfit   -> saved list only (never marks as worn)
 *  Not For Me    -> negative feedback on THIS combination (items stay untouched)
 *  Mark As Worn  -> wear history only (never saves as favourite)
 */
export default function OutfitCard({ outfit, index, state = {}, busy = false, onSave, onNotForMe, onWorn }) {
  const { saved = false, rejected = false, wornToday = false } = state;
  return (
    <article
      className={`card flex flex-col p-4 transition-colors sm:p-5 ${
        rejected ? "opacity-60" : "hover:border-ink/25"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Look {String(index + 1).padStart(2, "0")}
        </span>
        {outfit.occasion && <span className="tag">{outfit.occasion}</span>}
      </div>

      <h3 className="mt-1 text-lg font-semibold text-ink">{outfit.outfit_name}</h3>

      <div className="mt-3.5 rounded-lg border border-line bg-canvas p-2">
        <OutfitCollage items={outfit.items} showLabels={false} />
      </div>

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {[...new Set(outfit.items.map((i) => i.category))].map((c) => (
          <span key={c} className="tag">
            {c}
          </span>
        ))}
      </div>

      <p className="mt-3 flex-1 text-xs leading-relaxed text-ink-soft">
        {outfit.styling_explanation}
      </p>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-xs text-ink-soft">
        <span>Style match</span>
        <span className="text-sm font-semibold text-ink">
          {outfit.recommendation_score}/100
        </span>
      </div>

      {rejected && (
        <p className="mt-2 rounded border border-danger/20 bg-danger-tint px-3 py-1.5 text-[11px] font-medium text-danger">
          Combination noted — will rank lower in future.
        </p>
      )}

      <div className="mt-3.5 flex flex-wrap gap-2">
        <button
          type="button"
          className={`inline-flex flex-1 items-center justify-center gap-1 rounded-lg border py-1.5 text-xs font-medium transition-colors ${
            saved
              ? "border-accent/30 bg-accent-tint text-accent"
              : "border-line text-ink-soft hover:border-ink/30 hover:text-ink"
          }`}
          disabled={busy || saved}
          onClick={() => onSave(outfit)}
        >
          {saved ? (
            <BookmarkCheck className="h-3.5 w-3.5" />
          ) : (
            <Bookmark className="h-3.5 w-3.5" />
          )}
          {saved ? "Saved" : "Save"}
        </button>

        <button
          type="button"
          className="flex items-center justify-center rounded-lg border border-line px-3 py-1.5 text-ink-faint transition-colors hover:border-ink/30 hover:text-ink"
          disabled={busy || rejected}
          onClick={() => onNotForMe(outfit)}
          title="Not for me"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-accent py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          disabled={busy || wornToday}
          onClick={() => onWorn(outfit)}
        >
          <Check className="h-3.5 w-3.5" />
          {wornToday ? "Worn" : "Mark worn"}
        </button>
      </div>
    </article>
  );
}
