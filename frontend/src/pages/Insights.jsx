import { Link, useNavigate } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import useAsync from "../hooks/useAsync";
import { getInsights } from "../services/api";
import PageHeader from "../components/ui/PageHeader";
import GarmentImage from "../components/ui/GarmentImage";
import OutfitCollage from "../components/ui/OutfitCollage";
import { EmptyState, ErrorState, Spinner } from "../components/ui/Feedback";

function Section({ title, children, className = "" }) {
  return (
    <section className={className}>
      <h2 className="mb-4 text-2xl">{title}</h2>
      {children}
    </section>
  );
}

function Bars({ rows, tone = "bg-rose" }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.category} className="grid grid-cols-[92px_1fr_28px] items-center gap-3 text-sm">
          <span className="truncate text-ink-soft">{r.category}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-line" role="presentation">
            <span className={`block h-full rounded-full ${tone}`} style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

function ItemStrip({ items, caption }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((i) => (
        <li key={i.id}>
          <GarmentImage item={i} className="aspect-[4/5]" rounded="rounded-card" />
          <p className="mt-2 truncate text-sm font-medium">{i.item_name}</p>
          <p className="text-xs text-ink-soft">{caption(i)}</p>
        </li>
      ))}
    </ul>
  );
}

export default function Insights() {
  const { data, loading, error, reload } = useAsync(getInsights);
  const navigate = useNavigate();

  return (
    <>
      <PageHeader eyebrow="Style insights" title="What your closet is telling you" />

      {loading && <Spinner label="Crunching your wardrobe" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && !data.sufficient_data && (
        <EmptyState
          icon={BarChart3}
          title="Not enough history yet"
          message="Mark a few outfits as worn and your personal patterns will appear here. We never show made-up numbers."
          action={<Link to="/studio" className="btn-primary">Find an outfit</Link>}
        />
      )}

      {data?.sufficient_data && (
        <div className="space-y-12">
          <div className="grid gap-10 lg:grid-cols-2">
            <Section title="Most-worn categories">
              <Bars rows={data.categories_most} />
            </Section>
            <div className="space-y-10">
              <Section title="Favourite shades">
                <ul className="flex flex-wrap gap-4">
                  {data.colours.map((c) => (
                    <li key={c.colour} className="flex items-center gap-2 text-sm">
                      <span className="h-6 w-6 rounded-full border border-ink/15" style={{ background: c.hex }} aria-hidden />
                      <span>{c.colour}</span>
                      <span className="text-ink-faint">{c.count}×</span>
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title="Least-worn categories">
                <Bars rows={data.categories_least} tone="bg-sage" />
              </Section>
            </div>
          </div>

          <Section title="Repeat stats">
            <div className="grid max-w-2xl grid-cols-3 gap-3">
              {[
                [data.total_worn, "outfits worn"],
                [data.repeat_stats.unique_outfits, "different combinations"],
                [`${data.repeat_stats.repeat_rate}%`, "were repeats"],
              ].map(([v, l]) => (
                <div key={l} className="card px-4 py-4">
                  <p className="font-serif text-3xl">{v}</p>
                  <p className="mt-1 text-xs text-ink-soft">{l}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Favourite pieces">
            <ItemStrip items={data.favourite_items} caption={(i) => `worn ${i.times_worn}×`} />
          </Section>

          <Section title="Underused pieces">
            {data.underused_items.length ? (
              <ItemStrip items={data.underused_items} caption={() => "not worn yet"} />
            ) : (
              <p className="text-sm text-ink-soft">Every piece has been worn at least once. Nicely done.</p>
            )}
          </Section>

          <Section title="Most frequent combinations">
            <div className="grid gap-5 md:grid-cols-3">
              {data.top_combinations.map(({ outfit, times_worn }) => (
                <div key={outfit.id} className="card p-4">
                  <OutfitCollage items={outfit.items} showLabels={false} />
                  <p className="mt-3 font-medium">{outfit.outfit_name}</p>
                  <p className="text-xs text-ink-soft">worn {times_worn}×</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Combinations to try">
            {data.untried.length ? (
              <div className="grid gap-5 md:grid-cols-3">
                {data.untried.map((o) => (
                  <div key={o.id} className="card flex flex-col p-4">
                    <OutfitCollage items={o.items} showLabels={false} />
                    <p className="mt-3 font-medium">{o.outfit_name}</p>
                    <p className="mt-1 flex-1 text-sm text-ink-soft">{o.styling_explanation}</p>
                    <button type="button" className="btn-secondary btn-sm mt-4" onClick={() => navigate("/studio")}>Try in Studio</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-soft">You’ve tried every combination we can suggest.</p>
            )}
          </Section>
        </div>
      )}
    </>
  );
}
