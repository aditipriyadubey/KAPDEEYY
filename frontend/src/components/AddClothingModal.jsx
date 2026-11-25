import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Image as ImageIcon,
  Info,
  Loader2,
  Sparkles,
} from "lucide-react";
import Modal from "./ui/Modal";
import {
  CATEGORIES,
  OCCASIONS,
  PATTERNS,
  SEASONS,
  STYLES,
} from "../utils/constants";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_MB = 10;

const INITIAL = {
  item_name: "",
  category: "Tops",
  subcategory: "",
  colour: "",
  colour_hex: "",
  pattern: "Solid",
  style: "Minimal",
  suggested_occasions: ["Casual"],
  season: "All-season",
};

function describeAnalysisError(error) {
  const message = String(error?.message || "").trim();
  const lower = message.toLowerCase();

  if (
    lower.includes("gemini_api_key") ||
    (lower.includes("gemini") && lower.includes("not configured")) ||
    (lower.includes("classification") && lower.includes("not configured"))
  ) {
    return "AI classification isn’t configured yet. Your item was saved — keep your details or edit them manually.";
  }

  if (error?.status === 401 || error?.status === 403) {
    return "Your session needs refreshing before AI analysis. Your item was saved — sign in again and retry.";
  }

  if (lower.includes("no garment")) {
    return "We couldn’t find a garment in that photo. Try a clearer photo of one item, or keep your details.";
  }

  if (
    lower.includes("not running") ||
    lower.includes("unavailable") ||
    lower.includes("not reachable") ||
    lower.includes("network error") ||
    lower.includes("failed to fetch")
  ) {
    return "AI analysis is temporarily unavailable. Your item was saved — try again later or keep your details.";
  }

  if (lower.includes("timed out") || lower.includes("timeout")) {
    return "AI analysis took too long. Your item was saved — try again, or keep your details.";
  }

  if (error?.status === 409) {
    return "That photo isn’t available for analysis. Your item was saved — keep your details or replace the photo.";
  }

  if (lower.includes("classification failed") || lower.includes("gemini")) {
    return "Gemini couldn’t classify this garment. Your item was saved — try again, or keep your details.";
  }

  if (message) {
    return `${message} Your item was saved with your details.`;
  }

  return "AI analysis couldn’t finish. Your item was saved with your details.";
}

function AnalysisProgress({ phase, preview }) {
  const analyzing = phase === "analyzing";

  return (
    <div className="space-y-4" role="status" aria-live="polite">
      {preview && (
        <div className="rounded-card border border-line p-3">
          <img
            src={preview}
            alt="Item being analyzed"
            className="mx-auto max-h-52 object-contain opacity-80"
          />
        </div>
      )}

      <div className="flex items-start gap-3 rounded-card border border-line bg-white p-4">
        <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-rose-deep" />
        <div>
          <p className="text-sm font-medium">
            {analyzing ? "Analyzing your photo…" : "Saving your item…"}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {analyzing
              ? "RF-DETR is removing the background, then Gemini is suggesting details. This can take up to a minute on first use."
              : "Uploading the photo and creating the wardrobe item."}
          </p>
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-rose" />
      </div>

      <p className="text-xs text-ink-faint">
        You can’t close this window while analysis is running. If it fails, your
        item stays saved with the details you entered.
      </p>
    </div>
  );
}

