import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, ChevronDown, Edit3 } from "lucide-react";
import {
  CATEGORIES,
  PATTERNS,
  SEASONS,
  STYLES,
} from "../utils/constants";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_MB = 10;

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=700&auto=format&fit=crop&q=80";

const INITIAL = {
  item_name: "Beige Teddy Fleece",
  category: "Tops",
  subcategory: "Jacket",
  colour: "Beige",
  colour_hex: "#E8D8C4",
  pattern: "Solid",
  style: "Casual",
  suggested_occasions: ["Casual", "College"],
  season: "Autumn",
};

export default function AddClothingModal({ open, onClose, onSave }) {
  const fileRef = useRef(null);

  const [draft, setDraft] = useState(INITIAL);
  const [preview, setPreview] = useState(DEFAULT_IMAGE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) {
      setDraft(INITIAL);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const set = (key, value) =>
    setDraft((curr) => ({ ...curr, [key]: value }));

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

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave({
        ...draft,
        item_name: draft.item_name.trim() || "New Garment",
        image_url: preview,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Couldn't save clothing item");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs select-none">
      {/* Modal Card — responsive sheet on mobile, rounded card on desktop */}
      <div className="relative w-full max-w-md h-full sm:h-auto sm:max-h-[92vh] bg-white sm:rounded-[36px] overflow-hidden shadow-2xl flex flex-col justify-between">
        
        {/* Header: Back Arrow + "Add item" + Edit/Camera */}
        <div className="p-4 sm:p-5 border-b border-[#F2ECEE] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="p-1 -ml-1 text-[#9B4A58] hover:text-[#FF5C77] rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5 stroke-[2.5]" />
          </button>
          
          <h2 className="text-base sm:text-lg font-bold text-[#9B4A58]">
            Add item
          </h2>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="p-1 -mr-1 text-[#9B4A58] hover:text-[#FF5C77] rounded-full transition-colors"
          >
            <Edit3 className="h-4.5 w-4.5 stroke-[2.2]" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-5 sm:p-7 space-y-6">
          
          {/* Main Large Garment Cutout Image on Wooden Hanger */}
          <div className="flex flex-col items-center justify-center py-1">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={onPick}
            />

            <div
              onClick={() => fileRef.current?.click()}
              className="group cursor-pointer relative h-56 sm:h-64 w-full flex items-center justify-center"
            >
              <img
                src={preview}
                alt="Clothing garment"
                className="max-h-full max-w-[85%] object-contain filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.12)] group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute bottom-1 right-6 rounded-full bg-white/90 backdrop-blur-xs px-2.5 py-1 text-[11px] font-bold text-[#9B4A58] shadow-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-3 w-3" /> Change
              </div>
            </div>

            {/* Item Name Input */}
            <input
              type="text"
              value={draft.item_name}
              onChange={(e) => set("item_name", e.target.value)}
              className="text-center text-sm font-bold text-[#9B4A58] mt-2 border-b border-transparent hover:border-gray-200 focus:border-[#FF5C77] focus:outline-none py-0.5 bg-transparent w-full max-w-xs transition-colors"
              placeholder="Item name..."
            />
          </div>

          {/* Section: Season (Reference Image 2 Screen 2) */}
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[#9B4A58] mb-2.5">
              Season
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {["Autumn", "Winter", "Spring", "Summer"].map((s) => {
                const isSelected = draft.season === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("season", s)}
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

          {/* Section: Characteristics (Reference Image 2 Screen 2) */}
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[#9B4A58] mb-2.5">
              Characteristics
            </h3>

            <div className="space-y-3.5 text-xs font-semibold">
              {/* Category */}
              <div className="flex items-center justify-between border-b border-gray-100/90 pb-2">
                <span className="text-black/45 font-bold">Category</span>
                <div className="flex items-center gap-1 cursor-pointer">
                  <select
                    value={draft.category}
                    onChange={(e) => set("category", e.target.value)}
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
                  value={draft.subcategory || ""}
                  onChange={(e) => set("subcategory", e.target.value)}
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
                    value={draft.colour || ""}
                    onChange={(e) => set("colour", e.target.value)}
                    className="w-20 bg-transparent text-black/75 font-bold focus:outline-none text-right"
                  />
                  <input
                    type="color"
                    value={draft.colour_hex || "#E8D8C4"}
                    onChange={(e) => set("colour_hex", e.target.value)}
                    className="h-4 w-4 rounded-full border-0 cursor-pointer p-0"
                  />
                  <ChevronDown className="h-3.5 w-3.5 text-black/40" />
                </div>
              </div>

              {/* Pattern */}
              <div className="flex items-center justify-between border-b border-gray-100/90 pb-2">
                <span className="text-black/45 font-bold">Pattern</span>
                <div className="flex items-center gap-1 cursor-pointer">
                  <select
                    value={draft.pattern}
                    onChange={(e) => set("pattern", e.target.value)}
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
                    value={draft.style}
                    onChange={(e) => set("style", e.target.value)}
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

        {/* Bottom Prominent Coral "Save" Button */}
        <div className="p-4 sm:p-5 pt-2 shrink-0 bg-white border-t border-[#F2ECEE]">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="w-full py-3.5 rounded-full bg-[#FF5C77] hover:bg-[#E05252] text-white font-extrabold text-sm sm:text-base shadow-[0_8px_20px_rgba(255,92,119,0.35)] transition-all"
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
