import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Check, ChevronDown, Edit3 } from "lucide-react";
import {
  CATEGORIES,
  PATTERNS,
  SEASONS,
  STYLES,
} from "../utils/constants";
import { addWardrobeItem } from "../services/api";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_MB = 10;

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=700&auto=format&fit=crop&q=80";

export default function AddItem() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [season, setSeason] = useState("Autumn");
  const [category, setCategory] = useState("Tops");
  const [subcategory, setSubcategory] = useState("Jacket");
  const [colour, setColour] = useState("Beige");
  const [colourHex, setColourHex] = useState("#E8D8C4");
  const [pattern, setPattern] = useState("Solid");
  const [style, setStyle] = useState("Casual");
  const [itemName, setItemName] = useState("Beige Teddy Fleece");

  const [preview, setPreview] = useState(DEFAULT_IMAGE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const onPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPT.split(",").includes(file.type)) {
      setError("Please choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File is larger than ${MAX_MB}MB.`);
      return;
    }

    setError(null);
    setPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await addWardrobeItem({
        item_name: itemName.trim() || "Beige Teddy Fleece",
        category,
        subcategory,
        colour,
        colour_hex: colourHex,
        pattern,
        style,
        suggested_occasions: ["Casual", "College"],
        season,
        image_url: preview,
      });
      setSavedSuccess(true);
      setTimeout(() => {
        navigate("/wardrobe");
      }, 700);
    } catch (err) {
      setError(err?.message || "Couldn't save clothing item");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-[calc(100vh-8rem)] flex flex-col justify-between py-2 sm:py-4 px-2 sm:px-4">
      {/* ─── Top Bar (Reference Image 2 Screen 2) ─── */}
      <div className="flex items-center justify-between pb-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-[#9B4A58] hover:text-[#FF5C77] transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 stroke-[2.5]" />
        </button>

        <h1 className="text-base sm:text-lg font-bold text-[#9B4A58]">
          Add item
        </h1>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="p-2 -mr-2 text-[#9B4A58] hover:text-[#FF5C77] transition-colors"
          aria-label="Edit image"
          title="Upload / Change garment photo"
        >
          <Edit3 className="h-4.5 w-4.5 stroke-[2.2]" />
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={onPick}
      />

      {/* ─── Main Content ─── */}
      <div className="space-y-6 flex-1 flex flex-col justify-center">
        {/* Garment Hero Photo (Floating clean realistic garment on wooden hanger) */}
        <div className="flex flex-col items-center justify-center py-2 relative group">
          <div
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer relative h-60 sm:h-72 w-full flex items-center justify-center"
          >
            <img
              src={preview}
              alt="Garment on hanger"
              className="max-h-full max-w-[85%] object-contain filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.12)] group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute bottom-1 right-8 rounded-full bg-white/90 backdrop-blur-xs px-2.5 py-1 text-[11px] font-bold text-[#9B4A58] shadow-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-3 w-3" /> Change
            </div>
          </div>

          {/* Quick inline name editor */}
          <input
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="text-center text-sm font-bold text-[#9B4A58] mt-1 border-b border-transparent hover:border-gray-200 focus:border-[#FF5C77] focus:outline-none bg-transparent w-full max-w-xs transition-colors"
            placeholder="Item name..."
          />
        </div>

        {/* ─── Section: Season (Reference Image 2 Screen 2) ─── */}
        <div>
          <h2 className="text-xs sm:text-sm font-bold text-[#9B4A58] mb-2.5">
            Season
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {["Autumn", "Winter", "Spring", "Summer"].map((s) => {
              const isSelected = season === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeason(s)}
                  className={`py-2 px-1 text-center rounded-2xl text-xs font-bold transition-all ${
                    isSelected
                      ? "bg-[#B6F2C7] text-[#0F4722] shadow-2xs font-extrabold"
                      : "bg-white text-black/45 border border-gray-200/80 hover:border-gray-300"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Section: Characteristics (Reference Image 2 Screen 2) ─── */}
        <div>
          <h2 className="text-xs sm:text-sm font-bold text-[#9B4A58] mb-2.5">
            Characteristics
          </h2>

          <div className="space-y-3.5 text-xs font-semibold">
            {/* Category */}
            <div className="flex items-center justify-between border-b border-gray-100/90 pb-2">
              <span className="text-black/45 font-bold">Category</span>
              <div className="flex items-center gap-1 cursor-pointer">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-transparent text-black/75 font-bold focus:outline-none text-right cursor-pointer"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-black/40" />
              </div>
            </div>

            {/* Subcategory */}
            <div className="flex items-center justify-between border-b border-gray-100/90 pb-2">
              <span className="text-black/45 font-bold">Subcategory</span>
              <input
                type="text"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder="Pants / Jacket"
                className="bg-transparent text-black/75 font-bold focus:outline-none text-right placeholder:text-black/30"
              />
            </div>

            {/* Colour */}
            <div className="flex items-center justify-between border-b border-gray-100/90 pb-2">
              <span className="text-black/45 font-bold">Colour</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={colour}
                  onChange={(e) => setColour(e.target.value)}
                  className="w-20 bg-transparent text-black/75 font-bold focus:outline-none text-right"
                />
                <input
                  type="color"
                  value={colourHex}
                  onChange={(e) => setColourHex(e.target.value)}
                  className="h-4 w-4 rounded-full border-0 cursor-pointer p-0"
                  title="Pick hex colour"
                />
                <ChevronDown className="h-3.5 w-3.5 text-black/40" />
              </div>
            </div>

            {/* Pattern */}
            <div className="flex items-center justify-between border-b border-gray-100/90 pb-2">
              <span className="text-black/45 font-bold">Pattern</span>
              <div className="flex items-center gap-1 cursor-pointer">
                <select
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  className="bg-transparent text-black/75 font-bold focus:outline-none text-right cursor-pointer"
                >
                  {PATTERNS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-black/40" />
              </div>
            </div>

            {/* Style */}
            <div className="flex items-center justify-between border-b border-gray-100/90 pb-2">
              <span className="text-black/45 font-bold">Style</span>
              <div className="flex items-center gap-1 cursor-pointer">
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="bg-transparent text-black/75 font-bold focus:outline-none text-right cursor-pointer"
                >
                  {STYLES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-black/40" />
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-[#FF5C77] font-bold text-center">{error}</p>}
      </div>

      {/* ─── Bottom Coral "Save" Button (Reference Image 2 Screen 2) ─── */}
      <div className="pt-6 pb-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || savedSuccess}
          className="w-full py-3.5 rounded-full bg-[#FF5C77] hover:bg-[#E05252] active:scale-[0.99] text-white font-extrabold text-sm sm:text-base shadow-[0_8px_20px_rgba(255,92,119,0.35)] transition-all flex items-center justify-center gap-2"
        >
          {savedSuccess ? (
            <>
              <Check className="h-5 w-5" /> Saved to Wardrobe!
            </>
          ) : busy ? (
            "Saving..."
          ) : (
            "Save"
          )}
        </button>
      </div>
    </div>
  );
}
