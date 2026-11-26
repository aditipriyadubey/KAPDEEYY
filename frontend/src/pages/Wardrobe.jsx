import { useMemo, useState } from "react";
import { Plus, Search, Shirt } from "lucide-react";
import useAsync from "../hooks/useAsync";
import {
  createGarment,
  deleteWardrobeItem,
  getWardrobe,
  updateWardrobeItem,
} from "../services/api";
import { CATEGORIES, OCCASIONS } from "../utils/constants";
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
    setTimeout(() => setToast(null), type === "error" ? 6000 : 2400);
  };

  const onAdd = async (metadata, file, onStage) => {
    try {
      const { item, segmentationError } = await createGarment({ file, metadata, onStage });
      setData((current) => [item, ...(current || []).filter((i) => i.id !== item.id)]);
      if (segmentationError) {
        flash(`Garment saved, but segmentation failed: ${segmentationError}`, "error");
      } else {
        flash("Item added to your wardrobe");
      }
      return { item, segmentationError };
    } catch (err) {
      flash("Couldn't add item", "error");
      throw err;
    }
  };

  const onSave = async (id, patch) => {
    try {
      const updated = await updateWardrobeItem(id, patch);
      setData((current) =>
        (current || []).map((i) => (i.id === id ? { ...i, ...updated } : i))
      );
      flash("Changes saved");
    } catch {
      flash("Couldn't save changes", "error");
      throw new Error("Couldn't save changes");
    }
  };

  const onDelete = async (item) => {
    try {
      await deleteWardrobeItem(item.id);
      setData((current) => (current || []).filter((i) => i.id !== item.id));
      setSelectedId(null);
      flash("Item deleted");
    } catch {
      flash("Couldn't delete item", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col justify-between gap-4 border-b border-line pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Collection</p>
          <h1 className="mt-1 font-display text-2xl font-normal tracking-tight text-ink sm:text-3xl">
            My Wardrobe
          </h1>
          <p className="mt-1 text-xs text-ink-soft sm:text-sm">
            {items.length} {items.length === 1 ? "piece" : "pieces"} in your wardrobe
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAdding(true)}
          className="btn-primary w-max px-4 py-2 text-[13px]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.2} />
          <span>Add Clothing</span>
        </button>
      </div>

      {/* ─── Category filters ─── */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
        {["All", ...CATEGORIES].map((c) => {
          const isSelected = category === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={isSelected}
              className={`${isSelected ? "chip chip-active" : "chip"} shrink-0`}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* ─── Search & occasion filter ─── */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            strokeWidth={1.8}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items, colours, styles"
            aria-label="Search wardrobe"
            className="field py-2 pl-9 text-[13px]"
          />
        </div>

        <select
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          aria-label="Filter by occasion"
          className="field w-auto cursor-pointer py-2 text-[13px] sm:min-w-[160px]"
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
          title="Your wardrobe is empty"
          message="Add your first piece to start building outfits."
          action={
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="btn-primary"
            >
              Add clothing
            </button>
          }
        />
      )}

      {/* ─── Garments grid ─── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-3 pb-6 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className="group rounded-xl border border-line bg-surface p-2.5 text-left transition-colors hover:border-ink/30"
            >
              <GarmentImage item={item} className="aspect-[4/5] rounded-lg" />
              <div className="px-0.5 pb-0.5 pt-2.5">
                <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">
                  {item.item_name}
                </p>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-ink-faint">
                  <span className="truncate">{item.category}</span>
                  <span className="shrink-0">{item.times_worn ?? 0}× worn</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && !error && items.length > 0 && filtered.length === 0 && (
        <div className="card px-6 py-10 text-center">
          <p className="text-sm font-medium text-ink">No matching items</p>
          <p className="mt-1 text-xs text-ink-soft">
            Try a different search or clear the filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("All");
              setOccasion("All");
            }}
            className="btn-secondary mt-4 py-2 text-xs"
          >
            Clear filters
          </button>
        </div>
      )}

      <AddClothingModal
        open={adding}
        onClose={() => setAdding(false)}
        onSave={onAdd}
      />

      <ItemDetailModal
        item={selected}
        onClose={() => setSelectedId(null)}
        onSave={onSave}
        onDelete={onDelete}
      />

      <Toast toast={toast} />
    </div>
  );
}
