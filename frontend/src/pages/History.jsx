import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import useAsync from "../hooks/useAsync";
import { getHistory } from "../services/api";
import { formatShort, isSameDay } from "../utils/format";
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
    <div className="mb-8 overflow-x-auto no-scrollbar pb-2">
      <ol className="flex gap-3 min-w-max" aria-label="Last 14 days">
        {days.map(({ date, entry }) => {
          const today = isSameDay(date, new Date());
          return (
            <li
              key={date.toISOString()}
              className={`flex flex-col items-center rounded-2xl border p-3 w-20 transition-all duration-200 ${
                entry ? "border-[#F46A6A]/40 bg-coral-tint" : "border-gray-200 bg-white"
              } ${today ? "ring-2 ring-[#F46A6A] shadow-sm" : ""}`}
              title={entry ? `${formatShort(date)} · ${entry.outfit.outfit_name}` : formatShort(date)}
            >
              <span className="text-xs font-bold text-black/50">{formatShort(date)}</span>
              {entry && <GarmentImage item={entry.outfit.items[0]} className="mt-2 w-full h-14 !bg-transparent" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function History() {
  const { data, loading, error, reload } = useAsync(getHistory);
  const navigate = useNavigate();
  const entries = data || [];
  const repeated = entries.find((e) => e.repeated);

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-gray-100">
        <h1 className="font-display text-3xl font-extrabold text-ink">Wear History 📅</h1>
        <p className="text-sm font-semibold text-black/45 mt-0.5">Every combination you've worn, remembered automatically.</p>
      </div>

      {loading && <Spinner label="Loading your wear history" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && entries.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="No outfits worn yet"
          message='When you tap "Mark as worn" on an outfit, it shows up here by date.'
          action={<Link to="/studio" className="btn-coral-save px-6 py-2.5 text-sm inline-block">Find an outfit</Link>}
        />
      )}

      {!loading && entries.length > 0 && (
        <>
          {repeated && (
            <div className="rounded-2xl bg-coral-tint p-5 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm font-semibold text-ink">
                You've worn <strong className="font-black text-[#F46A6A]">{repeated.outfit.outfit_name}</strong> {repeated.repeat_count} times in the
                last two weeks: {repeated.outfit.items.map((i) => i.item_name).join(", ")}.
              </p>
              <button type="button" className="btn-coral-save px-5 py-2 text-xs" onClick={() => navigate("/studio")}>Explore fresh looks</button>
            </div>
          )}

          <Strip entries={entries} />

          <ol className="space-y-4 pb-8">
            {entries.map((e) => (
              <li key={e.id} className="rounded-3xl bg-white border border-gray-100 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-24 shrink-0">
                    <p className="font-display text-xl font-bold text-ink">{formatShort(e.worn_at)}</p>
                    <p className="text-xs font-semibold text-black/40">{e.occasion}</p>
                  </div>

                  <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {e.outfit.items.slice(0, 4).map((it) => (
                      <GarmentImage key={it.id} item={it} className="h-16 w-16 rounded-xl shrink-0" />
                    ))}
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <div className="mb-1.5 flex flex-wrap sm:justify-end gap-1.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${e.recently_worn ? "bg-coral-tint text-[#F46A6A]" : "bg-[#D7F0DC] text-[#215E39]"}`}>
                      {e.recently_worn ? "Worn recently" : "Not worn lately"}
                    </span>
                    {e.repeated && <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-black/60">Repeated ×{e.repeat_count}</span>}
                  </div>
                  <p className="font-bold text-sm text-ink">{e.outfit.outfit_name}</p>
                  <p className="text-xs text-black/45">{e.outfit.items.map((i) => i.item_name).join(" · ")}</p>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
