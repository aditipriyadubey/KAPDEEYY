
import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import Modal from "./ui/Modal";
import GarmentImage from "./ui/GarmentImage";
import {
  CATEGORIES,
  OCCASIONS,
  PATTERNS,
  SEASONS,
  STYLES,
} from "../utils/constants";

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2.5 text-sm last:border-0">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-right font-semibold">{value || "—"}</dd>
    </div>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="block text-sm text-ink-soft">
      <span className="font-semibold">{label}</span>
      <select
        className="field mt-1.5"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function ItemDetailModal({
  item,
  onClose,
  onSave,
  onDelete,
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(item);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(item);
    setEditing(false);
    setConfirming(false);
  }, [item]);

  if (!item) return null;

  const set = (key, value) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const toggleOccasion = (occasion) => {
    const current = draft.suggested_occasions || [];

    set(
      "suggested_occasions",
      current.includes(occasion)
        ? current.filter((value) => value !== occasion)
        : [...current, occasion]
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);

    try {
      await onSave(item.id, {
        item_name: draft.item_name.trim(),
        category: draft.category,
        subcategory: draft.subcategory || null,
        colour: draft.colour || null,
        colour_hex: draft.colour_hex || null,
        pattern: draft.pattern || null,
        style: draft.style || null,
        season: draft.season || null,
        suggested_occasions: draft.suggested_occasions || [],
      });

      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);

    try {
      await onDelete(item);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={editing ? "Edit details" : item.item_name}
      wide
    >
      <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
        <GarmentImage
          item={item}
          className="aspect-square sm:aspect-[3/4]"
          rounded="rounded-lg"
        />

        {!editing ? (
          <div>
            <dl>
              <Row label="Category" value={item.category} />
              <Row label="Subcategory" value={item.subcategory} />
              <Row label="Colour" value={item.colour} />
              <Row label="Pattern" value={item.pattern} />
              <Row label="Style" value={item.style} />
              <Row label="Season" value={item.season} />
              <Row
                label="Worn"
                value={`${item.times_worn ?? 0}×`}
              />
            </dl>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {(item.suggested_occasions || []).map((occasion) => (
                <span key={occasion} className="tag">
                  {occasion}
                </span>
              ))}
            </div>

            {confirming ? (
              <div className="mt-6 rounded-lg border border-danger/20 bg-danger-tint p-4 text-sm">
                <p className="text-ink">
                  Delete "{item.item_name}" from your wardrobe? This action
                  cannot be undone.
                </p>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn-secondary py-2 text-xs"
                    onClick={() => setConfirming(false)}
                    disabled={busy}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-lg bg-danger px-5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    onClick={remove}
                    disabled={busy}
                  >
                    {busy ? "Deleting..." : "Yes, delete"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary py-2 text-xs"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit details
                </button>

                <button
                  type="button"
                  className="btn-secondary py-2 text-xs text-danger"
                  onClick={() => setConfirming(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm text-ink-soft">
              <span className="font-semibold">Item name</span>
              <input
                className="field mt-1.5"
                value={draft.item_name || ""}
                onChange={(e) => set("item_name", e.target.value)}
                maxLength={80}
                required
              />
            </label>

            <Select
              label="Category"
              value={draft.category}
              options={CATEGORIES}
              onChange={(value) => set("category", value)}
            />

            <label className="block text-sm text-ink-soft">
              <span className="font-semibold">Subcategory</span>
              <input
                className="field mt-1.5"
                value={draft.subcategory || ""}
                onChange={(e) => set("subcategory", e.target.value)}
              />
            </label>

            <label className="block text-sm text-ink-soft">
              <span className="font-semibold">Colour</span>
              <input
                className="field mt-1.5"
                value={draft.colour || ""}
                onChange={(e) => set("colour", e.target.value)}
              />
            </label>

            <label className="block text-sm text-ink-soft">
              <span className="font-semibold">Colour code</span>
              <input
                className="field mt-1.5 h-11"
                type="color"
                value={draft.colour_hex || "#EFEADF"}
                onChange={(e) => set("colour_hex", e.target.value)}
              />
            </label>

            <Select
              label="Pattern"
              value={draft.pattern}
              options={PATTERNS}
              onChange={(value) => set("pattern", value)}
            />

            <Select
              label="Style"
              value={draft.style}
              options={STYLES}
              onChange={(value) => set("style", value)}
            />

            <Select
              label="Season"
              value={draft.season}
              options={SEASONS}
              onChange={(value) => set("season", value)}
            />

            <div>
              <p className="mb-2 text-sm font-semibold text-ink-soft">
                Suitable occasions
              </p>

              <div className="flex flex-wrap gap-2">
                {OCCASIONS.map((occasion) => (
                  <button
                    key={occasion}
                    type="button"
                    className={`chip !py-1.5 !px-3.5 text-[13px] ${
                      (draft.suggested_occasions || []).includes(occasion) ? "chip-active" : ""
                    }`}
                    onClick={() => toggleOccasion(occasion)}
                  >
                    {occasion}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                className="btn-secondary py-2 text-xs"
                onClick={() => {
                  setDraft(item);
                  setEditing(false);
                }}
                disabled={busy}
              >
                Cancel
              </button>

              <button type="submit" className="btn-primary py-2 text-xs" disabled={busy}>
                {busy ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
