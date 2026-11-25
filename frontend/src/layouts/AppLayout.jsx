import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Bookmark, CalendarDays, Home, LogOut, Menu, Shirt, Sparkles, TrendingUp, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { to: "/", label: "Today", icon: Home, end: true },
  { to: "/wardrobe", label: "Wardrobe", icon: Shirt },
  { to: "/studio", label: "Outfit Studio", icon: Sparkles },
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/history", label: "History", icon: CalendarDays },
  { to: "/insights", label: "Insights", icon: TrendingUp },
];

function Logo() {
  return (
    <span className="font-serif text-2xl text-ink">
      Closet <em className="text-rose-deep">Remix</em>
    </span>
  );
}

function NavList({ onNavigate }) {
  return (
    <nav className="mt-10 flex flex-col gap-1" aria-label="Main">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[15px] transition duration-200 ${
              isActive ? "bg-rose-tint font-medium text-ink" : "text-ink-soft hover:bg-ink/5 hover:text-ink"
            }`
          }
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function UserFooter() {
  const { user, demoMode, signOut } = useAuth();
  return (
    <div className="mt-auto border-t border-line pt-4">
      <p className="truncate text-sm font-medium">{user?.full_name || "—"}</p>
      <p className="truncate text-xs text-ink-faint">{demoMode ? "Demo mode · mock data" : user?.email}</p>
      {!demoMode && (
        <button type="button" className="btn-ghost btn-sm mt-3 -ml-3.5" onClick={signOut}>
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      )}
    </div>
  );
}

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [location.pathname]);

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-ivory px-5 py-8 lg:flex">
        <Logo />
        <NavList />
        <UserFooter />
      </aside>

      {/* Mobile / tablet top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-ivory/95 px-4 py-3 lg:hidden">
        <Logo />
        <button type="button" className="btn-ghost !p-2" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <aside className="fade-up absolute left-0 top-0 flex h-full w-72 max-w-[85%] flex-col bg-ivory px-5 py-6 shadow-xl">
            <div className="flex items-center justify-between">
              <Logo />
              <button type="button" className="btn-ghost !p-2" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList onNavigate={() => setOpen(false)} />
            <UserFooter />
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
