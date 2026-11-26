import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Check, Edit3, ImagePlus, Loader2 } from "lucide-react";
import { CATEGORIES, PATTERNS, SEASONS, STYLES } from "../utils/constants";
import { createGarment } from "../services/api";
import { friendlyError } from "../services/http";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_MB = 10;

export default function AddItem() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [season, setSeason] = useState("");
  const [category, setCategory] = useState("Tops");
  const [subcategory, setSubcategory] = useState("");
  const [colour, setColour] = useState("");
  // Empty by default: forcing a swatch on every item made every save depend on
  // the colour constraint, and invented a colour the user never picked.
  const [colourHex, setColourHex] = useState("");
  const [pattern, setPattern] = useState("");
  const [style, setStyle] = useState("");
  const [itemName, setItemName] = useState("");

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const onPick = (e) => {
    const picked = e.target.files?.[0];
    if (!picked) return;

    if (!ACCEPT.split(",").includes(picked.type)) {
      setError("Please choose a JPG, PNG or WebP image.");
      return;
    }
    if (picked.size > MAX_MB * 1024 * 1024) {
      setError(`File is larger than ${MAX_MB}MB.`);
      return;
    }

    setError(null);
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Choose a photo of the garment first.");
      return;
    }
    if (!itemName.trim()) {
      setError("Give the item a name.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      setStage("Uploading photo...");
      const { item, segmentationError } = await createGarment({
        file,
        onStage: setStage,
        metadata: {
          item_name: itemName.trim(),
          category,
          subcategory: subcategory || null,
          colour: colour || null,
          colour_hex: colourHex || null,
          pattern: pattern || null,
          style: style || null,
          suggested_occasions: [],
          season: season || null,
        },
      });

      if (segmentationError) {
        setError(`Garment saved, but segmentation failed: ${segmentationError}`);
        setTimeout(() => navigate("/wardrobe"), 2500);
        return;
      }

      setSavedSuccess(true);
      setTimeout(() => navigate("/wardrobe"), 700);
    } catch (err) {
      setError(friendlyError(err, "Couldn't save clothing item"));
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-xl flex-col px-1 py-2 sm:px-2 sm:py-4">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="-ml-2 flex items-center gap-1.5 p-2 text-sm text-ink-soft transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <h1 className="font-display text-lg font-normal tracking-tight text-ink">
          Add item
        </h1>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="-mr-1 p-2 text-ink-soft transition-colors hover:text-ink"
          aria-label="Change garment photo"
          title="Upload or change garment photo"
        >
          <Edit3 className="h-4 w-4" />
        </button>
      </div>

      <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={onPick} />

      <div className="flex flex-1 flex-col justify-center space-y-7 py-6">
        <div>
          <div
            onClick={() => fileRef.current?.click()}
            className="group relative h-60 w-full cursor-pointer overflow-hidden rounded-xl border border-line bg-surface sm:h-72"
          >
            {preview ? (
              <>
                <img
                  src={preview}
                  alt="Selected garment"
                  className="h-full w-full object-contain p-4"
                />
                <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded border border-line bg-surface px-2 py-1 text-[11px] font-medium text-ink-soft">
                  <Camera className="h-3 w-3" /> Change
                </span>
              </>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-faint">
                <ImagePlus className="h-6 w-6" strokeWidth={1.6} />
                <p className="text-sm font-medium text-ink-soft">
                  Choose a clothing photo
                </p>
                <p className="text-[11px]">JPG, PNG or WebP · up to {MAX_MB}MB</p>
              </div>
            )}
          </div>

          <input
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="field mt-3"
            placeholder="Item name"
            aria-label="Item name"
          />
        </div>

        <div>
          <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Season
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {SEASONS.filter((s) => s !== "All-season").map((s) => {
              const isSelected = season === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeason(isSelected ? "" : s)}
                  aria-pressed={isSelected}
                  className={`${isSelected ? "chip chip-active" : "chip"} py-2`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Details
          </h2>

          <div className="space-y-0 text-xs">
            <div className="flex items-center justify-between gap-4 border-b border-line py-2.5">
              <span className="text-ink-soft">Category</span>
              <div className="flex items-center gap-1">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="cursor-pointer bg-transparent text-right text-sm font-medium text-ink focus:outline-none"
                  aria-label="Category"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-line py-2.5">
              <span className="text-ink-soft">Subcategory</span>
              <input
                type="text"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder="Pants / Jacket"
                className="bg-transparent text-right text-sm font-medium text-ink placeholder:text-ink-faint focus:outline-none"
                aria-label="Subcategory"
              />
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-line py-2.5">
              <span className="text-ink-soft">Colour</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={colour}
                  onChange={(e) => setColour(e.target.value)}
                  placeholder="Beige"
                  className="w-20 bg-transparent text-right text-sm font-medium text-ink placeholder:text-ink-faint focus:outline-none"
                  aria-label="Colour name"
                />
                <label
                  className={`relative h-5 w-5 cursor-pointer overflow-hidden rounded-full border border-line ${
                    colourHex ? "" : "bg-canvas"
                  }`}
                  style={colourHex ? { backgroundColor: colourHex } : undefined}
                  title="Choose colour swatch"
                >
                  <input
                    type="color"
                    value={colourHex || "#E8D8C4"}
                    onChange={(e) => setColourHex(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="Colour swatch"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-line py-2.5">
              <span className="text-ink-soft">Pattern</span>
              <div className="flex items-center gap-1">
                <select
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  className="cursor-pointer bg-transparent text-right text-sm font-medium text-ink focus:outline-none"
                  aria-label="Pattern"
                >
                  <option value="">—</option>
                  {PATTERNS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-ink-soft">Style</span>
              <div className="flex items-center gap-1">
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="cursor-pointer bg-transparent text-right text-sm font-medium text-ink focus:outline-none"
                  aria-label="Style"
                >
                  <option value="">—</option>
                  {STYLES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-danger/20 bg-danger-tint p-3 text-center text-xs font-medium text-danger">
            {error}
          </p>
        )}
      </div>

      <div className="pb-2 pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || savedSuccess}
          className="btn-primary w-full py-3"
        >
          {savedSuccess ? (
            <>
              <Check className="h-4 w-4" /> Saved to wardrobe
            </>
          ) : busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {stage || "Saving..."}
            </>
          ) : (
            "Save"
          )}
        </button>
      </div>
    </div>
  );
}
