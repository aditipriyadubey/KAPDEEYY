import { Link, useNavigate } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import useAsync from "../hooks/useAsync";
import { getInsights } from "../services/api";
import GarmentImage from "../components/ui/GarmentImage";
import OutfitCollage from "../components/ui/OutfitCollage";
import { EmptyState, ErrorState, Spinner } from "../components/ui/Feedback";

function Section({ title, children, className = "" }) {
  return (
    <section className={className}>
      <h2 className="mb-4 font-display text-xl font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Bars({ rows, tone = "bg-[#F46A6A]" }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.category} className="grid grid-cols-[110px_1fr_32px] items-center gap-3 text-xs font-bold">
          <span className="truncate text-black/60">{r.category}</span>
          <span className="h-3 overflow-hidden rounded-full bg-gray-100" role="presentation">
            <span className={`block h-full rounded-full ${tone} transition-all duration-500`} style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-ink">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

function ItemStrip({ items, caption }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {items.map((i) => (
        <div key={i.id} className="rounded-2xl bg-white border border-gray-100 p-2.5 shadow-2xs">
          <GarmentImage item={i} className="aspect-[4/5] rounded-xl" />
          <p className="mt-2 truncate text-xs font-bold text-ink">{i.item_name}</p>
          <p className="text-[10px] text-black/45 font-semibold">{caption(i)}</p>
        </div>
      ))}
    </div>
  );
}

export default function Insights() {
  const { data, loading, error, reload } = useAsync(getInsights);
  const navigate = useNavigate();

  return (
    <div className="space-y-8 pb-10">
      <div className="pb-2 border-b border-gray-100">
        <h1 className="font-display text-3xl font-extrabold text-ink">Wardrobe Insights 📊</h1>
        <p className="text-sm font-semibold text-black/45 mt-0.5">Analyze what you actually wear and discover untried combinations.</p>
      </div>

      {loading && <Spinner label="Analyzing your closet data" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && !data.sufficient_data && (
        <EmptyState
          icon={BarChart3}
          title="Not enough history yet"
          message="Mark a few outfits as worn and your personal patterns will appear here."
          action={<Link to="/studio" className="btn-coral-save px-6 py-2.5 text-sm inline-block">Find an outfit</Link>}
        />
      )}

      {data?.sufficient_data && (
        <div className="space-y-10">
          {/* Quick Repeat Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              [data.total_worn, "Total Outfits Worn", "bg-[#D7F0DC]", "text-[#215E39]"],
              [data.repeat_stats.unique_outfits, "Unique Combinations", "bg-[#E5F4FC]", "text-[#2B8BB0]"],
              [`${data.repeat_stats.repeat_rate}%`, "Repeat Rate", "bg-[#FFEAEF]", "text-[#F46A6A]"],
            ].map(([v, l, bg, tc]) => (
              <div key={l} className={`rounded-3xl ${bg} p-6 text-center shadow-xs`}>
                <p className={`font-display text-4xl font-black ${tc}`}>{v}</p>
                <p className="mt-1 text-xs font-bold text-black/60">{l}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Section title="Most-Worn Categories">
              <div className="rounded-3xl bg-white border border-gray-100 p-6 shadow-xs">
                <Bars rows={data.categories_most} />
              </div>
            </Section>

            <Section title="Least-Worn Categories">
              <div className="rounded-3xl bg-white border border-gray-100 p-6 shadow-xs">
                <Bars rows={data.categories_least} tone="bg-[#215E39]" />
              </div>
            </Section>
          </div>

          {/* Favourite Colours */}
          <Section title="Favourite Colors in Wardrobe">
            <div className="rounded-3xl bg-white border border-gray-100 p-6 shadow-xs">
              <ul className="flex flex-wrap gap-5">
                {data.colours.map((c) => (
                  <li key={c.colour} className="flex items-center gap-2.5 text-xs font-bold text-ink">
                    <span className="h-6 w-6 rounded-full border border-black/10 shadow-xs" style={{ background: c.hex }} />
                    <span>{c.colour}</span>
                    <span className="text-black/40">({c.count}×)</span>
                  </li>
                ))}
              </ul>
            </div>
          </Section>

          {/* Favourite Pieces */}
          <Section title="Most-Worn Pieces">
            <ItemStrip items={data.favourite_items} caption={(i) => `worn ${i.times_worn}×`} />
          </Section>

          {/* Combinations to try */}
          <Section title="Combinations to Try Next">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {data.untried.slice(0, 3).map((o) => (
                <div key={o.id} className="rounded-3xl bg-white border border-gray-100 p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <OutfitCollage items={o.items} showLabels={false} />
                    <p className="mt-3 font-display text-base font-bold text-ink">{o.outfit_name}</p>
                    <p className="mt-1 text-xs text-black/55 leading-relaxed">{o.styling_explanation}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/studio")}
                    className="btn-coral-save w-full py-2.5 text-xs mt-4"
                  >
                    Try in Studio
                  </button>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
