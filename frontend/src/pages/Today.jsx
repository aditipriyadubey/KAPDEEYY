import { useState } from "react";
import { Bell, Camera, Check, Search, Shirt } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import useAsync from "../hooks/useAsync";
import useOutfitActions from "../hooks/useOutfitActions";
import { getTodayOutfit, getWardrobeStats } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { greeting } from "../utils/format";
import OutfitCollage from "../components/ui/OutfitCollage";
import { EmptyState, ErrorState } from "../components/ui/Feedback";
import Toast from "../components/ui/Toast";
import { useNotifications } from "../context/NotificationContext";
import VirtualTryOnModal from "../components/VirtualTryOnModal";

function initialsFor(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function Today() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const stats = useAsync(getWardrobeStats);
  const today = useAsync(getTodayOutfit);
  const actions = useOutfitActions();
  const { unreadCount, openNotifications } = useNotifications();
  const [tryOnOutfit, setTryOnOutfit] = useState(null);

  const outfit = today.data;
  const worn = outfit && actions.stateFor(outfit).wornToday;
  const firstName = user?.full_name?.split(" ")[0] || "there";

  const statCards = stats.data
    ? [
        ["Pieces in wardrobe", stats.data.total_items],
        ["Saved outfits", stats.data.saved_outfits],
        ["Worn this month", stats.data.worn_this_month],
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* ─── Greeting ─── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-sm font-semibold text-ink">
            {initialsFor(user?.full_name)}
          </span>
          <div>
            <h1 className="font-display text-2xl font-normal leading-tight tracking-tight text-ink sm:text-3xl">
              {greeting()}, {firstName}
            </h1>
            <p className="mt-0.5 text-xs text-ink-soft sm:text-sm">
              Here is how your wardrobe looks today.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openNotifications}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft transition-colors hover:border-ink/30 hover:text-ink"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" strokeWidth={1.8} />
            {unreadCount > 0 && (
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" />
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate("/wardrobe")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft transition-colors hover:border-ink/30 hover:text-ink"
            aria-label="Search wardrobe"
          >
            <Search className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* ─── Outfit for today ─── */}
      <section>
        <div className="mb-3 flex items-baseline justify-between gap-4 border-b border-line pb-2.5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink">
            Your outfit for today
          </h2>
          <Link
            to="/studio"
            className="text-xs font-medium text-ink-soft transition-colors hover:text-accent"
          >
            Open studio
          </Link>
        </div>

        {today.loading && <div className="skeleton h-56 rounded-xl" />}
        {today.error && <ErrorState message={today.error} onRetry={today.reload} />}

        {!today.loading && !today.error && !outfit && (
          <EmptyState
            icon={Shirt}
            title="No outfit selected yet"
            message="Save a look from the studio and it will show up here."
            action={
              <button
                type="button"
                onClick={() => navigate("/studio")}
                className="btn-primary"
              >
                Find an outfit
              </button>
            }
          />
        )}

        {outfit && (
          <div className="card overflow-hidden">
            <div className="grid gap-0 sm:grid-cols-[minmax(0,220px)_1fr]">
              <div className="border-b border-line bg-canvas p-4 sm:border-b-0 sm:border-r">
                <OutfitCollage items={outfit.items} showLabels={false} className="w-full" />
              </div>

              <div className="flex flex-col justify-between p-5 sm:p-6">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="eyebrow">
                      {outfit.occasion || "Saved look"}
                    </p>
                    {outfit.recommendation_score != null && (
                      <span className="text-[11px] font-medium text-ink-faint">
                        Match {Math.round(outfit.recommendation_score)}/100
                      </span>
                    )}
                  </div>

                  <h3 className="mt-1 font-display text-xl font-normal tracking-tight text-ink sm:text-2xl">
                    {outfit.outfit_name}
                  </h3>

                  {outfit.styling_explanation && (
                    <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                      {outfit.styling_explanation}
                    </p>
                  )}

                  {outfit.items?.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {[...new Set(outfit.items.map((item) => item.category))].map(
                        (category) => (
                          <span key={category} className="tag">
                            {category}
                          </span>
                        )
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      disabled={worn || actions.busyId === outfit.id}
                      onClick={() => actions.onWorn(outfit)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent transition-colors hover:text-accent-hover disabled:text-ink-faint"
                    >
                      <Check className="h-4 w-4" strokeWidth={2} />
                      {worn ? "Worn today" : "Mark as worn"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setTryOnOutfit(outfit)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft transition-colors hover:text-ink"
                    >
                      <Camera className="h-4 w-4" strokeWidth={1.8} />
                      Virtual Try-On
                    </button>
                  </div>
                  <Link
                    to="/saved"
                    className="text-xs font-medium text-ink-soft transition-colors hover:text-ink"
                  >
                    View saved outfits
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ─── Wardrobe overview ─── */}
      <section>
        <div className="mb-3 border-b border-line pb-2.5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink">
            Wardrobe overview
          </h2>
        </div>

        {stats.loading && (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-24 rounded-xl" />
            ))}
          </div>
        )}

        {stats.error && <ErrorState message={stats.error} onRetry={stats.reload} />}

        {statCards.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {statCards.map(([label, value]) => (
              <div key={label} className="card px-4 py-5">
                <p className="text-2xl font-semibold leading-none tabular-nums text-ink">
                  {value}
                </p>
                <p className="mt-2 text-[11px] font-medium leading-snug text-ink-soft sm:text-xs">
                  {label}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <VirtualTryOnModal
        open={!!tryOnOutfit}
        outfit={tryOnOutfit}
        onClose={() => setTryOnOutfit(null)}
      />

      <Toast toast={actions.toast} />
    </div>
  );
}
