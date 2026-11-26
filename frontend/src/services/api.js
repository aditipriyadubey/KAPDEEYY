import { http } from "./http";

// The media endpoint returns protected, token-signed URLs. Relative URLs are
// resolved against the API host so <img> loads work in dev and in production.
const API_ORIGIN = (http.defaults.baseURL || "").replace(/\/api\/?$/, "");

function withImage(item) {
  if (!item) return item;
  const url = item.image_url;
  if (url && url.startsWith("/")) return { ...item, image_url: `${API_ORIGIN}${url}` };
  return item;
}

function withImages(items) {
  return (items || []).map(withImage);
}

function hydrateOutfit(outfit, wardrobeById) {
  const items = (outfit.items || []).map((item) => {
    const fresh = wardrobeById?.get(item.id);
    return withImage({ ...item, image_url: fresh?.image_url ?? item.image_url });
  });
  return { ...outfit, items };
}

// ── Profile ───────────────────────────────────────────────────────
export async function getProfile() {
  const res = await http.get("/profile");
  return res.data;
}

export async function updateProfile(patch) {
  const body = typeof patch === "string" ? { full_name: patch } : patch;
  const res = await http.put("/profile", body);
  return res.data;
}

// ── Wardrobe ──────────────────────────────────────────────────────
export async function getWardrobe() {
  const res = await http.get("/wardrobe");
  return withImages(res.data).map((item) => ({ ...item, times_worn: item.times_worn ?? 0 }));
}

export async function uploadWardrobeImage(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await http.post("/wardrobe/upload", form);
  return withImage(res.data);
}

export async function addWardrobeItem(payload) {
  const res = await http.post("/wardrobe", payload);
  return withImage({ ...res.data, times_worn: res.data.times_worn ?? 0 });
}

export async function analyzeWardrobeItem(id) {
  // Segmentation on CPU can take a while; allow more than the default timeout.
  const res = await http.post(`/wardrobe/${id}/analyze`, null, { timeout: 180000 });
  return { ...res.data, item: withImage(res.data.item) };
}

export async function updateWardrobeItem(id, patch) {
  const res = await http.patch(`/wardrobe/${id}`, patch);
  return withImage(res.data);
}

export async function deleteWardrobeItem(id) {
  const res = await http.delete(`/wardrobe/${id}`);
  return res.data;
}

export async function discardWardrobeUpload(path) {
  const res = await http.delete("/wardrobe/upload", { params: { path } });
  return res.data;
}

// ── Outfits ───────────────────────────────────────────────────────
/**
 * Ask the backend for real combinations from the user's wardrobe, then persist
 * each one via /outfits/register so Save / Mark worn have a real outfit id.
 * `seed` rotates equally-scored combinations, which is what makes Remix work.
 */
async function recommendationOutfits(occasion, seed = 0) {
  const params = {};
  if (occasion) params.occasion = occasion;
  if (seed) params.seed = seed;

  const [recs, wardrobe] = await Promise.all([
    http.get("/outfits/recommendations", { params }),
    getWardrobe(),
  ]);
  const byId = new Map(wardrobe.map((item) => [item.id, item]));
  const outfits = [];

  for (const rec of recs.data.outfits || []) {
    const items = rec.items || [];
    if (!items.length) continue;
    const payload = {
      outfit_name: (rec.name || `${String(rec.type || "outfit").replace(/_/g, " ")} combination`).slice(0, 120),
      occasion: rec.occasion || null,
      recommendation_score: rec.score ?? null,
      styling_explanation: rec.explanation || null,
      wardrobe_item_ids: items.map((item) => item.id),
    };
    const res = await http.post("/outfits/register", payload);
    outfits.push(hydrateOutfit(res.data, byId));
  }

  return { outfits, info: recs.data.algorithm_info || null };
}

export async function generateOutfits(occasion, seed = 0) {
  const { outfits, info } = await recommendationOutfits(occasion, seed);
  return { mode: "generate", occasion, outfits, info };
}

export async function remixOutfits(occasion, seed = 1) {
  const { outfits, info } = await recommendationOutfits(occasion, seed);
  return { mode: "remix", occasion, outfits, info };
}

export async function surpriseOutfits(seed = 0) {
  const { outfits, info } = await recommendationOutfits(null, seed);
  return { mode: "surprise", occasion: null, outfits, info };
}

export async function getSavedOutfits() {
  const [res, wardrobe] = await Promise.all([http.get("/outfits/saved"), getWardrobe()]);
  const byId = new Map(wardrobe.map((item) => [item.id, item]));
  return (res.data || []).map((outfit) => hydrateOutfit(outfit, byId));
}

