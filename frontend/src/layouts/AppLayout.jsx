import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, Bookmark, CalendarDays, Home, LogOut, Plus, Search, Shirt, ShoppingBag, Sparkles, TrendingUp, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AddClothingModal from "../components/AddClothingModal";
import { addWardrobeItem } from "../services/api";
import Toast from "../components/ui/Toast";
import NotificationModal from "../components/NotificationModal";
import { useNotifications } from "../context/NotificationContext";

const NAV_LINKS = [
  { to: "/", label: "Today", icon: Home, end: true },
  { to: "/wardrobe", label: "Wardrobe", icon: Shirt },
  { to: "/studio", label: "Studio", icon: Sparkles },
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/history", label: "History", icon: CalendarDays },
  { to: "/insights", label: "Insights", icon: TrendingUp },
];

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [addingModal, setAddingModal] = useState(false);
  const { unreadCount, openNotifications } = useNotifications();
  const [toast, setToast] = useState(null);

  const flash = (message, type = "ok") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleQuickAdd = async (payload) => {
    try {
      await addWardrobeItem(payload);
      flash("Item added to your wardrobe ✨");
    } catch {
      flash("Couldn't add clothing item", "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9F9] flex flex-col text-ink font-sans">
      
      {/* ─── Desktop Header (hidden on mobile, visible on md+) ─── */}
      <header className="hidden md:block sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#F5EBEF] shadow-2xs">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between gap-6">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFEAEF] text-[#F46A6A] group-hover:scale-105 transition-transform">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="font-sans font-extrabold text-2xl tracking-tight text-ink">
              KAPDEEYY<span className="text-[#F46A6A]">!</span>
            </span>
          </Link>

          {/* Desktop Nav Pills */}
          <nav className="flex items-center gap-1.5" aria-label="Main navigation">
            {NAV_LINKS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 ${
                    isActive
                      ? "bg-[#D7F0DC] text-[#215E39] shadow-2xs"
                      : "text-black/60 hover:text-black hover:bg-black/5"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right Action Tools */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/add")}
              className="flex items-center gap-2 rounded-full bg-[#F46A6A] px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(244,106,106,0.35)] hover:bg-[#E05252] active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>Add Item</span>
            </button>

            <button
              type="button"
              onClick={() => {
                signOut();
                navigate("/login");
              }}
              className="flex items-center gap-1 text-xs font-bold text-[#F46A6A] hover:underline px-2 py-1"
              title="Sign out & Splash screen"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Mobile Top Bar (visible only on mobile) ─── */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#F5EBEF] px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFEAEF] text-[#F46A6A]">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="font-sans font-extrabold text-xl tracking-tight text-ink">
            KAPDEEYY<span className="text-[#F46A6A]">!</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/add")}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F46A6A] text-white shadow-xs"
            aria-label="Add item"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
          </button>
          <button
            type="button"
            onClick={() => {
              signOut();
              navigate("/login");
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFEAEF] text-[#F46A6A]"
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ─── Main Content Canvas (Mobile-first responsive container) ─── */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-7 pb-24 md:pb-12">
        <Outlet />
      </main>

      {/* ─── Mobile Bottom Navigation Bar (Phone-perfect from Reference Image 2) ─── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#F5EBEF] px-3 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {/* Home */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-1 px-3 text-[11px] font-bold transition-colors ${
                isActive ? "text-[#F46A6A]" : "text-black/40 hover:text-black/70"
              }`
            }
          >
            <Home className="h-5 w-5" />
            <span>Home</span>
          </NavLink>

          {/* Market / Wardrobe */}
          <NavLink
            to="/wardrobe"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-1 px-3 text-[11px] font-bold transition-colors ${
                isActive ? "text-[#F46A6A]" : "text-black/40 hover:text-black/70"
              }`
            }
          >
            <ShoppingBag className="h-5 w-5" />
            <span>Market</span>
          </NavLink>

          {/* Elevated Coral Plus Button in Center */}
          <button
            type="button"
            onClick={() => navigate("/add")}
            className="-mt-5 flex h-13 w-13 items-center justify-center rounded-full bg-[#F46A6A] text-white shadow-[0_6px_20px_rgba(244,106,106,0.45)] active:scale-95 transition-transform"
            aria-label="Add item"
          >
            <Plus className="h-6 w-6 stroke-[3]" />
          </button>

          {/* For you / Studio */}
          <NavLink
            to="/studio"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-1 px-3 text-[11px] font-bold transition-colors ${
                isActive ? "text-[#F46A6A]" : "text-black/40 hover:text-black/70"
              }`
            }
          >
            <Sparkles className="h-5 w-5" />
            <span>For you</span>
          </NavLink>

          {/* Profile / Saved */}
          <NavLink
            to="/saved"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-1 px-3 text-[11px] font-bold transition-colors ${
                isActive ? "text-[#F46A6A]" : "text-black/40 hover:text-black/70"
              }`
            }
          >
            <User className="h-5 w-5" />
            <span>Profile</span>
          </NavLink>
        </div>
      </nav>

      {/* Global Add Item Modal */}
      <AddClothingModal
        open={addingModal}
        onClose={() => setAddingModal(false)}
        onSave={handleQuickAdd}
      />

      {/* Global Daily Notifications Modal */}
      <NotificationModal />

      <Toast toast={toast} />
    </div>
  );
}
