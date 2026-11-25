import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Bell, Check, Plus, Search, Shirt, Sparkles } from "lucide-react";
import useAsync from "../hooks/useAsync";
import useOutfitActions from "../hooks/useOutfitActions";
import { getTodayOutfit, getWardrobeStats } from "../services/api";
import { useAuth } from "../context/AuthContext";
import OutfitCollage from "../components/ui/OutfitCollage";
import { EmptyState, ErrorState } from "../components/ui/Feedback";
import Toast from "../components/ui/Toast";
import { useNotifications } from "../context/NotificationContext";

export default function Today() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const stats = useAsync(getWardrobeStats);
  const today = useAsync(getTodayOutfit);
  const actions = useOutfitActions();

  const [activeDay, setActiveDay] = useState("Mon 23");
  const { unreadCount, openNotifications } = useNotifications();
  const outfit = today.data;
  const worn = outfit && actions.stateFor(outfit).wornToday;

  const days = [
    { label: "Sun", date: "22" },
    { label: "Mon", date: "23" },
    { label: "Tue", date: "24" },
    { label: "Wed", date: "25" },
    { label: "Thu", date: "26" },
    { label: "Fri", date: "27" },
    { label: "Sat", date: "28" },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      
      {/* ─── 1. Playful Greeting Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar with playful colorful ring */}
          <div className="h-12 w-12 rounded-full overflow-hidden border-3 border-[#FF5C77] bg-[#FFEAEF] flex items-center justify-center shadow-sm shrink-0">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80"
              alt="Mary Avatar"
              className="h-full w-full object-cover"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.parentElement.innerHTML = `<span class="font-bold text-base text-[#FF5C77]">M</span>`;
              }}
            />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1F1D1E] leading-tight">
              Hi, {user?.full_name?.split(" ")[0] || "Mary"} 👋
            </h1>
            <p className="text-xs sm:text-sm text-[#7D7377] font-semibold">
              Build your own wardrobe!
            </p>
          </div>
        </div>

        {/* Notifications & Search Round Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openNotifications}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white border-2 border-[#FCE4EC] shadow-sm text-black/70 hover:text-[#FF5C77] hover:border-[#FF5C77] transition-colors cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-[#FF5C77] border-2 border-white" />
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate("/wardrobe")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white border-2 border-[#FCE4EC] shadow-sm text-black/70 hover:text-[#FF5C77] hover:border-[#FF5C77] transition-colors"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ─── 2. Vibrant Mint "New item" Card (Reference Image 2 Screen 1) ─── */}
      <div
        onClick={() => navigate("/studio")}
        className="cursor-pointer rounded-[30px] bg-gradient-to-r from-[#B9F5CB] via-[#C9F8D6] to-[#DCFAE5] p-5 sm:p-7 shadow-[0_8px_24px_rgba(185,245,203,0.45)] hover:shadow-lg active:scale-[0.99] transition-all relative overflow-hidden group border-2 border-[#A6EFBC]"
      >
        <div className="flex justify-between items-center gap-4">
          <div className="z-10 max-w-xs sm:max-w-md">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#124C27] leading-tight">
              New item
            </h2>
            <p className="text-xs sm:text-sm text-[#2E7A4A] font-bold mt-0.5">
              Choose an outfit for this item!
            </p>

            {/* Garment thumbnail stickers + '+6' badge */}
            <div className="flex items-center gap-2 mt-3 sm:mt-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/90 text-lg shadow-sm border border-[#A6EFBC]">
                🧥
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/90 text-lg shadow-sm border border-[#A6EFBC]">
                🕶️
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/90 text-lg shadow-sm border border-[#A6EFBC]">
                👢
              </span>
              <span className="flex items-center justify-center rounded-full bg-[#186234] text-white text-[11px] sm:text-xs font-black px-3 py-1 shadow-sm">
                +6
              </span>
            </div>
          </div>

          {/* Floating Realistic Beige Fleece Jacket */}
          <div className="relative h-28 w-28 sm:h-36 sm:w-36 shrink-0 flex items-center justify-center">
            <img
              src="https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&auto=format&fit=crop&q=80"
              alt="Teddy fleece jacket"
              className="max-h-full max-w-full object-contain filter drop-shadow-lg group-hover:scale-108 transition-transform duration-300"
            />
          </div>
        </div>

        {/* 3 Pagination dots */}
        <div className="flex justify-center gap-1.5 mt-3">
          <span className="h-2 w-6 rounded-full bg-[#186234]" />
          <span className="h-2 w-2 rounded-full bg-[#82D89C]" />
          <span className="h-2 w-2 rounded-full bg-[#82D89C]" />
        </div>
      </div>

      {/* ─── 3. 7-Day Calendar Strip (Sun 22 - Sat 28) ─── */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1">
        {days.map(({ label, date }) => {
          const key = `${label} ${date}`;
          const isSelected = activeDay === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveDay(key)}
              className={`flex-1 flex flex-col items-center justify-center min-w-[46px] sm:min-w-[54px] py-2.5 sm:py-3 rounded-2xl font-bold transition-all ${
                isSelected
                  ? "bg-[#FF5C77] text-white shadow-[0_6px_16px_rgba(255,92,119,0.45)] scale-105 border-2 border-[#FF3859]"
                  : "bg-white text-black/55 border-2 border-[#FCE4EC] hover:border-[#FF5C77]/50"
              }`}
            >
              <span className={`text-[10px] sm:text-xs font-bold ${isSelected ? "text-white" : "text-black/45"}`}>{label}</span>
              <span className={`text-base sm:text-lg font-black mt-0.5 ${isSelected ? "text-white" : "text-black/85"}`}>{date}</span>
            </button>
          );
        })}
      </div>

      {/* ─── 4. "Your outfit for today" Section ─── */}
      <div>
        <h3 className="text-base sm:text-lg font-bold text-[#1F1D1E] mb-2.5">
          Your outfit for today
        </h3>

        {today.loading && <div className="skeleton h-52 rounded-[28px]" />}
        {today.error && <ErrorState message={today.error} onRetry={today.reload} />}

        {!today.loading && !today.error && !outfit && (
          <EmptyState
            icon={Shirt}
            title="Add a few pieces first"
            message="Upload some clothes to generate your styled look for today!"
            action={<button onClick={() => navigate("/wardrobe")} className="btn-coral-save px-6 py-2.5 text-xs">Open Wardrobe</button>}
          />
        )}

        {outfit && (
          <div className="playful-card p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6 border-2 border-[#FCE4EC]">
            {/* Collage of garment pieces */}
            <div className="sm:w-2/5 shrink-0 rounded-2xl bg-[#F0FAF3] p-3 flex items-center justify-center border border-[#C8F2D5]">
              <OutfitCollage items={outfit.items} showLabels={false} className="w-full" />
            </div>

            {/* Details matching Reference Image 2 Screen 1 */}
            <div className="flex-1 flex flex-col justify-between py-1">
              <div>
                <span className="text-xs font-bold text-[#8C7A82] uppercase tracking-wider">
                  Autumn
                </span>
                <h4 className="text-xl sm:text-2xl font-extrabold text-[#1F1D1E] mt-0.5">
                  Casual look
                </h4>

                <p className="text-xs text-black/65 leading-relaxed mt-1 font-semibold">
                  {outfit.styling_explanation}
                </p>

                {/* Style Pills (Vibrant Mint) */}
                <div className="mt-3">
                  <p className="text-xs font-bold text-black/50 mb-1">Style</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-[#B6F2C7] text-[#0F4722] text-xs font-extrabold px-3 py-1 shadow-2xs">
                      free
                    </span>
                    <span className="rounded-full bg-[#B6F2C7] text-[#0F4722] text-xs font-extrabold px-3 py-1 shadow-2xs">
                      cozy
                    </span>
                  </div>
                </div>

                {/* Cases Pills (Vibrant Mint) */}
                <div className="mt-2.5">
                  <p className="text-xs font-bold text-black/50 mb-1">Cases</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-[#B6F2C7] text-[#0F4722] text-xs font-extrabold px-3 py-1 shadow-2xs">
                      work
                    </span>
                    <span className="rounded-full bg-[#B6F2C7] text-[#0F4722] text-xs font-extrabold px-3 py-1 shadow-2xs">
                      walk
                    </span>
                    <span className="rounded-full bg-[#B6F2C7] text-[#0F4722] text-xs font-extrabold px-3 py-1 shadow-2xs">
                      study
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 pt-3 border-t border-[#F5E6EB] flex items-center justify-between">
                <button
                  type="button"
                  disabled={worn || actions.busyId === outfit.id}
                  onClick={() => actions.onWorn(outfit)}
                  className="flex items-center gap-1.5 text-xs font-extrabold text-[#FF5C77] hover:underline"
                >
                  <Check className="h-4 w-4" />
                  {worn ? "Worn today ✓" : "Mark as worn"}
                </button>
                <Link to="/studio" className="text-xs font-extrabold text-[#124C27] hover:underline flex items-center gap-1">
                  More ideas <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── 5. "You might like it" Discovery Shelf (Playful Candy Cards) ─── */}
      <div>
        <h3 className="text-base sm:text-lg font-bold text-[#1F1D1E] mb-2.5">
          You might like it
        </h3>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {/* Daily 1: Vibrant Sky Blue */}
          <div
            onClick={() => navigate("/studio")}
            className="cursor-pointer shrink-0 w-36 sm:w-44 h-30 rounded-2xl bg-gradient-to-br from-[#BAE6FD] to-[#7DD3FC] p-3.5 flex flex-col justify-between relative overflow-hidden shadow-sm hover:shadow-md active:scale-95 transition-all group border border-[#93C5FD]"
          >
            <div>
              <span className="text-[10px] font-black text-[#0369A1] uppercase tracking-wider">Accessories</span>
              <p className="text-sm font-extrabold text-[#0C4A6E] mt-0.5">Daily Twist</p>
            </div>
            <div className="absolute right-2 bottom-1 text-3xl group-hover:scale-115 transition-transform">
              🌀
            </div>
          </div>

          {/* Daily 2: Vibrant Blush Pink */}
          <div
            onClick={() => navigate("/studio")}
            className="cursor-pointer shrink-0 w-36 sm:w-44 h-30 rounded-2xl bg-gradient-to-br from-[#FBCFE8] to-[#F472B6] p-3.5 flex flex-col justify-between relative overflow-hidden shadow-sm hover:shadow-md active:scale-95 transition-all group border border-[#F9A8D4]"
          >
            <div>
              <span className="text-[10px] font-black text-[#9D174D] uppercase tracking-wider">Textures</span>
              <p className="text-sm font-extrabold text-[#831843] mt-0.5">Daily Fluff</p>
            </div>
            <div className="absolute right-2 bottom-1 text-3xl group-hover:scale-115 transition-transform">
              🌸
            </div>
          </div>

          {/* Daily 3: Vibrant Sunshine Yellow */}
          <div
            onClick={() => navigate("/studio")}
            className="cursor-pointer shrink-0 w-36 sm:w-44 h-30 rounded-2xl bg-gradient-to-br from-[#FDE68A] to-[#FCD34D] p-3.5 flex flex-col justify-between relative overflow-hidden shadow-sm hover:shadow-md active:scale-95 transition-all group border border-[#FBBF24]"
          >
            <div>
              <span className="text-[10px] font-black text-[#92400E] uppercase tracking-wider">Highlights</span>
              <p className="text-sm font-extrabold text-[#78350F] mt-0.5">Daily Glow</p>
            </div>
            <div className="absolute right-2 bottom-1 text-3xl group-hover:scale-115 transition-transform">
              ✨
            </div>
          </div>

          {/* Daily 4: Vibrant Mint Green */}
          <div
            onClick={() => navigate("/studio")}
            className="cursor-pointer shrink-0 w-36 sm:w-44 h-30 rounded-2xl bg-gradient-to-br from-[#A7F3D0] to-[#6EE7B7] p-3.5 flex flex-col justify-between relative overflow-hidden shadow-sm hover:shadow-md active:scale-95 transition-all group border border-[#34D399]"
          >
            <div>
              <span className="text-[10px] font-black text-[#065F46] uppercase tracking-wider">Fresh Picks</span>
              <p className="text-sm font-extrabold text-[#064E3B] mt-0.5">Daily Mood</p>
            </div>
            <div className="absolute right-2 bottom-1 text-3xl group-hover:scale-115 transition-transform">
              🍀
            </div>
          </div>
        </div>
      </div>

      {/* ─── 6. Playful Wardrobe Overview Counters ─── */}
      {stats.data && (
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <div className="rounded-2xl bg-[#D7F0DC] p-3.5 text-center border border-[#B9F5CB] shadow-2xs">
            <p className="text-xl sm:text-2xl font-black text-[#124C27]">{stats.data.total_items}</p>
            <p className="text-xs font-bold text-[#2A7545]">Pieces in closet</p>
          </div>
          <div className="rounded-2xl bg-[#FFEAEF] p-3.5 text-center border border-[#FBCFE8] shadow-2xs">
            <p className="text-xl sm:text-2xl font-black text-[#FF5C77]">{stats.data.saved_outfits}</p>
            <p className="text-xs font-bold text-[#D84A6E]">Saved outfits</p>
          </div>
          <div className="rounded-2xl bg-[#FFF4CC] p-3.5 text-center border border-[#FDE68A] shadow-2xs">
            <p className="text-xl sm:text-2xl font-black text-[#B45309]">{stats.data.worn_this_month}</p>
            <p className="text-xs font-bold text-[#92400E]">Worn this month</p>
          </div>
        </div>
      )}

      <Toast toast={actions.toast} />
    </div>
  );
}
