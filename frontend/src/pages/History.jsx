import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import useAsync from "../hooks/useAsync";
import { getHistory } from "../services/api";
import { formatShort, isSameDay } from "../utils/format";
import PageHeader from "../components/ui/PageHeader";
import GarmentImage from "../components/ui/GarmentImage";
import { EmptyState, ErrorState, Spinner } from "../components/ui/Feedback";

function Strip({ entries }) {
  const days = useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      return { date: d, entry: entries.find((e) => isSameDay(e.worn_at, d)) };
    });
  }, [entries]);

  return (
    <ol className="mb-10 grid grid-cols-7 gap-2 sm:gap-3" aria-label="Last 14 days">
      {days.map(({ date, entry }) => {
        const today = isSameDay(date, new Date());
        return (
          <li
            key={date.toISOString()}
            className={`flex aspect-[3/4] flex-col items-center rounded-lg border p-1.5 text-[11px] ${
              entry ? "border-rose/40 bg-rose-tint" : "border-line bg-white/60"
            } ${today ? "ring-1 ring-ink" : ""}`}
            title={entry ? `${formatShort(date)} · ${entry.outfit.outfit_name}` : formatShort(date)}
          >
            <span className="text-ink-soft">{formatShort(date)}</span>
            {entry && <GarmentImage item={entry.outfit.items[0]} className="mt-1.5 w-full flex-1 !bg-transparent" />}
          </li>
        );
      })}
    </ol>
  );
}

export default function History() {
  const { data, loading, error, reload } = useAsync(getHistory);
  const navigate = useNavigate();
  const entries = data || [];
  const repeated = entries.find((e) => e.repeated);

  return (
    <>
      <PageHeader
        eyebrow="Rotation"
        title="Every combination, remembered"
        subtitle="Closet Remix tracks exact outfits, not just single pieces. Combinations worn recently are ranked lower in new suggestions."
      />

      {loading && <Spinner label="Loading your history" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && entries.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="No outfits worn yet"
          message="When you tap “Mark as worn” on an outfit, it shows up here by date."
          action={<Link to="/studio" className="btn-primary">Find an outfit</Link>}
        />
      )}

      {!loading && entries.length > 0 && (
        <>
          {repeated && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-l-2 border-rose pl-4">
              <p className="text-sm text-ink-soft">
                You’ve worn <strong className="font-medium text-ink">{repeated.outfit.outfit_name}</strong> {repeated.repeat_count} times in the
                last two weeks: {repeated.outfit.items.map((i) => i.item_name).join(", ")}.
              </p>
              <button type="button" className="btn-primary btn-sm" onClick={() => navigate("/studio")}>Explore something different</button>
            </div>
          )}

          <Strip entries={entries} />

          <ol className="divide-y divide-line">
            {entries.map((e) => (
              <li key={e.id} className="grid gap-4 py-6 sm:grid-cols-[110px_auto_1fr] sm:items-center">
                <div>
                  <p className="font-serif text-2xl">{formatShort(e.worn_at)}</p>
                  <p className="text-sm text-ink-soft">{e.occasion}</p>
                </div>
                <div className="flex gap-2">
                  {e.outfit.items.slice(0, 4).map((it) => (
                    <GarmentImage key={it.id} item={it} className="h-16 w-16 sm:h-20 sm:w-20" />
                  ))}
                </div>
                <div>
                  <div className="mb-1.5 flex flex-wrap gap-1.5">
                    <span className={`tag ${e.recently_worn ? "bg-rose-tint text-rose-deep" : "bg-sage-tint text-sage-deep"}`}>
                      {e.recently_worn ? "Worn recently" : "Not worn lately"}
                    </span>
                    {e.repeated && <span className="tag bg-lilac text-ink-soft">Repeated ×{e.repeat_count}</span>}
                  </div>
                  <p className="font-medium">{e.outfit.outfit_name}</p>
                  <p className="text-sm text-ink-soft">{e.outfit.items.map((i) => i.item_name).join(" · ")}</p>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}
