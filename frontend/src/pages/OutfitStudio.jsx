import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Shirt, Sparkles } from "lucide-react";
import { generateOutfits, remixOutfits, surpriseOutfits } from "../services/api";
import { OCCASIONS } from "../utils/constants";
import useOutfitActions from "../hooks/useOutfitActions";
import StudioOutfitCard from "../components/StudioOutfitCard";
import { CardSkeleton, EmptyState, ErrorState } from "../components/ui/Feedback";
import Toast from "../components/ui/Toast";

const HERO_JACKET = "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=700&auto=format&fit=crop&q=80";

export default function OutfitStudio() {
  const navigate = useNavigate();
  const [occasion, setOccasion] = useState("College");
  const [filterTab, setFilterTab] = useState("Outfits");
  const [outfits, setOutfits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const actions = useOutfitActions();

  const load = useCallback(async (nextMode, occ) => {
    setLoading(true);
    setError(null);
    try {
      const res =
        nextMode === "remix" ? await remixOutfits(occ)
        : nextMode === "surprise" ? await surpriseOutfits()
        : await generateOutfits(occ);
      setOutfits(res.outfits || []);
    } catch (err) {
      setError(err?.message || "Couldn't build outfits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("generate", "College");
  }, [load]);

  // Filter outfits if a specific piece category is selected
  const displayedOutfits = outfits.filter((o) => {
    if (filterTab === "Outfits") return true;
    if (filterTab === "Trousers") return o.items.some((i) => i.category === "Bottoms");
    if (filterTab === "Shoes") return o.items.some((i) => i.category === "Shoes");
    if (filterTab === "Headdress") return o.items.some((i) => ["Accessories", "Bags"].includes(i.category));
    return true;
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      
      {/* ─── 1. Top Pastel Mint Green Canvas (Reference Image 2 Screen 3) ─── */}
      <div className="rounded-[32px] sm:rounded-[36px] bg-[#D7F5DF] p-4 sm:p-7 shadow-[0_8px_24px_rgba(182,242,199,0.35)] relative overflow-hidden border border-[#B6F2C7]">
        
        {/* Navigation Bar inside Mint Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1 -ml-1 text-[#124C27] hover:bg-white/40 rounded-full transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5 stroke-[2.5]" />
          </button>
          
          <h2 className="text-sm sm:text-base font-bold text-[#124C27]">
            Creating an outfit
          </h2>

          <div className="w-5" /> {/* Spacer to keep title centered */}
        </div>

        {/* Studio Content: Heading + Connected Pieces (Left) & Hero Jacket (Right) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          
          {/* Left: Heading & Connected Floating Pieces (7 cols on md) */}
          <div className="md:col-span-7 space-y-4">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#124C27] leading-[1.15]">
              Let's pick an outfit<br />for this thing
            </h1>

            {/* Connected Floating Piece Badges with Taglines (Reference Image 2 Screen 3) */}
            <div className="space-y-2.5 pt-1 relative">
              {/* Bubble 1: Boots + "to warmth" */}
              <div className="flex items-center gap-2 group cursor-pointer">
                <div className="relative">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm border border-[#B6F2C7] text-xl group-hover:scale-105 transition-transform">
                    👢
                  </span>
                  <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#B6F2C7] text-[#0F4722] text-[10px] font-black border border-white">
                    +1
                  </span>
                </div>
                <span className="rounded-full bg-white/80 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold text-[#124C27] border border-[#B6F2C7]/60 shadow-2xs">
                  to warmth
                </span>
              </div>

              {/* Bubble 2: Trousers + "to brightness" (staggered slightly to right) */}
              <div className="flex items-center gap-2 ml-4 sm:ml-6 group cursor-pointer">
                <div className="relative">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm border border-[#B6F2C7] text-xl group-hover:scale-105 transition-transform">
                    👖
                  </span>
                  <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#B6F2C7] text-[#0F4722] text-[10px] font-black border border-white">
                    +2
                  </span>
                </div>
                <span className="rounded-full bg-white/80 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold text-[#124C27] border border-[#B6F2C7]/60 shadow-2xs">
                  to brightness
                </span>
              </div>

              {/* Bubble 3: Sunglasses + "to convenience" */}
              <div className="flex items-center gap-2 group cursor-pointer">
                <div className="relative">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm border border-[#B6F2C7] text-xl group-hover:scale-105 transition-transform">
                    🕶️
                  </span>
                  <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#B6F2C7] text-[#0F4722] text-[10px] font-black border border-white">
                    +5
                  </span>
                </div>
                <span className="rounded-full bg-white/80 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold text-[#124C27] border border-[#B6F2C7]/60 shadow-2xs">
                  to convenience
                </span>
              </div>
            </div>
          </div>

          {/* Right: Featured Beige Jacket Cutout on Wooden Hanger (5 cols on md) */}
          <div className="md:col-span-5 flex justify-center items-center py-2 relative">
            <img
              src={HERO_JACKET}
              alt="Beige Teddy Fleece"
              className="h-44 sm:h-56 md:h-64 object-contain filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.14)] hover:scale-105 transition-transform duration-300"
            />
          </div>
        </div>
      </div>

      {/* ─── 2. Filter Pills Bar (Reference Image 2 Screen 3) ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#F5E6EB]">
        
        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => setFilterTab("Outfits")}
            className={`px-4 py-1.5 rounded-full text-xs font-black transition-all shrink-0 ${
              filterTab === "Outfits"
                ? "bg-[#B6F2C7] text-[#0F4722] shadow-2xs"
                : "bg-white text-black/60 border border-gray-200"
            }`}
          >
            Outfits
          </button>

          <button
            type="button"
            onClick={() => setFilterTab("Trousers")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
              filterTab === "Trousers"
                ? "bg-[#B6F2C7] text-[#0F4722]"
                : "bg-white text-black/60 border border-gray-200"
            }`}
          >
            <span>Trousers</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#FDE68A] text-[#78350F] text-[10px] font-black">
              +1
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab("Shoes")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
              filterTab === "Shoes"
                ? "bg-[#B6F2C7] text-[#0F4722]"
                : "bg-white text-black/60 border border-gray-200"
            }`}
          >
            <span>Shoes</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#FDE68A] text-[#78350F] text-[10px] font-black">
              +1
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab("Headdress")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
              filterTab === "Headdress"
                ? "bg-[#B6F2C7] text-[#0F4722]"
                : "bg-white text-black/60 border border-gray-200"
            }`}
          >
            <span>Headdress</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#FDE68A] text-[#78350F] text-[10px] font-black">
              +1
            </span>
          </button>
        </div>

        {/* Occasions + Remix Action */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {OCCASIONS.map((occ) => (
              <button
                key={occ}
                type="button"
                onClick={() => { setOccasion(occ); load("generate", occ); }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  occasion === occ
                    ? "bg-[#FF5C77] text-white shadow-xs"
                    : "bg-white text-black/60 border border-[#FCE4EC] hover:bg-gray-50"
                }`}
              >
                {occ}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => load("remix", occasion)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-full bg-[#FFF0F3] text-[#FF5C77] px-3 py-1.5 text-xs font-bold hover:bg-[#FFE5EB] active:scale-95 transition-all shrink-0 border border-[#FBCFE8]"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            <span>Remix</span>
          </button>
        </div>
      </div>

      {/* ─── 3. Outfits Boutique Grid (Reference Image 2 Screen 3) ─── */}
      {loading && <CardSkeleton tall count={2} />}
      {error && !loading && <ErrorState message={error} onRetry={() => load("generate", occasion)} />}

      {!loading && !error && displayedOutfits.length === 0 && (
        <EmptyState
          icon={Shirt}
          title="No outfits for this filter"
          message="Try tapping 'Outfits' tab or remixing to discover fresh combinations."
        />
      )}

      {!loading && !error && displayedOutfits.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {displayedOutfits.map((o, i) => (
            <StudioOutfitCard
              key={o.id}
              outfit={o}
              index={i}
              state={actions.stateFor(o)}
              busy={actions.busyId === o.id}
              onSave={actions.onSave}
              onNotForMe={actions.onNotForMe}
              onWorn={actions.onWorn}
            />
          ))}
        </div>
      )}

      <Toast toast={actions.toast} />
    </div>
  );
}
