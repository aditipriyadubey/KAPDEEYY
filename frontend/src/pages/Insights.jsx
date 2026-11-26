import { Link } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import useAsync from "../hooks/useAsync";
import { getInsights } from "../services/api";
import GarmentImage from "../components/ui/GarmentImage";
import { EmptyState, ErrorState, Spinner } from "../components/ui/Feedback";

function Section({ title, children, className = "" }) {
  return (
    <section className={className}>
      <h2 className="mb-3 font-display text-lg font-normal tracking-tight text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Bars({ rows, tone = "bg-accent" }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li
          key={r.category}
          className="grid grid-cols-[110px_1fr_28px] items-center gap-3 text-[11px] font-medium"
        >
          <span className="truncate text-ink-soft">{r.category}</span>
          <span className="h-2 overflow-hidden rounded-sm bg-canvas">
            <span
              className={`block h-full rounded-sm ${tone} transition-all duration-500`}
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </span>
          <span className="text-right tabular-nums text-ink">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

function ItemStrip({ items, caption }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {items.map((i) => (
        <div key={i.id} className="card p-2">
          <GarmentImage item={i} className="aspect-[4/5] rounded-lg" />
          <p className="mt-2 truncate text-[11px] font-medium text-ink">{i.item_name}</p>
          <p className="text-[10px] text-ink-faint">{caption(i)}</p>
        </div>
      ))}
    </div>
  );
}

export default function Insights() {
  const { data, loading, error, reload } = useAsync(getInsights);

  const summary = data?.sufficient_data
    ? [
        { value: data.total_worn, label: "Total outfits worn" },
        { value: data.repeat_stats.unique_outfits, label: "Unique combinations" },
        { value: `${data.repeat_stats.repeat_rate}%`, label: "Repeat rate" },
      ]
    : [];

  return (
    <div className="space-y-8 pb-8">
      <div className="border-b border-line pb-5">
        <p className="eyebrow">Analytics</p>
        <h1 className="mt-1 font-display text-2xl font-normal tracking-tight text-ink sm:text-3xl">
          Wardrobe Insights
        </h1>
        <p className="mt-1 text-xs text-ink-soft sm:text-sm">
          What you actually wear, and the pieces that never leave the closet.
        </p>
      </div>

      {loading && <Spinner label="Analyzing your wardrobe" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && !data.sufficient_data && (
        <EmptyState
          icon={BarChart3}
          title="Not enough history yet"
          message="Mark a few outfits as worn and your personal patterns will appear here."
          action={
            <Link to="/studio" className="btn-primary">
              Find an outfit
            </Link>
          }
        />
      )}

      {data?.sufficient_data && (
        <div className="space-y-9">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {summary.map(({ value, label }) => (
              <div key={label} className="card px-5 py-6">
                <p className="text-2xl font-semibold leading-none tabular-nums text-ink">
                  {value}
                </p>
                <p className="mt-2 text-[11px] font-medium text-ink-soft">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Section title="Most-worn categories">
              <div className="card p-5">
                <Bars rows={data.categories_most} />
              </div>
            </Section>

            <Section title="Least-worn categories">
              <div className="card p-5">
                <Bars rows={data.categories_least} tone="bg-ink" />
              </div>
            </Section>
          </div>

          <Section title="Favourite colours">
            <div className="card p-5">
              {data.colours.length === 0 && (
                <p className="text-sm text-ink-soft">
                  Add colour swatches to your pieces to see your palette here.
                </p>
              )}
              <ul className="flex flex-wrap gap-5">
                {data.colours.map((c) => (
                  <li
                    key={c.colour}
                    className="flex items-center gap-2 text-[11px] font-medium text-ink"
                  >
                    <span
                      className="h-5 w-5 rounded-full border border-line"
                      style={{ background: c.hex }}
                    />
                    <span>{c.colour}</span>
                    <span className="text-ink-faint">({c.count}×)</span>
                  </li>
                ))}
              </ul>
            </div>
          </Section>

          <Section title="Most-worn pieces">
            {data.favourite_items.length > 0 ? (
              <ItemStrip items={data.favourite_items} caption={(i) => `${i.times_worn}× worn`} />
            ) : (
              <div className="card px-6 py-8 text-center text-sm text-ink-soft">
                Mark an outfit as worn to see your most-worn pieces here.
              </div>
            )}
          </Section>

          <Section title="Worn least often">
            {data.underused_items.length > 0 ? (
              <ItemStrip items={data.underused_items} caption={(i) => `${i.times_worn}× worn`} />
            ) : (
              <div className="card px-6 py-8 text-center text-sm text-ink-soft">
                Nothing to show yet.
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
