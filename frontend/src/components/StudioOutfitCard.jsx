import { Bookmark, BookmarkCheck, Check, ThumbsDown } from "lucide-react";
import GarmentImage from "./ui/GarmentImage";

/**
 * Aesthetic fashion flatlay outfit card matching Reference Image 2 Screen 3
 */
export default function StudioOutfitCard({ outfit, index, state = {}, busy = false, onSave, onNotForMe, onWorn }) {
  const { saved = false, rejected = false, wornToday = false } = state;

  const tops = outfit.items.filter((i) => ["Tops", "Outerwear", "Dresses"].includes(i.category));
  const bottoms = outfit.items.filter((i) => i.category === "Bottoms");
  const shoes = outfit.items.filter((i) => i.category === "Shoes");
  const accessories = outfit.items.filter((i) => ["Bags", "Accessories", "Other"].includes(i.category));

  // Fallback if categorization doesn't divide cleanly
  const orderedItems = [...tops, ...bottoms, ...shoes, ...accessories];
  const displayItems = orderedItems.length > 0 ? orderedItems : outfit.items;

  return (
    <article
      className={`rounded-3xl bg-white p-3.5 sm:p-4 border border-[#F2ECEE] shadow-2xs hover:shadow-md transition-all flex flex-col justify-between ${
        rejected ? "opacity-50" : ""
      }`}
    >
      {/* ─── Top Header: Index & Occasion Pill ─── */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F9F5F6]">
        <span className="text-[10px] font-black uppercase tracking-wider text-black/40">
          Outfit {String(index + 1).padStart(2, "0")}
        </span>
        <span className="rounded-full bg-[#FFEAEF] text-[#FF5C77] text-[10px] font-black px-2 py-0.5">
          {outfit.occasion}
        </span>
      </div>

      {/* ─── Boutique Fashion Flatlay Grid (Reference Image 2 Screen 3) ─── */}
      <div className="rounded-2xl bg-[#FFFBFB] p-2.5 sm:p-3 border border-[#F7EDF0] my-1">
        <div className="grid grid-cols-2 gap-2">
          {displayItems.map((item, idx) => (
            <div
              key={item.id || idx}
              title={item.item_name}
              className={`relative flex items-center justify-center rounded-xl overflow-hidden ${
                idx === 0 && displayItems.length % 2 !== 0 ? "col-span-2 aspect-[16/10]" : "aspect-square"
              }`}
            >
              <GarmentImage
                item={item}
                showLabel={false}
                className="w-full h-full"
                rounded="rounded-xl"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ─── Outfit Info ─── */}
      <div className="pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-[#1F1D1E] truncate">
            {outfit.outfit_name}
          </h3>
          <span className="text-[11px] font-black text-[#FF5C77]">
            {outfit.recommendation_score}/100
          </span>
        </div>

        <p className="text-[11px] text-black/60 font-semibold line-clamp-2 mt-1 leading-snug">
          {outfit.styling_explanation}
        </p>
      </div>

      {/* ─── Action Controls ─── */}
      <div className="flex items-center gap-1.5 pt-3 mt-1 border-t border-[#F7EDF0]">
        <button
          type="button"
          disabled={busy || saved}
          onClick={() => onSave(outfit)}
          className={`flex-1 py-1.5 rounded-full text-[11px] font-bold border transition-colors flex items-center justify-center gap-1 ${
            saved
              ? "bg-[#FFEAEF] border-[#FFD6DF] text-[#FF5C77]"
              : "border-gray-200 text-black/70 hover:bg-gray-50"
          }`}
        >
          {saved ? <BookmarkCheck className="h-3 w-3 text-[#FF5C77]" /> : <Bookmark className="h-3 w-3" />}
          <span>{saved ? "Saved" : "Save"}</span>
        </button>

        <button
          type="button"
          disabled={busy || rejected}
          onClick={() => onNotForMe(outfit)}
          className="p-1.5 rounded-full border border-gray-200 text-black/45 hover:text-black/80 hover:bg-gray-50 transition-colors"
          title="Not for me"
        >
          <ThumbsDown className="h-3 w-3" />
        </button>

        <button
          type="button"
          disabled={busy || wornToday}
          onClick={() => onWorn(outfit)}
          className={`flex-1 py-1.5 rounded-full text-[11px] font-bold text-white transition-colors flex items-center justify-center gap-1 shadow-2xs ${
            wornToday
              ? "bg-green-600"
              : "bg-[#FF5C77] hover:bg-[#E05252]"
          }`}
        >
          <Check className="h-3 w-3 stroke-[2.5]" />
          <span>{wornToday ? "Worn" : "Mark worn"}</span>
        </button>
      </div>
    </article>
  );
}
