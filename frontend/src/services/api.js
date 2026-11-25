import { authConfigured } from "./supabase";
import { errorMessage, http } from "./http";
import * as mockApi from "../mocks/mockApi";
import { MOCK_USER } from "../mocks/data";

// Clothing categories match the Roboflow annotation classes.
export const CATEGORIES = ["Tops", "Bottoms", "Dresses", "Outerwear", "Shoes", "Bags", "Other"];

// Occasions are separate from categories.
export const OCCASIONS = ["College", "Casual", "Dinner", "Party"];

// Style preferences - must match the backend schema values
export const STYLES = ["Minimal", "Classic", "Casual", "Smart", "Street", "Romantic"];

// Occasions are separate from categories.
export const SEASONS = ["Spring", "Summer", "Autumn", "Winter", "All-season"];

// PATTERNS = ["Solid", "Striped", "Floral", "Checked", "Printed", "Textured"];

// Profile
export async function getProfile() {
  if (!authConfigured) return mockApi.getProfile();

  const res = await http.get("/profile");
  return res.data;
}

export async function updateProfile(patch) {
  const body = typeof patch === "string" ? { full_name: patch } : patch;

  if (!authConfigured) {
    Object.assign(MOCK_USER, body);
    return { ...MOCK_USER };
  }

  const res = await http.put("/profile", body);
  return res.data;
}

// Wardrobe
export async function getWardrobe() {
  if (!authConfigured) return mockApi.getWardrobe();

  try {
    const res = await http.get("/wardrobe");
    return res.data.map((item) => ({
      ...item,
      times_worn: item.times_worn ?? 0,
    }));
  } catch (err) {
    throw new Error(errorMessage(err, "Couldn't load your closet."));
  }
}

// `imageFile` is optional so demo mode keeps working; real items upload it to
// private Storage first and then save the returned path with the metadata.
export async function addWardrobeItem(payload, imageFile) {
  if (!authConfigured) return mockApi.addWardrobeItem(payload);

  let original_image_path = null;

  try {
    if (imageFile) {
      const form = new FormData();
      form.append("file", imageFile);
      const uploaded = await http.post("/wardrobe/upload", form);
      original_image_path = uploaded.data.path;
    }

    const res = await http.post("/wardrobe", {
      ...payload,
      original_image_path,
    });

    return { ...res.data, times_worn: 0 };
  } catch (err) {
    // Do not leave the uploaded file behind when the metadata could not be saved.
    if (original_image_path) {
      try {
        await http.delete("/wardrobe/upload", {
          params: { path: original_image_path },
        });
      } catch {
        // Keep surfacing the original failure; rollback is best effort.
      }
    }

    throw new Error(errorMessage(err, "Couldn't save this clothing item."));
  }
}

// AI analysis can take up to a minute on CPU. The backend allows the worker
// 120s, so give the browser request enough room to receive the real result.
export async function analyzeWardrobeItem(id) {
  if (!authConfigured) {
    const error = new Error("AI analysis requires a signed-in wardrobe.");
    error.status = 503;
    throw error;
  }

  try {
    const res = await http.post(`/wardrobe/${id}/analyze`, null, {
      timeout: 180000,
    });
    return res.data;
  } catch (err) {
    const error = new Error(
      errorMessage(err, "Couldn't analyze this clothing item.")
    );
    error.status = err?.response?.status;
    throw error;
  }
}

export async function updateWardrobeItem(id, patch) {
  if (!authConfigured) return mockApi.updateWardrobeItem(id, patch);

  try {
    const res = await http.patch(`/wardrobe/${id}`, patch);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, "Couldn't save changes."));
  }
}

export async function deleteWardrobeItem(id) {
  if (!authConfigured) return mockApi.deleteWardrobeItem(id);

  try {
    const res = await http.delete(`/wardrobe/${id}`);
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, "Couldn't delete that item."));
  }
}

// ── Outfit generation ────────────────────────────────────────────────

