
import { tintFor } from "../../utils/format";

const SHAPES = {
  tee: "M30 18 L42 14 Q50 22 58 14 L70 18 L88 34 L78 46 L70 40 L70 86 L30 86 L30 40 L22 46 L12 34 Z",
  long: "M32 16 L44 12 L50 20 L56 12 L68 16 L92 70 L80 76 L70 50 L70 88 L30 88 L30 50 L20 76 L8 70 Z",
  pants: "M30 10 H70 L76 90 H54 L50 40 L46 90 H24 Z",
  skirt: "M34 14 H66 L84 86 H16 Z",
  dress: "M38 10 L44 10 L50 20 L56 10 L62 10 L60 38 L82 90 H18 L40 38 Z",
  shoe: "M10 62 Q30 60 38 44 L44 40 Q60 56 90 58 V72 H10 Z",
  bag: "M22 40 H78 L84 84 H16 Z",
  other: "M26 26 H74 V78 H26 Z",
};

function shapeFor(category, subcategory = "") {
  const sub = (subcategory || "").toLowerCase();

  if (/skirt/.test(sub)) return "skirt";
  if (/jean|trouser|pant|short/.test(sub)) return "pants";
  if (/shirt|blouse|cami|knit|sweater/.test(sub) && !/tee|t-shirt/.test(sub)) return "long";

  switch (category) {
    case "Tops": return "tee";
    case "Bottoms": return "pants";
    case "Dresses": return "dress";
    case "Outerwear": return "long";
    case "Shoes": return "shoe";
    case "Bags": return "bag";
    default: return "other";
  }
}

export default function GarmentImage({
  item,
  showLabel = false,
  className = "",
  rounded = "rounded-2xl",
}) {
  const tint = tintFor(item.id);
  const shape = shapeFor(item.category, item.subcategory);

  return (
    <div
      title={item.item_name || "Clothing item"}
      className={`relative flex items-center justify-center overflow-hidden ${tint} ${rounded} ${className} transition-all duration-200`}
    >
      {item.image_url ? (
        <img
          src={item.image_url}
          alt={item.item_name || "Clothing item"}
          className="h-full w-full object-contain p-2.5"
          loading="lazy"
        />
      ) : (
        <svg
          viewBox="0 0 100 100"
          className="h-[65%] w-[65%] drop-shadow-sm"
          role="img"
          aria-label={item.item_name || "Clothing item"}
        >
          {shape === "bag" && (
            <path
              d="M34 42 Q34 18 50 18 Q66 18 66 42"
              fill="none"
              stroke="rgba(48,45,42,0.3)"
              strokeWidth="3"
            />
          )}
          <path
            d={SHAPES[shape]}
            fill={item.colour_hex || "#CFC8BF"}
            stroke="rgba(48,45,42,0.22)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {showLabel && (
        <span className="absolute inset-x-0 bottom-0 bg-white/85 backdrop-blur-2xs px-1.5 py-0.5 text-[10px] font-bold text-center leading-tight text-ink truncate">
          {item.item_name}
        </span>
      )}
    </div>
  );
}
