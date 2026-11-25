
import { authConfigured } from "./supabase";
import { http } from "./http";
import * as mockApi from "../mocks/mockApi";
import { MOCK_USER } from "../mocks/data";

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

  const res = await http.get("/wardrobe");
  return res.data.map((item) => ({
    ...item,
    times_worn: item.times_worn ?? 0,
  }));
}

export async function addWardrobeItem(payload) {
  if (!authConfigured) return mockApi.addWardrobeItem(payload);

  const res = await http.post("/wardrobe", payload);
  return { ...res.data, times_worn: 0 };
}

export async function updateWardrobeItem(id, patch) {
  if (!authConfigured) return mockApi.updateWardrobeItem(id, patch);

  const res = await http.patch(`/wardrobe/${id}`, patch);
  return { ...res.data, times_worn: 0 };
}

export async function deleteWardrobeItem(id) {
  if (!authConfigured) return mockApi.deleteWardrobeItem(id);

  const res = await http.delete(`/wardrobe/${id}`);
  return res.data;
}

// Outfit generation using real wardrobe items
const normalize = (value) =>
  String(value || "").trim().toLowerCase();

async function generateAndRegister(generatorPromise) {
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
      const category = normalize(demoItem.category);
      const name = normalize(demoItem.item_name);
      const subcategory = normalize(demoItem.subcategory);

      // First: exact item name and category
      let match = wardrobe.find(
        (item) =>
          !usedIds.has(item.id) &&
          normalize(item.category) === category &&
          normalize(item.item_name) === name
      );

      // Second: matching subcategory and category
      if (!match && subcategory) {
        match = wardrobe.find(
          (item) =>
            !usedIds.has(item.id) &&
            normalize(item.category) === category &&
            normalize(item.subcategory) === subcategory
        );
      }

      // Third: matching category only
      if (!match) {
        match = wardrobe.find(
          (item) =>
            !usedIds.has(item.id) &&
            normalize(item.category) === category
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

export async function generateOutfits(occasion) {
  if (!authConfigured) return mockApi.generateOutfits(occasion);

  return generateAndRegister(mockApi.generateOutfits(occasion));
}

export async function remixOutfits(occasion) {
  if (!authConfigured) return mockApi.remixOutfits(occasion);

  return generateAndRegister(mockApi.remixOutfits(occasion));
}

export async function surpriseOutfits() {
  if (!authConfigured) return mockApi.surpriseOutfits();

  return generateAndRegister(mockApi.surpriseOutfits());
}

export async function getTodayOutfit() {
  return mockApi.getTodayOutfit();
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