// Core generator that works with both mock and real data
async function generateAndRegister(generatorPromise, occasion) {
  const result = await generatorPromise;

  // Keep demo mode unchanged
  if (!authConfigured) return result;

  // Fetch the user's actual wardrobe
  const wardrobe = await getWardrobe();
  const registeredOutfits = [];

  for (const template of result.outfits || []) {
    const usedIds = new Set();
    const matchedItems = [];

    for (const demoItem of template.items || []) {
      const category = (demoItem.category || "").trim().toLowerCase();
      const name = (demoItem.item_name || "").trim().toLowerCase();
      const subcategory = (demoItem.subcategory || "").trim().toLowerCase();

      // First: exact item name and category
      let match = wardrobe.find(
        (item) =>
          !usedIds.has(item.id) &&
          (item.category || "").trim().toLowerCase() === category &&
          (item.item_name || "").trim().toLowerCase() === name
      );

      // Second: matching subcategory and category
      if (!match && subcategory) {
        match = wardrobe.find(
          (item) =>
            !usedIds.has(item.id) &&
            (item.category || "").trim().toLowerCase() === category &&
            (item.subcategory || "").trim().toLowerCase() === subcategory
        );
      }

      // Third: matching category only
      if (!match) {
        match = wardrobe.find(
          (item) =>
            !usedIds.has(item.id) && (item.category || "").trim().toLowerCase() === category
        );
      }

      // Skip incomplete outfits
      if (!match) {
        matchedItems.length = 0;
        break;
      }

      matchedItems.push(match);
      usedIds.add(match.id);
    }

    if (
      matchedItems.length === 0 ||
      matchedItems.length !== (template.items || []).length
    ) {
      continue;
    }

    // Register outfit using actual Supabase wardrobe IDs
    const payload = {
      outfit_name: template.outfit_name,
      occasion: template.occasion,
      recommendation_score: template.recommendation_score,
      styling_explanation: template.styling_explanation,
      wardrobe_item_ids: matchedItems.map((item) => item.id),
    };

    const response = await http.post("/outfits/register", payload);
    registeredOutfits.push(response.data);
  }

  return {
    ...result,
    outfits: registeredOutfits,
  };
}

// Generate outfits using real wardrobe
export async function generateOutfits(occasion) {
  if (!authConfigured) return mockApi.generateOutfits(occasion);

  return generateAndRegister(mockApi.generateOutfits(occasion), occasion);
}

// Remix outfits using real wardrobe
export async function remixOutfits(occasion) {
  if (!authConfigured) return mockApi.remixOutfits(occasion);

  return generateAndRegister(mockApi.remixOutfits(occasion), occasion);
}

// Surprise outfits using real wardrobe
export async function surpriseOutfits() {
  if (!authConfigured) return mockApi.surpriseOutfits();

  return generateAndRegister(mockApi.surpriseOutfits(), null);
}

// Optional: Direct recommendations endpoint
export async function getRecommendations(occasion, style, includeAccessories = true) {
  if (!authConfigured) return mockApi.getRecommendations();

  try {
    const res = await http.get("/outfits/recommendations", {
      params: {
        occasion,
        style,
        include_accessories: includeAccessories,
      },
    });
    return res.data;
  } catch (err) {
    throw new Error(errorMessage(err, "Couldn't get recommendations."));
  }
}

// Saved Outfits
export async function getSavedOutfits() {
  if (!authConfigured) return mockApi.getSavedOutfits();

  const res = await http.get("/outfits/saved");
  return res.data;
}

export async function saveOutfit(id) {
  if (!authConfigured) return mockApi.saveOutfit(id);

  const res = await http.post(`/outfits/${id}/save`);
  return res.data;
}

export async function removeSavedOutfit(id) {
  if (!authConfigured) return mockApi.removeSavedOutfit(id);

  const res = await http.delete(`/outfits/${id}/save`);
  return res.data;
}

// Outfit feedback and wear tracking
export async function markNotForMe(id) {
  if (!authConfigured) return mockApi.markNotForMe(id);

  const res = await http.post(`/outfits/${id}/feedback`);
  return res.data;
}

export async function markWorn(id) {
  if (!authConfigured) return mockApi.markWorn(id);

  const res = await http.post(`/outfits/${id}/worn`);
  return res.data;
}

// Outfit IDs
export async function getSavedIds() {
  if (!authConfigured) return mockApi.getSavedIds();

  const res = await http.get("/outfits/saved-ids");
  return res.data;
}

export async function getWornTodayIds() {
  if (!authConfigured) return mockApi.getWornTodayIds();

  const res = await http.get("/outfits/worn-today-ids");
  return res.data;
}

// Outfit history
export async function getHistory() {
  if (!authConfigured) return mockApi.getHistory();

  const res = await http.get("/outfits/history");
  return res.data;
}

// Remaining demo-mode functions
export async function getWardrobeStats() {
  return mockApi.getWardrobeStats();
}

export async function getInsights() {
  return mockApi.getInsights();
}

export async function getAiStatus() {
  return mockApi.getAiStatus();
}

export async function getTodayOutfit() {
  return mockApi.getTodayOutfit();
}