// ───────────────────────────────────────────────────────────────
// TEMPORARY MOCK DATA — Phase 1 only.
// Everything in src/mocks/ is deleted/replaced when real API calls
// (Phase 2+) are wired in via src/services/api.js.
// ───────────────────────────────────────────────────────────────

export const MOCK_USER = { id: "mock-user", full_name: "Aditi Sharma", email: "aditi@example.com" };

const item = (id, item_name, category, subcategory, colour, colour_hex, pattern, style, suggested_occasions, season) => ({
  id: `i${id}`, item_name, category, subcategory, colour, colour_hex, pattern, style,
  suggested_occasions, season, image_url: null, segmentation_status: "mock",
});

export const MOCK_ITEMS = [
  item(1, "Ivory Ribbed Tee", "Tops", "T-shirt", "Ivory", "#EFEADF", "Textured", "Minimal", ["College", "Casual"], "All-season"),
  item(2, "Blush Knit Top", "Tops", "Knit top", "Blush", "#E8C4CC", "Solid", "Romantic", ["Casual", "Dinner", "Party"], "Autumn"),
  item(3, "Black Fitted Tee", "Tops", "T-shirt", "Black", "#34302D", "Solid", "Street", ["College", "Casual", "Party"], "All-season"),
  item(4, "White Poplin Shirt", "Tops", "Shirt", "White", "#FBFAF7", "Solid", "Classic", ["College", "Dinner"], "All-season"),
  item(5, "Blue Striped Shirt", "Tops", "Shirt", "Light blue", "#C9D9E8", "Striped", "Classic", ["College", "Casual"], "Summer"),
  item(6, "Butter Cropped Tee", "Tops", "T-shirt", "Butter yellow", "#EFDD9A", "Solid", "Casual", ["Casual"], "Summer"),
  item(7, "Blue Straight-Leg Jeans", "Bottoms", "Jeans", "Blue", "#7F9AC0", "Solid", "Casual", ["College", "Casual"], "All-season"),
  item(8, "Dark Wash Jeans", "Bottoms", "Jeans", "Navy", "#3E4C6B", "Solid", "Classic", ["College", "Casual", "Dinner"], "All-season"),
  item(9, "Black Satin Midi Skirt", "Bottoms", "Skirt", "Black", "#2F2C2A", "Solid", "Smart", ["Dinner", "Party"], "All-season"),
  item(10, "Pleated Butter Skirt", "Bottoms", "Skirt", "Butter yellow", "#EADFA9", "Solid", "Romantic", ["Casual"], "Spring"),
  item(11, "Sage Cargo Pants", "Bottoms", "Trousers", "Sage", "#A8B89F", "Solid", "Street", ["College", "Casual"], "All-season"),
  item(12, "Rose Floral Sundress", "Dresses", "Sundress", "Rose", "#E8BFC8", "Floral", "Romantic", ["Casual", "Dinner"], "Summer"),
  item(13, "Lavender Slip Dress", "Dresses", "Slip dress", "Lavender", "#D2C8E6", "Solid", "Smart", ["Dinner", "Party"], "All-season"),
  item(14, "Camel Trench Coat", "Outerwear", "Trench coat", "Camel", "#C7A785", "Solid", "Classic", ["College", "Dinner"], "Autumn"),
  item(15, "Cream Knit Cardigan", "Outerwear", "Cardigan", "Cream", "#EEE5CF", "Textured", "Minimal", ["College", "Casual", "Dinner"], "Winter"),
  item(16, "Cropped Denim Jacket", "Outerwear", "Jacket", "Blue", "#7F9AC0", "Solid", "Casual", ["College", "Casual"], "Spring"),
  item(17, "White Leather Sneakers", "Shoes", "Sneakers", "White", "#FAF8F4", "Solid", "Minimal", ["College", "Casual"], "All-season"),
  item(18, "Tan Leather Loafers", "Shoes", "Loafers", "Tan", "#B98B62", "Solid", "Classic", ["College", "Casual", "Dinner"], "All-season"),
  item(19, "Black Block Heels", "Shoes", "Heels", "Black", "#2F2C2A", "Solid", "Smart", ["Dinner", "Party"], "All-season"),
  item(20, "Blush Ballet Flats", "Shoes", "Flats", "Blush", "#E8BFC8", "Solid", "Romantic", ["Casual", "Dinner"], "All-season"),
  item(21, "Brown Leather Tote", "Bags", "Tote", "Brown", "#8A5E44", "Solid", "Classic", ["College", "Casual"], "All-season"),
  item(22, "Black Mini Bag", "Bags", "Mini bag", "Black", "#2F2C2A", "Solid", "Smart", ["Dinner", "Party"], "All-season"),
  item(23, "Butter Shoulder Bag", "Bags", "Shoulder bag", "Butter yellow", "#EFDD9A", "Solid", "Casual", ["Casual", "Dinner"], "All-season"),
];

