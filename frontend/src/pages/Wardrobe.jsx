import { useMemo, useState } from "react";
import { Plus, Search, Shirt } from "lucide-react";
import useAsync from "../hooks/useAsync";
import {
  addWardrobeItem,
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

const CATEGORY_COLORS = {
  All: "bg-[#FFEAEF] text-[#FF5C77] border-[#FBCFE8]",
  Tops: "bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]",
  Bottoms: "bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]",
  Dresses: "bg-[#FCE7F3] text-[#BE185D] border-[#FBCFE8]",
  Outerwear: "bg-[#F3E8FF] text-[#7E22CE] border-[#E9D5FF]",
  Shoes: "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]",
  Bags: "bg-[#FFEDD5] text-[#C2410C] border-[#FED7AA]",
  Other: "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]",
};

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

  const onAdd = async (payload) => {
    try {
      const created = await addWardrobeItem(payload);
      setData((current) => [created, ...(current || [])]);
      flash("Item added to wardrobe ✨");
    } catch (err) {
      flash("Couldn't add item", "error");
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
      flash("Changes saved ✓");
    } catch {
      flash("Couldn't save changes", "error");
      throw new Error("Couldn't save changes");
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
    } catch {
      flash("Couldn't delete item", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#F5E6EB]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F1D1E]">
            My Wardrobe 👗
          </h1>
          <p className="text-xs sm:text-sm font-bold text-[#8C7A82] mt-0.5">
            {items.length} {items.length === 1 ? "piece" : "pieces"} in your colorful closet
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAdding(true)}
          className="btn-coral-save flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold shadow-md w-max"
        >
          <Plus className="h-4 w-4 stroke-[3]" />
          <span>Add Clothing</span>
        </button>
      </div>

      {/* ─── Playful Candy Category Filter Pills ─── */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
        {["All", ...CATEGORIES].map((c) => {
          const isSelected = category === c;
          const candyStyle = CATEGORY_COLORS[c] || "bg-gray-100 text-black/60";
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 border ${
                isSelected
                  ? `${candyStyle} shadow-sm scale-105 font-extrabold`
                  : "bg-white text-black/55 border-gray-200 hover:border-gray-300"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* ─── Search & Occasion Filter ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items, colors, styles..."
            className="w-full rounded-full border-2 border-[#FCE4EC] bg-white pl-10 pr-4 py-2.5 text-xs font-bold text-ink placeholder:text-black/35 focus:border-[#FF5C77] focus:outline-none transition-colors"
          />
        </div>

        <select
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          className="rounded-full border-2 border-[#FCE4EC] bg-white px-4 py-2.5 text-xs font-bold text-ink focus:border-[#FF5C77] focus:outline-none cursor-pointer"
        >
          <option value="All">All Occasions</option>
          {OCCASIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      {loading && <CardSkeleton count={8} />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon={Shirt}
          title="Your closet is empty"
          message="Tap Add Clothing to upload your first favorite piece!"
          action={
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="btn-coral-save px-6 py-2.5 text-xs"
            >
              Add clothing
            </button>
          }
        />
      )}

      {/* ─── Playful Responsive Garments Grid ─── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5 pb-8">
          {filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className="cursor-pointer group playful-card p-3 shadow-xs hover:shadow-card-hover transition-all active:scale-[0.98]"
            >
              <GarmentImage
                item={item}
                className="aspect-[4/5] rounded-2xl group-hover:scale-103 transition-transform"
              />
              <div className="mt-2.5 px-1">
                <p className="truncate text-xs sm:text-sm font-bold text-[#1F1D1E]">
                  {item.item_name}
                </p>
                <div className="flex items-center justify-between mt-1 text-[10px] font-bold text-black/50">
                  <span className="truncate">{item.category}</span>
                  <span className="rounded-full bg-[#FFEAEF] text-[#FF5C77] px-2 py-0.5 shrink-0">
                    {item.times_worn ?? 0}×
                  </span>
                </div>
              </div>
            </div>
          ))}
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
