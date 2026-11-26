import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Bookmark,
  CalendarDays,
  Home,
  Layers,
  LogOut,
  Plus,
  Shirt,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import NotificationModal from "../components/NotificationModal";

const NAV_LINKS = [
  { to: "/", label: "Today", icon: Home, end: true },
  { to: "/wardrobe", label: "Wardrobe", icon: Shirt },
  { to: "/studio", label: "Studio", icon: Layers },
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/history", label: "History", icon: CalendarDays },
  { to: "/insights", label: "Insights", icon: TrendingUp },
];

function Wordmark({ compact = false }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded bg-ink text-[12px] font-semibold tracking-wide text-white">
        K
      </span>
      <span
        className={`font-display font-normal uppercase tracking-[0.22em] text-ink ${
          compact ? "text-base" : "text-lg"
        }`}
      >
        Kapdeeyy
      </span>
    </Link>
  );
}

export default function AppLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      {/* ─── Desktop header ─── */}
      <header className="sticky top-0 z-40 hidden border-b border-line bg-surface md:block">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-8 px-6">
          <Wordmark />

          <nav className="flex items-center gap-7" aria-label="Main navigation">
            {NAV_LINKS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `border-b-2 py-1 text-sm transition-colors ${
                    isActive
                      ? "border-accent font-semibold text-ink"
                      : "border-transparent text-ink-soft hover:border-line hover:text-ink"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/add")}
              className="btn-primary px-4 py-2 text-[13px]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              Add Item
            </button>
            <button
              type="button"
              onClick={() => {
                signOut();
                navigate("/login");
              }}
              className="flex items-center gap-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── Mobile header ─── */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
        <Wordmark compact />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate("/add")}
            className="flex h-8 w-8 items-center justify-center rounded bg-accent text-white"
            aria-label="Add item"
          >
            <Plus className="h-4 w-4" strokeWidth={2.4} />
          </button>
          <button
            type="button"
            onClick={() => {
              signOut();
              navigate("/login");
            }}
            className="flex h-8 w-8 items-center justify-center rounded border border-line text-ink-soft"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-14 md:pt-10 lg:px-8">
        <Outlet />
      </main>

      {/* ─── Mobile bottom navigation ─── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 md:hidden"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto flex max-w-md items-center justify-around">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1 text-[10px] font-medium transition-colors ${
                isActive ? "text-accent" : "text-ink-faint hover:text-ink"
              }`
            }
          >
            <Home className="h-5 w-5" strokeWidth={1.8} />
            <span>Home</span>
          </NavLink>

          <NavLink
            to="/wardrobe"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1 text-[10px] font-medium transition-colors ${
                isActive ? "text-accent" : "text-ink-faint hover:text-ink"
              }`
            }
          >
            <Shirt className="h-5 w-5" strokeWidth={1.8} />
            <span>Wardrobe</span>
          </NavLink>

          <button
            type="button"
            onClick={() => navigate("/add")}
            className="-mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-lift active:scale-95"
            aria-label="Add item"
          >
            <Plus className="h-5 w-5" strokeWidth={2.2} />
          </button>

          <NavLink
            to="/studio"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1 text-[10px] font-medium transition-colors ${
                isActive ? "text-accent" : "text-ink-faint hover:text-ink"
              }`
            }
          >
            <Layers className="h-5 w-5" strokeWidth={1.8} />
            <span>Studio</span>
          </NavLink>

          <NavLink
            to="/saved"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1 text-[10px] font-medium transition-colors ${
                isActive ? "text-accent" : "text-ink-faint hover:text-ink"
              }`
            }
          >
            <Bookmark className="h-5 w-5" strokeWidth={1.8} />
            <span>Saved</span>
          </NavLink>
        </div>
      </nav>

      <NotificationModal />
    </div>
  );
}
