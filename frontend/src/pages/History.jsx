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
    <div className="no-scrollbar mb-8 overflow-x-auto pb-2">
      <ol className="flex min-w-max gap-2" aria-label="Last 14 days">
        {days.map(({ date, entry }) => {
          const today = isSameDay(date, new Date());
          return (
            <li
              key={date.toISOString()}
              className={`flex w-[74px] flex-col items-center rounded-lg border p-2.5 transition-colors ${
                entry ? "border-accent/25 bg-accent-tint" : "border-line bg-surface"
              } ${today ? "ring-1 ring-accent/40" : ""}`}
              title={
                entry
                  ? `${formatShort(date)} · ${entry.outfit.outfit_name}`
                  : formatShort(date)
              }
            >
              <span className="text-[10px] font-medium text-ink-faint">
                {formatShort(date)}
              </span>
              {entry ? (
                <GarmentImage
                  item={entry.outfit.items[0]}
                  className="mt-1.5 h-12 w-full rounded bg-transparent"
                />
              ) : (
                <span className="mt-1.5 flex h-12 w-full items-center justify-center">
                  <span className="h-px w-4 bg-line" />
                </span>
              )}
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
      <div className="border-b border-line pb-5">
        <p className="eyebrow">Record</p>
        <h1 className="mt-1 font-display text-2xl font-normal tracking-tight text-ink sm:text-3xl">
          Wear History
        </h1>
        <p className="mt-1 text-xs text-ink-soft sm:text-sm">
          Every combination you have worn, remembered automatically.
        </p>
      </div>

      {loading && <Spinner label="Loading your wear history" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && entries.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="No outfits worn yet"
          message='When you mark an outfit as worn, it shows up here by date.'
          action={
            <Link to="/studio" className="btn-primary">
              Find an outfit
            </Link>
          }
        />
      )}

      {!loading && entries.length > 0 && (
        <>
          {repeated && (
            <div className="card flex flex-wrap items-center justify-between gap-4 border-l-2 border-l-accent p-5">
              <p className="text-sm leading-relaxed text-ink-soft">
                You have worn{" "}
                <strong className="font-semibold text-ink">
                  {repeated.outfit.outfit_name}
                </strong>{" "}
                {repeated.repeat_count} times so far:{" "}
                {repeated.outfit.items.map((i) => i.item_name).join(", ")}.
              </p>
              <button
                type="button"
                className="btn-secondary py-2 text-xs"
                onClick={() => navigate("/studio")}
              >
                Explore fresh looks
              </button>
            </div>
          )}

          <Strip entries={entries} />

          <ol className="space-y-3 pb-6">
            {entries.map((e) => (
              <li
                key={e.id}
                className="card flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5"
              >
                <div className="flex items-center gap-4">
                  <div className="w-20 shrink-0">
                    <p className="font-display text-lg font-normal leading-tight text-ink">
                      {formatShort(e.worn_at)}
                    </p>
                    <p className="text-[11px] text-ink-faint">{e.occasion}</p>
                  </div>

                  <div className="no-scrollbar flex gap-2 overflow-x-auto">
                    {e.outfit.items.slice(0, 4).map((it) => (
                      <GarmentImage
                        key={it.id}
                        item={it}
                        className="h-14 w-14 shrink-0 rounded-lg"
                      />
                    ))}
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <div className="mb-1.5 flex flex-wrap gap-1.5 sm:justify-end">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                        e.recently_worn
                          ? "bg-accent-tint text-accent"
                          : "bg-canvas text-ink-soft"
                      }`}
                    >
                      {e.recently_worn ? "Worn recently" : "Not worn lately"}
                    </span>
                    {e.repeated && (
                      <span className="rounded bg-canvas px-2 py-0.5 text-[10px] font-medium text-ink-soft">
                        Repeated ×{e.repeat_count}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-ink">{e.outfit.outfit_name}</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    {e.outfit.items.map((i) => i.item_name).join(" · ")}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
