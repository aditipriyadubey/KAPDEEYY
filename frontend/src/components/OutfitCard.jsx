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
      className={`playful-card flex flex-col p-4 sm:p-5 transition-all duration-300 ${
        rejected ? "opacity-60" : "hover:-translate-y-1 hover:shadow-card-hover"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-black/40 uppercase tracking-wider">
          Outfit {String(index + 1).padStart(2, "0")}
        </span>
        <span className="rounded-full bg-[#FFF2F1] text-[#F46A6A] text-[11px] font-bold px-2.5 py-0.5">
          {outfit.occasion}
        </span>
      </div>

      <h3 className="mt-1 text-lg sm:text-xl font-bold text-ink">{outfit.outfit_name}</h3>

      <OutfitCollage items={outfit.items} showLabels={false} className="mt-3.5" />

      {/* Playful Category / Style Tags */}
      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {[...new Set(outfit.items.map((i) => i.category))].map((c) => (
          <span key={c} className="rounded-full bg-[#F1ECFB] text-[#7C5AC2] text-[10px] font-bold px-2.5 py-0.5">
            {c}
          </span>
        ))}
      </div>

      <p className="mt-3 flex-1 text-xs text-black/60 leading-relaxed">{outfit.styling_explanation}</p>

      <div className="mt-3 pt-2 border-t border-[#F2ECEE] flex items-center justify-between text-xs text-black/45">
        <span>Style Match</span>
        <span className="font-extrabold text-[#F46A6A] text-sm">{outfit.recommendation_score}/100</span>
      </div>

      {rejected && (
        <p className="mt-2 rounded-xl bg-coral-tint px-3 py-1.5 text-[11px] font-semibold text-coral-deep">
          Combination noted — will rank lower in future.
        </p>
      )}

      <div className="mt-3.5 flex flex-wrap gap-2">
        <button
          type="button"
          className="flex-1 py-1.5 rounded-full border border-gray-200 text-xs font-bold text-black/70 hover:bg-gray-50 flex items-center justify-center gap-1 transition-colors"
          disabled={busy || saved}
          onClick={() => onSave(outfit)}
        >
          {saved ? <BookmarkCheck className="h-3.5 w-3.5 text-[#F46A6A]" /> : <Bookmark className="h-3.5 w-3.5" />}
          {saved ? "Saved" : "Save"}
        </button>

        <button
          type="button"
          className="px-3 py-1.5 rounded-full border border-gray-200 text-xs font-bold text-black/50 hover:bg-gray-50 flex items-center justify-center transition-colors"
          disabled={busy || rejected}
          onClick={() => onNotForMe(outfit)}
          title="Not for me"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          className="flex-1 py-1.5 rounded-full bg-[#F46A6A] text-xs font-bold text-white shadow-2xs hover:bg-[#E05252] flex items-center justify-center gap-1 transition-colors"
          disabled={busy || wornToday}
          onClick={() => onWorn(outfit)}
        >
          <Check className="h-3.5 w-3.5" />
          {wornToday ? "Worn ✓" : "Mark worn"}
        </button>
      </div>
    </article>
  );
}