const outfit = (id, outfit_name, occasion, recommendation_score, styling_explanation, ids) => ({
  id, outfit_name, occasion, recommendation_score, styling_explanation, item_ids: ids.map((n) => `i${n}`),
});

export const MOCK_OUTFITS = [
  outfit("o1", "The Quiet Classic", "College", 92,
    "Ivory Ribbed Tee sets a calm base, blue straight-leg jeans keep it grounded, and white sneakers finish the look without competing.", [1, 7, 17, 21]),
  outfit("o2", "Library Day Classic", "College", 90,
    "A crisp white poplin shirt with blue jeans is an easy neutral pairing; the brown tote adds one warm note.", [4, 7, 17, 21]),
  outfit("o3", "Fresh Pairing", "College", 88,
    "A relaxed pairing: black tee with straight-leg jeans, softened by a cream cardigan. Only one piece does the talking.", [3, 7, 15, 17, 22]),
  outfit("o4", "Sundress & Loafers", "Casual", 86,
    "The rose sundress and tan loafers share a soft warm range, so the outfit feels considered rather than matched.", [12, 18]),
  outfit("o5", "Sunday Pleats", "Casual", 89,
    "Butter tones repeat across the tee, pleated skirt and bag, with blush flats breaking up the yellow.", [6, 10, 20, 23]),
  outfit("o6", "Weekend Denim", "Casual", 87,
    "A striped shirt under a denim jacket with dark jeans keeps blues in one family; white sneakers lighten it.", [5, 8, 16, 17]),
  outfit("o7", "Golden Hour Dinner", "Dinner", 91,
    "A lavender slip dress layered with a camel trench; black heels and a mini bag keep the palette tight.", [13, 14, 19, 22]),
  outfit("o8", "Soft Evening", "Dinner", 88,
    "Blush knit with dark jeans is dressed up by tan loafers and a butter shoulder bag.", [2, 8, 18, 23]),
  outfit("o9", "Poplin & Satin", "Dinner", 90,
    "White poplin shirt with a black satin midi skirt, balanced by blush flats and a cream cardigan.", [4, 9, 20, 15]),
  outfit("o10", "After Hours", "Party", 93,
    "Black fitted tee, satin midi skirt and block heels: a monochrome base with a mini bag for contrast in texture.", [3, 9, 19, 22]),
  outfit("o11", "Lavender Night", "Party", 86,
    "A lavender slip dress needs very little; black heels and a mini bag keep it sharp.", [13, 19, 22]),
  outfit("o12", "Blush & Black", "Party", 91,
    "Blush knit against a black satin skirt is a classic soft-versus-sharp pairing, finished with black heels.", [2, 9, 19, 22]),
];

// Wear history as [daysAgo, outfitId]. Dates are generated relative to today.
export const MOCK_HISTORY_SEED = [
  [1, "o2"], [2, "o5"], [4, "o2"], [5, "o3"], [6, "o7"],
  [8, "o1"], [9, "o2"], [11, "o9"], [13, "o10"], [15, "o1"], [18, "o6"],
];

// Saved outfits as [outfitId, daysAgoSaved].
export const MOCK_SAVED_SEED = [["o2", 6], ["o7", 9], ["o5", 13], ["o10", 20]];
