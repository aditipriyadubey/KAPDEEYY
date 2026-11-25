
// TEMPORARY in-memory mock of the FastAPI backend (Phase 1 only).
// Function names and return shapes mirror the planned REST contracts.
import {
  MOCK_HISTORY_SEED,
  MOCK_ITEMS,
  MOCK_OUTFITS,
  MOCK_SAVED_SEED,
  MOCK_USER,
} from "./data";
import { OCCASIONS } from "../utils/constants";
import { isSameDay } from "../utils/format";

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
};

// ── in-memory state ─────────────────────────────────────────────
let items = MOCK_ITEMS.map((i) => ({ ...i }));

let history = MOCK_HISTORY_SEED.map(([n, outfitId], idx) => ({
  id: `h${idx}`,
  outfit_id: outfitId,
  worn_at: daysAgo(n).toISOString(),
  occasion: MOCK_OUTFITS.find((o) => o.id === outfitId).occasion,
}));

let saved = MOCK_SAVED_SEED.map(([outfitId, n], idx) => ({
  id: `s${idx}`,
  outfit_id: outfitId,
  saved_at: daysAgo(n).toISOString(),
}));

const rejected = new Set();
let remixCounter = 0;
let nextId = 100;

// ── helpers ─────────────────────────────────────────────────────
const byId = (id) => items.find((i) => i.id === id);

const hydrate = (o) => ({
  ...o,
  items: o.item_ids.map(byId).filter(Boolean),
});

const comboKey = (o) => [...o.item_ids].sort().join("|");

function wornCounts() {
  const counts = {};

  history.forEach((h) => {
    const o = MOCK_OUTFITS.find((x) => x.id === h.outfit_id);

    o.item_ids.forEach((id) => {
      counts[id] = (counts[id] || 0) + 1;
    });
  });

  return counts;
}

function recentPenalty(o) {
  const cutoff = daysAgo(7).getTime();

  const n = history.filter(
    (h) =>
      h.outfit_id === o.id &&
      new Date(h.worn_at).getTime() >= cutoff
  ).length;

  return n * 8;
}

function ranked(pool) {
  return pool
    .filter((o) => !rejected.has(o.id))
    .map((o) => ({
      o,
      s: o.recommendation_score - recentPenalty(o),
    }))
    .sort((a, b) => b.s - a.s)
    .map(({ o }) => o);
}

function rotate(list, n) {
  if (!list.length) return list;

  const k = n % list.length;

  return [...list.slice(k), ...list.slice(0, k)];
}

// ── user / profile ──────────────────────────────────────────────
export async function getProfile() {
  await delay(150);
  return { ...MOCK_USER };
}

// ── wardrobe ────────────────────────────────────────────────────
export async function getWardrobe() {
  await delay();

  const counts = wornCounts();

  return items.map((i) => ({
    ...i,
    times_worn: counts[i.id] || 0,
  }));
}

export async function addWardrobeItem(payload) {
  await delay(250);

  const newItem = {
    id: `i${nextId++}`,
    item_name: payload.item_name,
    category: payload.category,
    subcategory: payload.subcategory || "",
    colour: payload.colour || "",
    colour_hex: payload.colour_hex || null,
    pattern: payload.pattern || "",
    style: payload.style || "",
    suggested_occasions: payload.suggested_occasions || [],
    season: payload.season || null,
    original_image_path: null,
    segmented_image_path: null,
    segmentation_status: "pending",
    times_worn: 0,
  };

  items.unshift(newItem);

  return { ...newItem };
}

export async function updateWardrobeItem(id, patch) {
  await delay(250);

  items = items.map((i) =>
    i.id === id ? { ...i, ...patch } : i
  );

  return byId(id);
}

export async function deleteWardrobeItem(id) {
  await delay(250);

  items = items.filter((i) => i.id !== id);

  return { ok: true };
}

export async function getWardrobeStats() {
  await delay(150);

  const unworn14 = (() => {
    const cutoff = daysAgo(14).getTime();
    const recent = new Set();

    history
      .filter((h) => new Date(h.worn_at).getTime() >= cutoff)
      .forEach((h) => {
        MOCK_OUTFITS.find((o) => o.id === h.outfit_id)
          .item_ids.forEach((id) => recent.add(id));
      });

    return items.filter((i) => !recent.has(i.id)).length;
  })();

  return {
    total_items: items.length,
    saved_outfits: saved.length,
    worn_this_month: history.filter(
      (h) =>
        new Date(h.worn_at).getMonth() === new Date().getMonth()
    ).length,
    unworn_two_weeks: unworn14,
  };
}

// ── outfit studio ───────────────────────────────────────────────
export async function generateOutfits(occasion) {
  await delay(500);

  const pool = ranked(
    MOCK_OUTFITS.filter((o) => o.occasion === occasion)
  );

  return {
    mode: "generate",
    occasion,
    outfits: pool.slice(0, 3).map(hydrate),
  };
}

export async function remixOutfits(occasion) {
  await delay(500);

  remixCounter += 1;

  const base = occasion
    ? MOCK_OUTFITS.filter((o) => o.occasion === occasion)
    : MOCK_OUTFITS;

  const pool = rotate(ranked(base), remixCounter);

  return {
    mode: "remix",
    occasion,
    outfits: pool.slice(0, 3).map(hydrate),
  };
}

export async function surpriseOutfits() {
  await delay(500);

  remixCounter += 1;

  const occs = rotate([...OCCASIONS], remixCounter).slice(0, 3);

  const picks = occs
    .map((occ) =>
      rotate(
        ranked(MOCK_OUTFITS.filter((o) => o.occasion === occ)),
        remixCounter
      )[0]
    )
    .filter(Boolean);

  return {
    mode: "surprise",
    occasion: null,
    outfits: picks.map(hydrate),
  };
}

