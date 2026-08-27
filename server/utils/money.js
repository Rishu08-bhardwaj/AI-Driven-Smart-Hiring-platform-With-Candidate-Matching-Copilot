/** Round to 2 decimal places, avoiding binary float drift. */
export function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/** Coerce to a non-negative 2-dp number (0 for invalid). */
export function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return round2(v);
}
