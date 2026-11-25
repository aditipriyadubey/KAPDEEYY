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
      className={`card fade-up flex flex-col p-5 transition duration-200 ${rejected ? "opacity-60" : "hover:-translate-y-0.5"}`}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <p className="eyebrow">Outfit {String(index + 1).padStart(2, "0")}</p>
      <h3 className="mt-1 text-2xl">{outfit.outfit_name}</h3>

      <OutfitCollage items={outfit.items} className="mt-4" />

      <div className="mt-4 flex flex-wrap gap-1.5">
        <span className="tag bg-rose-tint text-rose-deep">{outfit.occasion}</span>
        {[...new Set(outfit.items.map((i) => i.category))].map((c) => (
          <span key={c} className="tag bg-lilac text-ink-soft">{c}</span>
        ))}
      </div>

      <p className="mt-4 flex-1 text-sm leading-relaxed text-ink-soft">{outfit.styling_explanation}</p>

      <p className="mt-4 text-xs text-ink-faint">
        Style match <span className="font-serif text-lg text-rose-deep">{outfit.recommendation_score}</span>/100
        <span className="ml-1">· rule-based score</span>
      </p>

      {rejected && (
        <p className="mt-3 rounded-lg bg-rose-tint px-3 py-2 text-xs text-rose-deep">
          Noted — this exact combination will rank lower. Your pieces are unaffected.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary btn-sm" disabled={busy || saved} onClick={() => onSave(outfit)}>
          {saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
          {saved ? "Saved" : "Save outfit"}
        </button>
        <button type="button" className="btn-secondary btn-sm" disabled={busy || rejected} onClick={() => onNotForMe(outfit)}>
          <ThumbsDown className="h-3.5 w-3.5" /> Not for me
        </button>
        <button type="button" className="btn-primary btn-sm" disabled={busy || wornToday} onClick={() => onWorn(outfit)}>
          <Check className="h-3.5 w-3.5" /> {wornToday ? "Worn today" : "Mark as worn"}
        </button>
      </div>
    </article>
  );
}
