
import { useMemo, useState } from "react";
import { Plus, Search, Shirt } from "lucide-react";
import useAsync from "../hooks/useAsync";
import {
  addWardrobeItem,
  analyzeWardrobeItem,
  deleteWardrobeItem,
  getWardrobe,
  updateWardrobeItem,
} from "../services/api";
import { authConfigured } from "../services/supabase";
import { CATEGORIES, OCCASIONS } from "../utils/constants";
import { plural } from "../utils/format";
import PageHeader from "../components/ui/PageHeader";
import GarmentImage from "../components/ui/GarmentImage";
import { CardSkeleton, EmptyState, ErrorState } from "../components/ui/Feedback";
import AddClothingModal from "../components/AddClothingModal";
import ItemDetailModal from "../components/ItemDetailModal";
import Toast from "../components/ui/Toast";

export default function Wardrobe() {
  const { data, loading, error, reload, setData } = useAsync(getWardrobe);

  const [category, setCategory] = useState("All");
  const [occasion, setOccasion] = useState("All");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast] = useState(null);

  const items = data || [];
  const selected = items.find((i) => i.id === selectedId) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items.filter(
      (i) =>
        (category === "All" || i.category === category) &&
        (occasion === "All" ||
          (i.suggested_occasions || []).includes(occasion)) &&
        (!q ||
          [
            i.item_name,
            i.category,
            i.subcategory,
            i.colour,
            i.pattern,
            i.style,
          ]
            .join(" ")
            .toLowerCase()
            .includes(q))
    );
  }, [items, category, occasion, query]);

  const flash = (message, type = "ok") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2400);
  };

  const onAdd = async (payload, file) => {
    try {
      const created = await addWardrobeItem(payload, file);
      setData((current) => [created, ...(current || [])]);
      flash("Item added to your wardrobe");
      return created;
    } catch (err) {
      flash(err.message || "Couldn't add clothing item", "error");
      throw err;
    }
  };

  const onAnalyze = async (id) => {
    try {
      const result = await analyzeWardrobeItem(id);

      // The analyze response carries the cutout's signed URL and the updated
      // segmentation status, so the grid can show it as soon as this returns.
      setData((current) =>
        (current || []).map((i) =>
          i.id === id ? { ...i, ...result.item } : i
        )
      );

      return result;
    } catch (err) {
      // Analysis failures are persisted as `failed`; reflect that locally even
      // though the user's original photo and metadata are untouched.
      setData((current) =>
        (current || []).map((i) =>
          i.id === id ? { ...i, segmentation_status: "failed" } : i
        )
      );
      throw err;
    }
  };

  const onSave = async (id, patch) => {
    try {
      const updated = await updateWardrobeItem(id, patch);

      setData((current) =>
        (current || []).map((i) =>
          i.id === id ? { ...i, ...updated } : i
        )
      );

      flash("Changes saved");
    } catch (err) {
      flash(err.message || "Couldn't save changes", "error");
      throw new Error(err.message || "Couldn't save changes");
    }
  };

  const onDelete = async (item) => {
    try {
      await deleteWardrobeItem(item.id);

      setData((current) =>
        (current || []).filter((i) => i.id !== item.id)
      );

      setSelectedId(null);
      flash("Item deleted");
    } catch (err) {
      flash(err.message || "Couldn't delete that item", "error");
    }
  };

  const filtersActive =
    category !== "All" || occasion !== "All" || query.trim();

  return (
    <>
      <PageHeader
        eyebrow="My wardrobe"
        title={loading ? "Your closet" : plural(items.length, "piece")}
        action={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-4 w-4" />
            Add clothing
          </button>
        }
      />

      <div
        className="mb-5 flex flex-wrap gap-2"
        role="group"
        aria-label="Filter by category"
      >
        {["All", ...CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            className={`chip ${category === c ? "chip-active" : ""}`}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mb-8 flex flex-wrap gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            className="field !pl-10"
            placeholder="Search your closet"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search your closet"
          />
        </div>

        <select
          className="field !w-auto"
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          aria-label="Filter by occasion"
        >
          <option value="All">All occasions</option>
          {OCCASIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {loading && <CardSkeleton count={8} />}

      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon={Shirt}
          title="Your closet is empty"
          message="Add your first piece — snap a photo or pick one from your gallery."
          action={
            <button
              type="button"
              className="btn-primary"
              onClick={() => setAdding(true)}
            >
              Add clothing
            </button>
          }
        />
      )}

      {!loading && !error && items.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={Search}
          title="Nothing matches"
          message="Try a different search or clear your filters."
          action={
            filtersActive && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setCategory("All");
                  setOccasion("All");
                  setQuery("");
                }}
              >
                Clear filters
              </button>
            )
          }
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="group block w-full text-left"
                onClick={() => setSelectedId(item.id)}
              >
                <GarmentImage
                  item={item}
                  className="aspect-[4/5] transition duration-200 group-hover:shadow-card group-hover:-translate-y-0.5"
                  rounded="rounded-card"
                />

                <p className="mt-2.5 truncate text-sm font-medium">
                  {item.item_name}
                </p>

                <p className="truncate text-xs text-ink-soft">
                  {[item.category, item.subcategory]
                    .filter(Boolean)
                    .join(" · ")}{" "}
                  · worn {item.times_worn ?? 0}×
                </p>

                <p className="truncate text-xs text-ink-faint">
                  {[item.colour, item.pattern].filter(Boolean).join(" · ") ||
                    "—"}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <AddClothingModal
        open={adding}
        onClose={() => setAdding(false)}
        onSave={onAdd}
        onAnalyze={onAnalyze}
        canAnalyze={authConfigured}
      />

      <ItemDetailModal
        item={selected}
        onClose={() => setSelectedId(null)}
        onSave={onSave}
        onDelete={onDelete}
      />

      <Toast toast={toast} />
    </>
  );
}