import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Edit3, ImagePlus, Loader2 } from "lucide-react";
import { CATEGORIES, PATTERNS, SEASONS, STYLES } from "../utils/constants";
import { friendlyError } from "../services/http";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_MB = 10;

const INITIAL = {
  item_name: "",
  category: "Tops",
  subcategory: "",
  colour: "",
  colour_hex: "",
  pattern: "",
  style: "",
  suggested_occasions: [],
  season: "",
};

export default function AddClothingModal({ open, onClose, onSave }) {
  const fileRef = useRef(null);

  const [draft, setDraft] = useState(INITIAL);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) {
      setDraft(INITIAL);
      setFile(null);
      setPreview(null);
      setBusy(false);
      setStage("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const set = (key, value) => setDraft((curr) => ({ ...curr, [key]: value }));

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

  const submit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Choose a photo of the garment first.");
      return;
    }
    if (!draft.item_name.trim()) {
      setError("Give the item a name.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      setStage("Uploading photo...");
      const metadata = {
        ...draft,
        item_name: draft.item_name.trim(),
        subcategory: draft.subcategory || null,
        colour: draft.colour || null,
        colour_hex: draft.colour_hex || null,
        pattern: draft.pattern || null,
        style: draft.style || null,
        season: draft.season || null,
      };
      await onSave(metadata, file, setStage);
      onClose();
    } catch (err) {
      setError(friendlyError(err, "Couldn't save this clothing item."));
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-0 sm:p-4">
      <div className="relative flex h-full w-full max-w-md flex-col justify-between overflow-hidden bg-surface animate-slide-up sm:h-auto sm:max-h-[92vh] sm:rounded-xl sm:border sm:border-line">
        <div className="flex shrink-0 items-center justify-between border-b border-line p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="-ml-1 rounded p-1 text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <h2 className="font-display text-lg font-normal tracking-tight text-ink">
            Add item
          </h2>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="-mr-1 rounded p-1 text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
            aria-label="Change garment photo"
          >
            <Edit3 className="h-4 w-4" />
          </button>
        </div>

        <div className="no-scrollbar flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
          <div>
            <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={onPick} />

            <div
              onClick={() => !busy && fileRef.current?.click()}
              className="group relative h-56 w-full cursor-pointer overflow-hidden rounded-xl border border-line bg-canvas sm:h-64"
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
              value={draft.item_name}
              onChange={(e) => set("item_name", e.target.value)}
              className="field mt-3"
              placeholder="Item name"
              aria-label="Item name"
            />
          </div>

          <div>
            <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Season
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {SEASONS.filter((s) => s !== "All-season").map((s) => {
                const isSelected = draft.season === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("season", isSelected ? "" : s)}
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
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Details
            </h3>

            <div className="space-y-0 text-xs">
              <div className="flex items-center justify-between gap-4 border-b border-line py-2.5">
                <span className="text-ink-soft">Category</span>
                <div className="flex items-center gap-1">
                  <select
                    value={draft.category}
                    onChange={(e) => set("category", e.target.value)}
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
                  value={draft.subcategory || ""}
                  onChange={(e) => set("subcategory", e.target.value)}
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
                    value={draft.colour || ""}
                    onChange={(e) => set("colour", e.target.value)}
                    placeholder="Beige"
                    className="w-20 bg-transparent text-right text-sm font-medium text-ink placeholder:text-ink-faint focus:outline-none"
                    aria-label="Colour name"
                  />
                  <label
                    className="relative h-5 w-5 cursor-pointer overflow-hidden rounded-full border border-line"
                    style={{ backgroundColor: draft.colour_hex || "#E8D8C4" }}
                    title="Choose colour swatch"
                  >
                    <input
                      type="color"
                      value={draft.colour_hex || "#E8D8C4"}
                      onChange={(e) => set("colour_hex", e.target.value)}
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
                    value={draft.pattern}
                    onChange={(e) => set("pattern", e.target.value)}
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
                    value={draft.style}
                    onChange={(e) => set("style", e.target.value)}
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

        <div className="shrink-0 border-t border-line bg-surface p-4 sm:p-5">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="btn-primary w-full py-3"
          >
            {busy ? (
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
    </div>
  );
}
