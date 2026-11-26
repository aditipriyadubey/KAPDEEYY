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

/** Neutral tile class used behind garment cut-outs. */
export function tintFor() {
  return "bg-canvas";
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
