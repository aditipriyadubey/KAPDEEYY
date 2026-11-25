import GarmentImage from "./GarmentImage";

/** Lays out 2–6 outfit items as a tidy grid. Always uses the real item images. */
export default function OutfitCollage({ items, showLabels = true, className = "" }) {
  const count = items.length;
  const cols = count <= 4 ? 2 : 3;
  return (
    <div
      className={`grid gap-2 ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <GarmentImage key={item.id} item={item} showLabel={showLabels} className="aspect-square" />
      ))}
    </div>
  );
}
