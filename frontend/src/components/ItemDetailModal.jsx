
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
    <div className="flex justify-between gap-4 border-b border-line py-2 text-sm last:border-0">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-right font-medium">{value || "—"}</dd>
    </div>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="block text-sm text-ink-soft">
      {label}
      <select
        className="field mt-1"
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
                <span
                  key={occasion}
                  className="tag bg-rose-tint text-rose-deep"
                >
                  {occasion}
                </span>
              ))}
            </div>

            {confirming ? (
              <div className="mt-6 rounded-lg bg-rose-tint p-4 text-sm">
                <p>
                  Delete “{item.item_name}” from your wardrobe? This also
                  removes any saved outfits and wear history that include it.
                  This action cannot be undone.
                </p>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setConfirming(false)}
                    disabled={busy}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn-primary"
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
                  className="btn-primary"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="mr-1 inline h-4 w-4" />
                  Edit details
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setConfirming(true)}
                >
                  <Trash2 className="mr-1 inline h-4 w-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm text-ink-soft">
              Item name
              <input
                className="field mt-1"
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
              Subcategory
              <input
                className="field mt-1"
                value={draft.subcategory || ""}
                onChange={(e) => set("subcategory", e.target.value)}
              />
            </label>

            <label className="block text-sm text-ink-soft">
              Colour
              <input
                className="field mt-1"
                value={draft.colour || ""}
                onChange={(e) => set("colour", e.target.value)}
              />
            </label>

            <label className="block text-sm text-ink-soft">
              Colour code
              <input
                className="field mt-1 h-11"
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
              <p className="mb-2 text-sm text-ink-soft">
                Suitable occasions
              </p>

              <div className="flex flex-wrap gap-2">
                {OCCASIONS.map((occasion) => (
                  <label key={occasion} className="chip cursor-pointer">
                    <input
                      type="checkbox"
                      className="mr-1.5"
                      checked={(draft.suggested_occasions || []).includes(
                        occasion
                      )}
                      onChange={() => toggleOccasion(occasion)}
                    />
                    {occasion}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setDraft(item);
                  setEditing(false);
                }}
                disabled={busy}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={busy}
              >
                {busy ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
