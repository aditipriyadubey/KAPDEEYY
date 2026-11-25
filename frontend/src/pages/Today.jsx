import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Shirt, Sparkles } from "lucide-react";
import useAsync from "../hooks/useAsync";
import useOutfitActions from "../hooks/useOutfitActions";
import { getTodayOutfit, getWardrobeStats } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatLong, greeting } from "../utils/format";
import OutfitCollage from "../components/ui/OutfitCollage";
import { EmptyState, ErrorState } from "../components/ui/Feedback";
import Toast from "../components/ui/Toast";

function Stat({ value, label }) {
  return (
    <div className="card px-4 py-4">
      <p className="font-serif text-3xl">{value}</p>
      <p className="mt-1 text-xs text-ink-soft">{label}</p>
    </div>
  );
}

export default function Today() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const stats = useAsync(getWardrobeStats);
  const today = useAsync(getTodayOutfit);
  const actions = useOutfitActions();

  const firstName = user?.full_name?.split(" ")[0];
  const outfit = today.data;
  const worn = outfit && actions.stateFor(outfit).wornToday;

  return (
    <div className="grid items-center gap-10 lg:min-h-[calc(100vh-6rem)] lg:grid-cols-[1fr_1.05fr]">
      <section className="fade-up">
        <p className="eyebrow">{formatLong()}</p>
        <h1 className="mt-4 text-5xl leading-[1.05] sm:text-6xl">
          {greeting()}
          {firstName ? `, ${firstName}.` : "."}
        </h1>
        <p className="mt-5 max-w-md text-lg text-ink-soft">
          Your wardrobe, reimagined. Wear what you own — and see it differently.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" className="btn-primary !px-7 !py-3.5 !text-base" onClick={() => navigate("/studio")}>
            <Sparkles className="h-4 w-4" /> Find my outfit
          </button>
          <Link to="/wardrobe" className="btn-secondary !px-6 !py-3.5">
            <Shirt className="h-4 w-4" /> My wardrobe
          </Link>
        </div>

        {stats.data && (
          <>
            <div className="mt-10 grid max-w-md grid-cols-3 gap-3">
              <Stat value={stats.data.total_items} label="pieces in your closet" />
              <Stat value={stats.data.saved_outfits} label="saved outfits" />
              <Stat value={stats.data.worn_this_month} label="worn this month" />
            </div>
            {stats.data.unworn_two_weeks > 0 && (
              <p className="mt-6 max-w-md border-l-2 border-rose pl-4 text-sm text-ink-soft">
                {stats.data.unworn_two_weeks} pieces haven’t been worn in two weeks. There are more combinations in your
                closet than you’ve tried.
              </p>
            )}
          </>
        )}
        {stats.error && <p className="mt-6 text-sm text-rose-deep">Couldn’t load wardrobe stats.</p>}
      </section>

      <section aria-label="Today’s recommended outfit">
        {today.loading && <div className="skeleton h-[480px] rounded-card" aria-hidden />}
        {today.error && <ErrorState message={today.error} onRetry={today.reload} />}
        {!today.loading && !today.error && !outfit && (
          <EmptyState
            icon={Shirt}
            title="Add a few pieces first"
            message="Upload some clothes and we’ll build today’s outfit from them."
            action={<Link to="/wardrobe" className="btn-primary">Go to wardrobe</Link>}
          />
        )}
        {outfit && (
          <div className="card fade-up bg-sand/60 p-6">
            <p className="eyebrow">Today’s edit · {outfit.outfit_name}</p>
            <OutfitCollage items={outfit.items} className="mt-4" />
            <p className="mt-5 text-[15px] leading-relaxed text-ink">{outfit.styling_explanation}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn-secondary btn-sm !bg-white"
                disabled={worn || actions.busyId === outfit.id}
                onClick={() => actions.onWorn(outfit)}
              >
                <Check className="h-3.5 w-3.5" /> {worn ? "Worn today" : "Mark as worn"}
              </button>
              <Link to="/studio" className="btn-ghost btn-sm">
                More ideas <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <span className="ml-auto text-xs text-ink-faint">
                Style match {outfit.recommendation_score}/100 · {outfit.occasion}
              </span>
            </div>
          </div>
        )}
      </section>
      <Toast toast={actions.toast} />
    </div>
  );
}
