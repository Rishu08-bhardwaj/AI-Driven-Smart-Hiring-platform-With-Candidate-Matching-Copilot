/**
 * Minimal duration-string → milliseconds parser.
 * Supports s, m, h, d (e.g. "15m", "7d", "1h"). Bare numbers are treated as ms.
 */
const UNITS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

export default function ms(input) {
  if (typeof input === 'number') return input;
  const match = /^(\d+)\s*(s|m|h|d)?$/.exec(String(input).trim());
  if (!match) throw new Error(`Invalid duration: ${input}`);
  const value = Number(match[1]);
  const unit = match[2];
  return unit ? value * UNITS[unit] : value;
}
