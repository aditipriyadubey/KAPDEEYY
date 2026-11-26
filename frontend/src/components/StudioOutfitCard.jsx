import { Bookmark, BookmarkCheck, Camera, Check, ThumbsDown } from "lucide-react";
import GarmentImage from "./ui/GarmentImage";

/** Outfit flat-lay card showing only the user's real garment images. */
export default function StudioOutfitCard({
  outfit,
  index,
  state = {},
  busy = false,
  onSave,
  onNotForMe,
  onWorn,
  onTryOn,
}) {
  const { saved = false, rejected = false, wornToday = false } = state;

  const tops = outfit.items.filter((i) =>
    ["Tops", "Outerwear", "Dresses"].includes(i.category)
  );
  const bottoms = outfit.items.filter((i) => i.category === "Bottoms");
  const shoes = outfit.items.filter((i) => i.category === "Shoes");
  const accessories = outfit.items.filter((i) =>
    ["Bags", "Accessories", "Other"].includes(i.category)
  );

  const orderedItems = [...tops, ...bottoms, ...shoes, ...accessories];
  const displayItems = orderedItems.length > 0 ? orderedItems : outfit.items;

  return (
    <article
      className={`card flex flex-col justify-between p-3.5 transition-colors sm:p-4 ${
        rejected ? "opacity-55" : "hover:border-ink/25"
      }`}
    >
      <div className="mb-2.5 flex items-center justify-between border-b border-line pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Look {String(index + 1).padStart(2, "0")}
        </span>
        {outfit.occasion && <span className="tag">{outfit.occasion}</span>}
      </div>

      <div className="rounded-lg border border-line bg-canvas p-2">
        <div className="grid grid-cols-2 gap-2">
          {displayItems.map((item, idx) => (
            <div
              key={item.id || idx}
              title={item.item_name}
              className={`relative flex items-center justify-center overflow-hidden rounded-lg ${
                idx === 0 && displayItems.length % 2 !== 0
                  ? "col-span-2 aspect-[16/10]"
                  : "aspect-square"
              }`}
            >
              <GarmentImage
                item={item}
                showLabel={false}
                className="h-full w-full"
                rounded="rounded-lg"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="pt-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-ink">
            {outfit.outfit_name}
          </h3>
          {outfit.recommendation_score != null && (
            <span className="shrink-0 text-[11px] font-medium text-ink-faint">
              {Math.round(outfit.recommendation_score)}/100
            </span>
          )}
        </div>

        {outfit.styling_explanation && (
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-soft">
            {outfit.styling_explanation}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onTryOn?.(outfit)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-canvas py-2 text-[11px] font-medium text-ink-soft transition-colors hover:border-ink/30 hover:text-ink"
      >
        <Camera className="h-3.5 w-3.5" strokeWidth={1.8} />
        Virtual Try-On
        <span className="ml-0.5 rounded-full border border-line px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-ink-faint">
          Soon
        </span>
      </button>

      <div className="mt-2 flex items-center gap-1.5 border-t border-line pt-3">
        <button
          type="button"
          disabled={busy || saved}
          onClick={() => onSave(outfit)}
          className={`inline-flex flex-1 items-center justify-center gap-1 rounded-lg border py-1.5 text-[11px] font-medium transition-colors ${
            saved
              ? "border-accent/30 bg-accent-tint text-accent"
              : "border-line text-ink-soft hover:border-ink/30 hover:text-ink"
          }`}
        >
          {saved ? (
            <BookmarkCheck className="h-3.5 w-3.5" />
          ) : (
            <Bookmark className="h-3.5 w-3.5" />
          )}
          <span>{saved ? "Saved" : "Save"}</span>
        </button>

        <button
          type="button"
          disabled={busy || rejected}
          onClick={() => onNotForMe(outfit)}
          className="rounded-lg border border-line p-1.5 text-ink-faint transition-colors hover:border-ink/30 hover:text-ink"
          title="Not for me"
          aria-label="Not for me"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          disabled={busy || wornToday}
          onClick={() => onWorn(outfit)}
          className={`inline-flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium text-white transition-colors ${
            wornToday
              ? "bg-success"
              : "bg-accent hover:bg-accent-hover"
          }`}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
          <span>{wornToday ? "Worn" : "Mark worn"}</span>
        </button>
      </div>
    </article>
  );
}
