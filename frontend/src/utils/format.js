const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

export function formatShort(value) {
  const d = toDate(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatLong(value = new Date()) {
  return toDate(value).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function isSameDay(a, b) {
  const x = toDate(a);
  const y = toDate(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

/** Deterministic pastel tint class for an id so cards keep a stable background. */
const TINTS = ["bg-mint/40", "bg-coral-tint", "bg-pastel-lavender", "bg-pastel-pink", "bg-pastel-blue", "bg-pastel-yellow"];
export function tintFor(id) {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