export async function saveOutfit(id) {
  const res = await http.post(`/outfits/${id}/save`);
  return res.data;
}

export async function removeSavedOutfit(id) {
  const res = await http.delete(`/outfits/${id}/save`);
  return res.data;
}

export async function markNotForMe(id) {
  const res = await http.post(`/outfits/${id}/feedback`);
  return res.data;
}

export async function markWorn(id) {
  const res = await http.post(`/outfits/${id}/worn`);
  return res.data;
}

export async function getSavedIds() {
  const res = await http.get("/outfits/saved-ids");
  return res.data;
}

export async function getWornTodayIds() {
  const res = await http.get("/outfits/worn-today-ids");
  return res.data;
}

export async function getHistory() {
  const [res, wardrobe] = await Promise.all([http.get("/outfits/history"), getWardrobe()]);
  const byId = new Map(wardrobe.map((item) => [item.id, item]));
  return (res.data || []).map((entry) => ({
    ...entry,
    outfit: hydrateOutfit(entry.outfit, byId),
  }));
}

export async function getInsights() {
  // The endpoint returns item ids + wear counts. Join them with the wardrobe so
  // the insights cards can show the real garment images and names.
  const [res, wardrobe] = await Promise.all([http.get("/outfits/insights"), getWardrobe()]);
  const byId = new Map(wardrobe.map((item) => [item.id, item]));

  const hydrate = (rows) =>
    (rows || [])
      .map((row) => {
        const item = byId.get(row.id);
        return item ? { ...item, times_worn: row.times_worn ?? item.times_worn ?? 0 } : null;
      })
      .filter(Boolean);

  return {
    ...res.data,
    favourite_items: hydrate(res.data.favourite_items),
    underused_items: hydrate(res.data.underused_items),
  };
}

export async function getWardrobeStats() {
  // The dashboard cards read total_items / saved_outfits / worn_this_month.
  // Counts come from real data only (no placeholder numbers).
  const [wardrobe, savedIds] = await Promise.all([getWardrobe(), getSavedIds()]);
  let wornThisMonth = 0;
  try {
    const now = new Date();
    const history = await getHistory();
    wornThisMonth = (history || []).filter((entry) => {
      const worn = new Date(entry.worn_at);
      return worn.getFullYear() === now.getFullYear() && worn.getMonth() === now.getMonth();
    }).length;
  } catch {
    // Wear history is additive information; a failure must not blank the page.
  }
  return {
    total_items: wardrobe.length,
    saved_outfits: savedIds.length,
    worn_this_month: wornThisMonth,
  };
}

export async function getAiStatus() {
  const res = await http.get("/ai/status");
  return res.data;
}

export async function getTodayOutfit() {
  // Today shows the most recently generated saved outfit, or nothing.
  const saved = await getSavedOutfits();
  return saved[0] || null;
}

/**
 * Full Phase 3 flow: upload original -> persist metadata -> run segmentation.
 * Returns { item, segmentationError }. The item is always the real persisted row;
 * segmentationError is set (never swallowed) when the AI worker/segmentation fails.
 */
export async function createGarment({ file, metadata, onStage }) {
  const stage = (message) => {
    if (typeof onStage === "function") onStage(message);
  };

  stage("Uploading photo...");
  const uploaded = await uploadWardrobeImage(file);
  let created;
  try {
    stage("Saving item details...");
    created = await addWardrobeItem({ ...metadata, original_image_path: uploaded.path });
  } catch (err) {
    // Do not leave an orphaned original behind if the row could not be saved.
    try { await discardWardrobeUpload(uploaded.path); } catch {}
    throw err;
  }

  try {
    stage("Detecting the garment with RF-DETR...");
    const analysis = await analyzeWardrobeItem(created.id);
    stage("Finishing the cutout...");
    // AI suggestions are only used to fill fields the user left empty.
    const suggestions = analysis.suggestions || {};
    const patch = {};
    if (!metadata.item_name && suggestions.item_name) patch.item_name = suggestions.item_name;
    if (!metadata.subcategory && suggestions.subcategory) patch.subcategory = suggestions.subcategory;
    if (!metadata.colour && suggestions.colour) patch.colour = suggestions.colour;
    if (!metadata.style && suggestions.style) patch.style = suggestions.style;
    if (!metadata.category && suggestions.category) patch.category = suggestions.category;

    let item = analysis.item;
    if (Object.keys(patch).length) {
      try { item = await updateWardrobeItem(created.id, patch); } catch {}
    }
    return { item, segmentationError: null };
  } catch (err) {
    return { item: created, segmentationError: err?.response?.data?.detail || err?.message || "Segmentation failed" };
  }
}