export async function getTodayOutfit() {
  await delay(300);

  const pick = ranked(MOCK_OUTFITS)[0];

  return pick ? hydrate(pick) : null;
}

// ── saved / feedback / worn ─────────────────────────────────────
export async function getSavedOutfits() {
  await delay();

  return saved
    .map((s) => {
      const o = MOCK_OUTFITS.find((x) => x.id === s.outfit_id);

      const wornDates = history
        .filter((h) => h.outfit_id === o.id)
        .map((h) => h.worn_at)
        .sort()
        .reverse();

      return {
        ...hydrate(o),
        saved_id: s.id,
        saved_at: s.saved_at,
        worn: wornDates.length > 0,
        last_worn_at: wornDates[0] || null,
      };
    })
    .sort(
      (a, b) => new Date(b.saved_at) - new Date(a.saved_at)
    );
}

export async function saveOutfit(outfitId) {
  await delay(200);

  if (!saved.some((s) => s.outfit_id === outfitId)) {
    saved = [
      {
        id: `s${nextId++}`,
        outfit_id: outfitId,
        saved_at: new Date().toISOString(),
      },
      ...saved,
    ];
  }

  return { ok: true };
}

export async function removeSavedOutfit(outfitId) {
  await delay(200);

  saved = saved.filter((s) => s.outfit_id !== outfitId);

  return { ok: true };
}

export async function markNotForMe(outfitId) {
  await delay(200);

  rejected.add(outfitId);

  return { ok: true };
}

export async function markWorn(outfitId) {
  await delay(200);

  const o = MOCK_OUTFITS.find((x) => x.id === outfitId);

  const exists = history.some(
    (h) =>
      h.outfit_id === outfitId &&
      isSameDay(h.worn_at, new Date())
  );

  if (!exists) {
    history = [
      {
        id: `h${nextId++}`,
        outfit_id: outfitId,
        worn_at: new Date().toISOString(),
        occasion: o.occasion,
      },
      ...history,
    ];
  }

  return { ok: true, duplicate: exists };
}

export async function getSavedIds() {
  await delay(50);

  return saved.map((s) => s.outfit_id);
}

export async function getWornTodayIds() {
  await delay(50);

  return history
    .filter((h) => isSameDay(h.worn_at, new Date()))
    .map((h) => h.outfit_id);
}

// ── history ─────────────────────────────────────────────────────
export async function getHistory() {
  await delay();

  const windowStart = daysAgo(14).getTime();
  const recentStart = daysAgo(7).getTime();

  const entries = [...history]
    .sort(
      (a, b) => new Date(b.worn_at) - new Date(a.worn_at)
    )
    .map((h) => {
      const o = MOCK_OUTFITS.find((x) => x.id === h.outfit_id);
      const t = new Date(h.worn_at).getTime();

      const repeats = history.filter((x) => {
        const ox = MOCK_OUTFITS.find(
          (p) => p.id === x.outfit_id
        );

        return (
          comboKey(ox) === comboKey(o) &&
          new Date(x.worn_at).getTime() >= windowStart
        );
      }).length;

      return {
        ...h,
        outfit: hydrate(o),
        recently_worn: t >= recentStart,
        repeated: t >= windowStart && repeats > 1,
        repeat_count: repeats,
      };
    });

  return entries;
}

// ── insights ────────────────────────────────────────────────────
export async function getInsights() {
  await delay(450);

  if (history.length < 3) {
    return {
      sufficient_data: false,
      total_worn: history.length,
    };
  }

  const counts = wornCounts();
  const catCounts = {};
  const colourCounts = {};
  const comboCounts = {};

  history.forEach((h) => {
    const o = MOCK_OUTFITS.find((x) => x.id === h.outfit_id);

    comboCounts[o.id] = (comboCounts[o.id] || 0) + 1;

    o.item_ids.forEach((id) => {
      const it = byId(id);

      if (!it) return;

      catCounts[it.category] =
        (catCounts[it.category] || 0) + 1;

      const c = colourCounts[it.colour] || {
        colour: it.colour,
        hex: it.colour_hex,
        count: 0,
      };

      c.count += 1;
      colourCounts[it.colour] = c;
    });
  });

  const categories = Object.entries(catCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const withCount = items.map((i) => ({
    ...i,
    times_worn: counts[i.id] || 0,
  }));

  const tried = new Set(history.map((h) => h.outfit_id));

  const repeated = Object.entries(comboCounts).filter(
    ([, n]) => n > 1
  );

  return {
    sufficient_data: true,
    total_worn: history.length,
    categories_most: categories.slice(0, 7),
    categories_least: [...categories].reverse().slice(0, 3),
    colours: Object.values(colourCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    favourite_items: [...withCount]
      .sort((a, b) => b.times_worn - a.times_worn)
      .slice(0, 5),
    underused_items: withCount
      .filter((i) => i.times_worn === 0)
      .slice(0, 5),
    top_combinations: Object.entries(comboCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, n]) => ({
        outfit: hydrate(
          MOCK_OUTFITS.find((o) => o.id === id)
        ),
        times_worn: n,
      })),
    repeat_stats: {
      unique_outfits: tried.size,
      repeated_outfits: repeated.length,
      repeat_rate: Math.round(
        (1 - tried.size / history.length) * 100
      ),
    },
    untried: MOCK_OUTFITS
      .filter((o) => !tried.has(o.id))
      .slice(0, 3)
      .map(hydrate),
  };
}

// ── AI status ───────────────────────────────────────────────────
export async function getAiStatus() {
  await delay(100);

  return {
    mode: "mock",
    ollama: "not connected (mock)",
    segmentation: "not connected (mock)",
  };
}