export default function AddClothingModal({
  open,
  onClose,
  onSave,
  onAnalyze,
  canAnalyze = true,
}) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const openRef = useRef(open);

  const [draft, setDraft] = useState(INITIAL);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // form → saving → analyzing → review (or failed after an analysis error)
  const [phase, setPhase] = useState("form");
  const [createdItem, setCreatedItem] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) {
      setDraft(INITIAL);
      setFile(null);
      setPreview(null);
      setError(null);
      setBusy(false);
      setPhase("form");
      setCreatedItem(null);
      setAnalysis(null);
      setSuggestions(null);
      setAnalysisError(null);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const set = (key, value) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const setSuggestion = (key, value) =>
    setSuggestions((current) => ({ ...current, [key]: value }));

  const requestClose = () => {
    if (!busy) onClose();
  };

  const onPick = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;

    if (!ACCEPT.split(",").includes(picked.type)) {
      setError("Please choose a JPG, PNG or WebP image.");
      return;
    }

    if (picked.size > MAX_MB * 1024 * 1024) {
      setError(`That image is larger than ${MAX_MB} MB.`);
      return;
    }

    setError(null);
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  };

  const toggleOccasion = (occasion) => {
    set(
      "suggested_occasions",
      draft.suggested_occasions.includes(occasion)
        ? draft.suggested_occasions.filter((value) => value !== occasion)
        : [...draft.suggested_occasions, occasion]
    );
  };

  const validatedPayload = () => {
    if (!draft.item_name.trim()) {
      setError("Please enter an item name.");
      return null;
    }

    if (!file) {
      setError("Please add a photo of this item.");
      return null;
    }

    return {
      ...draft,
      item_name: draft.item_name.trim(),
      subcategory: draft.subcategory.trim() || null,
      colour: draft.colour.trim() || null,
      colour_hex: draft.colour_hex || null,
    };
  };

  const submit = async (e) => {
    e.preventDefault();

    const payload = validatedPayload();
    if (!payload) return;

    setBusy(true);
    setError(null);

    try {
      await onSave(payload, file);
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save this clothing item.");
    } finally {
      setBusy(false);
    }
  };

  const runAnalysis = async (item) => {
    setPhase("analyzing");
    setAnalysisError(null);
    setBusy(true);

    try {
      const result = await onAnalyze(item.id);
      if (!openRef.current) return;

      const analyzedItem = { ...item, ...result.item };
      const next = result.suggestions || {};

      // Only the five fields the AI actually suggests are offered for review.
      // Pattern, season and occasions keep the values the user already chose.
      setCreatedItem(analyzedItem);
      setAnalysis(result);
      setSuggestions({
        item_name: (next.item_name || analyzedItem.item_name || "").trim(),
        category: CATEGORIES.includes(next.category)
          ? next.category
          : analyzedItem.category,
        // Missing suggestions fall back to what the user already saved so an
        // explicit save can never blank a field the AI did not classify.
        subcategory: next.subcategory || analyzedItem.subcategory || "",
        colour: next.colour || analyzedItem.colour || "",
        style: STYLES.includes(next.style)
          ? next.style
          : analyzedItem.style || "",
      });
      setPhase("review");
    } catch (err) {
      if (!openRef.current) return;
      setAnalysisError(describeAnalysisError(err));
      setPhase("failed");
    } finally {
      if (openRef.current) setBusy(false);
    }
  };

  const startAnalysis = async () => {
    setError(null);

    let item = createdItem;

    if (!item) {
      const payload = validatedPayload();
      if (!payload) return;

      setPhase("saving");
      setBusy(true);

      try {
        item = await onSave(payload, file);
      } catch (err) {
        if (!openRef.current) return;
        setPhase("form");
        setError(err.message || "Couldn't save this clothing item.");
        setBusy(false);
        return;
      }

      if (!openRef.current) return;
      setCreatedItem(item);
    }

    await runAnalysis(item);
  };

  const retryAnalysis = () => {
    if (createdItem && !busy) runAnalysis(createdItem);
  };

  const submitSuggestions = async (e) => {
    e.preventDefault();

    if (!createdItem || !suggestions) return;

    if (!suggestions.item_name.trim()) {
      setAnalysisError("Please enter an item name.");
      return;
    }

    setBusy(true);
    setAnalysisError(null);

    try {
      // The PATCH is only sent after an explicit review. It intentionally
      // updates these five fields and leaves pattern/season/occasions alone.
      await onSave(createdItem.id, {
        item_name: suggestions.item_name.trim(),
        category: suggestions.category,
        subcategory: suggestions.subcategory.trim() || null,
        colour: suggestions.colour.trim() || null,
        style: suggestions.style || null,
      });

      onClose();
    } catch (err) {
      setAnalysisError(err.message || "Couldn't save these details.");
    } finally {
      setBusy(false);
    }
  };

  const title =
    phase === "review"
      ? "Review AI suggestions"
      : phase === "failed"
        ? "AI analysis"
        : "Add clothing";

  const imageSrc = createdItem?.image_url || preview;
  const rawConfidence = Number(analysis?.detection?.confidence);
  const confidence =
    Number.isFinite(rawConfidence) && rawConfidence >= 0 && rawConfidence <= 1
      ? rawConfidence
      : null;

  return (
    <Modal open={open} onClose={requestClose} title={title} wide>
      {phase === "saving" || phase === "analyzing" ? (
        <AnalysisProgress phase={phase} preview={preview} />
      ) : phase === "failed" ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-card border border-rose-deep/20 bg-rose-tint p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-deep" />
            <div>
              <p className="text-sm font-medium">
                Item saved — AI analysis didn’t finish
              </p>
              <p className="mt-1 text-sm text-ink-soft">{analysisError}</p>
            </div>
          </div>

          {imageSrc && (
            <div className="rounded-card border border-line p-3">
              <img
                src={imageSrc}
                alt={createdItem?.item_name || "Saved clothing item"}
                className="mx-auto max-h-52 object-contain"
              />
            </div>
          )}

          <p className="text-sm text-ink-soft">
            Your manual entry is safe in the wardrobe. You can retry the AI
            analysis or keep the details exactly as entered.
          </p>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={busy}
            >
              Keep my details
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={retryAnalysis}
              disabled={busy}
            >
              <Sparkles className="h-4 w-4" />
              Try AI again
            </button>
          </div>
        </div>
      ) : phase === "review" && suggestions ? (
        <form onSubmit={submitSuggestions} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            {imageSrc && (
              <div className="rounded-card border border-line bg-white p-2">
                <img
                  src={imageSrc}
                  alt={createdItem?.item_name || "Analyzed clothing item"}
                  className="aspect-square w-full rounded-lg object-contain"
                />
              </div>
            )}

            <div className="rounded-card border border-line bg-white p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-rose-deep" />
                AI suggestions ready
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                Review and edit these values. Nothing changes until you press
                “Save suggestions”.
              </p>
              {analysis?.detection?.label && (
                <p className="mt-3 text-xs text-ink-faint">
                  Detected: {analysis.detection.label}
                  {confidence !== null
                    ? ` · ${Math.round(confidence * 100)}% confidence`
                    : ""}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              Item name *
              <input
                className="field mt-1"
                value={suggestions.item_name}
                onChange={(e) => setSuggestion("item_name", e.target.value)}
                maxLength={80}
                required
              />
            </label>

            <label className="block text-sm">
              Category *
              <select
                className="field mt-1"
                value={suggestions.category}
                onChange={(e) => setSuggestion("category", e.target.value)}
              >
                {CATEGORIES.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              Subcategory
              <input
                className="field mt-1"
                value={suggestions.subcategory}
                onChange={(e) => setSuggestion("subcategory", e.target.value)}
              />
            </label>

            <label className="block text-sm">
              Colour
              <input
                className="field mt-1"
                value={suggestions.colour}
                onChange={(e) => setSuggestion("colour", e.target.value)}
              />
            </label>

            <label className="block text-sm">
              Style
              <select
                className="field mt-1"
                value={suggestions.style}
                onChange={(e) => setSuggestion("style", e.target.value)}
              >
                <option value="">No style</option>
                {STYLES.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>

          <p className="flex items-start gap-2 rounded-lg bg-sage-tint px-3 py-2.5 text-xs text-ink-soft">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {analysis?.privacy_notice ||
              "The garment cutout is processed by Google Gemini for classification."}
          </p>

          {analysisError && (
            <p role="alert" className="text-sm text-rose-deep">
              {analysisError}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={requestClose}
              disabled={busy}
            >
              Keep my details
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Saving..." : "Save suggestions"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">
              Item name *
            </label>
            <input
              className="field mt-1"
              placeholder="e.g. Ivory Ribbed Tee"
              value={draft.item_name}
              onChange={(e) => set("item_name", e.target.value)}
              maxLength={80}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              Category *
              <select
                className="field mt-1"
                value={draft.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {CATEGORIES.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              Subcategory
              <input
                className="field mt-1"
                placeholder="e.g. T-shirt"
                value={draft.subcategory}
                onChange={(e) => set("subcategory", e.target.value)}
              />
            </label>

            <label className="block text-sm">
              Colour
              <input
                className="field mt-1"
                placeholder="e.g. Ivory"
                value={draft.colour}
                onChange={(e) => set("colour", e.target.value)}
              />
            </label>

            <label className="block text-sm">
              Colour code
              <input
                className="field mt-1"
                type="color"
                value={draft.colour_hex || "#EFEADF"}
                onChange={(e) => set("colour_hex", e.target.value)}
              />
            </label>

            <label className="block text-sm">
              Pattern
              <select
                className="field mt-1"
                value={draft.pattern}
                onChange={(e) => set("pattern", e.target.value)}
              >
                {PATTERNS.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              Style
              <select
                className="field mt-1"
                value={draft.style}
                onChange={(e) => set("style", e.target.value)}
              >
                {STYLES.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm sm:col-span-2">
              Season
              <select
                className="field mt-1"
                value={draft.season}
                onChange={(e) => set("season", e.target.value)}
              >
                {SEASONS.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Suitable occasions</p>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((occasion) => (
                <label key={occasion} className="chip cursor-pointer">
                  <input
                    type="checkbox"
                    className="mr-1.5"
                    checked={draft.suggested_occasions.includes(occasion)}
                    onChange={() => toggleOccasion(occasion)}
                  />
                  {occasion}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onPick}
            />
            <input
              ref={galleryRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={onPick}
            />

            {preview ? (
              <div className="rounded-card border border-line p-3">
                <img
                  src={preview}
                  alt="Selected clothing"
                  className="mx-auto max-h-52 object-contain"
                />
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => galleryRef.current?.click()}
                    disabled={busy}
                  >
                    <ImageIcon className="mr-1 inline h-4 w-4" />
                    Replace image
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => cameraRef.current?.click()}
                >
                  <Camera className="mr-1 inline h-4 w-4" />
                  Take photo
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => galleryRef.current?.click()}
                >
                  <ImageIcon className="mr-1 inline h-4 w-4" />
                  Choose image
                </button>
              </div>
            )}
          </div>

          <p className="flex items-start gap-2 rounded-lg bg-sage-tint px-3 py-2.5 text-xs text-ink-soft">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Your photo is stored privately and only visible to you. For AI garment
            analysis, the cutout is processed by Google Gemini.
          </p>

          {error && (
            <p role="alert" className="text-sm text-rose-deep">{error}</p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={requestClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={canAnalyze ? "btn-secondary" : "btn-primary"}
              disabled={busy}
            >
              {busy ? "Saving..." : "Save to wardrobe"}
            </button>
            {canAnalyze && (
              <button
                type="button"
                className="btn-primary"
                onClick={startAnalysis}
                disabled={busy}
              >
                <Sparkles className="h-4 w-4" />
                Save &amp; analyze
              </button>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}
